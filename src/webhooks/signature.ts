import crypto from 'node:crypto';

export class WebhookSignatureVerifier {
  /**
   * Validates Razorpay Webhook HMAC-SHA256 signature against the raw request body.
   */
  static verify(rawBody: string, signature: string | null | undefined, secret?: string): boolean {
    const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // If no secret configured (local dev/simulator mode), allow simulation if explicitly in mock mode
    if (!webhookSecret) {
      if (process.env.LLM_PROVIDER === 'mock' || !process.env.RAZORPAY_KEY_ID) {
        return true;
      }
      return false;
    }

    if (!signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      const signatureBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Helper to generate a valid signature for tests or simulation events.
   */
  static generateSignature(rawBody: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  }
}
