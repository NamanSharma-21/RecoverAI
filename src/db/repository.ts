import { DatabaseSync } from 'node:sqlite';
import {
  RecoveryCase,
  Decision,
  PolicyCheck,
  ToolExecution,
  AuditEvent,
  WebhookEventRecord,
  CaseStatus,
  ConsentStatus,
  PaymentMethod,
  ApprovedAction,
  PolicyResult,
} from '../domain/types';

export class Repository {
  constructor(private db: DatabaseSync) {}

  // ==================== WEBHOOK EVENTS ====================

  recordWebhookEvent(eventId: string, eventType: string, payload: string): boolean {
    const existing = this.db
      .prepare('SELECT event_id FROM webhook_events WHERE event_id = ?')
      .get(eventId) as { event_id: string } | undefined;

    if (existing) {
      return false; // Duplicate
    }

    this.db
      .prepare(
        'INSERT INTO webhook_events (event_id, event_type, payload, received_at, processed) VALUES (?, ?, ?, ?, ?)'
      )
      .run(eventId, eventType, payload, new Date().toISOString(), 0);
    return true;
  }

  isWebhookProcessed(eventId: string): boolean {
    const row = this.db
      .prepare('SELECT processed FROM webhook_events WHERE event_id = ?')
      .get(eventId) as { processed: number } | undefined;
    return !!row && row.processed === 1;
  }

  markWebhookProcessed(eventId: string): void {
    this.db
      .prepare('UPDATE webhook_events SET processed = 1 WHERE event_id = ?')
      .run(eventId);
  }

  getWebhookEvent(eventId: string): WebhookEventRecord | null {
    const row = this.db
      .prepare('SELECT * FROM webhook_events WHERE event_id = ?')
      .get(eventId) as any;
    if (!row) return null;
    return {
      event_id: row.event_id,
      event_type: row.event_type,
      payload: row.payload,
      received_at: row.received_at,
      processed: row.processed === 1,
    };
  }

  // ==================== RECOVERY CASES ====================

