import { expect, it } from 'vitest';
import { normalizeGameOverview } from '@/service/game/hypergryph/skIsland/overview';
const account = { appCode: 'arknights', uid: '1', gameId: '1', nickName: 'Fixture' };
it('preserves the official Arknights completed-story sentinel without inferring completion from missing data', async () => {
    const { gameOverview } = await import('@/openapi/schemas');
    for (const [raw, expected] of [['', ''], [null, null], [undefined, null], ['   ', null], [0, null], ['unknown-stage', 'unknown-stage']] as const) {
        const result = normalizeGameOverview(account, { status: { level: 120, mainStageProgress: raw } });
        expect(result.profile.mainProgress).toBe(expected);
        expect(gameOverview.parse(result).profile.mainProgress).toBe(expected);
    }
    const endfield = normalizeGameOverview({ ...account, appCode: 'endfield' }, { detail: {
        base: { level: 60, mainMission: { description: '' } },
    } });
    expect(endfield.profile.mainProgress).toBeNull();
});
it('normalizes Arknights snapshots, over-cap resources, base totals and operator names', () => {
    const result = normalizeGameOverview(account, {
        status: { level: 120, ap: { current: 150, max: 135, completeRecoveryTime: -1 }, storeTs: 1700000000, charCnt: 0, mainStageProgress: 'stage1' },
        routine: { daily: { current: 0, total: 100 }, weekly: { current: 300, total: 500 } },
        campaign: { reward: { current: 1200, total: 1800 } },
        building: { labor: { value: 40, maxValue: 200 }, tradings: [{ stock: [{}, {}] }, { stock: [{}] }], tiredChars: [], hire: { refreshCount: 2 }, furniture: { total: 20 } },
        chars: [{ charId: 'a', level: 1, evolvePhase: 0 }, { charId: 'b', level: 80, evolvePhase: 2 }],
        charInfoMap: { a: { name: 'Alpha' }, b: { name: 'Beta' } }, stageInfoMap: { stage1: { code: '1-1' } }, skins: [],
        credential: 'must-not-leak',
    }, 1800000000000);
    const metric = (key: string) => result.metrics.find(m => m.key === key);
    expect(metric('stamina')).toMatchObject({ current: 150, total: 135, recoveryAt: null });
    expect(metric('daily')?.current).toBe(0);
    expect(metric('tradingOrders')?.current).toBe(3);
    expect(metric('tiredOperators')?.current).toBe(0);
    expect(metric('operators')?.current).toBe(2);
    expect(result.profile.mainProgress).toBe('1-1');
    expect(result.operators?.map(c => c.name)).toEqual(['Beta', 'Alpha']);
    expect(result.updatedAt).toBe(1700000000);
    expect(result.fetchedAt).toBe(1800000000);
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
});
it('normalizes the CN Endfield detail envelope and numeric strings', () => {
    const result = normalizeGameOverview({ ...account, appCode: 'endfield' }, { detail: {
        base: { level: 40, worldLevel: 5, saveTime: '1700000000000', createTime: '1600000000', charNum: 12, mainMission: { description: 'Mission' } },
        dungeon: { curStamina: '80', maxStamina: '240', maxTs: '1800000000' },
        dailyMission: { dailyActivation: 80, maxDailyActivation: 100 }, weeklyMission: { score: 4, total: 10 }, bpSystem: { curLevel: 20, maxLevel: 60 },
        chars: [{ charData: { id: 'endmin', name: 'Endministrator' }, level: 60, evolvePhase: 3 }], achieve: { count: 16 },
    } });
    expect(result.metrics.find(m => m.key === 'stamina')).toMatchObject({ current: 80, total: 240, recoveryAt: 1800000000 });
    expect(result.profile).toMatchObject({ level: 40, worldLevel: 5, mainProgress: 'Mission', registeredAt: 1600000000 });
    expect(result.updatedAt).toBe(1700000000);
    expect(result.operators?.[0]).toEqual({ id: 'endmin', name: 'Endministrator', level: 60, phase: 3, rarity: null, potential: null, profession: null, element: null });
    expect(result.metrics.some(m => m.group === 'base')).toBe(false);
});
it('distinguishes missing and invalid fields from real zero values', () => {
    const result = normalizeGameOverview(account, { status: { level: 0, ap: { current: '', max: false } }, building: { tradings: [{ stock: [] }, {}] } });
    expect(result.profile.level).toBe(0);
    expect(result.profile.lastOnlineAt).toBeNull();
    expect(result.operators).toBeNull();
    expect(result.metrics.every(m => m.current === null)).toBe(true);
    expect(() => normalizeGameOverview(account, {})).toThrow('missing');
    expect(() => normalizeGameOverview({ ...account, appCode: 'endfield' }, { detail: {} })).toThrow('missing');
});

