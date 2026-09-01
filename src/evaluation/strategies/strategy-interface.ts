import { ApprovedAction } from '../../domain/types';
import { SimulatedObservableCase } from '../../simulator/latent-engine';

export interface StrategyCaseOutcome {
  caseId: string;
  amount: number;
  actionTaken: ApprovedAction;
  allowedByPolicy: boolean;
  policyResult: string;
  recovered: boolean;
  recoveredAmount: number;
  isPolicyViolation: boolean;
  isUnnecessaryIntervention: boolean;
  isHardDeclineRetry: boolean;
  executionTimeMs: number;
  diagnosis?: string;
  rationale?: string;
}

export interface EvaluationStrategy {
  getStrategyName(): string;
  evaluateCase(c: SimulatedObservableCase): Promise<StrategyCaseOutcome>;
}
