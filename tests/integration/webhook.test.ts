import { describe, it, expect, beforeEach } from 'vitest';
import { WebhookSignatureVerifier } from '../../src/webhooks/signature';
import { WebhookHandler } from '../../src/webhooks/handler';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { Repository } from '../../src/db/repository';
import { createMemoryDatabase } from '../../src/db/database';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';

describe('Webhook Integration & Signature Verification Tests', () => {
  const secret = 'test_webhook_secret_key_123';
  let repo: Repository;
  let handler: WebhookHandler;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    const provider = new SimulatorAdapter();
    const toolExecutor = new ToolExecutor(provider, repo);
    const loop = new RecoveryControlLoop(repo, toolExecutor);
    handler = new WebhookHandler(repo, loop, secret);
  });

  it('verifies valid HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ event: 'payment.failed', id: 'evt_sig_1' });
    const signature = WebhookSignatureVerifier.generateSignature(payload, secret);

    const isValid = WebhookSignatureVerifier.verify(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('rejects invalid or forged HMAC signature', () => {
    const payload = JSON.stringify({ event: 'payment.failed', id: 'evt_sig_2' });
    const forgedSignature = 'forged_fake_signature_hash_value_999999999999999999999999999999999999999999999999';

    const isValid = WebhookSignatureVerifier.verify(payload, forgedSignature, secret);
    expect(isValid).toBe(false);
  });

  it('rejects missing signature when secret is configured', () => {
    const payload = JSON.stringify({ event: 'payment.failed', id: 'evt_sig_3' });
    const isValid = WebhookSignatureVerifier.verify(payload, null, secret);
    expect(isValid).toBe(false);
  });

  it('achieves 100% duplicate event suppression', async () => {
    const rawPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.failed',
      event_id: 'evt_dedup_unique_101',
      payload: {
        payment: {
          entity: {
            id: 'pay_dedup_101',
            amount: 250000,
            currency: 'INR',
            status: 'failed',
            method: 'card',
            error_code: 'GATEWAY_ERROR',
            error_description: 'Gateway timeout',
          },
        },
      },
      created_at: Date.now(),
    });

    const sig = WebhookSignatureVerifier.generateSignature(rawPayload, secret);

    // 1st delivery
    const res1 = await handler.handleWebhook(rawPayload, sig);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.status).toBe('ACCEPTED');

    // 2nd delivery (exact duplicate)
    const res2 = await handler.handleWebhook(rawPayload, sig);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.status).toBe('DUPLICATE');

    // Verify only ONE recovery case and ONE tool execution exists
    const cases = repo.listCases();
    expect(cases.length).toBe(1);

    const toolExecs = repo.getToolExecutionsByCaseId(cases[0].id);
    expect(toolExecs.length).toBe(1);

    // Verify duplicate suppression is visible in audit events
    const audits = repo.getAuditEventsByCaseId(cases[0].id);
    expect(audits.some((a) => a.event_type === 'WEBHOOK_DUPLICATE_SUPPRESSED')).toBe(true);
  });

  it('handles payment success event and marks case RECOVERED', async () => {
    // 1. First trigger failure
    const failPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.failed',
      event_id: 'evt_flow_01',
      payload: {
        payment: {
          entity: {
            id: 'pay_flow_01',
            amount: 150000,
            currency: 'INR',
            status: 'failed',
            method: 'upi',
            error_code: 'AUTH_TIMEOUT',
            error_description: 'User timed out',
          },
        },
      },
      created_at: Date.now(),
    });

    const failSig = WebhookSignatureVerifier.generateSignature(failPayload, secret);
    await handler.handleWebhook(failPayload, failSig);

    const c = repo.getCaseByPaymentId('pay_flow_01');
    expect(c).not.toBeNull();
    expect(c?.status).toBe('OUTCOME_MONITORED');

    // 2. Ingest success event for same payment
    const successPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.captured',
      event_id: 'evt_flow_02_succ',
      payload: {
        payment: {
          entity: {
            id: 'pay_flow_01',
            amount: 150000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
      created_at: Date.now(),
    });

    const succSig = WebhookSignatureVerifier.generateSignature(successPayload, secret);
    const succRes = await handler.handleWebhook(successPayload, succSig);
    expect(succRes.body.status).toBe('ACCEPTED');

    const updatedCase = repo.getCaseByPaymentId('pay_flow_01');
    expect(updatedCase?.status).toBe('RECOVERED');
  });
});
