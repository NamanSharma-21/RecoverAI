import { Repository } from '../db/repository';
import { RecoveryCase, ApprovedAction, PolicyCheck } from '../domain/types';
import { PaymentProvider } from '../adapters/provider-interface';
import { createPaymentProvider } from '../adapters/razorpay-adapter';
import {
  ToolResult,
  executeRetryPayment,
  executeSendRecoveryLink,
  executeCreateOrReusePaymentLink,
  executeOfferAlternatePaymentMethod,
  executeWaitCase,
  executeStopCase,
  executeEscalateCase,
} from './definitions';

export class ToolExecutor {
  private repository?: Repository;
  private paymentProvider: PaymentProvider;

  constructor(arg1?: any, arg2?: any) {
    if (
      arg1 &&
      (typeof arg1.getPayment === 'function' ||
        typeof arg1.retryPayment === 'function' ||
        typeof arg1.createPaymentLink === 'function')
    ) {
      this.paymentProvider = arg1;
      this.repository = arg2;
    } else {
      this.repository = arg1;
      this.paymentProvider = arg2 || createPaymentProvider();
    }
  }

  getPaymentProvider(): PaymentProvider {
    return this.paymentProvider;
  }

  generateDeterministicIdempotencyKey(
    obligationKey: string,
    action: ApprovedAction,
    generation: number
  ): string {
    return `idemp_${obligationKey}_${action}_gen${generation}`;
  }

