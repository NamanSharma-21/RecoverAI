import { CaseStatus } from './types';

/**
 * Valid state transitions mapping for RecoveryCase.
 * Strict enforcement to ensure illegal state mutations are rejected.
 */
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  // Product state machine:
  FAILED: ['ANALYZING', 'POLICY_CHECK', 'ACTION_PENDING', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  ANALYZING: ['DECISION_READY', 'POLICY_CHECK', 'ACTION_PENDING', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  DECISION_READY: ['POLICY_CHECK', 'ACTION_PENDING', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  POLICY_CHECK: ['ACTION_PENDING', 'ACTION_EXECUTED', 'HUMAN_REVIEW', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  ACTION_PENDING: ['ACTION_EXECUTED', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  ACTION_EXECUTED: ['OUTCOME_MONITORED', 'RECOVERED', 'FAILED_RECOVERY', 'STOPPED', 'ESCALATED'],
  OUTCOME_MONITORED: ['RECOVERED', 'FAILED_RECOVERY', 'STOPPED', 'ESCALATED', 'ANALYZING', 'FAILED'],
  HUMAN_REVIEW: ['ACTION_PENDING', 'ACTION_EXECUTED', 'POLICY_CHECK', 'STOPPED', 'ESCALATED', 'RECOVERED'],
  RECOVERED: [], // Terminal success
  STOPPED: [],   // Terminal stop
  ESCALATED: ['HUMAN_REVIEW'],
  EXPIRED: ['STOPPED'],
  FAILED_RECOVERY: ['ANALYZING', 'FAILED', 'STOPPED', 'ESCALATED', 'RECOVERED'],

  // Legacy aliases:
  EVENT_RECEIVED: ['VERIFIED', 'STOPPED', 'RECOVERED'],
  VERIFIED: ['DEDUPLICATED', 'STOPPED', 'RECOVERED'],
  DEDUPLICATED: ['RECOVERY_CASE_CREATED', 'FAILED', 'STOPPED', 'RECOVERED'],
  RECOVERY_CASE_CREATED: ['DIAGNOSED', 'ANALYZING', 'PRIORITIZED', 'ACTION_SELECTED', 'STOPPED', 'RECOVERED'],
  DIAGNOSED: ['PRIORITIZED', 'DECISION_READY', 'ACTION_SELECTED', 'POLICY_CHECKED', 'POLICY_CHECK', 'STOPPED', 'RECOVERED'],
  PRIORITIZED: ['ACTION_SELECTED', 'POLICY_CHECKED', 'POLICY_CHECK', 'STOPPED', 'RECOVERED'],
  ACTION_SELECTED: ['POLICY_CHECKED', 'POLICY_CHECK', 'STOPPED', 'RECOVERED'],
  POLICY_CHECKED: ['ACTION_EXECUTED', 'ACTION_PENDING', 'HUMAN_REVIEW', 'STOPPED', 'ESCALATED', 'RECOVERED'],
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
