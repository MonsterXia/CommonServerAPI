import { expect, it } from 'vitest';
import { normalizeArknightsDetails } from '@/service/game/hypergryph/skIsland/arknightsDetails';

const now = 1800000000;
const section = (data: unknown, key: string) => normalizeArknightsDetails(data, now).find(row => row.key === key)?.items;

it('distinguishes locked, idle, recruiting and completed recruitment slots', () => {
    const items = section({ recruit: [{ state: 0 }, { state: 1 }, { state: 2, finishTs: now + 600 }, { state: 2, finishTs: now - 1 }, { state: 3 }, {}] }, 'arknightsRecruitment');
    expect(items?.map(item => item.status)).toEqual(['locked', 'idle', 'working', 'complete', 'complete', 'unknown']);
    expect(items?.[2]?.completeAt).toBe(now + 600);
    expect(items?.[0]?.completeAt).toBeNull();
});

it('anchors specialization remaining seconds to the API currentTs', () => {
    const data = { charInfoMap: { a: { name: 'Amiya' } }, building: { training: { trainee: { charId: 'a', targetSkill: 1 }, remainSecs: 600, lastUpdateTime: now - 8000 } } };
    expect(section(data, 'arknightsTraining')?.[0]).toMatchObject({ name: 'Amiya', status: 'working', completeAt: now + 600 });
    data.building.training.remainSecs = 0;
    expect(section(data, 'arknightsTraining')?.[0]?.status).toBe('complete');
    data.building.training.trainee.targetSkill = -1;
    expect(section(data, 'arknightsTraining')?.[0]).toMatchObject({ status: 'idle', completeAt: null });
});

it('calculates manufactured stock using the official fatigue-limited speed model', () => {
    // 2 stocked, room for 8; 100 boosted seconds at 2x, then normal speed.
    const data = { manufactureFormulaInfoMap: { f: { id: 'f', weight: 2, costPoint: 100 } }, building: { manufactures: [{ formulaId: 'f', weight: 4, capacity: 20, remain: 8, speed: 2, lastUpdateTime: now - 350, chars: [{ ap: 10000 }] }] } };
    expect(section(data, 'arknightsManufacturing')?.[0]).toMatchObject({ current: 6, total: 10, status: 'working', completeAt: now + 350 });
    data.building.manufactures[0]!.lastUpdateTime = now - 1000;
    expect(section(data, 'arknightsManufacturing')?.[0]).toMatchObject({ current: 10, total: 10, status: 'complete' });
});

it('keeps manufacturing unknown when the formula or timing data is missing', () => {
    expect(section({ building: { manufactures: [{ weight: 10, capacity: 20 }] } }, 'arknightsManufacturing')?.[0]).toMatchObject({ current: null, total: null, status: 'unknown', completeAt: null });
});

it('preserves official manufacturing stock parity without inventing a negative completion time', () => {
    const data = { manufactureFormulaInfoMap: { f: { id: 'f', weight: 1, costPoint: 100 } }, building: { manufactures: [{ formulaId: 'f', weight: 0, capacity: 10, remain: 2, speed: 2, lastUpdateTime: now, chars: [{ ap: 8640000 }] }] } };
    expect(section(data, 'arknightsManufacturing')?.[0]).toMatchObject({ current: 2, total: 10, status: 'complete', completeAt: null });
});

it('uses room level and comfort to count fully rested operators', () => {
    const data = { building: { dormitories: [{ level: 5, comfort: 5000, chars: [{ ap: 8640000 }, { ap: 8240000, lastApAddTime: now - 1000 }, { ap: 7840000, lastApAddTime: now - 1000 }] }, { chars: [] }] } };
    expect(section(data, 'arknightsDormitories')).toEqual([
        expect.objectContaining({ current: 2, total: 3, status: 'working', completeAt: now + 1000 }),
        expect.objectContaining({ current: 0, total: 0, status: 'idle' }),
    ]);
    const partial = { building: { dormitories: [{ ...data.building.dormitories[0], chars: [...data.building.dormitories[0]!.chars, {}] }] } };
    expect(section(partial, 'arknightsDormitories')?.[0]).toMatchObject({ current: null, total: 4, completeAt: null });
});

it('retains clue exchange timing and distinguishes completed exchanges', () => {
    const data = { building: { meeting: { level: 3, clue: { board: ['1', '2'], sharing: true, shareCompleteTime: now + 60 } } } };
    expect(section(data, 'arknightsClues')?.[0]).toMatchObject({ current: 2, total: 7, status: 'working', completeAt: now + 60 });
    data.building.meeting.clue.shareCompleteTime = now - 1;
    expect(section(data, 'arknightsClues')?.[0]?.status).toBe('complete');
});