  createCase(c: RecoveryCase): void {
    this.db
      .prepare(
        `INSERT INTO recovery_cases (
          id, merchant_id, event_id, payment_id, order_id, payment_link_id,
          amount, currency, failure_code, failure_description, payment_method,
          customer_context, attempt_count, status, recoverability_score,
          expected_recovery_value, consent_status, policy_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        c.id,
        c.merchant_id,
        c.event_id,
        c.payment_id,
        c.order_id || null,
        c.payment_link_id || null,
        c.amount,
        c.currency,
        c.failure_code,
        c.failure_description,
        c.payment_method,
        JSON.stringify(c.customer_context),
        c.attempt_count,
        c.status,
        c.recoverability_score,
        c.expected_recovery_value,
        c.consent_status,
        c.policy_version,
        c.created_at,
        c.updated_at
      );
  }

  updateCase(c: Partial<RecoveryCase> & { id: string }): void {
    const existing = this.getCaseById(c.id);
    if (!existing) {
      throw new Error(`Case not found: ${c.id}`);
    }

    const updated: RecoveryCase = {
      ...existing,
      ...c,
      updated_at: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE recovery_cases SET
          merchant_id = ?,
          event_id = ?,
          payment_id = ?,
          order_id = ?,
          payment_link_id = ?,
          amount = ?,
          currency = ?,
          failure_code = ?,
          failure_description = ?,
          payment_method = ?,
          customer_context = ?,
          attempt_count = ?,
          status = ?,
          recoverability_score = ?,
          expected_recovery_value = ?,
          consent_status = ?,
          policy_version = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        updated.merchant_id,
        updated.event_id,
        updated.payment_id,
        updated.order_id || null,
        updated.payment_link_id || null,
        updated.amount,
        updated.currency,
        updated.failure_code,
        updated.failure_description,
        updated.payment_method,
        JSON.stringify(updated.customer_context),
        updated.attempt_count,
        updated.status,
        updated.recoverability_score,
        updated.expected_recovery_value,
        updated.consent_status,
        updated.policy_version,
        updated.updated_at,
        updated.id
      );
  }

  getCaseById(id: string): RecoveryCase | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_cases WHERE id = ?')
      .get(id) as any;
    if (!row) return null;
    return this.mapCaseRow(row);
  }

  getCaseByPaymentId(paymentId: string): RecoveryCase | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_cases WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(paymentId) as any;
    if (!row) return null;
    return this.mapCaseRow(row);
  }

  getCaseByOrderId(orderId: string): RecoveryCase | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_cases WHERE order_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(orderId) as any;
    if (!row) return null;
    return this.mapCaseRow(row);
  }

  listCases(filters?: { status?: CaseStatus; limit?: number; offset?: number }): RecoveryCase[] {
    let sql = 'SELECT * FROM recovery_cases';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapCaseRow(r));
  }

  getDashboardStats(): {
    totalCases: number;
    recoveredCases: number;
    failedCases: number;
    stoppedCases: number;
    escalatedCases: number;
    humanReviewCases: number;
    totalAtRiskAmount: number;
    totalRecoveredAmount: number;
    recoveryRate: number;
  } {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) as count, SUM(amount) as total_amount FROM recovery_cases')
      .get() as any;

    const recoveredRow = this.db
      .prepare("SELECT COUNT(*) as count, SUM(amount) as total_amount FROM recovery_cases WHERE status = 'RECOVERED'")
      .get() as any;

    const failedRow = this.db
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status = 'FAILED'")
      .get() as any;

    const stoppedRow = this.db
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status = 'STOPPED'")
      .get() as any;

    const escalatedRow = this.db
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status = 'ESCALATED'")
      .get() as any;

    const reviewRow = this.db
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status = 'HUMAN_REVIEW'")
      .get() as any;

    const totalCases = totalRow?.count || 0;
    const recoveredCases = recoveredRow?.count || 0;
    const totalAtRiskAmount = totalRow?.total_amount || 0;
    const totalRecoveredAmount = recoveredRow?.total_amount || 0;
    const recoveryRate = totalCases > 0 ? (recoveredCases / totalCases) * 100 : 0;

    return {
      totalCases,
      recoveredCases,
      failedCases: failedRow?.count || 0,
      stoppedCases: stoppedRow?.count || 0,
      escalatedCases: escalatedRow?.count || 0,
      humanReviewCases: reviewRow?.count || 0,
      totalAtRiskAmount,
      totalRecoveredAmount,
      recoveryRate,
    };
  }

  private mapCaseRow(row: any): RecoveryCase {
    return {
      id: row.id,
      merchant_id: row.merchant_id,
      event_id: row.event_id,
      payment_id: row.payment_id,
      order_id: row.order_id,
      payment_link_id: row.payment_link_id,
      amount: row.amount,
      currency: row.currency,
      failure_code: row.failure_code,
      failure_description: row.failure_description,
      payment_method: row.payment_method as PaymentMethod,
      customer_context: JSON.parse(row.customer_context || '{}'),
      attempt_count: row.attempt_count,
      status: row.status as CaseStatus,
      recoverability_score: row.recoverability_score,
      expected_recovery_value: row.expected_recovery_value,
      consent_status: row.consent_status as ConsentStatus,
      policy_version: row.policy_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ==================== DECISIONS ====================

  createDecision(d: Decision): void {
    this.db
      .prepare(
        `INSERT INTO decisions (
          id, case_id, model_provider, model_version, prompt_version,
          diagnosis, evidence, recommended_action, confidence, expected_value, rationale, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.id,
        d.case_id,
        d.model_provider,
        d.model_version,
        d.prompt_version,
        d.diagnosis,
        JSON.stringify(d.evidence),
        d.recommended_action,
        d.confidence,
        d.expected_value,
        d.rationale,
        d.created_at
      );
  }

  getDecisionsByCaseId(caseId: string): Decision[] {
    const rows = this.db
      .prepare('SELECT * FROM decisions WHERE case_id = ? ORDER BY created_at ASC')
      .all(caseId) as any[];

    return rows.map((r) => ({
      id: r.id,
      case_id: r.case_id,
      model_provider: r.model_provider,
      model_version: r.model_version,
      prompt_version: r.prompt_version,
      diagnosis: r.diagnosis,
      evidence: JSON.parse(r.evidence || '[]'),
      recommended_action: r.recommended_action as ApprovedAction,
      confidence: r.confidence,
      expected_value: r.expected_value,
      rationale: r.rationale,
      created_at: r.created_at,
    }));
  }

  getLatestDecisionByCaseId(caseId: string): Decision | null {
    const row = this.db
      .prepare('SELECT * FROM decisions WHERE case_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(caseId) as any;
    if (!row) return null;
    return {
      id: row.id,
      case_id: row.case_id,
      model_provider: row.model_provider,
      model_version: row.model_version,
      prompt_version: row.prompt_version,
      diagnosis: row.diagnosis,
      evidence: JSON.parse(row.evidence || '[]'),
      recommended_action: row.recommended_action as ApprovedAction,
      confidence: row.confidence,
      expected_value: row.expected_value,
      rationale: row.rationale,
      created_at: row.created_at,
    };
  }

  // ==================== POLICY CHECKS ====================

  createPolicyCheck(p: PolicyCheck): void {
    this.db
      .prepare(
        `INSERT INTO policy_checks (
          id, decision_id, case_id, allowed, policy_result, reasons, policy_version, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        p.id,
        p.decision_id,
        p.case_id,
        p.allowed ? 1 : 0,
        p.policy_result,
        JSON.stringify(p.reasons),
        p.policy_version,
        p.created_at
      );
  }

  getPolicyChecksByCaseId(caseId: string): PolicyCheck[] {
    const rows = this.db
      .prepare('SELECT * FROM policy_checks WHERE case_id = ? ORDER BY created_at ASC')
      .all(caseId) as any[];

    return rows.map((r) => ({
      id: r.id,
      decision_id: r.decision_id,
      case_id: r.case_id,
      allowed: r.allowed === 1,
      policy_result: r.policy_result as PolicyResult,
      reasons: JSON.parse(r.reasons || '[]'),
      policy_version: r.policy_version,
      created_at: r.created_at,
    }));
  }

  getLatestPolicyCheckByCaseId(caseId: string): PolicyCheck | null {
    const row = this.db
      .prepare('SELECT * FROM policy_checks WHERE case_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(caseId) as any;
    if (!row) return null;
    return {
      id: row.id,
      decision_id: row.decision_id,
      case_id: row.case_id,
      allowed: row.allowed === 1,
      policy_result: row.policy_result as PolicyResult,
      reasons: JSON.parse(row.reasons || '[]'),
      policy_version: row.policy_version,
      created_at: row.created_at,
    };
  }

  // ==================== TOOL EXECUTIONS ====================

  createToolExecution(t: ToolExecution): void {
    this.db
      .prepare(
        `INSERT INTO tool_executions (
          id, case_id, decision_id, tool_name, idempotency_key, arguments, result, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        t.id,
        t.case_id,
        t.decision_id || null,
        t.tool_name,
        t.idempotency_key,
        JSON.stringify(t.arguments),
        JSON.stringify(t.result),
        t.status,
        t.created_at
      );
  }

  updateToolExecution(id: string, status: 'PENDING' | 'SUCCESS' | 'FAILED', result: Record<string, any>): void {
    this.db
      .prepare('UPDATE tool_executions SET status = ?, result = ? WHERE id = ?')
      .run(status, JSON.stringify(result), id);
  }

  getToolExecutionByIdempotencyKey(key: string): ToolExecution | null {
    const row = this.db
      .prepare('SELECT * FROM tool_executions WHERE idempotency_key = ?')
      .get(key) as any;
    if (!row) return null;
    return {
      id: row.id,
      case_id: row.case_id,
      decision_id: row.decision_id,
      tool_name: row.tool_name,
      idempotency_key: row.idempotency_key,
      arguments: JSON.parse(row.arguments || '{}'),
      result: JSON.parse(row.result || '{}'),
      status: row.status,
      created_at: row.created_at,
    };
  }

  getToolExecutionsByCaseId(caseId: string): ToolExecution[] {
    const rows = this.db
      .prepare('SELECT * FROM tool_executions WHERE case_id = ? ORDER BY created_at ASC')
      .all(caseId) as any[];

    return rows.map((r) => ({
      id: r.id,
      case_id: r.case_id,
      decision_id: r.decision_id,
      tool_name: r.tool_name,
      idempotency_key: r.idempotency_key,
      arguments: JSON.parse(r.arguments || '{}'),
      result: JSON.parse(r.result || '{}'),
      status: r.status,
      created_at: r.created_at,
    }));
  }

  // ==================== AUDIT EVENTS ====================

  createAuditEvent(a: AuditEvent): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (
          id, case_id, event_type, actor, source, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        a.id,
        a.case_id,
        a.event_type,
        a.actor,
        a.source,
        JSON.stringify(a.metadata),
        a.timestamp
      );
  }

  getAuditEventsByCaseId(caseId: string): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events WHERE case_id = ? ORDER BY timestamp ASC')
      .all(caseId) as any[];

    return rows.map((r) => ({
      id: r.id,
      case_id: r.case_id,
      event_type: r.event_type as any,
      actor: r.actor as any,
      source: r.source,
      metadata: JSON.parse(r.metadata || '{}'),
      timestamp: r.timestamp,
    }));
  }

  // ==================== BENCHMARK RUNS ====================

  saveBenchmarkRun(run: {
    id: string;
    seed: number;
    total_cases: number;
    dataset_version: string;
    model_version: string;
    policy_version: string;
    results_json: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO benchmark_runs (
          id, seed, total_cases, dataset_version, model_version, policy_version, created_at, results_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        run.id,
        run.seed,
        run.total_cases,
        run.dataset_version,
        run.model_version,
        run.policy_version,
        new Date().toISOString(),
        run.results_json
      );
  }

  getLatestBenchmarkRun(): any | null {
    const row = this.db
      .prepare('SELECT * FROM benchmark_runs ORDER BY created_at DESC LIMIT 1')
      .get() as any;
    if (!row) return null;
    return {
      ...row,
      results: JSON.parse(row.results_json),
    };
  }
}
