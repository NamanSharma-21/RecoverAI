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
  CustomerFriction,
  PaymentObligation,
  ObligationStatus,
  RecoveryAction,
  ActionLifecycleStatus,
  CommunicationAttempt,
} from '../domain/types';

export class Repository {
  constructor(private db: DatabaseSync) {}

  // ==================== PAYMENT OBLIGATIONS ====================

  getOrCreateObligation(
    orderId: string,
    arg2: number | string,
    arg3?: string | number,
    arg4?: string
  ): PaymentObligation {
    const existing = this.getObligationByOrderId(orderId);
    if (existing) {
      return existing;
    }

    let amountMinor: number;
    let currency: string = 'INR';
    let merchantId: string = 'merchant_default';

    if (typeof arg2 === 'string') {
      merchantId = arg2;
      amountMinor = typeof arg3 === 'number' ? arg3 : 0;
      currency = typeof arg4 === 'string' ? arg4 : 'INR';
    } else {
      amountMinor = arg2;
      currency = typeof arg3 === 'string' ? arg3 : 'INR';
      merchantId = typeof arg4 === 'string' ? arg4 : 'merchant_default';
    }

    const now = new Date().toISOString();
    const id = `obl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const obligation: PaymentObligation = {
      id,
      merchant_id: merchantId,
      order_id: orderId,
      amount_minor: amountMinor,
      currency,
      status: 'OPEN',
      satisfied_at: null,
      satisfied_by_payment_id: null,
      created_at: now,
      updated_at: now,
    };

    this.db
      .prepare(
        `INSERT INTO payment_obligations (
          id, merchant_id, order_id, amount_minor, currency, status,
          satisfied_at, satisfied_by_payment_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        obligation.id,
        obligation.merchant_id,
        obligation.order_id,
        obligation.amount_minor,
        obligation.currency,
        obligation.status,
        obligation.satisfied_at || null,
        obligation.satisfied_by_payment_id || null,
        obligation.created_at,
        obligation.updated_at
      );

    return obligation;
  }

  getObligationById(id: string): PaymentObligation | null {
    const row = this.db
      .prepare('SELECT * FROM payment_obligations WHERE id = ?')
      .get(id) as any;
    if (!row) return null;
    return this.mapObligationRow(row);
  }

  getObligationByOrderId(orderId: string): PaymentObligation | null {
    const row = this.db
      .prepare('SELECT * FROM payment_obligations WHERE order_id = ?')
      .get(orderId) as any;
    if (!row) return null;
    return this.mapObligationRow(row);
  }

  updateObligationStatus(
    id: string,
    status: ObligationStatus,
    satisfiedByPaymentId?: string | null
  ): PaymentObligation | null {
    const now = new Date().toISOString();
    const satisfiedAt = status === 'SATISFIED' ? now : null;

    this.db
      .prepare(
        `UPDATE payment_obligations SET
          status = ?,
          satisfied_at = CASE WHEN ? = 'SATISFIED' AND satisfied_at IS NULL THEN ? ELSE satisfied_at END,
          satisfied_by_payment_id = COALESCE(?, satisfied_by_payment_id),
          updated_at = ?
        WHERE id = ?`
      )
      .run(status, status, satisfiedAt, satisfiedByPaymentId || null, now, id);

    return this.getObligationById(id);
  }

  listObligations(): PaymentObligation[] {
    const rows = this.db
      .prepare('SELECT * FROM payment_obligations ORDER BY created_at DESC')
      .all() as any[];
    return rows.map((r) => this.mapObligationRow(r));
  }

  private mapObligationRow(row: any): PaymentObligation {
    return {
      id: row.id,
      merchant_id: row.merchant_id,
      order_id: row.order_id,
      amount_minor: row.amount_minor,
      currency: row.currency,
      status: row.status as ObligationStatus,
      satisfied_at: row.satisfied_at,
      satisfied_by_payment_id: row.satisfied_by_payment_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
    };
  }

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

