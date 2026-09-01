import { StrategyCaseOutcome } from './strategies/strategy-interface';

export interface StrategyMetrics {
  strategyName: string;
  totalCases: number;
  totalRevenueAtRisk: number;
  totalRecoveredRevenue: number;
  recoveryRate: number; // percentage (0-100)
  incrementalRevenueVsRuleBaseline: number;
  incrementalPercentageVsRuleBaseline: number;
  policyViolations: number;
  policyViolationRate: number; // percentage
  hardDeclineRetries: number;
  hardDeclineRetryRate: number; // percentage
  unnecessaryInterventions: number;
  unnecessaryInterventionRate: number; // percentage
  escalations: number;
  escalationRate: number;
  averageLatencyMs: number;
  validDecisionRate: number; // percentage
}

export class MetricsCalculator {
  static computeMetrics(
    strategyName: string,
    outcomes: StrategyCaseOutcome[],
    ruleBaselineRevenue: number = 0
  ): StrategyMetrics {
    const totalCases = outcomes.length;
    if (totalCases === 0) {
      return {
        strategyName,
        totalCases: 0,
        totalRevenueAtRisk: 0,
        totalRecoveredRevenue: 0,
        recoveryRate: 0,
        incrementalRevenueVsRuleBaseline: 0,
        incrementalPercentageVsRuleBaseline: 0,
        policyViolations: 0,
        policyViolationRate: 0,
        hardDeclineRetries: 0,
        hardDeclineRetryRate: 0,
        unnecessaryInterventions: 0,
        unnecessaryInterventionRate: 0,
        escalations: 0,
        escalationRate: 0,
        averageLatencyMs: 0,
        validDecisionRate: 100,
      };
    }

    let totalRevenueAtRisk = 0;
    let totalRecoveredRevenue = 0;
    let recoveredCasesCount = 0;
    let policyViolations = 0;
    let hardDeclineRetries = 0;
    let unnecessaryInterventions = 0;
    let escalations = 0;
    let totalLatency = 0;

    for (const o of outcomes) {
      totalRevenueAtRisk += o.amount;
      if (o.recovered) {
        recoveredCasesCount++;
        totalRecoveredRevenue += o.recoveredAmount;
      }
      if (o.isPolicyViolation) {
        policyViolations++;
      }
      if (o.isHardDeclineRetry) {
        hardDeclineRetries++;
      }
      if (o.isUnnecessaryIntervention) {
        unnecessaryInterventions++;
      }
      if (o.actionTaken === 'ESCALATE') {
        escalations++;
      }
      totalLatency += o.executionTimeMs;
    }

    const recoveryRate = Number(((recoveredCasesCount / totalCases) * 100).toFixed(2));
    const incrementalRevenueVsRuleBaseline = totalRecoveredRevenue - ruleBaselineRevenue;
    const incrementalPercentageVsRuleBaseline =
      ruleBaselineRevenue > 0
        ? Number(((incrementalRevenueVsRuleBaseline / ruleBaselineRevenue) * 100).toFixed(2))
        : 0;

    const policyViolationRate = Number(((policyViolations / totalCases) * 100).toFixed(2));
    const hardDeclineRetryRate = Number(((hardDeclineRetries / totalCases) * 100).toFixed(2));
    const unnecessaryInterventionRate = Number(((unnecessaryInterventions / totalCases) * 100).toFixed(2));
    const escalationRate = Number(((escalations / totalCases) * 100).toFixed(2));
    const averageLatencyMs = Number((totalLatency / totalCases).toFixed(2));

    return {
      strategyName,
      totalCases,
      totalRevenueAtRisk,
      totalRecoveredRevenue,
      recoveryRate,
      incrementalRevenueVsRuleBaseline,
      incrementalPercentageVsRuleBaseline,
      policyViolations,
      policyViolationRate,
      hardDeclineRetries,
      hardDeclineRetryRate,
      unnecessaryInterventions,
      unnecessaryInterventionRate,
      escalations,
      escalationRate,
      averageLatencyMs,
      validDecisionRate: 100,
    };
  }
}
