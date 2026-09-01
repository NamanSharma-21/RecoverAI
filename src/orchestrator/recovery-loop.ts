import { Repository } from '../db/repository';
import {
  RecoveryCase,
  CaseStatus,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
  PaymentMethod,
} from '../domain/types';
import { validateTransition, isOpenState } from '../domain/state-machine';
import { ContextBuilder } from '../context/context-builder';
import { DecisionService } from '../agent/decision-service';
import { PolicyEngine } from '../policy/policy-engine';
import { ToolExecutor } from '../tools/tool-executor';
import { HumanReviewActionRequest } from '../domain/schemas';

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

  constructor(
    private repository: Repository,
    private toolExecutor: ToolExecutor,
    private policyConfig: MerchantPolicyConfig = DEFAULT_MERCHANT_POLICY,
    decisionService?: DecisionService
  ) {
    this.decisionService = decisionService || new DecisionService();
    this.policyEngine = new PolicyEngine(policyConfig);
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

    // 1. Check if case already exists
    let c = this.repository.getCaseByPaymentId(input.paymentId);

    if (!c) {
      const caseId = `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      c = {
        id: caseId,
        merchant_id: 'merchant_default',
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
        policy_version: this.policyConfig.policy_version,
        created_at: now,
        updated_at: now,
      };

      this.repository.createCase(c);

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        event_type: 'CASE_CREATED',
        actor: 'SYSTEM',
        source: 'RecoveryControlLoop.handlePaymentFailure',
        metadata: { amount: c.amount, failure_code: c.failure_code, payment_method: c.payment_method },
        timestamp: now,
      });
    }

    // Invariant: If case is already RECOVERED, stop immediately
    if (c.status === 'RECOVERED') {
      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        event_type: 'PAYMENT_SUCCESS_INTERRUPT',
        actor: 'SYSTEM',
        source: 'RecoveryControlLoop',
        metadata: { message: 'Failure received on already RECOVERED case. Aborting recovery.' },
        timestamp: now,
      });
      return {
        case: c,
        transitionedTo: c.status,
        message: 'Case already recovered; no action taken.',
      };
    }

    // 2. Assemble context & diagnosis
    validateTransition(c.id, c.status, 'ANALYZING');
    c.status = 'ANALYZING';
    this.repository.updateCase(c);

    const context = ContextBuilder.buildContext(c, this.policyConfig);
    c.recoverability_score = context.recoverability_score;
    c.expected_recovery_value = context.expected_recovery_value;
    this.repository.updateCase(c);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      event_type: 'CONTEXT_BUILT',
      actor: 'SYSTEM',
      source: 'ContextBuilder',
      metadata: { score: context.recoverability_score, expected_value: context.expected_recovery_value },
      timestamp: new Date().toISOString(),
    });

    // 3. AI structured decision
    validateTransition(c.id, c.status, 'DECISION_READY');
    c.status = 'DECISION_READY';
    this.repository.updateCase(c);

    const decision = await this.decisionService.decide(context);
    this.repository.createDecision(decision);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
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

    // 4. Deterministic Policy Check
    validateTransition(c.id, c.status, 'POLICY_CHECK');
    c.status = 'POLICY_CHECK';
    this.repository.updateCase(c);

    const policyCheck = this.policyEngine.evaluate(c, decision);
    this.repository.createPolicyCheck(policyCheck);

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
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

    // 5. Execution based on policy check
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

      // Execute approved action
      validateTransition(c.id, c.status, 'ACTION_PENDING');
      c.status = 'ACTION_PENDING';
      this.repository.updateCase(c);

      validateTransition(c.id, c.status, 'ACTION_EXECUTED');
      c.status = 'ACTION_EXECUTED';
      c.attempt_count += 1;
      this.repository.updateCase(c);

      const toolResult = await this.toolExecutor.execute(decision.recommended_action, c, policyCheck);

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
        event_type: 'CASE_RECOVERED',
        actor: 'PAYMENT_GATEWAY',
        source: 'RazorpayWebhook.payment.captured',
        metadata: { amount: input.amount, payment_id: input.paymentId, payment_link_id: input.paymentLinkId },
        timestamp: new Date().toISOString(),
      });

      return { recovered: true, case: c };
    }

    return { recovered: false, case: c };
  }

  /**
   * Handles human operator action on an escalated review case.
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

    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
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

      validateTransition(c.id, c.status, 'ACTION_PENDING');
      c.status = 'ACTION_PENDING';
      this.repository.updateCase(c);

      validateTransition(c.id, c.status, 'ACTION_EXECUTED');
      c.status = 'ACTION_EXECUTED';
      c.attempt_count += 1;
      this.repository.updateCase(c);

      const policyCheck = {
        id: `pol_man_${Date.now()}`,
        decision_id: latestDecision?.id || 'manual_override',
        case_id: c.id,
        allowed: true,
        policy_result: 'ALLOW' as const,
        reasons: [`Manually approved/overridden by operator: ${req.operator_notes}`],
        policy_version: this.policyConfig.policy_version,
        created_at: now,
      };

      const toolResult = await this.toolExecutor.execute(actionToExecute, c, policyCheck);

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
