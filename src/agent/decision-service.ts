import { LLMClient, createLLMClient } from './llm-client';
import { CaseStructuredContext } from '../context/context-builder';
import { AIDecisionOutputSchema, AIDecisionOutput } from '../domain/schemas';
import { Decision, ApprovedAction, CustomerFriction } from '../domain/types';

export class DecisionService {
  private llmClient: LLMClient;
  private maxRetries: number;

  constructor(llmClient?: LLMClient, maxRetries: number = 2) {
    this.llmClient = llmClient || createLLMClient();
    this.maxRetries = maxRetries;
  }

  async decide(context: CaseStructuredContext): Promise<Decision> {
    let rawOutput = '';
    let parsed: AIDecisionOutput | null = null;
    let lastError: Error | null = null;
    let isFallback = false;

    // Total attempts = initial attempt (1) + maxRetries
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        rawOutput = await this.llmClient.generateDecision(context);
        const json = JSON.parse(rawOutput);
        parsed = AIDecisionOutputSchema.parse(json);
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    // Fallback if model output is malformed or invalid schema
    if (!parsed) {
      isFallback = true;
      parsed = this.createFallbackDecision(context, lastError?.message || 'Malformed or unapproved model output');
    }

    return {
      id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: context.case_id,
      model_provider: isFallback ? 'system_fallback' : this.llmClient.getProviderName(),
      model_version: isFallback ? 'fallback-rules-v1' : this.llmClient.getModelName(),
      prompt_version: 'v2.0',
      diagnosis: parsed.diagnosis,
      failure_category: parsed.failure_category || context.failure_category,
      recoverability: parsed.recoverability ?? context.recoverability_score,
      expected_recovery_value: parsed.expected_recovery_value ?? context.expected_recovery_value,
      evidence: parsed.evidence || context.observable_evidence,
      recommended_action: parsed.recommended_action,
      timing: parsed.timing || 'IMMEDIATE',
      confidence: parsed.confidence,
      reason: parsed.reason || parsed.rationale || '',
      customer_friction: (parsed.customer_friction || 'LOW') as CustomerFriction,
      expected_value: parsed.expected_recovery_value ?? context.expected_recovery_value,
      rationale: parsed.rationale || parsed.reason || '',
      created_at: new Date().toISOString(),
    };
  }

  private createFallbackDecision(context: CaseStructuredContext, errorReason: string): AIDecisionOutput {
    const isHardDecline = context.failure_category === 'HARD_DECLINE';
    const isTransient = context.failure_category === 'TRANSIENT';

    let action: ApprovedAction = 'ESCALATE';
    if (isTransient && context.attempt_count < 1) {
      action = 'RETRY';
    } else if (isHardDecline) {
      action = 'OFFER_ALTERNATE_PAYMENT_METHOD';
    }

    return {
      diagnosis: `Fallback diagnosis generated: ${context.failure_code} on ${context.payment_method}. (LLM unavailable: ${errorReason})`,
      failure_category: context.failure_category,
      recoverability: context.recoverability_score,
      expected_recovery_value: context.expected_recovery_value,
      recommended_action: action,
      timing: 'IMMEDIATE',
      confidence: 0.5,
      reason: `System fallback triggered: ${errorReason}`,
      customer_friction: 'MEDIUM',
      evidence: context.observable_evidence,
      rationale: `Fallback triggered due to AI error: ${errorReason}`,
    };
  }
}