  createCase(c: RecoveryCase): RecoveryCase {
    const now = new Date().toISOString();
    const caseRecord: RecoveryCase = {
      ...c,
      created_at: c.created_at || now,
      updated_at: c.updated_at || now,
    };

    this.db
      .prepare(
        `INSERT INTO recovery_cases (
          id, merchant_id, obligation_id, event_id, payment_id, order_id, payment_link_id, recovery_url,
          amount, currency, failure_code, failure_description, payment_method,
          customer_context, attempt_count, status, recoverability_score,
          expected_recovery_value, consent_status, policy_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        caseRecord.id,
        caseRecord.merchant_id,
        caseRecord.obligation_id || null,
        caseRecord.event_id,
        caseRecord.payment_id,
        caseRecord.order_id || null,
        caseRecord.payment_link_id || null,
        caseRecord.recovery_url || null,
        caseRecord.amount,
        caseRecord.currency,
        caseRecord.failure_code,
        caseRecord.failure_description,
        caseRecord.payment_method,
        JSON.stringify(caseRecord.customer_context || {}),
        caseRecord.attempt_count,
        caseRecord.status,
        caseRecord.recoverability_score,
        caseRecord.expected_recovery_value,
        caseRecord.consent_status,
        caseRecord.policy_version,
        caseRecord.created_at,
        caseRecord.updated_at
      );

    return caseRecord;
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
          obligation_id = ?,
          event_id = ?,
          payment_id = ?,
          order_id = ?,
          payment_link_id = ?,
          recovery_url = ?,
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
        updated.obligation_id || null,
        updated.event_id,
        updated.payment_id,
        updated.order_id || null,
        updated.payment_link_id || null,
        updated.recovery_url || null,
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

  getCaseByPaymentLinkId(paymentLinkId: string): RecoveryCase | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_cases WHERE payment_link_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(paymentLinkId) as any;
    if (!row) return null;
    return this.mapCaseRow(row);
  }

  /**
   * Lists cases sorted by economic priority:
   * 1. Amount at risk (DESC)
   * 2. Recoverability score (DESC)
   * 3. Urgency / creation date (DESC)
   */
  listCases(filters?: { status?: CaseStatus; limit?: number; offset?: number }): RecoveryCase[] {
    let sql = 'SELECT * FROM recovery_cases';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }

    // Prioritized ranking: High Amount -> High Recoverability -> Newest
    sql += ' ORDER BY amount DESC, recoverability_score DESC, created_at DESC';

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
    activeRecoveriesCount: number;
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
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status IN ('FAILED', 'FAILED_RECOVERY')")
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

    const activeRow = this.db
      .prepare("SELECT COUNT(*) as count FROM recovery_cases WHERE status IN ('ACTION_EXECUTED', 'OUTCOME_MONITORED', 'ACTION_PENDING', 'ANALYZING', 'DECISION_READY', 'POLICY_CHECK', 'DIAGNOSED', 'PRIORITIZED', 'ACTION_SELECTED', 'POLICY_CHECKED')")
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
      activeRecoveriesCount: activeRow?.count || 0,
      totalAtRiskAmount,
      totalRecoveredAmount,
      recoveryRate,
    };
  }

  private mapCaseRow(row: any): RecoveryCase {
    return {
      id: row.id,
      merchant_id: row.merchant_id,
      obligation_id: row.obligation_id || null,
      event_id: row.event_id,
      payment_id: row.payment_id,
      order_id: row.order_id,
      payment_link_id: row.payment_link_id,
      recovery_url: row.recovery_url,
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
          diagnosis, failure_category, recoverability, expected_recovery_value, evidence, recommended_action, timing, confidence,
          reason, customer_friction, expected_value, rationale, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        d.id,
        d.case_id,
        d.model_provider,
        d.model_version,
        d.prompt_version,
        d.diagnosis,
        d.failure_category || 'TRANSIENT',
        d.recoverability ?? 0.5,
        d.expected_recovery_value ?? 0,
        JSON.stringify(d.evidence || []),
        d.recommended_action,
        d.timing || 'IMMEDIATE',
        d.confidence,
        d.reason || d.rationale || '',
        d.customer_friction || 'LOW',
        d.expected_value,
        d.rationale || d.reason || '',
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
      failure_category: r.failure_category || 'TRANSIENT',
      recoverability: r.recoverability ?? 0.5,
      expected_recovery_value: r.expected_recovery_value ?? 0,
      evidence: JSON.parse(r.evidence || '[]'),
      recommended_action: r.recommended_action as ApprovedAction,
      timing: r.timing || 'IMMEDIATE',
      confidence: r.confidence,
      reason: r.reason || r.rationale || '',
      customer_friction: (r.customer_friction || 'LOW') as CustomerFriction,
      expected_value: r.expected_value,
      rationale: r.rationale || r.reason || '',
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
      failure_category: row.failure_category || 'TRANSIENT',
      recoverability: row.recoverability ?? 0.5,
      expected_recovery_value: row.expected_recovery_value ?? 0,
      evidence: JSON.parse(row.evidence || '[]'),
      recommended_action: row.recommended_action as ApprovedAction,
      timing: row.timing || 'IMMEDIATE',
      confidence: row.confidence,
      reason: row.reason || row.rationale || '',
      customer_friction: (row.customer_friction || 'LOW') as CustomerFriction,
      expected_value: row.expected_value,
      rationale: row.rationale || row.reason || '',
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

  // ==================== RECOVERY ACTIONS ====================

  createRecoveryAction(a: Partial<RecoveryAction> & {
    obligation_id: string;
    case_id: string;
    action_type: ApprovedAction;
    idempotency_key: string;
  }): RecoveryAction {
    const now = new Date().toISOString();
    const action: RecoveryAction = {
      id: a.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      case_id: a.case_id,
      obligation_id: a.obligation_id,
      action_type: a.action_type,
      generation: a.generation ?? 1,
      idempotency_key: a.idempotency_key,
      status: a.status || 'POLICY_ALLOWED',
      valid_until: a.valid_until || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      claim_worker_id: a.claim_worker_id || null,
      claim_expires_at: a.claim_expires_at || null,
      arguments: a.arguments || {},
      result: a.result || {},
      created_at: a.created_at || now,
      updated_at: a.updated_at || now,
    };

    this.db
      .prepare(
        `INSERT INTO recovery_actions (
          id, case_id, obligation_id, action_type, generation, idempotency_key,
          status, valid_until, claim_worker_id, claim_expires_at, arguments, result, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        action.id,
        action.case_id,
        action.obligation_id,
        action.action_type,
        action.generation,
        action.idempotency_key,
        action.status,
        action.valid_until || null,
        action.claim_worker_id || null,
        action.claim_expires_at || null,
        JSON.stringify(action.arguments || {}),
        JSON.stringify(action.result || null),
        action.created_at,
        action.updated_at
      );

    return action;
  }

  getRecoveryActionById(id: string): RecoveryAction | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_actions WHERE id = ?')
      .get(id) as any;
    if (!row) return null;
    return this.mapRecoveryActionRow(row);
  }

