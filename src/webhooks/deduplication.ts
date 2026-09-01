import { Repository } from '../db/repository';

export class WebhookDeduplicator {
  constructor(private repository: Repository) {}

  /**
   * Attempts to register and lock the event ID.
   * Returns true if event is unique and accepted, false if it is a duplicate.
   */
  processEvent(eventId: string, eventType: string, rawPayload: string): { isDuplicate: boolean } {
    const isNew = this.repository.recordWebhookEvent(eventId, eventType, rawPayload);
    return {
      isDuplicate: !isNew,
    };
  }
}
