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

CREATE TABLE IF NOT EXISTS payment_obligations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  satisfied_at TEXT,
  satisfied_by_payment_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_obligations_order ON payment_obligations(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_obligations_status ON payment_obligations(status);

CREATE TABLE IF NOT EXISTS recovery_cases (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  obligation_id TEXT,
  event_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT,
  payment_link_id TEXT,
  recovery_url TEXT,
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
CREATE INDEX IF NOT EXISTS idx_recovery_cases_obligation ON recovery_cases(obligation_id);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  failure_category TEXT NOT NULL DEFAULT 'TRANSIENT',
  recoverability REAL NOT NULL DEFAULT 0.5,
  expected_recovery_value INTEGER NOT NULL DEFAULT 0,
  evidence TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  timing TEXT NOT NULL DEFAULT 'IMMEDIATE',
  confidence REAL NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  customer_friction TEXT NOT NULL DEFAULT 'LOW',
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

CREATE TABLE IF NOT EXISTS recovery_actions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  obligation_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  generation INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  claim_worker_id TEXT,
  claim_expires_at TEXT,
  arguments TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES recovery_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recovery_actions_case ON recovery_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_obligation ON recovery_actions(obligation_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_idemp ON recovery_actions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_status ON recovery_actions(status);

CREATE TABLE IF NOT EXISTS communication_ledger (
  id TEXT PRIMARY KEY,
  obligation_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  customer_id TEXT,
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  delivered_at TEXT,
  failed_at TEXT,
  error_reason TEXT,
  simulated INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_comm_ledger_obligation ON communication_ledger(obligation_id);
CREATE INDEX IF NOT EXISTS idx_comm_ledger_customer ON communication_ledger(customer_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  obligation_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  source TEXT NOT NULL,
  metadata TEXT NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_obligation ON audit_events(obligation_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp);

CREATE TABLE IF NOT EXISTS merchant_settings (
  merchant_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

interface ColumnMigration {
  table: string;
  column: string;
  definition: string;
}

const REQUIRED_COLUMNS: ColumnMigration[] = [
  // recovery_cases
  { table: 'recovery_cases', column: 'obligation_id', definition: 'TEXT' },
  { table: 'recovery_cases', column: 'recovery_url', definition: 'TEXT' },
  { table: 'recovery_cases', column: 'order_id', definition: 'TEXT' },
  { table: 'recovery_cases', column: 'payment_link_id', definition: 'TEXT' },
  { table: 'recovery_cases', column: 'recoverability_score', definition: 'REAL NOT NULL DEFAULT 0.0' },
  { table: 'recovery_cases', column: 'expected_recovery_value', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'recovery_cases', column: 'consent_status', definition: 'TEXT NOT NULL DEFAULT "CONSENTED"' },
  { table: 'recovery_cases', column: 'policy_version', definition: 'TEXT NOT NULL DEFAULT "v2.0"' },

  // decisions
  { table: 'decisions', column: 'failure_category', definition: 'TEXT NOT NULL DEFAULT "TRANSIENT"' },
  { table: 'decisions', column: 'recoverability', definition: 'REAL NOT NULL DEFAULT 0.5' },
  { table: 'decisions', column: 'expected_recovery_value', definition: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'decisions', column: 'timing', definition: 'TEXT NOT NULL DEFAULT "IMMEDIATE"' },
  { table: 'decisions', column: 'reason', definition: 'TEXT NOT NULL DEFAULT ""' },
  { table: 'decisions', column: 'customer_friction', definition: 'TEXT NOT NULL DEFAULT "LOW"' },
  { table: 'decisions', column: 'expected_value', definition: 'INTEGER NOT NULL DEFAULT 0' },

  // audit_events
  { table: 'audit_events', column: 'obligation_id', definition: 'TEXT' },

  // tool_executions
  { table: 'tool_executions', column: 'decision_id', definition: 'TEXT' },

  // payment_obligations
  { table: 'payment_obligations', column: 'expires_at', definition: 'TEXT' },

  // recovery_actions
  { table: 'recovery_actions', column: 'claim_worker_id', definition: 'TEXT' },
  { table: 'recovery_actions', column: 'claim_expires_at', definition: 'TEXT' },

  // communication_ledger
  { table: 'communication_ledger', column: 'simulated', definition: 'INTEGER NOT NULL DEFAULT 1' },
];

export function runMigrations(db: DatabaseSync): void {
  try {
    for (const mig of REQUIRED_COLUMNS) {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(mig.table);
      if (tableCheck) {
        const columns = (db.prepare(`PRAGMA table_info(${mig.table})`).all() as Array<{ name: string }>).map(c => c.name);
        if (!columns.includes(mig.column)) {
          db.exec(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.column} ${mig.definition};`);
        }
      }
    }
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}

export function closeDatabase(): void {
  if (defaultDbInstance) {
    try {
      defaultDbInstance.close();
    } catch {
      // ignore
    }
    defaultDbInstance = null;
  }
}

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbPath === ':memory:') {
    const memDb = new DatabaseSync(':memory:');
    memDb.exec('PRAGMA foreign_keys = ON;');
    memDb.exec(SCHEMA_SQL);
    runMigrations(memDb);
    return memDb;
  }

  if (defaultDbInstance) {
    return defaultDbInstance;
  }

  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
  let targetPath = dbPath || process.env.DATABASE_URL;

  if (!targetPath) {
    targetPath = isVercel ? '/tmp/recoverai.db' : './data/recoverai.db';
  } else if (isVercel && !targetPath.startsWith('/') && !targetPath.startsWith('http') && !targetPath.startsWith('postgres')) {
    targetPath = path.join('/tmp', path.basename(targetPath));
  }

  let resolvedTarget = path.resolve(targetPath);
  let resolvedDir = path.dirname(resolvedTarget);

  try {
    if (!fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
  } catch (dirErr) {
    console.warn(`[RecoverAI] Could not create directory ${resolvedDir}, falling back to /tmp:`, dirErr);
    resolvedTarget = path.resolve('/tmp/recoverai.db');
    resolvedDir = '/tmp';
    try {
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }
    } catch {
      // ignore
    }
  }

  try {
    defaultDbInstance = new DatabaseSync(resolvedTarget);
  } catch (dbErr) {
    console.warn(`[RecoverAI] Failed to open SQLite at ${resolvedTarget}, falling back to :memory::`, dbErr);
    defaultDbInstance = new DatabaseSync(':memory:');
  }

  try {
    defaultDbInstance.exec('PRAGMA journal_mode = WAL;');
  } catch {
    try {
      defaultDbInstance.exec('PRAGMA journal_mode = DELETE;');
    } catch {
      // ignore
    }
  }

  defaultDbInstance.exec('PRAGMA foreign_keys = ON;');
  runMigrations(defaultDbInstance);
  defaultDbInstance.exec(SCHEMA_SQL);

  return defaultDbInstance;
}

export function createMemoryDatabase(): DatabaseSync {
  return getDatabase(':memory:');
}

