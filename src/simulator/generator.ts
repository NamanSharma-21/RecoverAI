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

export class DatasetGenerator {
  /**
   * Generates a seeded synthetic benchmark dataset of N cases.
   */
  static generateSeededDataset(
    count: number = 1200,
    seed: number = 42
  ): {
    trainCases: SimulatedObservableCase[];
    heldOutCases: SimulatedObservableCase[];
  } {
    const rng = new Mulberry32(seed);
    const allCases: SimulatedObservableCase[] = [];

    const failureArchetypes: Array<{
      code: string;
      desc: string;
      method: PaymentMethod;
      outage: LatentOutageType;
      weight: number;
    }> = [
      {
        code: 'GATEWAY_ERROR',
        desc: 'Gateway timeout during authorization with issuer',
        method: 'card',
        outage: 'TRANSIENT_GATEWAY',
        weight: 25,
      },
      {
        code: 'BANK_SERVER_DOWN',
        desc: 'Issuing bank node unresponsive for netbanking verification',
        method: 'netbanking',
        outage: 'TRANSIENT_GATEWAY',
        weight: 15,
      },
      {
        code: 'BAD_REQUEST_ERROR',
        desc: 'Card expiration date expired or invalid',
        method: 'card',
        outage: 'EXPIRED_INSTRUMENT',
        weight: 10,
      },
      {
        code: 'INSUFFICIENT_FUNDS',
        desc: 'Declined: insufficient funds in customer account',
        method: 'upi',
        outage: 'BALANCE_DEFICIT',
        weight: 15,
      },
      {
        code: 'AUTH_TIMEOUT',
        desc: '3D Secure OTP verification window timed out by user',
        method: 'card',
        outage: 'AUTH_DROPOUT',
        weight: 15,
      },
      {
        code: 'PAYMENT_CANCELLED_BY_USER',
        desc: 'Customer declined/cancelled checkout flow',
        method: 'upi',
        outage: 'CUSTOMER_ABORT',
        weight: 10,
      },
      {
        code: 'CARD_BLOCKED',
        desc: 'Card blocked by issuing bank fraud monitoring',
        method: 'card',
        outage: 'STOLEN_OR_BLOCKED',
        weight: 5,
      },
      {
        code: 'UNKNOWN_GATEWAY_CODE',
        desc: 'Undocumented vendor rejection response received',
        method: 'wallet',
        outage: 'PERSISTENT_OUTAGE',
        weight: 5,
      },
    ];

    const expandedArchetypes: typeof failureArchetypes = [];
    for (const item of failureArchetypes) {
      for (let i = 0; i < item.weight; i++) {
        expandedArchetypes.push(item);
      }
    }

    const intentOptions: LatentCustomerIntent[] = ['HIGH', 'HIGH', 'MEDIUM', 'MEDIUM', 'LOW', 'CHURNED'];

    for (let i = 1; i <= count; i++) {
      const arch = rng.choice(expandedArchetypes);
      const intent = rng.choice(intentOptions);

      // Amount distribution: majority regular (500 INR to 5,000 INR), some high value (50,000 to 1,50,000 INR)
      const isHighValue = rng.next() < 0.08;
      const amount = isHighValue
        ? rng.nextInt(5000000, 15000000) // 50,000 - 150,000 INR
        : rng.nextInt(39900, 499900);     // 399 - 4,999 INR

      const optOut = rng.next() < 0.03; // 3% opt-out
      const consentStatus: ConsentStatus = optOut ? 'OPTED_OUT' : 'CONSENTED';

      const priorTx = rng.nextInt(1, 20);
      const successRate = Number((0.4 + rng.next() * 0.55).toFixed(2));
      const priorFailed = Math.round(priorTx * (1 - successRate));

      const caseId = `case_seed_${String(i).padStart(4, '0')}`;
      const paymentId = `pay_seed_${String(i).padStart(4, '0')}`;
      const orderId = `order_seed_${String(i).padStart(4, '0')}`;

      const latent: HiddenLatentState = {
        case_id: caseId,
        outage_type: arch.outage,
        customer_intent: intent,
        alternate_method_available: rng.next() > 0.2,
        time_sensitive: rng.next() > 0.5,
        true_recovery_potential:
          arch.outage === 'TRANSIENT_GATEWAY' ? 0.9 : arch.outage === 'AUTH_DROPOUT' ? 0.75 : 0.3,
      };

      const observable: SimulatedObservableCase = {
        id: caseId,
        payment_id: paymentId,
        order_id: orderId,
        amount,
        currency: 'INR',
        failure_code: arch.code,
        failure_description: arch.desc,
        payment_method: arch.method,
        customer_context: {
          customer_id: `cust_${rng.nextInt(100, 999)}`,
          email: `customer_${i}@example.com`,
          contact: `+9198${rng.nextInt(10000000, 99999999)}`,
          historical_success_rate: successRate,
          total_prior_transactions: priorTx,
          prior_failed_transactions: priorFailed,
          lifetime_value: priorTx * 250000,
        },
        attempt_count: rng.choice([1, 1, 1, 2, 2, 3]),
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
