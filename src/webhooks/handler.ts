import { Repository } from '../db/repository';
import { WebhookSignatureVerifier } from './signature';
import { WebhookDeduplicator } from './deduplication';
import { RecoveryControlLoop } from '../orchestrator/recovery-loop';
import { RazorpayWebhookPayloadSchema } from '../domain/schemas';

export interface WebhookProcessingResult {
  statusCode: number;
  body: {
    success: boolean;
    status: 'ACCEPTED' | 'DUPLICATE' | 'INVALID_SIGNATURE' | 'MALFORMED' | 'IGNORED';
    message: string;
    eventId?: string;
  };
}

export class WebhookHandler {
  private deduplicator: WebhookDeduplicator;

  constructor(
    private repository: Repository,
    private recoveryLoop: RecoveryControlLoop,
    private webhookSecret?: string
  ) {
    this.deduplicator = new WebhookDeduplicator(repository);
  }

  async handleWebhook(
    rawBody: string,
    signatureHeader: string | null | undefined
  ): Promise<WebhookProcessingResult> {
    // 1. Signature Verification
    const isValidSignature = WebhookSignatureVerifier.verify(
      rawBody,
      signatureHeader,
      this.webhookSecret
    );

    if (!isValidSignature) {
      return {
        statusCode: 400,
        body: {
          success: false,
          status: 'INVALID_SIGNATURE',
          message: 'Invalid Razorpay webhook signature.',
        },
      };
    }

    // 2. Parse & Validate Payload JSON
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      return {
        statusCode: 400,
        body: {
          success: false,
          status: 'MALFORMED',
          message: 'Invalid JSON body.',
        },
      };
    }

    const eventId =
      parsedPayload.event_id ||
      parsedPayload.id ||
      `evt_${parsedPayload.event}_${parsedPayload.created_at || Date.now()}`;
    const eventType = parsedPayload.event || 'unknown';

    // 3. Deduplication Check
    const { isDuplicate } = this.deduplicator.processEvent(eventId, eventType, rawBody);
    if (isDuplicate) {
      // Record audit event for duplicate observability
      const paymentId = parsedPayload.payload?.payment?.entity?.id;
      const existingCase = paymentId ? this.repository.getCaseByPaymentId(paymentId) : null;

      if (existingCase) {
        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          case_id: existingCase.id,
          event_type: 'WEBHOOK_DUPLICATE_SUPPRESSED',
          actor: 'SYSTEM',
          source: 'WebhookHandler',
          metadata: { event_id: eventId, event_type: eventType },
          timestamp: new Date().toISOString(),
        });
      }

      return {
        statusCode: 200,
        body: {
          success: true,
          status: 'DUPLICATE',
          eventId,
          message: 'Duplicate event acknowledged and suppressed from re-execution.',
        },
      };
    }

    // 4. Process event based on type
    if (eventType === 'payment.failed' || eventType === 'payment_link.cancelled') {
      const paymentEntity = parsedPayload.payload?.payment?.entity;
      const linkEntity = parsedPayload.payload?.payment_link?.entity;

      const paymentId = paymentEntity?.id || `pay_${Date.now()}`;
      const amount = paymentEntity?.amount || linkEntity?.amount || 0;
      const currency = paymentEntity?.currency || linkEntity?.currency || 'INR';
      const failureCode = paymentEntity?.error_code || 'GATEWAY_ERROR';
      const failureDescription = paymentEntity?.error_description || 'Payment failed at gateway';
      const method = paymentEntity?.method || 'card';

      // Asynchronous background trigger or immediate execution
      await this.recoveryLoop.handlePaymentFailure({
        eventId,
        paymentId,
        orderId: paymentEntity?.order_id || null,
        paymentLinkId: linkEntity?.id || null,
        amount,
        currency,
        failureCode,
        failureDescription,
        paymentMethod: method as any,
        customerContext: {
          email: paymentEntity?.email || linkEntity?.customer?.email,
          contact: paymentEntity?.contact || linkEntity?.customer?.contact,
        },
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          status: 'ACCEPTED',
          eventId,
          message: 'Failure event ingested and recovery control loop initiated.',
        },
      };
    } else if (
      eventType === 'payment.captured' ||
      eventType === 'payment.authorized' ||
      eventType === 'payment_link.paid'
    ) {
      const paymentEntity = parsedPayload.payload?.payment?.entity;
      const linkEntity = parsedPayload.payload?.payment_link?.entity;

      const paymentId = paymentEntity?.id || `pay_${Date.now()}`;
      const orderId = paymentEntity?.order_id;
      const amount = paymentEntity?.amount || linkEntity?.amount || 0;

      await this.recoveryLoop.handlePaymentSuccess({
        paymentId,
        orderId,
        paymentLinkId: linkEntity?.id,
        amount,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          status: 'ACCEPTED',
          eventId,
          message: 'Payment success event ingested and case updated to RECOVERED.',
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        status: 'IGNORED',
        eventId,
        message: `Event '${eventType}' received but not configured for recovery intervention.`,
      },
    };
  }
}
