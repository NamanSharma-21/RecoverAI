import { describe, it, expect, beforeEach } from 'vitest';
import { GOLDEN_SCENARIOS } from '../../src/simulator/scenarios';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { Repository } from '../../src/db/repository';
import { createMemoryDatabase } from '../../src/db/database';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';

describe('Golden Scenarios Test Suite (10 Standard Fixtures)', () => {
  let repo: Repository;
  let loop: RecoveryControlLoop;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    const provider = new SimulatorAdapter();
    const toolExecutor = new ToolExecutor(provider, repo);
    loop = new RecoveryControlLoop(repo, toolExecutor);
  });

  for (const fixture of GOLDEN_SCENARIOS) {
    it(`executes ${fixture.name} (${fixture.id}) correctly`, async () => {
      const c = fixture.caseData;

      const res = await loop.handlePaymentFailure({
        eventId: `evt_${fixture.id}`,
        paymentId: c.payment_id,
        orderId: c.order_id,
        amount: c.amount,
        currency: c.currency,
        failureCode: c.failure_code,
        failureDescription: c.failure_description,
        paymentMethod: c.payment_method,
        customerContext: c.customer_context,
        consentStatus: c.consent_status,
      });

      expect(res.decision).toBeDefined();
      expect(res.policyCheck).toBeDefined();
      expect(res.policyCheck?.policy_result).toBe(fixture.expectedPolicyResult);

      const auditTrail = repo.getAuditEventsByCaseId(res.case.id);
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail.some((a) => a.event_type === 'CASE_CREATED')).toBe(true);
      expect(auditTrail.some((a) => a.event_type === 'POLICY_EVALUATED')).toBe(true);
    });
  }
});
