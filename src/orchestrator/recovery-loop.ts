import { Repository } from '../db/repository';
import {
  RecoveryCase,
  CaseStatus,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
  PaymentMethod,
  ApprovedAction,
  Decision,
} from '../domain/types';
import { validateTransition, isOpenState } from '../domain/state-machine';
import { ContextBuilder } from '../context/context-builder';
import { DecisionService } from '../agent/decision-service';
import { PolicyEngine } from '../policy/policy-engine';
import { ToolExecutor } from '../tools/tool-executor';
import { HumanReviewActionRequest } from '../domain/schemas';
import { PaymentTruthResolver } from '../truth/payment-truth-resolver';
import { PreFlightGuard } from './pre-flight-guard';
import { CommunicationLedgerManager } from '../communication/communication-ledger';

export interface RecoveryLoopResult {
  case: RecoveryCase;
  decision?: any;
  policyCheck?: any;
  toolResult?: any;
  transitionedTo: CaseStatus;
  message: string;
}

export class RecoveryControlLoop {
  private decisionService: DecisionService;
  private policyEngine: PolicyEngine;
  private truthResolver: PaymentTruthResolver;
  private preFlightGuard: PreFlightGuard;
  private commLedger: CommunicationLedgerManager;

  constructor(
    private repository: Repository,
    private toolExecutor: ToolExecutor,
    private policyConfig: MerchantPolicyConfig = DEFAULT_MERCHANT_POLICY,
    decisionService?: DecisionService,
    truthResolver?: PaymentTruthResolver
  ) {
    this.decisionService = decisionService || new DecisionService();
    this.policyEngine = new PolicyEngine(policyConfig);
    this.truthResolver =
      truthResolver ||
      new PaymentTruthResolver(repository, toolExecutor.getPaymentProvider());
    this.preFlightGuard = new PreFlightGuard(repository, this.truthResolver);
    this.commLedger = new CommunicationLedgerManager(repository);
  }

  getTruthResolver(): PaymentTruthResolver {
    return this.truthResolver;
  }

  getPreFlightGuard(): PreFlightGuard {
    return this.preFlightGuard;
  }

  getCommLedger(): CommunicationLedgerManager {
    return this.commLedger;
  }

  private getEffectivePolicy(): MerchantPolicyConfig {
    if (this.repository && typeof this.repository.getMerchantSettings === 'function') {
      const saved = this.repository.getMerchantSettings('merchant_default');
      if (saved) {
        return { ...this.policyConfig, ...saved };
      }
    }
    return this.policyConfig;
  }

