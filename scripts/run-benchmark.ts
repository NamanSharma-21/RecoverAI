import { BenchmarkRunner } from '../src/evaluation/runner';

async function main() {
  console.log('================================================================');
  console.log('  RecoverAI — Payment Recovery Decision Engine Benchmark Runner');
  console.log('================================================================\n');

  const runner = new BenchmarkRunner();
  console.log('Generating seeded dataset (1,200 total cases, 600 held-out test split, seed=42)...');
  console.log('Evaluating 5 candidate strategies against hidden latent ground truth...\n');

  const report = await runner.runBenchmark(1200, 42);

  console.log('---------------------------------------------------------------------------------------------------------');
  console.log(
    `| ${'Strategy'.padEnd(22)} | ${'Recovered (₹)'.padEnd(14)} | ${'Recov Rate'.padEnd(10)} | ${'Incr. vs Rule'.padEnd(14)} | ${'Incr. %'.padEnd(10)} | ${'Safety'.padEnd(9)} | ${'Hard Decl'.padEnd(10)} |`
  );
  console.log('---------------------------------------------------------------------------------------------------------');

  for (const [name, m] of Object.entries(report.strategies)) {
    const formattedRecov = `₹${(m.totalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const formattedIncr = `₹${(m.incrementalRevenueVsRuleBaseline / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const sign = m.incrementalPercentageVsRuleBaseline >= 0 ? '+' : '';
    const formattedIncrPct = `${sign}${m.incrementalPercentageVsRuleBaseline}%`;
    const safetyViolations = `${m.policyViolations} viols`;
    const hardDeclRetries = `${m.hardDeclineRetries} fails`;

    console.log(
      `| ${name.padEnd(22)} | ${formattedRecov.padEnd(14)} | ${(m.recoveryRate + '%').padEnd(10)} | ${formattedIncr.padEnd(14)} | ${formattedIncrPct.padEnd(10)} | ${safetyViolations.padEnd(9)} | ${hardDeclRetries.padEnd(10)} |`
    );
  }
  console.log('---------------------------------------------------------------------------------------------------------\n');

  console.log('================================================================');
  console.log('  KEY BENCHMARK FINDINGS & SUMMARY:');
  console.log('================================================================');
  console.log(`- Total Dataset Cases: ${report.totalDatasetCases} (Held-out Test Cases: ${report.heldOutTestCases})`);
  console.log(`- Rule Baseline Revenue: ₹${(report.summary.ruleBaselineRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`- RecoverAI Hybrid Revenue: ₹${(report.summary.hybridRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  console.log(`- Incremental Recovery: +₹${(report.summary.incrementalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })} (${report.summary.incrementalPercentage}%)`);
  console.log(`- Critical Policy Violations:`);
  console.log(`    * RecoverAI Hybrid: ${report.summary.hybridSafetyViolations} (Deterministic Guardrails Active)`);
  console.log(`    * LLM-Only Strategy: ${report.summary.llmOnlySafetyViolations} (Dangerous unconstrained model actions)`);
  console.log(`\nConclusion: ${report.summary.conclusion}\n`);
}

main().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
