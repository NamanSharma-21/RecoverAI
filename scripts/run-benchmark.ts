import { BenchmarkRunner } from '../src/evaluation/runner';

async function main() {
  console.log('================================================================');
  console.log('  RecoverAI — Payment Recovery Decision Engine Benchmark Runner');
  console.log('================================================================\n');

  const runner = new BenchmarkRunner();
  console.log('Generating seeded dataset (5,000 total cases, 2,500 held-out test split, seed=42)...');
  console.log('Evaluating 5 candidate strategies against hidden latent ground truth...\n');

  const report = await runner.runBenchmark(5000, 42);

  console.log('---------------------------------------------------------------------------------------------------------------------------------------------');
  console.log(
    `| ${'Strategy'.padEnd(20)} | ${'Gross Recov (₹)'.padEnd(16)} | ${'Costs (₹)'.padEnd(11)} | ${'Penalties (₹)'.padEnd(14)} | ${'Net Recov (₹)'.padEnd(16)} | ${'Net Recov %'.padEnd(12)} | ${'Safety'.padEnd(9)} |`
  );
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------');

  for (const [name, m] of Object.entries(report.strategies)) {
    const grossRecov = `₹${(m.totalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const costs = `₹${(m.totalCosts / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const penalties = `₹${(m.safetyPenalties / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const netRecov = `₹${(m.totalNetRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const netRate = `${m.netRecoveryRate}%`;
    const safetyViolations = `${m.policyViolations} viols`;

    console.log(
      `| ${name.padEnd(20)} | ${grossRecov.padEnd(16)} | ${costs.padEnd(11)} | ${penalties.padEnd(14)} | ${netRecov.padEnd(16)} | ${netRate.padEnd(12)} | ${safetyViolations.padEnd(9)} |`
    );
  }
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------\n');

  console.log('================================================================');
  console.log('  KEY BENCHMARK FINDINGS & SUMMARY:');
  console.log('================================================================');
  console.log(`- Total Dataset Cases: ${report.totalDatasetCases} (Held-out Test Cases: ${report.heldOutTestCases})`);
  console.log(`- Rule Baseline Gross: ₹${(report.summary.ruleBaselineRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`- RecoverAI Hybrid Gross: ₹${(report.summary.hybridRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  const hybridStrat = report.strategies['recoverai_hybrid'];
  const ruleStrat = report.strategies['fixed_rule_baseline'];
  const llmStrat = report.strategies['llm_only'];
  console.log(`- Rule Baseline Net: ₹${(ruleStrat.totalNetRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`- RecoverAI Hybrid Net: ₹${(hybridStrat.totalNetRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`- Incremental Net Recovery: +₹${(hybridStrat.incrementalNetRevenueVsRuleBaseline / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${hybridStrat.incrementalNetPercentageVsRuleBaseline}%)`);
  console.log(`- Critical Policy Violations:`);
  console.log(`    * RecoverAI Hybrid: ${report.summary.hybridSafetyViolations} (Deterministic Guardrails Active)`);
  console.log(`    * LLM-Only Strategy: ${report.summary.llmOnlySafetyViolations} (Dangerous unconstrained model actions, ₹${(llmStrat.safetyPenalties / 100).toLocaleString('en-IN')} in penalties)`);
  console.log(`\nConclusion: ${report.summary.conclusion}\n`);
}

main().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