  /**
   * Main entry point when a payment failure event is ingested.
   */
  async handlePaymentFailure(input: {
    eventId: string;
    paymentId: string;
    orderId?: string | null;
    paymentLinkId?: string | null;
    amount: number;
    currency: string;
    failureCode: string;
    failureDescription: string;
    paymentMethod: PaymentMethod;
    customerContext?: Record<string, any>;
    consentStatus?: 'CONSENTED' | 'OPTED_OUT' | 'UNKNOWN';
  }): Promise<RecoveryLoopResult> {
    const now = new Date().toISOString();
    const effectivePolicy = this.getEffectivePolicy();
    const policyEngine = new PolicyEngine(effectivePolicy);

    // 1. Resolve or create the commercial Payment Obligation
    const orderId = input.orderId || `order_${input.paymentId}`;
    const obligation = this.repository.getOrCreateObligation(
      orderId,
      input.amount,
      input.currency || 'INR'
    );

    // 2. Check if case already exists
    let c = this.repository.getCaseByPaymentId(input.paymentId);

    if (!c) {
      const caseId = `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      c = {
        id: caseId,
        merchant_id: 'merchant_default',
        obligation_id: obligation.id,
        event_id: input.eventId,
        payment_id: input.paymentId,
        order_id: input.orderId || null,
        payment_link_id: input.paymentLinkId || null,
        recovery_url: null,
        amount: input.amount,
        currency: input.currency || 'INR',
        failure_code: input.failureCode || 'GATEWAY_ERROR',
        failure_description: input.failureDescription || 'Payment attempt failed',
        payment_method: input.paymentMethod || 'card',
        customer_context: input.customerContext || {},
        attempt_count: 0,
        status: 'FAILED',
        recoverability_score: 0.5,
        expected_recovery_value: Math.round(input.amount * 0.5),
        consent_status: input.consentStatus || 'CONSENTED',
        policy_version: effectivePolicy.policy_version,
        created_at: now,
        updated_at: now,
      };

      this.repository.createCase(c);

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: obligation.id,
        event_type: 'CASE_CREATED',
        actor: 'SYSTEM',
        source: 'RecoveryControlLoop.handlePaymentFailure',
        metadata: {
          amount: c.amount,
          failure_code: c.failure_code,
          payment_method: c.payment_method,
          obligation_id: obligation.id,
        },
        timestamp: now,
      });
    } else if (!c.obligation_id) {
      c.obligation_id = obligation.id;
      this.repository.updateCase(c);
    }

    // Invariant: If payment obligation or case is already SATISFIED / RECOVERED, stop immediately
    if (obligation.status === 'SATISFIED' || c.status === 'RECOVERED') {
      if (c.status !== 'RECOVERED' && isOpenState(c.status)) {
        validateTransition(c.id, c.status, 'RECOVERED');
        c.status = 'RECOVERED';
        this.repository.updateCase(c);
      }

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: obligation.id,
        event_type: 'PAYMENT_SUCCESS_INTERRUPT',
        actor: 'SYSTEM',
        source: 'RecoveryControlLoop',
        metadata: {
          message: 'Payment obligation already satisfied. Aborting recovery attempt.',
          obligation_status: obligation.status,
        },
        timestamp: now,
      });

      return {
        case: c,
        transitionedTo: 'RECOVERED',
        message: 'Commercial obligation already satisfied; recovery action halted.',
      };
    }

    // 3. Assemble context & diagnosis
    validateTransition(c.id, c.status, 'ANALYZING');
    c.status = 'ANALYZING';
    this.repository.updateCase(c);

    const context = ContextBuilder.buildContext(c, effectivePolicy);
    c.recoverability_score = context.recoverability_score;
    c.expected_recovery_value = context.expected_recovery_value;
    this.repository.updateCase(c);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      obligation_id: obligation.id,
      event_type: 'CONTEXT_BUILT',
      actor: 'SYSTEM',
      source: 'ContextBuilder',
      metadata: {
        score: context.recoverability_score,
        expected_value: context.expected_recovery_value,
      },
      timestamp: new Date().toISOString(),
    });

    // 4. Tiered Decision Routing (Fast Path for deterministic criteria)
    validateTransition(c.id, c.status, 'DECISION_READY');
    c.status = 'DECISION_READY';
    this.repository.updateCase(c);

    let decision: Decision;
    const isOptedOut = c.consent_status === 'OPTED_OUT';
    const isRetryLimitReached =
      c.attempt_count >= effectivePolicy.max_retry_attempts;

    if (isOptedOut) {
      // Fast path: Customer explicitly opted out
      decision = {
        id: `dec_fast_${Date.now()}`,
        case_id: c.id,
        model_provider: 'fast_path_policy',
        model_version: 'deterministic-v2',
        prompt_version: 'none',
        diagnosis: 'Customer opted out of communications.',
        failure_category: context.failure_category,
        recoverability: 0.0,
        expected_recovery_value: 0,
        evidence: ['Customer consent status: OPTED_OUT'],
        recommended_action: 'STOP',
        timing: 'IMMEDIATE',
        confidence: 1.0,
        reason: 'Customer opted out of recovery messages.',
        customer_friction: 'HIGH',
        expected_value: 0,
        rationale: 'Customer opt-out requires immediate halt.',
        created_at: new Date().toISOString(),
      };
    } else if (isRetryLimitReached) {
      // Fast path: Maximum retry attempts exhausted
      decision = {
        id: `dec_fast_${Date.now()}`,
        case_id: c.id,
        model_provider: 'fast_path_policy',
        model_version: 'deterministic-v2',
        prompt_version: 'none',
        diagnosis: `Max retry interventions reached (${c.attempt_count}/${effectivePolicy.max_retry_attempts}).`,
        failure_category: context.failure_category,
        recoverability: 0.1,
        expected_recovery_value: 0,
        evidence: [`Attempt count ${c.attempt_count} exceeds limit`],
        recommended_action: 'STOP',
        timing: 'IMMEDIATE',
        confidence: 0.99,
        reason: 'Maximum allowed retry interventions exhausted.',
        customer_friction: 'LOW',
        expected_value: 0,
        rationale: 'Retry cap reached per merchant policy.',
        created_at: new Date().toISOString(),
      };
    } else {
      // Normal path: AI structured diagnosis and recommendation
      decision = await this.decisionService.decide(context);
    }

    this.repository.createDecision(decision);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      obligation_id: obligation.id,
      event_type: 'AI_DECISION_PRODUCED',
      actor: 'LLM',
      source: `DecisionService.${decision.model_provider}`,
      metadata: {
        diagnosis: decision.diagnosis,
        recommended_action: decision.recommended_action,
        confidence: decision.confidence,
        reason: decision.reason,
        customer_friction: decision.customer_friction,
      },
      timestamp: new Date().toISOString(),
    });

    // 5. Deterministic Policy Check with Obligation Awareness
    validateTransition(c.id, c.status, 'POLICY_CHECK');
    c.status = 'POLICY_CHECK';
    this.repository.updateCase(c);

    const policyCheck = policyEngine.evaluate(c, decision, {
      obligationStatus: obligation.status,
    });
    this.repository.createPolicyCheck(policyCheck);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      obligation_id: obligation.id,
      event_type: 'POLICY_EVALUATED',
      actor: 'POLICY',
      source: 'PolicyEngine',
      metadata: {
        result: policyCheck.policy_result,
        allowed: policyCheck.allowed,
        reasons: policyCheck.reasons,
      },
      timestamp: new Date().toISOString(),
    });

    // 6. Execution based on policy check
    if (policyCheck.policy_result === 'ALLOW') {
      if (decision.recommended_action === 'STOP') {
        validateTransition(c.id, c.status, 'STOPPED');
        c.status = 'STOPPED';
        this.repository.updateCase(c);

        const stopToolRes = await this.toolExecutor.execute('STOP', c, policyCheck);
        return {
          case: c,
          decision,
          policyCheck,
          toolResult: stopToolRes,
          transitionedTo: 'STOPPED',
          message: 'Case stopped by policy decision.',
        };
      }

      // PRE-FLIGHT CHECK
      const preFlight = await this.preFlightGuard.evaluate(
        c,
        decision.recommended_action,
        policyCheck,
        effectivePolicy
      );

      if (!preFlight.passed) {
        validateTransition(c.id, c.status, 'STOPPED');
        c.status = 'STOPPED';
        this.repository.updateCase(c);

        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
          obligation_id: obligation.id,
          event_type: 'CASE_CLOSED',
          actor: 'POLICY',
          source: 'PreFlightGuard',
          metadata: { block_reason: preFlight.blockReason, checks: preFlight.checks },
          timestamp: new Date().toISOString(),
        });

        return {
          case: c,
          decision,
          policyCheck,
          transitionedTo: 'STOPPED',
          message: `Pre-flight safety check blocked execution: ${preFlight.blockReason}`,
        };
      }

      // Customer Communication Safety Guard
      const isCustomerContact =
        decision.recommended_action === 'CREATE_OR_REUSE_PAYMENT_LINK' ||
        decision.recommended_action === 'SEND_RECOVERY_LINK' ||
        decision.recommended_action === 'OFFER_ALTERNATE_PAYMENT_METHOD' ||
        decision.recommended_action === 'OFFER_ALTERNATE_METHOD';

      if (isCustomerContact) {
        const commCheck = this.commLedger.canContactCustomer(
          c,
          'PAYMENT_LINK_PAGE',
          effectivePolicy
        );

        if (!commCheck.canContact) {
          // Record suppressed attempt in communication ledger
          this.commLedger.recordAttempt(
            c.id,
            obligation.id,
            c.customer_context?.customer_id,
            'PAYMENT_LINK_PAGE',
            'PAYMENT_RECOVERY_STANDARD',
            'SUPPRESSED',
            commCheck.reason
          );

          // Log audit trail event
          this.repository.createAuditEvent({
            id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            case_id: c.id,
            obligation_id: obligation.id,
            event_type: 'COMMUNICATION_SUPPRESSED',
            actor: 'POLICY',
            source: 'CommunicationLedgerManager',
            metadata: {
              reason: commCheck.reason,
              contact_count: commCheck.contactCount,
              remaining_cooldown_seconds: commCheck.remainingCooldownSeconds,
              intended_action: decision.recommended_action,
            },
            timestamp: new Date().toISOString(),
          });

          // Check if suppressed due to active cooldown -> Enforce WAIT
          if (commCheck.remainingCooldownSeconds && commCheck.remainingCooldownSeconds > 0) {
            validateTransition(c.id, c.status, 'ACTION_PENDING');
            c.status = 'ACTION_PENDING';
            this.repository.updateCase(c);

            validateTransition(c.id, c.status, 'ACTION_EXECUTED');
            c.status = 'ACTION_EXECUTED';
            this.repository.updateCase(c);

            const waitToolRes = await this.toolExecutor.execute('WAIT', c, policyCheck);

            validateTransition(c.id, c.status, 'OUTCOME_MONITORED');
            c.status = 'OUTCOME_MONITORED';
            this.repository.updateCase(c);

            return {
              case: c,
              decision,
              policyCheck,
              toolResult: waitToolRes,
              transitionedTo: 'OUTCOME_MONITORED',
              message: `Communication suppressed due to active cooldown (${commCheck.remainingCooldownSeconds}s remaining). Executed WAIT.`,
            };
          }

          // Check if suppressed due to contact limit or opt-out -> BLOCK or ESCALATE
          const highValueThreshold =
            effectivePolicy.autonomous_limit_inr ||
            effectivePolicy.autonomous_amount_threshold ||
            (effectivePolicy as any).autonomous_recovery_limit ||
            500000;

          if (c.amount > highValueThreshold) {
            // High-value cases escalate for human oversight
            validateTransition(c.id, c.status, 'HUMAN_REVIEW');
            c.status = 'HUMAN_REVIEW';
            this.repository.updateCase(c);

            const escToolRes = await this.toolExecutor.execute('ESCALATE', c, {
              ...policyCheck,
              allowed: true,
              policy_result: 'ALLOW',
            });

            this.repository.createAuditEvent({
              id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              case_id: c.id,
              obligation_id: obligation.id,
              event_type: 'HUMAN_REVIEW_TRIGGERED',
              actor: 'POLICY',
              source: 'CommunicationLedgerManager',
              metadata: {
                reason: commCheck.reason,
                amount: c.amount,
                threshold: highValueThreshold,
              },
              timestamp: new Date().toISOString(),
            });

            return {
              case: c,
              decision,
              policyCheck,
              toolResult: escToolRes,
              transitionedTo: 'HUMAN_REVIEW',
              message: `Contact limit reached for high-value case (₹${(c.amount / 100).toFixed(2)}). Escalated for human review.`,
            };
          } else {
            // Standard cases block / stop
            validateTransition(c.id, c.status, 'STOPPED');
            c.status = 'STOPPED';
            this.repository.updateCase(c);

            const stopToolRes = await this.toolExecutor.execute('STOP', c, policyCheck);

            return {
              case: c,
              decision,
              policyCheck,
              toolResult: stopToolRes,
              transitionedTo: 'STOPPED',
              message: `Contact limit reached (${commCheck.contactCount}). Case stopped by policy.`,
            };
          }
        }
      }

      // Execute approved action with atomic leasing & deterministic idempotency
      validateTransition(c.id, c.status, 'ACTION_PENDING');
      c.status = 'ACTION_PENDING';
      this.repository.updateCase(c);

      validateTransition(c.id, c.status, 'ACTION_EXECUTED');
      c.status = 'ACTION_EXECUTED';
      c.attempt_count += 1;
      this.repository.updateCase(c);

      const toolResult = await this.toolExecutor.execute(
        decision.recommended_action,
        c,
        policyCheck
      );

      // Record communication in ledger if customer-facing
      if (isCustomerContact) {
        this.commLedger.recordAttempt(
          c.id,
          obligation.id,
          c.customer_context.customer_id,
          'PAYMENT_LINK_PAGE',
          'PAYMENT_RECOVERY_STANDARD',
          'SENT'
        );

        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
          obligation_id: obligation.id,
          event_type: 'COMMUNICATION_DISPATCHED',
          actor: 'SYSTEM',
          source: 'CommunicationLedgerManager',
          metadata: {
            channel: 'PAYMENT_LINK_PAGE',
            template: 'PAYMENT_RECOVERY_STANDARD',
            action: decision.recommended_action,
          },
          timestamp: new Date().toISOString(),
        });
      }

      validateTransition(c.id, c.status, 'OUTCOME_MONITORED');
      c.status = 'OUTCOME_MONITORED';
      this.repository.updateCase(c);

      return {
        case: c,
        decision,
        policyCheck,
        toolResult,
        transitionedTo: 'OUTCOME_MONITORED',
        message: `Action '${decision.recommended_action}' executed successfully. Monitoring outcome.`,
      };
    } else if (policyCheck.policy_result === 'ESCALATE') {
      validateTransition(c.id, c.status, 'HUMAN_REVIEW');
      c.status = 'HUMAN_REVIEW';
      this.repository.updateCase(c);

      const escalateToolRes = await this.toolExecutor.execute('ESCALATE', c, {
        ...policyCheck,
        allowed: true,
        policy_result: 'ALLOW',
      });

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: obligation.id,
        event_type: 'HUMAN_REVIEW_TRIGGERED',
        actor: 'POLICY',
        source: 'RecoveryControlLoop',
        metadata: { reasons: policyCheck.reasons },
        timestamp: new Date().toISOString(),
      });

      return {
        case: c,
        decision,
        policyCheck,
        toolResult: escalateToolRes,
        transitionedTo: 'HUMAN_REVIEW',
        message: 'Case routed to human operator review.',
      };
    } else {
      // BLOCK
      validateTransition(c.id, c.status, 'STOPPED');
      c.status = 'STOPPED';
      this.repository.updateCase(c);

      const blockToolRes = await this.toolExecutor.execute('STOP', c, {
        ...policyCheck,
        allowed: true,
        policy_result: 'ALLOW',
      });

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: obligation.id,
        event_type: 'CASE_CLOSED',
        actor: 'POLICY',
        source: 'RecoveryControlLoop',
        metadata: { blocked_reasons: policyCheck.reasons },
        timestamp: new Date().toISOString(),
      });

      return {
        case: c,
        decision,
        policyCheck,
        toolResult: blockToolRes,
        transitionedTo: 'STOPPED',
        message: 'Action blocked by policy guardrails. Case stopped.',
      };
    }
  }

  /**
   * Handles authoritative payment success event (Payment Truth).
   */
  async handlePaymentSuccess(input: {
    paymentId: string;
    orderId?: string | null;
    paymentLinkId?: string | null;
    amount: number;
  }): Promise<{ recovered: boolean; case?: RecoveryCase }> {
    let c = this.repository.getCaseByPaymentId(input.paymentId);
    if (!c && input.paymentLinkId) {
      c = this.repository.getCaseByPaymentLinkId(input.paymentLinkId);
    }
    if (!c && input.orderId) {
      c = this.repository.getCaseByOrderId(input.orderId);
    }

    const orderId = input.orderId || c?.order_id || `order_${input.paymentId}`;
    const obligation = this.repository.getOrCreateObligation(
      orderId,
      input.amount,
      c?.currency || 'INR'
    );

    // Authoritatively mark the obligation as SATISFIED and cancel pending actions
    this.truthResolver.markObligationSatisfied(
      obligation.id,
      input.paymentId,
      input.amount,
      'payment.captured'
    );

    if (!c) {
      return { recovered: false };
    }

    if (isOpenState(c.status)) {
      validateTransition(c.id, c.status, 'RECOVERED');
      c.status = 'RECOVERED';
      this.repository.updateCase(c);

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: obligation.id,
        event_type: 'CASE_RECOVERED',
        actor: 'PAYMENT_GATEWAY',
        source: 'RazorpayWebhook.payment.captured',
        metadata: {
          amount: input.amount,
          payment_id: input.paymentId,
          payment_link_id: input.paymentLinkId,
          obligation_id: obligation.id,
        },
        timestamp: new Date().toISOString(),
      });

      return { recovered: true, case: c };
    }

    return { recovered: false, case: c };
  }

  /**
   * Handles human operator action on an escalated review case.
   * INVARIANT: Human review is NOT a policy bypass.
   * Architecture: AI -> HUMAN -> POLICY -> TOOL
   */
  async handleHumanReview(
    caseId: string,
    req: HumanReviewActionRequest
  ): Promise<RecoveryLoopResult> {
    const c = this.repository.getCaseById(caseId);
    if (!c) {
      throw new Error(`Case ${caseId} not found`);
    }

    if (c.status !== 'HUMAN_REVIEW') {
      throw new Error(`Case ${caseId} is not currently in HUMAN_REVIEW status (current: ${c.status})`);
    }

    const now = new Date().toISOString();
    const effectivePolicy = this.getEffectivePolicy();
    const policyEngine = new PolicyEngine(effectivePolicy);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      obligation_id: c.obligation_id,
      event_type: 'HUMAN_ACTION_TAKEN',
      actor: 'MERCHANT_OPERATOR',
      source: req.operator_id,
      metadata: { action: req.action, override_action: req.override_action, notes: req.operator_notes },
      timestamp: now,
    });

    if (req.action === 'APPROVE' || req.action === 'OVERRIDE') {
      const latestDecision = this.repository.getLatestDecisionByCaseId(c.id);
      const actionToExecute =
        req.action === 'OVERRIDE' && req.override_action
          ? req.override_action
          : latestDecision?.recommended_action || 'SEND_RECOVERY_LINK';

      // Construct proposed operator decision
      const operatorDecision: Decision = {
        id: `dec_human_${Date.now()}`,
        case_id: c.id,
        model_provider: 'merchant_operator',
        model_version: 'human-review-v1',
        prompt_version: 'manual_override',
        diagnosis: `Operator review action by ${req.operator_id}: ${req.operator_notes}`,
        failure_category: latestDecision?.failure_category || 'MANUAL_TRIAGE',
        recoverability: latestDecision?.recoverability ?? 0.8,
        expected_recovery_value: latestDecision?.expected_recovery_value ?? c.amount,
        evidence: [
          `Operator review notes: ${req.operator_notes}`,
          `Operator verified payment readiness: ${req.operator_id}`,
        ],
        recommended_action: actionToExecute,
        timing: 'IMMEDIATE',
        confidence: 0.95, // High confidence since verified by human
        reason: req.operator_notes,
        customer_friction: 'LOW',
        expected_value: c.amount,
        rationale: req.operator_notes,
        created_at: now,
      };

      let obligationStatus: string | undefined;
      if (c.obligation_id) {
        const obl = this.repository.getObligationById(c.obligation_id);
        obligationStatus = obl?.status;
      }

      // POLICY CHECK ENFORCEMENT ON HUMAN DECISION (AI -> HUMAN -> POLICY -> TOOL)
      const policyCheck = policyEngine.evaluate(c, operatorDecision, { obligationStatus });
      this.repository.createPolicyCheck(policyCheck);

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: c.obligation_id,
        event_type: 'POLICY_EVALUATED',
        actor: 'POLICY',
        source: 'PolicyEngine.HumanReview',
        metadata: {
          result: policyCheck.policy_result,
          allowed: policyCheck.allowed,
          reasons: policyCheck.reasons,
        },
        timestamp: now,
      });

      // If policy strictly blocks (e.g. hard decline retry or customer opt-out), REJECT execution
      if (!policyCheck.allowed && policyCheck.policy_result === 'BLOCK') {
        throw new Error(
          `Policy Guardrail Rejection: Operator action '${actionToExecute}' violates hard merchant policy: ${policyCheck.reasons.join('; ')}`
        );
      }

      validateTransition(c.id, c.status, 'ACTION_PENDING');
      c.status = 'ACTION_PENDING';
      this.repository.updateCase(c);

      validateTransition(c.id, c.status, 'ACTION_EXECUTED');
      c.status = 'ACTION_EXECUTED';
      c.attempt_count += 1;
      this.repository.updateCase(c);

      const approvedCheck = {
        ...policyCheck,
        allowed: true,
        policy_result: 'ALLOW' as const,
        reasons: [`Operator approved/overridden: ${req.operator_notes}`],
      };

      const toolResult = await this.toolExecutor.execute(actionToExecute, c, approvedCheck);

      validateTransition(c.id, c.status, 'OUTCOME_MONITORED');
      c.status = 'OUTCOME_MONITORED';
      this.repository.updateCase(c);

      return {
        case: c,
        toolResult,
        transitionedTo: 'OUTCOME_MONITORED',
        message: `Operator action ${req.action} executed with action ${actionToExecute}.`,
      };
    } else if (req.action === 'STOP') {
      validateTransition(c.id, c.status, 'STOPPED');
      c.status = 'STOPPED';
      this.repository.updateCase(c);

      return {
        case: c,
        transitionedTo: 'STOPPED',
        message: `Operator stopped case: ${req.operator_notes}`,
      };
    } else {
      // ESCALATE
      validateTransition(c.id, c.status, 'ESCALATED');
      c.status = 'ESCALATED';
      this.repository.updateCase(c);

      return {
        case: c,
        transitionedTo: 'ESCALATED',
        message: `Operator escalated case to Tier 2: ${req.operator_notes}`,
      };
    }
  }
}
