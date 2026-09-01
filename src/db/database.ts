import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let defaultDbInstance: DatabaseSync | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recovery_cases (
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

CREATE INDEX IF NOT EXISTS idx_recovery_cases_status ON recovery_cases(status);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_payment ON recovery_cases(payment_id);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_order ON recovery_cases(order_id);

CREATE TABLE IF NOT EXISTS decisions (
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

CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON decisions(case_id);

CREATE TABLE IF NOT EXISTS policy_checks (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  policy_result TEXT NOT NULL,
  reasons TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_policy_checks_case_id ON policy_checks(case_id);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  decision_id TEXT,
  tool_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  arguments TEXT NOT NULL,
  result TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_case ON tool_executions(case_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_idemp ON tool_executions(idempotency_key);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);

CREATE TABLE IF NOT EXISTS benchmark_runs (
  id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  total_cases INTEGER NOT NULL,
  dataset_version TEXT NOT NULL,
  model_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  results_json TEXT NOT NULL
);
`;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbPath === ':memory:') {
    const memDb = new DatabaseSync(':memory:');
    memDb.exec('PRAGMA foreign_keys = ON;');
    memDb.exec(SCHEMA_SQL);
    return memDb;
  }

  if (defaultDbInstance) {
    return defaultDbInstance;
  }

  const targetPath = dbPath || process.env.DATABASE_URL || './data/recoverai.db';
  const resolvedDir = path.dirname(path.resolve(targetPath));

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  defaultDbInstance = new DatabaseSync(path.resolve(targetPath));
  defaultDbInstance.exec('PRAGMA journal_mode = WAL;');
  defaultDbInstance.exec('PRAGMA foreign_keys = ON;');
  defaultDbInstance.exec(SCHEMA_SQL);

  return defaultDbInstance;
}

export function createMemoryDatabase(): DatabaseSync {
  return getDatabase(':memory:');
}