  async execute(
    action: ApprovedAction,
    c: RecoveryCase,
    policyCheck: PolicyCheck,
    options?: {
      workerId?: string;
      validUntil?: string;
      customIdempotencyKey?: string;
    }
  ): Promise<ToolResult> {
    // 1. Invariant: Policy must allow execution
    if (!policyCheck.allowed && policyCheck.policy_result !== 'ALLOW') {
      throw new Error(
        `Security Guardrail Violation: Execution blocked. Policy returned ${policyCheck.policy_result}. Action '${action}' rejected.`
      );
    }

    // 2. Invariant: Deterministic Idempotency Key
    // Bound to obligation/order identity and action generation without random timestamps!
    const obligationKey = c.obligation_id || c.order_id || c.payment_id || c.id;
    const idempotencyKey =
      options?.customIdempotencyKey ||
      this.generateDeterministicIdempotencyKey(obligationKey, action, c.attempt_count);

    // Check existing execution records for replay
    if (this.repository && typeof this.repository.getRecoveryActionByIdempotencyKey === 'function') {
      const existingAction = this.repository.getRecoveryActionByIdempotencyKey(idempotencyKey);
      if (existingAction) {
        if (existingAction.status === 'SUCCEEDED' || existingAction.status === 'EXECUTED') {
          return {
            success: true,
            action,
            data: existingAction.result,
            message: 'Idempotent replay: Action was already executed.',
          };
        }
        if (existingAction.status === 'CLAIMED' || existingAction.status === 'EXECUTING') {
          throw new Error(
            `Concurrent Execution Conflict: Action '${idempotencyKey}' is already claimed by worker ${existingAction.claim_worker_id}. Duplicate execution rejected.`
          );
        }
      }
    } else if (this.repository && typeof this.repository.getToolExecutionByIdempotencyKey === 'function') {
      const existing = this.repository.getToolExecutionByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          success: existing.status === 'SUCCESS',
          action,
          data: existing.result,
          message: 'Idempotent replay: Action was already executed.',
        };
      }
    }

    // 3. Register Action Lifecycle: PROPOSED -> POLICY_ALLOWED -> CLAIMED -> EXECUTING
    const workerId = options?.workerId || `worker_${process.pid || 'main'}_${Math.random().toString(36).slice(2, 6)}`;
    const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const validUntil = options?.validUntil || new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5-minute decision validity
    const nowIso = new Date().toISOString();

    if (this.repository && typeof this.repository.createRecoveryAction === 'function') {
      this.repository.createRecoveryAction({
        id: actionId,
        case_id: c.id,
        obligation_id: c.obligation_id || obligationKey,
        action_type: action,
        generation: c.attempt_count,
        idempotency_key: idempotencyKey,
        status: 'POLICY_ALLOWED',
        valid_until: validUntil,
        claim_worker_id: null,
        claim_expires_at: null,
        arguments: { case_id: c.id, payment_id: c.payment_id, amount: c.amount, action },
        result: {},
        created_at: nowIso,
        updated_at: nowIso,
      });

      // Atomic DB lease claim
      const claimed = this.repository.claimActionForExecution(actionId, workerId, 30000);
      if (!claimed) {
        throw new Error(`Failed to acquire execution lease for action ${actionId}.`);
      }

      this.repository.updateRecoveryActionStatus(actionId, 'EXECUTING');
    }

    // Also record legacy tool execution record for audit & backward compatibility
    const executionId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.repository && typeof this.repository.createToolExecution === 'function') {
      this.repository.createToolExecution({
        id: executionId,
        case_id: c.id,
        decision_id: policyCheck.decision_id,
        tool_name: action,
        idempotency_key: idempotencyKey,
        arguments: { case_id: c.id, payment_id: c.payment_id, amount: c.amount, action },
        result: {},
        status: 'PENDING',
        created_at: nowIso,
      });

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        obligation_id: c.obligation_id || obligationKey,
        event_type: 'TOOL_EXECUTION_ATTEMPTED',
        actor: 'TOOL',
        source: `ToolExecutor.${action}`,
        metadata: { action, attempt: c.attempt_count, idempotency_key: idempotencyKey, worker_id: workerId },
        timestamp: nowIso,
      });
    }

    // 4. Controlled Execution with Post-Flight Check
    let result: ToolResult;
    try {
      switch (action) {
        case 'RETRY':
        case 'RETRY_NOW':
        case 'RETRY_LATER':
          result = await executeRetryPayment(c, this.paymentProvider);
          break;
        case 'SEND_RECOVERY_LINK':
        case 'CREATE_OR_REUSE_PAYMENT_LINK':
          result = await executeCreateOrReusePaymentLink(c, this.paymentProvider);
          if (result.data.short_url) {
            c.recovery_url = result.data.short_url;
          }
          if (result.data.payment_link_id) {
            c.payment_link_id = result.data.payment_link_id;
          }
          if (this.repository && typeof this.repository.updateCase === 'function') {
            this.repository.updateCase(c);
          }
          break;
        case 'OFFER_ALTERNATE_METHOD':
        case 'OFFER_ALTERNATE_PAYMENT_METHOD':
          result = await executeOfferAlternatePaymentMethod(c, this.paymentProvider);
          if (result.data.short_url) {
            c.recovery_url = result.data.short_url;
          }
          if (result.data.payment_link_id) {
            c.payment_link_id = result.data.payment_link_id;
          }
          if (this.repository && typeof this.repository.updateCase === 'function') {
            this.repository.updateCase(c);
          }
          break;
        case 'WAIT':
          result = await executeWaitCase(c);
          break;
        case 'STOP':
          result = await executeStopCase(c, policyCheck.reasons.join('; '));
          break;
        case 'ESCALATE':
          result = await executeEscalateCase(c, policyCheck.reasons.join('; '));
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // POST-FLIGHT: Update action lifecycle to EXECUTED / SUCCEEDED
      if (this.repository && typeof this.repository.updateRecoveryActionStatus === 'function') {
        this.repository.updateRecoveryActionStatus(
          actionId,
          result.success ? 'SUCCEEDED' : 'FAILED',
          result.data
        );
      }

      if (this.repository && typeof this.repository.updateToolExecution === 'function') {
        this.repository.updateToolExecution(
          executionId,
          result.success ? 'SUCCESS' : 'FAILED',
          result.data
        );

        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
          obligation_id: c.obligation_id || obligationKey,
          event_type: result.success ? 'TOOL_EXECUTION_COMPLETED' : 'TOOL_EXECUTION_FAILED',
          actor: 'TOOL',
          source: `ToolExecutor.${action}`,
          metadata: { success: result.success, message: result.message, data: result.data },
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (err: any) {
      if (this.repository && typeof this.repository.updateRecoveryActionStatus === 'function') {
        this.repository.updateRecoveryActionStatus(actionId, 'FAILED', { error: err.message });
      }

      if (this.repository && typeof this.repository.updateToolExecution === 'function') {
        this.repository.updateToolExecution(executionId, 'FAILED', { error: err.message });
        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
          obligation_id: c.obligation_id || obligationKey,
          event_type: 'TOOL_EXECUTION_FAILED',
          actor: 'TOOL',
          source: `ToolExecutor.${action}`,
          metadata: { error: err.message },
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  }
}
