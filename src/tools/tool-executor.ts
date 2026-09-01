import {
  RecoveryCase,
  PolicyCheck,
  ToolExecution,
  ApprovedAction,
} from '../domain/types';
import { PaymentProvider } from '../adapters/provider-interface';
import { Repository } from '../db/repository';
import {
  ToolResult,
  executeRetryPayment,
  executeCreateOrReusePaymentLink,
  executeOfferAlternatePaymentMethod,
  executeWaitCase,
  executeStopCase,
  executeEscalateCase,
} from './definitions';

export class ToolExecutor {
  constructor(
    private provider: PaymentProvider,
    private repository: Repository
  ) {}

  async execute(
    action: ApprovedAction,
    c: RecoveryCase,
    policyCheck: PolicyCheck,
    idempotencyKey?: string
  ): Promise<ToolResult> {
    // 1. Mandatory guardrail: Only ALLOW reaches a tool
    if (!policyCheck.allowed && policyCheck.policy_result !== 'ALLOW') {
      throw new Error(
        `Security Guardrail Violation: Cannot execute tool '${action}' because policy check was ${policyCheck.policy_result}. Reasons: ${policyCheck.reasons.join(', ')}`
      );
    }

    const key =
      idempotencyKey ||
      `idemp_${c.id}_${action}_${c.attempt_count + 1}_${Date.now()}`;

    // 2. Idempotency check: check if already executed
    const existingExec = this.repository.getToolExecutionByIdempotencyKey(key);
    if (existingExec) {
      return {
        success: existingExec.status === 'SUCCESS',
        action: existingExec.tool_name,
        data: existingExec.result,
        message: 'Idempotent replay of existing tool execution result.',
      };
    }

    const toolExecutionId = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Record pending execution
    this.repository.createToolExecution({
      id: toolExecutionId,
      case_id: c.id,
      decision_id: policyCheck.decision_id,
      tool_name: action,
      idempotency_key: key,
      arguments: { action, case_id: c.id, attempt: c.attempt_count + 1 },
      result: {},
      status: 'PENDING',
      created_at: new Date().toISOString(),
    });

    // Record audit event
    this.repository.createAuditEvent({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: c.id,
      event_type: 'TOOL_EXECUTION_ATTEMPTED',
      actor: 'TOOL',
      source: `ToolExecutor.${action}`,
      metadata: { action, idempotency_key: key, decision_id: policyCheck.decision_id },
      timestamp: new Date().toISOString(),
    });

    let result: ToolResult;
    try {
      switch (action) {
        case 'RETRY':
          result = await executeRetryPayment(c, this.provider);
          break;
        case 'CREATE_OR_REUSE_PAYMENT_LINK':
          result = await executeCreateOrReusePaymentLink(c, this.provider);
          break;
        case 'OFFER_ALTERNATE_PAYMENT_METHOD':
          result = await executeOfferAlternatePaymentMethod(c, this.provider);
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
          throw new Error(`Unsupported tool action: ${action}`);
      }

      this.repository.updateToolExecution(
        toolExecutionId,
        result.success ? 'SUCCESS' : 'FAILED',
        result.data
      );

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        event_type: result.success ? 'TOOL_EXECUTION_COMPLETED' : 'TOOL_EXECUTION_FAILED',
        actor: 'TOOL',
        source: `ToolExecutor.${action}`,
        metadata: { action, result: result.data, success: result.success },
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (err: any) {
      this.repository.updateToolExecution(toolExecutionId, 'FAILED', {
        error: err.message,
      });

      this.repository.createAuditEvent({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        case_id: c.id,
        event_type: 'TOOL_EXECUTION_FAILED',
        actor: 'TOOL',
        source: `ToolExecutor.${action}`,
        metadata: { action, error: err.message },
        timestamp: new Date().toISOString(),
      });

      throw err;
    }
  }
}