it('preserves the Endministrator game appearance without returning avatar resources', () => {
    for (const [gender, expected] of [[1, 'male'], ['2', 'female'], [0, null], [undefined, null]] as const) {
        const result = normalizeGameOverview({ ...account, appCode: 'endfield' }, { detail: {
            base: { level: 1, gender, avatarUrl: 'https://example.com/private-avatar' },
        } });
        expect(result.profile.endministratorGender).toBe(expected);
        expect(JSON.stringify(result)).not.toContain('private-avatar');
    }
    expect(normalizeGameOverview(account, { status: { level: 1, gender: 1 } }).profile).not.toHaveProperty('endministratorGender');
});

it('advances sanity and drones using upstream currentTs rather than the stored snapshot', () => {
    const ts = 1800000000;
    const result = normalizeGameOverview(account, {
        currentTs: ts,
        status: { storeTs: ts - 36000, ap: { current: 23, max: 210, lastApAddTime: ts - 3600, completeRecoveryTime: ts + 63720 } },
        building: { labor: { value: 2, maxValue: 200, lastUpdateTime: ts - 1800, remainSecs: 3600 } },
    }, (ts + 999) * 1000);
    expect(result.metrics.find(m => m.key === 'stamina')).toMatchObject({ current: 33, total: 210, recovery: { value: 23, at: ts - 3600, intervalSeconds: 360 } });
    expect(result.metrics.find(m => m.key === 'drones')).toMatchObject({ current: 101, total: 200, recoveryAt: ts + 1800 });
    expect(result.calculatedAt).toBe(ts);
});

it('handles recovery boundaries, stopped recovery and future timestamps without inventing resources', () => {
    const ts = 1800000000;
    const current = (ap: unknown) => normalizeGameOverview(account, { currentTs: ts, status: { ap } }, ts * 1000).metrics[0];
    expect(current({ current: 10, max: 100, completeRecoveryTime: ts, lastApAddTime: ts - 3600 })?.current).toBe(100);
    expect(current({ current: 150, max: 100, completeRecoveryTime: -1 })?.current).toBe(150);
    expect(current({ current: 10, max: 100, completeRecoveryTime: -1, lastApAddTime: ts - 3600 })?.current).toBe(10);
    expect(current({ current: 10, max: 100, completeRecoveryTime: ts + 1000, lastApAddTime: ts + 100 })?.current).toBe(10);
    expect(current({ current: 10, max: 100, completeRecoveryTime: ts + 1000 })?.current).toBe(10);
    expect(current({ current: 10, max: 100, completeRecoveryTime: ts + 1000, lastApAddTime: ts - 359 })?.current).toBe(10);
    expect(current({ current: 10, max: 100, completeRecoveryTime: ts + 1000, lastApAddTime: ts - 360 })?.current).toBe(11);
});

it('projects base orders and fatigue while preserving recruitment counts and the upstream object', () => {
    const ts = 1800000000;
    const raw = { currentTs: ts, status: { level: 1 }, building: {
        tradings: [{ stock: [{}, {}], stockLimit: 5, completeWorkTime: ts - 10800, lastUpdateTime: ts - 20000, chars: [{ charId: 'worker', ap: 720000, lastApAddTime: ts - 4000 }] }],
        hire: { refreshCount: 0, completeWorkTime: ts - 43200, chars: [{ charId: 'office', ap: 8640000, lastApAddTime: ts - 100 }] },
        tiredChars: [{ charId: 'resting' }], dormitories: [{ chars: [{ charId: 'resting', ap: 0 }] }],
        powers: [{ chars: [{ charId: 'worker', ap: 720000, lastApAddTime: ts - 4000 }] }],
    } };
    const copy = JSON.stringify(raw);
    const result = normalizeGameOverview(account, raw, ts * 1000);
    expect(result.metrics.find(m => m.key === 'tradingOrders')).toMatchObject({ current: 4, total: 5 });
    expect(result.metrics.find(m => m.key === 'recruitRefresh')?.current).toBe(0);
    expect(result.metrics.find(m => m.key === 'tiredOperators')?.current).toBe(1);
    expect(JSON.stringify(raw)).toBe(copy);
});

it('counts Amiya alternate forms only once as the official collection total does', () => {
    const result = normalizeGameOverview(account, {status: {level: 1}, chars: [{charId: 'char_002_amiya'}, {charId: 'char_1001_amiya2'}, {charId: 'char_1037_amiya3'}, {charId: 'char_003_kalts'}]});
    expect(result.metrics.find(m => m.key === 'operators')?.current).toBe(2);
    expect(result.operators).toHaveLength(4);
});