  getRecoveryActionByIdempotencyKey(key: string): RecoveryAction | null {
    const row = this.db
      .prepare('SELECT * FROM recovery_actions WHERE idempotency_key = ?')
      .get(key) as any;
    if (!row) return null;
    return this.mapRecoveryActionRow(row);
  }

  getRecoveryActionsByCaseId(caseId: string): RecoveryAction[] {
    const rows = this.db
      .prepare('SELECT * FROM recovery_actions WHERE case_id = ? ORDER BY created_at ASC')
      .all(caseId) as any[];
    return rows.map((r) => this.mapRecoveryActionRow(r));
  }

  getRecoveryActionsByObligationId(obligationId: string): RecoveryAction[] {
    const rows = this.db
      .prepare('SELECT * FROM recovery_actions WHERE obligation_id = ? ORDER BY created_at ASC')
      .all(obligationId) as any[];
    return rows.map((r) => this.mapRecoveryActionRow(r));
  }

  updateRecoveryActionStatus(
    id: string,
    status: ActionLifecycleStatus,
    result?: Record<string, any>
  ): void {
    const now = new Date().toISOString();
    if (result) {
      this.db
        .prepare('UPDATE recovery_actions SET status = ?, result = ?, updated_at = ? WHERE id = ?')
        .run(status, JSON.stringify(result), now, id);
    } else {
      this.db
        .prepare('UPDATE recovery_actions SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, now, id);
    }
  }

  claimActionForExecution(actionId: string, workerId: string, leaseDurationMs: number = 30000): boolean {
    const now = new Date();
    const claimExpiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
    const nowIso = now.toISOString();

    const info = this.db
      .prepare(
        `UPDATE recovery_actions
         SET status = 'CLAIMED',
             claim_worker_id = ?,
             claim_expires_at = ?,
             updated_at = ?
         WHERE id = ?
           AND (status = 'POLICY_ALLOWED' OR (status = 'CLAIMED' AND claim_expires_at < ?))`
      )
      .run(workerId, claimExpiresAt, nowIso, actionId, nowIso);

    return Number(info.changes) > 0;
  }

  cancelPendingActionsForObligation(obligationId: string, reason: string): number {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare(
        "SELECT id, result FROM recovery_actions WHERE obligation_id = ? AND status IN ('PROPOSED', 'POLICY_ALLOWED', 'CLAIMED')"
      )
      .all(obligationId) as any[];

    for (const row of rows) {
      const existingResult = JSON.parse(row.result || '{}');
      existingResult.cancellation_reason = reason;
      this.db
        .prepare(
          "UPDATE recovery_actions SET status = 'CANCELLED', result = ?, updated_at = ? WHERE id = ?"
        )
        .run(JSON.stringify(existingResult), now, row.id);
    }

    return rows.length;
  }

  private mapRecoveryActionRow(r: any): RecoveryAction {
    return {
      id: r.id,
      case_id: r.case_id,
      obligation_id: r.obligation_id,
      action_type: r.action_type as ApprovedAction,
      generation: r.generation,
      idempotency_key: r.idempotency_key,
      status: r.status as ActionLifecycleStatus,
      valid_until: r.valid_until,
      claim_worker_id: r.claim_worker_id,
      claim_expires_at: r.claim_expires_at,
      arguments: JSON.parse(r.arguments || '{}'),
      result: JSON.parse(r.result || '{}'),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  // ==================== COMMUNICATION LEDGER ====================

  recordCommunicationAttempt(attempt: CommunicationAttempt): void {
    this.db
      .prepare(
        `INSERT INTO communication_ledger (
          id, obligation_id, case_id, customer_id, channel, template,
          status, sent_at, delivered_at, failed_at, error_reason, simulated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        attempt.id,
        attempt.obligation_id,
        attempt.case_id,
        attempt.customer_id || null,
        attempt.channel,
        attempt.template,
        attempt.status,
        attempt.sent_at,
        attempt.delivered_at || null,
        attempt.failed_at || null,
        attempt.error_reason || null,
        attempt.simulated ? 1 : 0
      );
  }

  getRecentCommunications(obligationId: string, windowHours: number = 24): CommunicationAttempt[] {
    const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    const rows = this.db
      .prepare(
        'SELECT * FROM communication_ledger WHERE obligation_id = ? AND sent_at >= ? ORDER BY sent_at DESC'
      )
      .all(obligationId, cutoff) as any[];

    return rows.map((r) => this.mapCommunicationRow(r));
  }

  getCommunicationCount(obligationId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM communication_ledger WHERE obligation_id = ? AND status != 'SUPPRESSED'"
      )
      .get(obligationId) as any;
    return row?.count || 0;
  }

  getCommunicationsByCaseId(caseId: string): CommunicationAttempt[] {
    const rows = this.db
      .prepare('SELECT * FROM communication_ledger WHERE case_id = ? ORDER BY sent_at DESC')
      .all(caseId) as any[];
    return rows.map((r) => this.mapCommunicationRow(r));
  }

  private mapCommunicationRow(r: any): CommunicationAttempt {
    return {
      id: r.id,
      obligation_id: r.obligation_id,
      case_id: r.case_id,
      customer_id: r.customer_id,
      channel: r.channel,
      template: r.template,
      status: r.status,
      sent_at: r.sent_at,
      delivered_at: r.delivered_at,
      failed_at: r.failed_at,
      error_reason: r.error_reason,
      simulated: r.simulated === 1,
    };
  }

  // ==================== AUDIT EVENTS ====================

  createAuditEvent(a: AuditEvent): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (
          id, case_id, obligation_id, event_type, actor, source, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        a.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        a.case_id,
        a.obligation_id || null,
        a.event_type,
        a.actor || 'system',
        a.source || 'system',
        JSON.stringify(a.metadata || {}),
        a.timestamp || new Date().toISOString()
      );
  }

  getAuditEventsByCaseId(caseId: string): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events WHERE case_id = ? ORDER BY timestamp ASC')
      .all(caseId) as any[];

    return rows.map((r) => ({
      id: r.id,
      case_id: r.case_id,
      obligation_id: r.obligation_id || null,
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

  // ==================== MERCHANT SETTINGS ====================

  getMerchantSettings(merchantId: string = 'merchant_default'): any | null {
    const row = this.db
      .prepare('SELECT * FROM merchant_settings WHERE merchant_id = ?')
      .get(merchantId) as any;
    if (!row) return null;
    return JSON.parse(row.settings_json);
  }

  saveMerchantSettings(merchantId: string, settings: any): void {
    this.db
      .prepare(
        `INSERT INTO merchant_settings (merchant_id, settings_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(merchant_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`
      )
      .run(merchantId, JSON.stringify(settings), new Date().toISOString());
  }
}
