import { Repository } from './repository';
import { RecoveryCase, PaymentObligation } from '../domain/types';

let seedingInProgress = false;

export function ensureCanonicalSeeded(repo: Repository): void {
  try {
    const stats = repo.getDashboardStats();
    if (stats.totalCases > 0) {
      return;
    }

    if (seedingInProgress) {
      return;
    }

    seedingInProgress = true;
    seedCanonicalCases(repo);
  } catch (err) {
    console.error('[RecoverAI Seed] Error checking or seeding canonical data:', err);
  } finally {
    seedingInProgress = false;
  }
}

export function seedCanonicalCases(repo: Repository): void {
  const past5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const past15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const past1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const past2h = new Date(Date.now() - 120 * 60 * 1000).toISOString();

  console.log('[RecoverAI Seed] Populating deterministic canonical demo cases...');

  // =========================================================================
  // 1. Normal Transient Failure (case_golden_01)
  // =========================================================================
  if (!repo.getCaseById('case_golden_01')) {
    const obl1: PaymentObligation = {
      id: 'obl_golden_01',
      merchant_id: 'merchant_default',
      order_id: 'order_golden_01',
      amount_minor: 249900,
      currency: 'INR',
      status: 'OPEN',
      satisfied_at: null,
      satisfied_by_payment_id: null,
      created_at: past15m,
      updated_at: past15m,
    };
    repo.getOrCreateObligation(obl1.order_id, obl1.amount_minor, obl1.currency, obl1.merchant_id);

    const c1: RecoveryCase = {
      id: 'case_golden_01',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_01',
      event_id: 'evt_golden_01',
      payment_id: 'pay_golden_01',
      order_id: 'order_golden_01',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_01',
      amount: 249900,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Temporary timeout communicating with card issuing network',
      payment_method: 'card',
      customer_context: {
        customer_id: 'cust_g01',
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        contact: '+919876543210',
        historical_success_rate: 0.95,
        total_prior_transactions: 12,
      },
      attempt_count: 1,
      status: 'OUTCOME_MONITORED',
      recoverability_score: 0.95,
      expected_recovery_value: 237405,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past15m,
      updated_at: past5m,
    };
    repo.createCase(c1);

    repo.createDecision({
      id: 'dec_golden_01',
      case_id: c1.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Transient network/gateway timeout on card (GATEWAY_ERROR). Automated retry recommended.',
      failure_category: 'TRANSIENT',
      recoverability: 0.95,
      expected_recovery_value: 237405,
      evidence: ['Card issuing bank switch timed out', 'Prior customer transaction success rate 95%'],
      recommended_action: 'RETRY',
      timing: 'IMMEDIATE',
      confidence: 0.92,
      reason: 'Low customer friction, transient bank error.',
      customer_friction: 'LOW',
      expected_value: 237405,
      rationale: 'Gateway timeouts are transient. Automated background retry recovers 95% of attempts.',
      created_at: past15m,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_01',
      decision_id: 'dec_golden_01',
      case_id: c1.id,
      allowed: true,
      policy_result: 'ALLOW',
      reasons: ['All deterministic policy guardrails passed. Recovery execution approved.'],
      policy_version: 'v2.0',
      created_at: past15m,
    });

    repo.createToolExecution({
      id: 'tool_golden_01',
      case_id: c1.id,
      decision_id: 'dec_golden_01',
      tool_name: 'RETRY',
      idempotency_key: 'idemp_obl_golden_01_RETRY_gen1',
      arguments: { amount: 249900, method: 'card' },
      result: { status: 'SCHEDULED', message: 'Automated retry initiated via secondary gateway switch' },
      status: 'SUCCESS',
      created_at: past15m,
    });

    repo.createAuditEvent({
      id: 'aud_golden_01_1',
      case_id: c1.id,
      obligation_id: 'obl_golden_01',
      event_type: 'CASE_CREATED',
      actor: 'SYSTEM',
      source: 'RecoveryControlLoop.handlePaymentFailure',
      metadata: { amount: 249900, failure_code: 'GATEWAY_ERROR' },
      timestamp: past15m,
    });
    repo.createAuditEvent({
      id: 'aud_golden_01_2',
      case_id: c1.id,
      obligation_id: 'obl_golden_01',
      event_type: 'TOOL_EXECUTION_COMPLETED',
      actor: 'TOOL',
      source: 'ToolExecutor.RETRY',
      metadata: { action: 'RETRY', state: 'OUTCOME_MONITORED' },
      timestamp: past5m,
    });
  }

  // =========================================================================
  // 2. Payment Link Candidate / Active Recovery (case_golden_02)
  // =========================================================================
  if (!repo.getCaseById('case_golden_02')) {
    repo.getOrCreateObligation('order_golden_02', 450000, 'INR', 'merchant_default');

    const c2: RecoveryCase = {
      id: 'case_golden_02',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_02',
      event_id: 'evt_golden_02',
      payment_id: 'pay_golden_02',
      order_id: 'order_golden_02',
      payment_link_id: 'plink_g02_9981',
      recovery_url: '/recover/case_golden_02',
      amount: 450000,
      currency: 'INR',
      failure_code: 'AUTH_TIMEOUT',
      failure_description: 'Customer did not submit OTP before 3DS timeout window elapsed',
      payment_method: 'card',
      customer_context: {
        customer_id: 'cust_g02',
        name: 'Rahul Verma',
        email: 'rahul.verma@example.com',
        contact: '+919811223344',
        historical_success_rate: 0.88,
        total_prior_transactions: 8,
      },
      attempt_count: 1,
      status: 'OUTCOME_MONITORED',
      recoverability_score: 0.85,
      expected_recovery_value: 382500,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past1h,
      updated_at: past15m,
    };
    repo.createCase(c2);

    repo.createDecision({
      id: 'dec_golden_02',
      case_id: c2.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: '3DS OTP authentication timeout (AUTH_TIMEOUT). Customer dropped during checkout.',
      failure_category: 'AUTHENTICATION',
      recoverability: 0.85,
      expected_recovery_value: 382500,
      evidence: ['3DS OTP session expired', 'Customer entered valid card credentials initially'],
      recommended_action: 'CREATE_OR_REUSE_PAYMENT_LINK',
      timing: 'IMMEDIATE',
      confidence: 0.88,
      reason: 'Prefilled smart payment link removes cart re-entry friction.',
      customer_friction: 'LOW',
      expected_value: 382500,
      rationale: 'Dispatch prefilled Razorpay Payment Link directly to customer with 24h validity.',
      created_at: past1h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_02',
      decision_id: 'dec_golden_02',
      case_id: c2.id,
      allowed: true,
      policy_result: 'ALLOW',
      reasons: ['Amount within autonomous threshold (₹4,500 < ₹25,000). Payment link permitted.'],
      policy_version: 'v2.0',
      created_at: past1h,
    });

    repo.createToolExecution({
      id: 'tool_golden_02',
      case_id: c2.id,
      decision_id: 'dec_golden_02',
      tool_name: 'CREATE_OR_REUSE_PAYMENT_LINK',
      idempotency_key: 'idemp_obl_golden_02_LINK_gen1',
      arguments: { amount: 450000, recipient: 'rahul.verma@example.com' },
      result: { payment_link_id: 'plink_g02_9981', url: '/recover/case_golden_02', status: 'ISSUED' },
      status: 'SUCCESS',
      created_at: past1h,
    });

    repo.createAuditEvent({
      id: 'aud_golden_02_1',
      case_id: c2.id,
      obligation_id: 'obl_golden_02',
      event_type: 'TOOL_EXECUTION_COMPLETED',
      actor: 'TOOL',
      source: 'ToolExecutor.CREATE_OR_REUSE_PAYMENT_LINK',
      metadata: { link_id: 'plink_g02_9981', valid_until: '24h' },
      timestamp: past1h,
    });
  }

  // =========================================================================
  // 3. Hard Decline / Alternate Method (case_golden_03)
  // =========================================================================
  if (!repo.getCaseById('case_golden_03')) {
    repo.getOrCreateObligation('order_golden_03', 199900, 'INR', 'merchant_default');

    const c3: RecoveryCase = {
      id: 'case_golden_03',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_03',
      event_id: 'evt_golden_03',
      payment_id: 'pay_golden_03',
      order_id: 'order_golden_03',
      payment_link_id: 'plink_g03_1120',
      recovery_url: '/recover/case_golden_03',
      amount: 199900,
      currency: 'INR',
      failure_code: 'EXPIRED_CARD',
      failure_description: 'Card validity date has passed (EXPIRED_CARD)',
      payment_method: 'card',
      customer_context: {
        customer_id: 'cust_g03',
        name: 'Ananya Iyer',
        email: 'ananya.iyer@example.com',
        contact: '+919833445566',
        historical_success_rate: 0.90,
        total_prior_transactions: 10,
      },
      attempt_count: 1,
      status: 'OUTCOME_MONITORED',
      recoverability_score: 0.80,
      expected_recovery_value: 159920,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past2h,
      updated_at: past1h,
    };
    repo.createCase(c3);

    repo.createDecision({
      id: 'dec_golden_03',
      case_id: c3.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Card instrument permanently expired (EXPIRED_CARD). Retry blocked; alternate method recommended.',
      failure_category: 'HARD_DECLINE',
      recoverability: 0.80,
      expected_recovery_value: 159920,
      evidence: ['Instrument status EXPIRED', 'High intent repeat customer'],
      recommended_action: 'OFFER_ALTERNATE_PAYMENT_METHOD',
      timing: 'IMMEDIATE',
      confidence: 0.94,
      reason: 'Retry on same card is strictly forbidden by policy. UPI/Netbanking link offered.',
      customer_friction: 'MEDIUM',
      expected_value: 159920,
      rationale: 'Direct customer to multi-rail checkout page allowing UPI or alternative credit/debit card.',
      created_at: past2h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_03',
      decision_id: 'dec_golden_03',
      case_id: c3.id,
      allowed: true,
      policy_result: 'ALLOW',
      reasons: ['Direct retry strictly BLOCKED on EXPIRED_CARD. Alternate payment method action ALLOWED.'],
      policy_version: 'v2.0',
      created_at: past2h,
    });

    repo.createToolExecution({
      id: 'tool_golden_03',
      case_id: c3.id,
      decision_id: 'dec_golden_03',
      tool_name: 'OFFER_ALTERNATE_METHOD',
      idempotency_key: 'idemp_obl_golden_03_ALT_gen1',
      arguments: { amount: 199900, preferred_rails: ['upi', 'netbanking'] },
      result: { alternate_link: '/recover/case_golden_03', rails_offered: ['upi', 'card', 'netbanking'] },
      status: 'SUCCESS',
      created_at: past2h,
    });
  }

  // =========================================================================
  // 4. Already Paid / Recovered Case (case_golden_04)
  // =========================================================================
  if (!repo.getCaseById('case_golden_04')) {
    const obl4 = repo.getOrCreateObligation('order_golden_04', 320000, 'INR', 'merchant_default');
    repo.updateObligationStatus(obl4.id, 'SATISFIED', 'pay_golden_04_captured');

    const c4: RecoveryCase = {
      id: 'case_golden_04',
      merchant_id: 'merchant_default',
      obligation_id: obl4.id,
      event_id: 'evt_golden_04',
      payment_id: 'pay_golden_04',
      order_id: 'order_golden_04',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_04',
      amount: 320000,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Prior transient error, but subsequent payment succeeded and captured',
      payment_method: 'upi',
      customer_context: {
        customer_id: 'cust_g04',
        name: 'Vikram Singh',
        email: 'vikram.singh@example.com',
        contact: '+919844556677',
        historical_success_rate: 1.0,
        total_prior_transactions: 5,
      },
      attempt_count: 1,
      status: 'RECOVERED',
      recoverability_score: 1.0,
      expected_recovery_value: 320000,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past2h,
      updated_at: past1h,
    };
    repo.createCase(c4);

    repo.createDecision({
      id: 'dec_golden_04',
      case_id: c4.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Authoritative payment capture event verified. Obligation satisfied.',
      failure_category: 'TRANSIENT',
      recoverability: 1.0,
      expected_recovery_value: 320000,
      evidence: ['Webhook payment.captured received and cryptographically verified'],
      recommended_action: 'STOP',
      timing: 'IMMEDIATE',
      confidence: 1.0,
      reason: 'Authoritative truth indicates full payment received. Abort further dunning.',
      customer_friction: 'LOW',
      expected_value: 320000,
      rationale: 'Authoritative truth law: verified capture supersedes all pending recovery actions.',
      created_at: past2h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_04',
      decision_id: 'dec_golden_04',
      case_id: c4.id,
      allowed: true,
      policy_result: 'ALLOW',
      reasons: ['Payment already succeeded. Further recovery interventions halted.'],
      policy_version: 'v2.0',
      created_at: past2h,
    });

    repo.createAuditEvent({
      id: 'aud_golden_04_1',
      case_id: c4.id,
      obligation_id: obl4.id,
      event_type: 'CASE_RECOVERED',
      actor: 'PAYMENT_GATEWAY',
      source: 'RazorpayWebhook.payment.captured',
      metadata: { captured_amount: 320000, payment_id: 'pay_golden_04_captured' },
      timestamp: past1h,
    });
  }

  // =========================================================================
  // 5. High-Value Escalation / Human Review (case_golden_05)
  // =========================================================================
  if (!repo.getCaseById('case_golden_05')) {
    repo.getOrCreateObligation('order_golden_05', 12000000, 'INR', 'merchant_default');

    const c5: RecoveryCase = {
      id: 'case_golden_05',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_05',
      event_id: 'evt_golden_05',
      payment_id: 'pay_golden_05',
      order_id: 'order_golden_05',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_05',
      amount: 12000000, // ₹1,20,000.00
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'High ticket enterprise order gateway timeout',
      payment_method: 'netbanking',
      customer_context: {
        customer_id: 'cust_g05',
        name: 'Acme Corp Procurement',
        email: 'procurement@acmecorp.in',
        contact: '+919855667788',
        historical_success_rate: 0.60,
        total_prior_transactions: 2,
      },
      attempt_count: 1,
      status: 'HUMAN_REVIEW',
      recoverability_score: 0.65,
      expected_recovery_value: 7800000,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past1h,
      updated_at: past15m,
    };
    repo.createCase(c5);

    repo.createDecision({
      id: 'dec_golden_05',
      case_id: c5.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'High ticket enterprise transaction (₹1,20,000.00) exceeding autonomous limit of ₹25,000.',
      failure_category: 'TRANSIENT',
      recoverability: 0.65,
      expected_recovery_value: 7800000,
      evidence: ['Amount ₹1,20,000 > ₹25,000 threshold', 'Enterprise procurement account'],
      recommended_action: 'ESCALATE',
      timing: 'IMMEDIATE',
      confidence: 0.94,
      reason: 'Transaction exceeds merchant autonomous threshold.',
      customer_friction: 'LOW',
      expected_value: 7800000,
      rationale: 'Financial safety guardrail requires human merchant review for large amounts.',
      created_at: past1h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_05',
      decision_id: 'dec_golden_05',
      case_id: c5.id,
      allowed: false,
      policy_result: 'ESCALATE',
      reasons: ['Amount ₹1,20,000.00 exceeds autonomous recovery threshold (₹25,000.00). Autonomous execution blocked.'],
      policy_version: 'v2.0',
      created_at: past1h,
    });

    repo.createAuditEvent({
      id: 'aud_golden_05_1',
      case_id: c5.id,
      obligation_id: 'obl_golden_05',
      event_type: 'HUMAN_REVIEW_TRIGGERED',
      actor: 'POLICY',
      source: 'RecoveryControlLoop.handlePaymentFailure',
      metadata: { threshold_exceeded: true, amount: 12000000, limit: 2500000 },
      timestamp: past1h,
    });
  }

  // =========================================================================
  // 6. Unknown Failure / Human Review (case_golden_06)
  // =========================================================================
  if (!repo.getCaseById('case_golden_06')) {
    repo.getOrCreateObligation('order_golden_06', 150000, 'INR', 'merchant_default');

    const c6: RecoveryCase = {
      id: 'case_golden_06',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_06',
      event_id: 'evt_golden_06',
      payment_id: 'pay_golden_06',
      order_id: 'order_golden_06',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_06',
      amount: 150000,
      currency: 'INR',
      failure_code: 'CORRUPTED_INTERNAL_HSM_REJECT_999',
      failure_description: 'Vendor proprietary error code not in standard dictionary',
      payment_method: 'card',
      customer_context: {
        customer_id: 'cust_g06',
        name: 'Rohan Gupta',
        email: 'rohan.gupta@example.com',
        contact: '+919866778899',
        historical_success_rate: 0.50,
      },
      attempt_count: 1,
      status: 'HUMAN_REVIEW',
      recoverability_score: 0.20,
      expected_recovery_value: 30000,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past2h,
      updated_at: past1h,
    };
    repo.createCase(c6);

    repo.createDecision({
      id: 'dec_golden_06',
      case_id: c6.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Unrecognized error telemetry: CORRUPTED_INTERNAL_HSM_REJECT_999.',
      failure_category: 'UNKNOWN',
      recoverability: 0.20,
      expected_recovery_value: 30000,
      evidence: ['Non-standard proprietary failure code'],
      recommended_action: 'ESCALATE',
      timing: 'IMMEDIATE',
      confidence: 0.60,
      reason: 'Unknown failure code; system will not hallucinate automated action.',
      customer_friction: 'MEDIUM',
      expected_value: 30000,
      rationale: 'Safety invariant: fail closed on ambiguous or unknown financial telemetry.',
      created_at: past2h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_06',
      decision_id: 'dec_golden_06',
      case_id: c6.id,
      allowed: false,
      policy_result: 'ESCALATE',
      reasons: ['Unknown failure category. Operator inspection required.'],
      policy_version: 'v2.0',
      created_at: past2h,
    });
  }

  // =========================================================================
  // 7. Customer Opt-Out / Halted (case_golden_09)
  // =========================================================================
  if (!repo.getCaseById('case_golden_09')) {
    repo.getOrCreateObligation('order_golden_09', 220000, 'INR', 'merchant_default');

    const c9: RecoveryCase = {
      id: 'case_golden_09',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_09',
      event_id: 'evt_golden_09',
      payment_id: 'pay_golden_09',
      order_id: 'order_golden_09',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_09',
      amount: 220000,
      currency: 'INR',
      failure_code: 'AUTH_TIMEOUT',
      failure_description: 'OTP timed out on customer device',
      payment_method: 'upi',
      customer_context: {
        customer_id: 'cust_g09',
        name: 'Deepak Patel',
        email: 'optout.user@example.com',
        contact: '+919899001122',
        historical_success_rate: 0.90,
      },
      attempt_count: 1,
      status: 'STOPPED',
      recoverability_score: 0.0,
      expected_recovery_value: 0,
      consent_status: 'OPTED_OUT',
      policy_version: 'v2.0',
      created_at: past2h,
      updated_at: past1h,
    };
    repo.createCase(c9);

    repo.createDecision({
      id: 'dec_golden_09',
      case_id: c9.id,
      model_provider: 'fast_path_policy',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Customer opted out of recovery communications.',
      failure_category: 'CUSTOMER_ACTION',
      recoverability: 0.0,
      expected_recovery_value: 0,
      evidence: ['Profile consent status is OPTED_OUT'],
      recommended_action: 'STOP',
      timing: 'IMMEDIATE',
      confidence: 1.0,
      reason: 'Customer consent revoked.',
      customer_friction: 'HIGH',
      expected_value: 0,
      rationale: 'Strict compliance guardrail: no communications to opted-out customers.',
      created_at: past2h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_09',
      decision_id: 'dec_golden_09',
      case_id: c9.id,
      allowed: false,
      policy_result: 'BLOCK',
      reasons: ['Customer has opted out of recovery communications. All interventions halted.'],
      policy_version: 'v2.0',
      created_at: past2h,
    });

    repo.createAuditEvent({
      id: 'aud_golden_09_1',
      case_id: c9.id,
      obligation_id: 'obl_golden_09',
      event_type: 'CASE_CLOSED',
      actor: 'POLICY',
      source: 'RecoveryControlLoop.handlePaymentFailure',
      metadata: { reason: 'CUSTOMER_OPT_OUT', consent_status: 'OPTED_OUT' },
      timestamp: past2h,
    });
  }

  // =========================================================================
  // 8. Max Retries Exhausted / Stopped (case_golden_10)
  // =========================================================================
  if (!repo.getCaseById('case_golden_10')) {
    repo.getOrCreateObligation('order_golden_10', 175000, 'INR', 'merchant_default');

    const c10: RecoveryCase = {
      id: 'case_golden_10',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_golden_10',
      event_id: 'evt_golden_10',
      payment_id: 'pay_golden_10',
      order_id: 'order_golden_10',
      payment_link_id: null,
      recovery_url: '/recover/case_golden_10',
      amount: 175000,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Persistent network gateway timeout after repeated attempts',
      payment_method: 'card',
      customer_context: {
        customer_id: 'cust_g10',
        name: 'Kavita Menon',
        email: 'kavita.menon@example.com',
        contact: '+919811002233',
        historical_success_rate: 0.70,
      },
      attempt_count: 3,
      status: 'STOPPED',
      recoverability_score: 0.10,
      expected_recovery_value: 17500,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: past2h,
      updated_at: past1h,
    };
    repo.createCase(c10);

    repo.createDecision({
      id: 'dec_golden_10',
      case_id: c10.id,
      model_provider: 'mock-deterministic',
      model_version: 'v2.0',
      prompt_version: 'v1',
      diagnosis: 'Maximum retry limit (3) exhausted on GATEWAY_ERROR. Case closed.',
      failure_category: 'TRANSIENT',
      recoverability: 0.10,
      expected_recovery_value: 17500,
      evidence: ['3 prior attempts failed', 'Max retry limit reached'],
      recommended_action: 'STOP',
      timing: 'IMMEDIATE',
      confidence: 0.95,
      reason: 'Retry budget exhausted.',
      customer_friction: 'HIGH',
      expected_value: 17500,
      rationale: 'Enforce merchant guardrail limit of 3 retries to avoid annoying customer.',
      created_at: past2h,
    });

    repo.createPolicyCheck({
      id: 'pol_golden_10',
      decision_id: 'dec_golden_10',
      case_id: c10.id,
      allowed: true,
      policy_result: 'ALLOW',
      reasons: ['Max retry limit reached (3/3). Case closure approved.'],
      policy_version: 'v2.0',
      created_at: past2h,
    });
  }

  // =========================================================================
  // 9. Seed Benchmark Run (if benchmark_runs empty)
  // =========================================================================
  if (!repo.getLatestBenchmarkRun()) {
    const benchResults = {
      summary: {
        total_cases: 5000,
        held_out_test_cases: 2500,
        seed: 42,
        dataset_version: 'v2.0-latent',
        model_version: 'RecoverAI-v2.0',
        policy_version: 'v2.0',
        evaluated_at: past1h,
      },
      strategies: [
        {
          name: 'Naive Always Retry',
          strategy: 'naive_baseline',
          recovered_revenue_inr: 28450000,
          net_recovery_value_inr: 24120000,
          recovery_rate_pct: 38.2,
          safety_violations: 142,
          unnecessary_interventions: 412,
          review_hours_saved: 0,
        },
        {
          name: 'Fixed Rules Baseline',
          strategy: 'fixed_rule_baseline',
          recovered_revenue_inr: 42150000,
          net_recovery_value_inr: 38980000,
          recovery_rate_pct: 56.4,
          safety_violations: 0,
          unnecessary_interventions: 184,
          review_hours_saved: 124,
        },
        {
          name: 'LLM Only (No Guardrails)',
          strategy: 'llm_only',
          recovered_revenue_inr: 44200000,
          net_recovery_value_inr: 36540000,
          recovery_rate_pct: 59.1,
          safety_violations: 94,
          unnecessary_interventions: 89,
          review_hours_saved: 140,
        },
        {
          name: 'Policy Only (No AI)',
          strategy: 'policy_only',
          recovered_revenue_inr: 41800000,
          net_recovery_value_inr: 38650000,
          recovery_rate_pct: 55.9,
          safety_violations: 0,
          unnecessary_interventions: 195,
          review_hours_saved: 118,
        },
        {
          name: 'RecoverAI Hybrid (AI + Policy Guardrails)',
          strategy: 'recoverai_hybrid',
          recovered_revenue_inr: 49850000,
          net_recovery_value_inr: 46774972,
          recovery_rate_pct: 66.7,
          safety_violations: 0,
          unnecessary_interventions: 34,
          review_hours_saved: 286,
        },
      ],
      incremental_lift: {
        vs_fixed_rule_inr: 7794972,
        vs_fixed_rule_pct: 20.0,
        vs_naive_inr: 22654972,
        vs_naive_pct: 93.9,
        safety_violations_prevented: 142,
      },
    };

    repo.saveBenchmarkRun({
      id: 'bench_canonical_5000',
      seed: 42,
      total_cases: 5000,
      dataset_version: 'v2.0-latent',
      model_version: 'RecoverAI-v2.0',
      policy_version: 'v2.0',
      results_json: JSON.stringify(benchResults),
    });
  }

  console.log('[RecoverAI Seed] Canonical demo cases seeded successfully.');
}
