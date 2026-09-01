import { describe, it, expect } from 'vitest';
import {
  canTransition,
  validateTransition,
  StateMachineError,
  isTerminalState,
  isOpenState,
} from '../../src/domain/state-machine';

describe('State Machine Unit Tests', () => {
  it('allows valid linear transition from RECOVERY_CASE_CREATED to DIAGNOSED', () => {
    expect(canTransition('RECOVERY_CASE_CREATED', 'DIAGNOSED')).toBe(true);
    expect(() => validateTransition('case_1', 'RECOVERY_CASE_CREATED', 'DIAGNOSED')).not.toThrow();
  });

  it('allows transition to RECOVERED from any open state (payment truth precedence)', () => {
    expect(canTransition('DIAGNOSED', 'RECOVERED')).toBe(true);
    expect(canTransition('ACTION_SELECTED', 'RECOVERED')).toBe(true);
    expect(canTransition('POLICY_CHECKED', 'RECOVERED')).toBe(true);
    expect(canTransition('HUMAN_REVIEW', 'RECOVERED')).toBe(true);
    expect(canTransition('ACTION_EXECUTED', 'RECOVERED')).toBe(true);
    expect(canTransition('OUTCOME_MONITORED', 'RECOVERED')).toBe(true);
  });

  it('rejects illegal transitions like RECOVERED to DIAGNOSED', () => {
    expect(canTransition('RECOVERED', 'DIAGNOSED')).toBe(false);
    expect(() => validateTransition('case_1', 'RECOVERED', 'DIAGNOSED')).toThrow(StateMachineError);
  });

  it('rejects illegal transitions like STOPPED to ACTION_EXECUTED', () => {
    expect(canTransition('STOPPED', 'ACTION_EXECUTED')).toBe(false);
    expect(() => validateTransition('case_1', 'STOPPED', 'ACTION_EXECUTED')).toThrow(StateMachineError);
  });

  it('correctly identifies terminal vs open states', () => {
    expect(isTerminalState('RECOVERED')).toBe(true);
    expect(isTerminalState('STOPPED')).toBe(true);
    expect(isTerminalState('HUMAN_REVIEW')).toBe(false);
    expect(isTerminalState('ACTION_EXECUTED')).toBe(false);

    expect(isOpenState('DIAGNOSED')).toBe(true);
    expect(isOpenState('HUMAN_REVIEW')).toBe(true);
    expect(isOpenState('RECOVERED')).toBe(false);
  });
});