it('selects clue inventory without assigning unverified semantics to the daily reward flag', () => {
    const items = section({ building: { meeting: { clue: { board: [], sharing: false, own: 0, received: 2, needReceive: 3, dailyReward: true } } } }, 'arknightsClues');
    expect(items?.map(row => [row.nameKey, row.current, row.total])).toEqual([
        ['clueBoard', 0, 7], ['clueOwned', 0, 10], ['clueReceived', 2, null], ['cluePending', 3, null],
    ]);
    expect(items?.find(row => row.nameKey === 'clueDailyReward')).toBeUndefined();
});

it('preserves office refresh counts as snapshots while deriving refresh availability', () => {
    const data = { building: { hire: { refreshCount: 0, completeWorkTime: now - 86400, chars: [{ ap: 8640000, lastApAddTime: now - 1 }] } } };
    expect(section(data, 'arknightsOffice')?.[0]).toMatchObject({ nameKey: 'recruitRefresh', current: 0, total: 3, status: 'complete', completeAt: now - 86400 });
    data.building.hire.completeWorkTime = now + 600;
    expect(section(data, 'arknightsOffice')?.[0]).toMatchObject({ status: 'working', completeAt: now + 600 });
    data.building.hire.chars = [];
    expect(section(data, 'arknightsOffice')?.[0]).toMatchObject({ status: 'idle', completeAt: null });
});

it('projects trading stock only for staffed active rooms and caps it', () => {
    const active = { stock: [{}, {}], stockLimit: 5, completeWorkTime: now - 10800, lastUpdateTime: now - 20000, chars: [{ charId: 'a' }] };
    const items = section({ building: { tradings: [active, { ...active, chars: [] }, { ...active, completeWorkTime: -1 }, { ...active, completeWorkTime: now - 90000 }] } }, 'arknightsTrading');
    expect(items?.map(item => item.current)).toEqual([4, 2, 2, 5]);
    expect(items?.map(item => item.status)).toEqual(['working', 'idle', 'idle', 'complete']);
    expect(items?.[0]?.completeAt).toBe(now + 10800);
});

it('omits unavailable sections, preserves zero, and never leaks unselected data', () => {
    expect(normalizeArknightsDetails({}, now)).toEqual([]);
    const data = { credential: 'private-token', building: { meeting: { clue: { board: [], sharing: false }, secret: 'private-token' }, training: { trainee: null, remainSecs: -1 }, dormitories: [{}] } };
    const before = JSON.stringify(data);
    expect(section(data, 'arknightsClues')?.[0]).toMatchObject({ current: 0, status: 'idle' });
    expect(section(data, 'arknightsTraining')?.[0]?.status).toBe('idle');
    expect(section(data, 'arknightsDormitories')?.[0]).toMatchObject({ current: null, total: null });
    expect(JSON.stringify(normalizeArknightsDetails(data, now))).not.toContain('private-token');
    expect(JSON.stringify(data)).toBe(before);
});

it('sums SideStory stages and applies official activity type and rerun filters', () => {
    const data = {
        activity: [
            { actId: 'a', zones: [{ clearedStage: 10, totalStage: 10 }, { clearedStage: 4, totalStage: 5 }] },
            { actId: 'b', zones: [{ clearedStage: 20, totalStage: 20 }] },
            { actId: 'rerun', zones: [] }, { actId: 'other', zones: [] },
            { actId: 'partial', zones: [{ clearedStage: 1 }] },
        ],
        activityInfoMap: { a: { name: 'Story A', type: 'SIDESTORY' }, b: { name: 'Story B', type: 'BRANCHLINE' }, rerun: { name: 'Rerun', type: 'SIDESTORY', isReplicate: true }, other: { name: 'Other', type: 'OTHER' }, partial: { name: 'Partial', type: 'SIDESTORY' } },
    };
    const items = section(data, 'arknightsActivities');
    expect(items?.map(row => row.id)).toEqual(['partial', 'b', 'a']);
    expect(items?.find(row => row.id === 'a')).toMatchObject({ name: 'Story A', current: 14, total: 15, status: 'unknown' });
    expect(items?.find(row => row.id === 'b')).toMatchObject({ current: 20, total: 20, status: 'complete' });
    expect(items?.find(row => row.id === 'partial')).toMatchObject({ current: 1, total: null, status: 'unknown' });
});

