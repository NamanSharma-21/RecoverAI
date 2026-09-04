import { StrategyCaseOutcome } from './strategies/strategy-interface';
import { LatentCostBreakdown } from '../simulator/latent-engine';

export interface StrategyMetrics {
  strategyName: string;
  totalCases: number;
  totalRevenueAtRisk: number;
  totalRecoveredRevenue: number;
  recoveryRate: number; // percentage (0-100)
  totalNetRecoveredRevenue: number;
  netRecoveryRate: number; // percentage of revenue at risk
  totalCosts: number;
  safetyPenalties: number;
  costBreakdown: LatentCostBreakdown;
  incrementalRevenueVsRuleBaseline: number;
  incrementalPercentageVsRuleBaseline: number;
  incrementalNetRevenueVsRuleBaseline: number;
  incrementalNetPercentageVsRuleBaseline: number;
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
    ruleBaselineRevenue: number = 0,
    ruleBaselineNetRevenue: number = 0
  ): StrategyMetrics {
    const emptyCosts: LatentCostBreakdown = {
      communicationCost: 0,
      retryCost: 0,
      frictionCost: 0,
      escalationCost: 0,
      safetyPenalties: 0,
      totalCost: 0,
    };

    const totalCases = outcomes.length;
    if (totalCases === 0) {
      return {
        strategyName,
        totalCases: 0,
        totalRevenueAtRisk: 0,
        totalRecoveredRevenue: 0,
        recoveryRate: 0,
        totalNetRecoveredRevenue: 0,
        netRecoveryRate: 0,
        totalCosts: 0,
        safetyPenalties: 0,
        costBreakdown: emptyCosts,
        incrementalRevenueVsRuleBaseline: 0,
        incrementalPercentageVsRuleBaseline: 0,
        incrementalNetRevenueVsRuleBaseline: 0,
        incrementalNetPercentageVsRuleBaseline: 0,
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
    let totalNetRecoveredRevenue = 0;
    let recoveredCasesCount = 0;
    let policyViolations = 0;
    let hardDeclineRetries = 0;
    let unnecessaryInterventions = 0;
    let escalations = 0;
    let totalLatency = 0;

    const costsAgg: LatentCostBreakdown = {
      communicationCost: 0,
      retryCost: 0,
      frictionCost: 0,
      escalationCost: 0,
      safetyPenalties: 0,
      totalCost: 0,
    };

    for (const o of outcomes) {
      totalRevenueAtRisk += o.amount;
      if (o.recovered) {
        recoveredCasesCount++;
        totalRecoveredRevenue += o.recoveredAmount;
      }
      totalNetRecoveredRevenue += o.netRecoveryValue ?? (o.recovered ? o.recoveredAmount : 0);

      if (o.costs) {
        costsAgg.communicationCost += o.costs.communicationCost;
        costsAgg.retryCost += o.costs.retryCost;
        costsAgg.frictionCost += o.costs.frictionCost;
        costsAgg.escalationCost += o.costs.escalationCost;
        costsAgg.safetyPenalties += o.costs.safetyPenalties;
        costsAgg.totalCost += o.costs.totalCost;
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
    const netRecoveryRate =
      totalRevenueAtRisk > 0
        ? Number(((totalNetRecoveredRevenue / totalRevenueAtRisk) * 100).toFixed(2))
        : 0;

    const incrementalRevenueVsRuleBaseline = totalRecoveredRevenue - ruleBaselineRevenue;
    const incrementalPercentageVsRuleBaseline =
      ruleBaselineRevenue > 0
        ? Number(((incrementalRevenueVsRuleBaseline / ruleBaselineRevenue) * 100).toFixed(2))
        : 0;

    const incrementalNetRevenueVsRuleBaseline = totalNetRecoveredRevenue - ruleBaselineNetRevenue;
    const incrementalNetPercentageVsRuleBaseline =
      ruleBaselineNetRevenue > 0
        ? Number(((incrementalNetRevenueVsRuleBaseline / ruleBaselineNetRevenue) * 100).toFixed(2))
        : 0;

    const policyViolationRate = Number(((policyViolations / totalCases) * 100).toFixed(2));
    const hardDeclineRetryRate = Number(((hardDeclineRetries / totalCases) * 100).toFixed(2));
    const unnecessaryInterventionRate = Number(((unnecessaryInterventions / totalCases) * 100).toFixed(2));
    const escalationRate = Number(((escalations / totalCases) * 100).toFixed(2));
    const averageLatencyMs = Number((totalLatency / totalCases).toFixed(2));

    const totalOperationalCosts = costsAgg.totalCost - costsAgg.safetyPenalties;

    return {
      strategyName,
      totalCases,
      totalRevenueAtRisk,
      totalRecoveredRevenue,
      recoveryRate,
      totalNetRecoveredRevenue,
      netRecoveryRate,
      totalCosts: totalOperationalCosts,
      safetyPenalties: costsAgg.safetyPenalties,
      costBreakdown: costsAgg,
      incrementalRevenueVsRuleBaseline,
      incrementalPercentageVsRuleBaseline,
      incrementalNetRevenueVsRuleBaseline,
      incrementalNetPercentageVsRuleBaseline,
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
