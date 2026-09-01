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

  async execute(
    action: ApprovedAction,
    c: RecoveryCase,
    policyCheck: PolicyCheck
  ): Promise<ToolResult> {
    // 1. Invariant: Policy must allow execution
    if (!policyCheck.allowed && policyCheck.policy_result !== 'ALLOW') {
      throw new Error(
        `Security Guardrail Violation: Execution blocked. Policy returned ${policyCheck.policy_result}. Action '${action}' rejected.`
      );
    }

    // 2. Invariant: Idempotency Key check
    const idempotencyKey = `idemp_${c.id}_${action}_${c.attempt_count}_${Date.now()}`;
    if (this.repository && typeof this.repository.getToolExecutionByIdempotencyKey === 'function') {
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

    // 3. Record pending tool execution
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
        created_at: new Date().toISOString(),
      });

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        event_type: 'TOOL_EXECUTION_ATTEMPTED',
        actor: 'TOOL',
        source: `ToolExecutor.${action}`,
        metadata: { action, attempt: c.attempt_count, idempotency_key: idempotencyKey },
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Controlled Execution
    let result: ToolResult;
    try {
      switch (action) {
        case 'RETRY':
          result = await executeRetryPayment(c, this.paymentProvider);
          break;
        case 'SEND_RECOVERY_LINK':
          result = await executeSendRecoveryLink(c, this.paymentProvider);
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

      if (this.repository && typeof this.repository.updateToolExecution === 'function') {
        this.repository.updateToolExecution(
          executionId,
          result.success ? 'SUCCESS' : 'FAILED',
          result.data
        );

        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
          event_type: result.success ? 'TOOL_EXECUTION_COMPLETED' : 'TOOL_EXECUTION_FAILED',
          actor: 'TOOL',
          source: `ToolExecutor.${action}`,
          metadata: { success: result.success, message: result.message, data: result.data },
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch (err: any) {
      if (this.repository && typeof this.repository.updateToolExecution === 'function') {
        this.repository.updateToolExecution(executionId, 'FAILED', { error: err.message });
        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: c.id,
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
