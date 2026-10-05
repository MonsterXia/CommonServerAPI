import axios from 'axios';
import { getGatewayManager } from '@/lib/gatewayManager';
import { getSkLandSignHeader } from '@/util/skLand';
import { sklandEndpoints } from '../config/endpoints';
import type { SKLandAccountsRequestParams, SKLandCheckInRequestPayload } from '@/model/game/hypergraph/skIsland/user';
import type { CheckInErrorCode, CheckInOutcome, CheckInReward } from '@/model/game/hypergraph/skIsland/checkIn';

const messages: Record<CheckInErrorCode, string> = {
    clock_skew: 'SKLand server time could not be synchronized; retry later',
    timeout: 'Check-in result is unknown after timeout; retry to confirm',
    network_error: 'Check-in result is unknown after a connection failure; retry to confirm',
    auth_expired: 'Update the linked account login and try again',
    rate_limited: 'Too many requests; wait before trying again',
    upstream_error: 'SKLand check-in is unavailable; try again later',
    invalid_response: 'SKLand returned an unrecognized check-in response',
    unsupported_game: 'This game does not support check-in',
};
export class CheckInError extends Error {
    constructor(public code: CheckInErrorCode, public retryable = true, public upstreamCode: number | null = null) {
        super(messages[code]);
        this.name = 'CheckInError';
    }
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function decode(value: unknown, endfield: boolean): CheckInOutcome {
    const response = object(value);
    if (typeof response.code !== 'number' || !Number.isFinite(response.code)) throw new CheckInError('invalid_response');
    // Code 10001 is also used for other errors. Require an explicit attendance message.
    if (response.code !== 0 && typeof response.message === 'string'
        && /^(?:今日已签到[！!。]?|今天已经签到[了！!。]*|请勿重复签到[！!。]?|已经签到[了！!。]*|already (?:checked|signed) in[.!]?)$/i.test(response.message.trim())) {
        return { status: 'already_checked_in', rewards: [], rewardsComplete: true };
    }
    if (response.code !== 0) throw new CheckInError('upstream_error', true, response.code);
    // A code=0 acknowledges the write, even if optional reward details changed upstream.
    const data = object(response.data);
    const source = endfield ? data.awardIds : data.awards;
    const resources = object(data.resourceInfoMap);
    const rewards: CheckInReward[] = Array.isArray(source) ? source.map(item => {
        const award = object(item);
        const resource = endfield ? object(resources[String(award.id)]) : object(award.resource);
        return {
            id: text(endfield ? award.id : resource.id),
            name: text(resource.name),
            count: count(endfield ? resource.count : award.count),
            type: typeof award.type === 'string' || typeof award.type === 'number' ? String(award.type) : null,
        };
    }) : [];
    return { status: 'success', rewards, rewardsComplete: Array.isArray(source) && rewards.every(item => item.name !== null && item.count !== null) };
}

export async function fetchSkLandCheckInAPI(cred: SKLandAccountsRequestParams, account: SKLandCheckInRequestPayload): Promise<CheckInOutcome> {
    const endfield = account.appCode === 'endfield';
    if (!endfield && account.appCode !== 'arknights') throw new CheckInError('unsupported_game', false);
    const gateway = getGatewayManager();
    const url = gateway.buildSKLandURL(endfield ? sklandEndpoints.endfieldCheckIn : sklandEndpoints.arknightsCheckIn);
    const body = endfield ? undefined : { uid: account.uid, gameId: account.gameId };
    let delay: number | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
        // An empty URLSearchParams signs an empty string, matching the absent Endfield body.
        const headers = await getSkLandSignHeader(cred, url, body ?? new URLSearchParams(), delay);
        if (endfield) headers['sk-game-role'] = `3_${account.uid}_${account.gameId}`;
        try {
            return decode(await gateway.post<unknown>(url, body, { headers, timeout: 12000 }), endfield);
        } catch (error) {
            if (error instanceof CheckInError) throw error;
            if (!axios.isAxiosError(error)) throw new CheckInError('network_error');
            const response = object(error.response?.data);
            const code = typeof response.code === 'number' && Number.isFinite(response.code) ? response.code : null;
            if (attempt === 0 && error.response?.status === 401 && code === 10003) {
                const timestamp = Number(response.timestamp);
                const sent = Number(headers.timeStamp);
                if (response.timestamp !== null && response.timestamp !== undefined && response.timestamp !== ''
                    && Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(sent)) {
                    delay = sent - timestamp;
                    continue;
                }
            }
            if (error.response?.status === 401 && code === 10003) throw new CheckInError('clock_skew', true, code);
            if (error.response) {
                // Some attendance endpoints report an already-completed write with HTTP 403.
                if (error.response.status === 403) {
                    try { const outcome = decode(response, endfield); if (outcome.status === 'already_checked_in') return outcome; } catch { /* classify below */ }
                }
                if (error.response.status === 429) throw new CheckInError('rate_limited', true, code);
                if (error.response.status === 401 || error.response.status === 403) throw new CheckInError('auth_expired', false, code);
                throw new CheckInError('upstream_error', true, code);
            }
            // Never automatically repeat a POST whose outcome is unknown.
            throw new CheckInError(['ETIMEDOUT', 'ECONNABORTED'].includes(error.code ?? '') ? 'timeout' : 'network_error');
        }
    }
    throw new CheckInError('upstream_error');
}
