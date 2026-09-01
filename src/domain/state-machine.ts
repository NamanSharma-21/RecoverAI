import { CaseStatus } from './types';

/**
 * Valid state transitions mapping for RecoveryCase.
 * Strict enforcement to ensure illegal state mutations are rejected.
 */
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  EVENT_RECEIVED: ['VERIFIED', 'STOPPED', 'RECOVERED'],
  VERIFIED: ['DEDUPLICATED', 'STOPPED', 'RECOVERED'],
  DEDUPLICATED: ['RECOVERY_CASE_CREATED', 'STOPPED', 'RECOVERED'],
  RECOVERY_CASE_CREATED: ['DIAGNOSED', 'PRIORITIZED', 'ACTION_SELECTED', 'STOPPED', 'RECOVERED'],
  DIAGNOSED: ['PRIORITIZED', 'ACTION_SELECTED', 'POLICY_CHECKED', 'STOPPED', 'RECOVERED'],
  PRIORITIZED: ['ACTION_SELECTED', 'POLICY_CHECKED', 'STOPPED', 'RECOVERED'],
  ACTION_SELECTED: ['POLICY_CHECKED', 'STOPPED', 'RECOVERED'],
  POLICY_CHECKED: ['ACTION_EXECUTED', 'HUMAN_REVIEW', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  HUMAN_REVIEW: ['ACTION_EXECUTED', 'POLICY_CHECKED', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  ACTION_EXECUTED: ['OUTCOME_MONITORED', 'RECOVERED', 'FAILED', 'STOPPED', 'ESCALATED'],
  OUTCOME_MONITORED: ['RECOVERED', 'FAILED', 'STOPPED', 'ESCALATED', 'DIAGNOSED'],
  RECOVERED: [], // Terminal success
  FAILED: ['DIAGNOSED', 'PRIORITIZED', 'ACTION_SELECTED', 'STOPPED', 'ESCALATED', 'RECOVERED'], // Can trigger next bounded retry
  STOPPED: [],   // Terminal stop
  ESCALATED: ['HUMAN_REVIEW'], // Terminal / human queue
};

export class StateMachineError extends Error {
  constructor(
    public readonly currentStatus: CaseStatus,
    public readonly attemptedStatus: CaseStatus,
    public readonly caseId: string
  ) {
    super(
      `Illegal state transition for case ${caseId}: cannot transition from '${currentStatus}' to '${attemptedStatus}'`
    );
    this.name = 'StateMachineError';
  }
}

export function canTransition(current: CaseStatus, next: CaseStatus): boolean {
  // If payment succeeded, transitioning to RECOVERED from any non-terminal state is always allowed
  if (next === 'RECOVERED' && !isTerminalState(current)) {
    return true;
  }
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function validateTransition(caseId: string, current: CaseStatus, next: CaseStatus): void {
  if (!canTransition(current, next)) {
    throw new StateMachineError(current, next, caseId);
  }
}

export function isTerminalState(status: CaseStatus): boolean {
  return status === 'RECOVERED' || status === 'STOPPED';
}

export function isOpenState(status: CaseStatus): boolean {
  return !isTerminalState(status);
}