it('resets CN daily and weekly counters at 04:00 Beijing time, independent of server timezone', () => {
    const ts = Date.parse('2026-10-05T04:00:00+08:00') / 1000;
    const result = normalizeGameOverview(account, { currentTs: ts, status: { storeTs: ts - 1 }, routine: { daily: { current: 10, total: 10 }, weekly: { current: 13, total: 13 } }, campaign: { reward: { current: 1800, total: 1800 } } }, ts * 1000);
    for (const key of ['daily', 'weekly', 'orundum']) expect(result.metrics.find(m => m.key === key)?.current).toBe(0);
});


it('keeps game-specific rarity, potential, clocks and stamina rules in the OpenAPI contract', async () => {
    const { gameOverview } = await import('@/openapi/schemas');
    const ef = normalizeGameOverview({ ...account, appCode: 'endfield' }, { currentTs: 10, detail: {
        currentTs: 1800000000, base: { level: 60 }, dungeon: { curStamina: 360, maxStamina: 360, maxTs: '0' },
        chars: [{ id: 'hashed-id', charData: { id: 'raw-id', name: 'Fixture', rarity: { key: 'rarity_6' } }, potentialLevel: 0 }],
        warEchoes: { seasons: [{ id: 'season', name: 'Season', stars: 9, allPlusTasks: true }] },
    } });
    expect(ef.calculatedAt).toBe(1800000000);
    expect(ef.operators?.[0]).toMatchObject({ id: 'hashed-id', rarity: 6, potential: 0 });
    expect(ef.metrics[0]).toMatchObject({ current: 360, recoveryAt: null });
    expect(ef.metrics[0]).not.toHaveProperty('recovery');
    expect(gameOverview.parse(ef)).toEqual(ef);
    const ak = normalizeGameOverview(account, { status: { level: 120 }, chars: [{ charId: 'a', potentialRank: 0 }], charInfoMap: { a: { rarity: 5 } } });
    expect(ak.operators?.[0]).toMatchObject({ rarity: 6, potential: 1 });
    expect(gameOverview.parse(ak)).toEqual(ak);
});

it('resets SSS rewards on the first and sixteenth at CN 04:00, preserving missing counters', () => {
    for (const day of ['2026-10-01', '2026-10-16']) {
        const ts = Date.parse(day + 'T04:00:00+08:00') / 1000;
        const raw = { currentTs: ts - 1, status: { storeTs: ts - 10 }, tower: { reward: { lowerItem: { current: 24, total: 24 }, higherItem: { total: 60 } } } };
        const before = normalizeGameOverview(account, raw);
        expect(before.metrics.find(m => m.key === 'towerLower')?.current).toBe(24);
        raw.currentTs = ts;
        const after = normalizeGameOverview(account, raw);
        expect(after.metrics.find(m => m.key === 'towerLower')?.current).toBe(0);
        expect(after.metrics.find(m => m.key === 'towerHigher')?.current).toBeNull();
    }
});

it('selects Endfield operator avatars from charData with no ID, appearance or extra request dependency', async () => {
    const { gameOverview } = await import('@/openapi/schemas');
    const square = 'https://bbs.hycdn.cn/public/skland-game/image/square.png';
    const portrait = 'https://web.hycdn.cn/portrait.png';
    for (const [avatarSqUrl, avatarRtUrl, expected] of [
        [square, portrait, square], [undefined, portrait, portrait], ['', portrait, portrait],
        ['https://invalid.example/a.png', portrait, portrait], [undefined, undefined, undefined],
        [12, null, undefined], ['http://bbs.hycdn.cn/a.png', 'javascript:bad', undefined],
    ]) {
        const result = normalizeGameOverview({ ...account, appCode: 'endfield' }, { detail: {
            base: { level: 1 }, chars: [{ id: 'future-character', level: 0, charData: { name: 'Test', avatarSqUrl, avatarRtUrl } }],
        } });
        expect(result.operators?.[0]).toMatchObject({ id: 'future-character', level: 0 });
        expect(result.operators?.[0]?.avatarUrl).toBe(expected);
        expect(gameOverview.parse(result).operators?.[0]?.avatarUrl).toBe(expected);
    }
    const ak = normalizeGameOverview(account, { status: { level: 1 }, chars: [{ charId: 'char_002_amiya', avatarUrl: square }] });
    expect(ak.operators?.[0]).not.toHaveProperty('avatarUrl');
});
