import { CaseStructuredContext } from '../context/context-builder';
import { Decision, ApprovedAction } from '../domain/types';
import { AIDecisionOutputSchema, AIDecisionOutput } from '../domain/schemas';
import { LLMClient, createLLMClient } from './llm-client';

export class DecisionService {
  constructor(
    private llmClient: LLMClient = createLLMClient(),
    private maxRetries: number = 2
  ) {}

  async decide(context: CaseStructuredContext): Promise<Decision> {
    let lastError: Error | null = null;

    // Bounded retry loop for LLM output schema compliance
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const rawOutput = await this.llmClient.generateDecision(context);
        const parsedJson = JSON.parse(rawOutput);
        const validated: AIDecisionOutput = AIDecisionOutputSchema.parse(parsedJson);

        return {
          id: `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: context.case_id,
          model_provider: this.llmClient.getProviderName(),
          model_version: this.llmClient.getModelName(),
          prompt_version: '1.0.0',
          diagnosis: validated.diagnosis,
          evidence: validated.evidence,
          recommended_action: validated.recommended_action,
          confidence: validated.confidence,
          expected_value: validated.expected_recovery_value,
          rationale: validated.rationale,
          created_at: new Date().toISOString(),
        };
      } catch (err: any) {
        lastError = err;
      }
    }

    // Fallback on LLM failure or malformed JSON
    return this.fallbackDecision(context, lastError);
  }

  /**
   * Safe fallback decision when model is unavailable or malformed.
   * Never fabricates an LLM response; explicitly attributes to SYSTEM fallback.
   */
  private fallbackDecision(context: CaseStructuredContext, error: Error | null): Decision {
    let action: ApprovedAction = 'ESCALATE';
    let rationale = `LLM decision service failed (${error?.message || 'unknown error'}). Falling back to safe escalation.`;

    if (context.failure_category === 'TRANSIENT' && context.attempt_count < context.policy_constraints.max_retries) {
      action = 'RETRY';
      rationale = 'Policy fallback: transient error with remaining retry budget.';
    } else if (context.failure_category === 'HARD_DECLINE') {
      action = 'OFFER_ALTERNATE_PAYMENT_METHOD';
      rationale = 'Policy fallback: hard decline on payment method.';
    }

    return {
      id: `dec_fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: context.case_id,
      model_provider: 'system_fallback',
      model_version: 'fallback_v1',
      prompt_version: 'none',
      diagnosis: `Fallback diagnosis for ${context.failure_code} (${context.failure_category})`,
      evidence: context.observable_evidence,
      recommended_action: action,
      confidence: 0.50,
      expected_value: context.expected_recovery_value,
      rationale,
      created_at: new Date().toISOString(),
    };
  }
}
