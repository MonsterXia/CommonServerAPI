import type { SKLandGameAccount } from './user';
export type CheckInErrorCode = 'clock_skew' | 'timeout' | 'network_error' | 'auth_expired' | 'rate_limited' | 'upstream_error' | 'invalid_response' | 'unsupported_game';
export interface CheckInReward {
    id: string | null;
    name: string | null;
    count: number | null;
    type: string | null;
}
export interface CheckInOutcome {
    status: 'success' | 'already_checked_in';
    rewards: CheckInReward[];
    rewardsComplete: boolean;
}
export interface CheckInRoleResult {
    account: SKLandGameAccount;
    status: 'success' | 'already_checked_in' | 'failed';
    rewards: CheckInReward[];
    rewardsComplete: boolean;
    errorCode: CheckInErrorCode | null;
    retryable: boolean;
    upstreamCode: number | null;
}
export interface CheckInReport {
    requestId: string;
    completedAt: number;
    durationMs: number;
    results: CheckInRoleResult[];
    summary: { total: number; success: number; alreadyCheckedIn: number; failed: number };
    /** Compatibility for older clients. */
    checkInResults: string[];
    errorResults: (SKLandGameAccount & { error: string })[];
}