it('keeps distinct game-record quantities separate without inventing maxima or flattening objects', () => {
    const data = {
        rogue: { records: [{ rogueId: 'r', relicCnt: 120, bank: { current: 30 } }] }, rogueInfoMap: { r: { name: 'Rogue' } },
        tower: { records: [{ towerId: 't', best: 6 }, { towerId: 'u', best: { stage: 8, private: 'secret' } }] }, towerInfoMap: { t: { name: 'Tower', subName: 'Zone' } },
        campaign: { records: [{ campaignId: 'c', maxKills: 399 }] }, campaignInfoMap: { c: { name: 'Annihilation', campaignZoneId: 'z' } }, campaignZoneInfoMap: { z: { name: 'Zone' } },
        sandbox: [{ id: 's', name: 'Sandbox', nested: { private: 'secret' }, score: 999 }],
    };
    expect(section(data, 'arknightsRogueRelics')?.[0]).toMatchObject({ name: 'Rogue', current: 120, total: null });
    expect(section(data, 'arknightsRogueBank')?.[0]).toMatchObject({ name: 'Rogue', current: 30, total: null });
    expect(section(data, 'arknightsTower')?.find(row => row.id === 't')).toMatchObject({ name: 'Tower', subtitle: 'Zone', current: 6, total: null });
    expect(section(data, 'arknightsTower')?.find(row => row.id === 'u')).toMatchObject({ current: null, total: null });
    expect(section(data, 'arknightsCampaign')?.[0]).toMatchObject({ name: 'Annihilation', subtitle: 'Zone', current: 399, total: null });
    expect(section(data, 'arknightsSandbox')?.[0]).toMatchObject({ id: 's', name: 'Sandbox', current: null, total: null, status: 'unknown' });
    expect(JSON.stringify(normalizeArknightsDetails(data, now))).not.toContain('secret');
});


it('selects support operator identity and level without returning equipment or raw private data', () => {
    const sections = normalizeArknightsDetails({ assistChars: [{ charId: 'a', level: 90, token: 'secret' }, {}], charInfoMap: { a: { name: 'Support' } } }, 1800000000);
    expect(sections.find(s => s.key === 'arknightsSupport')?.items).toEqual([{ id: 'a:0', operatorId: 'a', skinId: null, name: 'Support', level: 90, status: 'unknown', current: null, total: null, completeAt: null }]);
    expect(JSON.stringify(sections)).not.toContain('secret');
});

it('selects the latest sandbox record and preserves known zero, false, and unknown separately', () => {
    const items = section({ sandbox: [
        { id: 'old', maxDay: 99 },
        { id: 'current', name: 'Synthetic season', maxDay: 0, maxDayChallenge: 12, mainQuest: 2,
          subQuest: [{ id: 'a', name: 'A', done: false }, { id: 'b', done: true }, { id: 'c', done: 'false' }],
          baseLv: 3, unlockNode: 17, enemyKill: 0, createRift: 4, fixRift: [0, 6], private: 'secret' },
    ] }, 'arknightsSandbox');
    expect(items).toHaveLength(1);
    expect(items?.[0]?.sandbox).toEqual({ maxDay: 0, maxDayChallenge: 12, mainQuest: 2,
        subQuests: [{ id: 'a', name: 'A', done: false }, { id: 'b', name: null, done: true }, { id: 'c', name: null, done: null }],
        baseLv: 3, unlockNode: 17, enemyKill: 0, createRift: 4, fixRift: { current: 0, total: 6 } });
    expect(JSON.stringify(items)).not.toContain('secret');
    expect(section({ sandbox: [{}] }, 'arknightsSandbox')?.[0]?.sandbox).toEqual({ maxDay: null, maxDayChallenge: null, mainQuest: null,
        subQuests: null, baseLv: null, unlockNode: null, enemyKill: null, createRift: null, fixRift: { current: null, total: null } });
    expect(section({ sandbox: [] }, 'arknightsSandbox')).toEqual([]);
});

it('keeps boss rush records without artwork and never infers unplayed or difficulty from missing data', () => {
    const items = section({ bossRush: [
        { id: 'act1bossrush', record: { played: true, difficulty: 'SP', stageId: 'fixture' }, picUrl: 'https://bbs.hycdn.cn/public/test.png' },
        { id: 'act2bossrush', record: { played: false, difficulty: 'SP', stageId: 'fixture' } },
        { id: 'act3bossrush', record: { difficulty: 'NORMAL' } },
        { id: 'future', record: { played: true, difficulty: 'NEW' } },
    ], stageInfoMap: { fixture: { code: 'TN-2' } } }, 'arknightsBossRush');
    expect(items?.map(item => item.bossRush)).toEqual([
        { edition: null, played: true, difficulty: null, stageCode: null },
        { edition: '03', played: null, difficulty: null, stageCode: null },
        { edition: '02', played: false, difficulty: null, stageCode: null },
        { edition: '01', played: true, difficulty: 'SP', stageCode: 'TN-2' },
    ]);
    expect(items?.[3]?.artworkUrl).toBe('https://bbs.hycdn.cn/public/test.png');
});
