import { describe, it, expect, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase, closeDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';

describe('Persistent SQLite Schema Migration Integration Tests', () => {
  const tempDbPath = path.resolve('./data/test-migration.db');

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  it('migrates an old schema missing recovery_url and decision metadata without data loss', () => {
    // 1. Create a DB file with old/legacy schema
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    const rawDb = new DatabaseSync(tempDbPath);
    rawDb.exec('PRAGMA foreign_keys = ON;');

    // Create old recovery_cases table (without recovery_url)
    rawDb.exec(`
      CREATE TABLE recovery_cases (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        payment_id TEXT NOT NULL,
        order_id TEXT,
        payment_link_id TEXT,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        failure_code TEXT NOT NULL,
        failure_description TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        customer_context TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        recoverability_score REAL NOT NULL DEFAULT 0.0,
        expected_recovery_value INTEGER NOT NULL DEFAULT 0,
        consent_status TEXT NOT NULL DEFAULT 'CONSENTED',
        policy_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create old decisions table (without failure_category, recoverability, etc.)
    rawDb.exec(`
      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        model_version TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        diagnosis TEXT NOT NULL,
        evidence TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        confidence REAL NOT NULL,
        expected_value INTEGER NOT NULL,
        rationale TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
      );
    `);

    // Insert legacy case and decision
    const now = new Date().toISOString();
    rawDb.exec(`
      INSERT INTO recovery_cases (
        id, merchant_id, event_id, payment_id, order_id, amount, currency,
        failure_code, failure_description, payment_method, customer_context,
        attempt_count, status, policy_version, created_at, updated_at
      ) VALUES (
        'case_legacy_1', 'merch_1', 'evt_1', 'pay_1', 'order_1', 50000, 'INR',
        'BAD_REQUEST_ERROR', 'Card expired', 'card', '{}',
        0, 'OPEN', 'v1.0', '${now}', '${now}'
      );
    `);

    rawDb.exec(`
      INSERT INTO decisions (
        id, case_id, model_provider, model_version, prompt_version,
        diagnosis, evidence, recommended_action, confidence, expected_value, rationale, created_at
      ) VALUES (
        'dec_legacy_1', 'case_legacy_1', 'rule_engine', '1.0', '1.0',
        'Expired card requires new link', '[]', 'CREATE_OR_REUSE_PAYMENT_LINK', 0.85, 42500, 'Card expired', '${now}'
      );
    `);

    rawDb.close();

    // 2. Open via getDatabase() which triggers runMigrations
    const migratedDb = getDatabase(tempDbPath);

    // Verify recovery_cases columns
    const caseCols = (migratedDb.prepare('PRAGMA table_info(recovery_cases)').all() as Array<{ name: string }>).map(c => c.name);
    expect(caseCols).toContain('obligation_id');
    expect(caseCols).toContain('recovery_url');

    // Verify decisions columns
    const decCols = (migratedDb.prepare('PRAGMA table_info(decisions)').all() as Array<{ name: string }>).map(c => c.name);
    expect(decCols).toContain('failure_category');
    expect(decCols).toContain('recoverability');
    expect(decCols).toContain('expected_recovery_value');
    expect(decCols).toContain('timing');
    expect(decCols).toContain('reason');
    expect(decCols).toContain('customer_friction');

    // Verify data integrity of legacy records
    const repo = new Repository(migratedDb);
    const legacyCase = repo.getCaseById('case_legacy_1');
    expect(legacyCase).not.toBeNull();
    expect(legacyCase?.id).toBe('case_legacy_1');
    expect(legacyCase?.amount).toBe(50000);
    expect(legacyCase?.recovery_url).toBeNull(); // Defaulted properly

    const legacyDecisions = repo.getDecisionsByCaseId('case_legacy_1');
    expect(legacyDecisions.length).toBe(1);
    expect(legacyDecisions[0].id).toBe('dec_legacy_1');
    expect(legacyDecisions[0].failure_category).toBe('TRANSIENT'); // Defaulted properly
    expect(legacyDecisions[0].timing).toBe('IMMEDIATE');

    // 3. Verify new writes work seamlessly with all columns
    repo.createCase({
      id: 'case_new_2',
      merchant_id: 'merch_1',
      obligation_id: 'ob_2',
      event_id: 'evt_2',
      payment_id: 'pay_2',
      order_id: 'order_2',
      payment_link_id: 'plink_2',
      recovery_url: 'http://localhost:3000/recover/case_new_2',
      amount: 120000,
      currency: 'INR',
      failure_code: 'PAYMENT_FAILED',
      failure_description: 'Issuer down',
      payment_method: 'upi',
      customer_context: { email: 'customer@test.com' },
      attempt_count: 1,
      status: 'ACTION_EXECUTED',
      recoverability_score: 0.9,
      expected_recovery_value: 108000,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
    });

    const retrievedCase = repo.getCaseById('case_new_2');
    expect(retrievedCase).not.toBeNull();
    expect(retrievedCase?.recovery_url).toBe('http://localhost:3000/recover/case_new_2');
    expect(retrievedCase?.obligation_id).toBe('ob_2');

    repo.createDecision({
      id: 'dec_new_2',
      case_id: 'case_new_2',
      model_provider: 'gemini',
      model_version: 'gemini-1.5-flash',
      prompt_version: 'v2.0',
      diagnosis: 'Temporary UPI switch timeout',
      failure_category: 'TRANSIENT',
      recoverability: 0.9,
      expected_recovery_value: 108000,
      evidence: ['Server timeout', 'UPI rail congestion'],
      recommended_action: 'RETRY',
      timing: 'EXPONENTIAL_BACKOFF',
      confidence: 0.95,
      reason: 'Transient switch issue',
      customer_friction: 'LOW',
      expected_value: 108000,
      rationale: 'High probability of recovery after backoff',
      created_at: new Date().toISOString(),
    });

    const retrievedDecision = repo.getLatestDecisionByCaseId('case_new_2');
    expect(retrievedDecision).not.toBeNull();
    expect(retrievedDecision?.failure_category).toBe('TRANSIENT');
    expect(retrievedDecision?.customer_friction).toBe('LOW');
  });
});
