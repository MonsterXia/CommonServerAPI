import { expect, it } from 'vitest';
import { normalizeGameOverview } from '@/service/game/hypergryph/skIsland/overview';
const account = { appCode: 'arknights', uid: '1', gameId: '1', nickName: 'Fixture' };
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
    expect(result.operators?.[0]).toEqual({ id: 'endmin', name: 'Endministrator', level: 60, phase: 3 });
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
