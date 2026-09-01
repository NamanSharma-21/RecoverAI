import {
  SimulatedObservableCase,
  HiddenLatentState,
  LatentOutageType,
  LatentCustomerIntent,
} from './latent-engine';
import { PaymentMethod, ConsentStatus } from '../domain/types';

/**
 * Seeded Mulberry32 pseudo-random number generator for 100% reproducible benchmark datasets.
 */
class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(items: T[]): T {
    return items[this.nextInt(0, items.length - 1)];
  }
}

export type BenchmarkArchetype =
  | 'HIGH_VALUE_TRANSIENT'
  | 'REPEATED_LOW_VALUE'
  | 'EXPIRED_PAYMENT_METHOD'
  | 'PREVIOUSLY_RECOVERABLE'
  | 'SUSPICIOUS_HIGH_RISK'
  | 'RECOVERY_SHOULD_STOP';

export class DatasetGenerator {
  /**
   * Generates a seeded synthetic benchmark dataset of N cases (Default: 5,000 cases).
   * Incorporates the 6 realistic payment recovery archetypes.
   */
  static generateSeededDataset(
    count: number = 5000,
    seed: number = 42
  ): {
    trainCases: SimulatedObservableCase[];
    heldOutCases: SimulatedObservableCase[];
  } {
    const rng = new Mulberry32(seed);
    const allCases: SimulatedObservableCase[] = [];

    const archetypes: BenchmarkArchetype[] = [
      'HIGH_VALUE_TRANSIENT',
      'HIGH_VALUE_TRANSIENT',
      'REPEATED_LOW_VALUE',
      'REPEATED_LOW_VALUE',
      'REPEATED_LOW_VALUE',
      'EXPIRED_PAYMENT_METHOD',
      'EXPIRED_PAYMENT_METHOD',
      'PREVIOUSLY_RECOVERABLE',
      'PREVIOUSLY_RECOVERABLE',
      'PREVIOUSLY_RECOVERABLE',
      'SUSPICIOUS_HIGH_RISK',
      'RECOVERY_SHOULD_STOP',
    ];

    for (let i = 1; i <= count; i++) {
      const archetype = rng.choice(archetypes);

      let code = 'GATEWAY_ERROR';
      let desc = 'Temporary gateway timeout during bank settlement';
      let method: PaymentMethod = 'card';
      let outage: LatentOutageType = 'TRANSIENT_GATEWAY';
      let intent: LatentCustomerIntent = 'HIGH';
      let amount = rng.nextInt(99900, 499900); // Default ₹999 - ₹4,999
      let consentStatus: ConsentStatus = 'CONSENTED';
      let attemptCount = 1;
      let priorTx = rng.nextInt(2, 10);
      let successRate = 0.85;

      switch (archetype) {
        case 'HIGH_VALUE_TRANSIENT':
          code = 'GATEWAY_ERROR';
          desc = 'High-ticket order gateway timeout at bank node';
          method = rng.choice(['netbanking', 'card', 'upi']);
          outage = 'TRANSIENT_GATEWAY';
          intent = 'HIGH';
          amount = rng.nextInt(5000000, 15000000); // ₹50,000 - ₹1,50,000
          priorTx = rng.nextInt(5, 25);
          successRate = 0.95;
          attemptCount = 1;
          break;

        case 'REPEATED_LOW_VALUE':
          code = 'INSUFFICIENT_FUNDS';
          desc = 'Account balance deficit on micro-transaction';
          method = 'upi';
          outage = 'BALANCE_DEFICIT';
          intent = 'MEDIUM';
          amount = rng.nextInt(19900, 99900); // ₹199 - ₹999
          priorTx = rng.nextInt(1, 4);
          successRate = 0.50;
          attemptCount = rng.choice([1, 2]);
          break;

        case 'EXPIRED_PAYMENT_METHOD':
          code = 'EXPIRED_CARD';
          desc = 'Card instrument expired; recurring token invalid';
          method = 'card';
          outage = 'EXPIRED_INSTRUMENT';
          intent = 'HIGH';
          amount = rng.nextInt(150000, 800000); // ₹1,500 - ₹8,000
          priorTx = rng.nextInt(3, 12);
          successRate = 0.80;
          attemptCount = 1;
          break;

        case 'PREVIOUSLY_RECOVERABLE':
          code = 'AUTH_TIMEOUT';
          desc = '3DS OTP screen abandoned before user submit';
          method = 'card';
          outage = 'AUTH_DROPOUT';
          intent = 'HIGH';
          amount = rng.nextInt(100000, 1200000); // ₹1,000 - ₹12,000
          priorTx = rng.nextInt(2, 8);
          successRate = 0.90;
          attemptCount = 1;
          break;

        case 'SUSPICIOUS_HIGH_RISK':
          code = 'CARD_BLOCKED';
          desc = 'Declined by issuer risk scoring engine';
          method = 'card';
          outage = 'STOLEN_OR_BLOCKED';
          intent = 'LOW';
          amount = rng.nextInt(2000000, 8000000); // ₹20,000 - ₹80,000
          priorTx = 0;
          successRate = 0.0;
          attemptCount = 1;
          break;

        case 'RECOVERY_SHOULD_STOP':
          code = 'GATEWAY_ERROR';
          desc = 'Customer opted out or exhausted max interventions';
          method = 'upi';
          outage = 'CUSTOMER_ABORT';
          intent = 'CHURNED';
          amount = rng.nextInt(50000, 300000); // ₹500 - ₹3,000
          consentStatus = rng.next() > 0.5 ? 'OPTED_OUT' : 'CONSENTED';
          attemptCount = consentStatus === 'OPTED_OUT' ? 1 : 3;
          break;
      }

      const caseId = `case_seed_${String(i).padStart(5, '0')}`;
      const paymentId = `pay_seed_${String(i).padStart(5, '0')}`;
      const orderId = `order_seed_${String(i).padStart(5, '0')}`;

      const latent: HiddenLatentState = {
        case_id: caseId,
        outage_type: outage,
        customer_intent: intent,
        alternate_method_available: archetype === 'EXPIRED_PAYMENT_METHOD' || archetype === 'REPEATED_LOW_VALUE',
        time_sensitive: intent === 'HIGH',
        true_recovery_potential:
          outage === 'TRANSIENT_GATEWAY' ? 0.92 : outage === 'AUTH_DROPOUT' ? 0.80 : outage === 'BALANCE_DEFICIT' ? 0.65 : 0.15,
      };

      const observable: SimulatedObservableCase = {
        id: caseId,
        payment_id: paymentId,
        order_id: orderId,
        amount,
        currency: 'INR',
        failure_code: code,
        failure_description: desc,
        payment_method: method,
        customer_context: {
          customer_id: `cust_${rng.nextInt(1000, 9999)}`,
          email: `customer_${i}@example.com`,
          contact: `+9198${rng.nextInt(10000000, 99999999)}`,
          historical_success_rate: successRate,
          total_prior_transactions: priorTx,
          prior_failed_transactions: Math.round(priorTx * (1 - successRate)),
          lifetime_value: priorTx * amount,
          is_returning_customer: priorTx > 1,
        },
        attempt_count: attemptCount,
        consent_status: consentStatus,
        _hidden_latent: latent,
      };

      allCases.push(observable);
    }

    const splitIndex = Math.floor(count / 2);
    return {
      trainCases: allCases.slice(0, splitIndex),
      heldOutCases: allCases.slice(splitIndex),
    };
  }
}
