import { describe, expect, it } from 'vitest';
import { normalizeEndfieldDetails } from '@/service/game/hypergryph/skIsland/endfieldOverview';
import { gameOverview } from '@/openapi/schemas';
import { normalizeGameOverview } from '@/service/game/hypergryph/skIsland/overview';

describe('Endfield additional overview fields', () => {
    it('uses the official room types, order, capacity and distinct manufacture labels', () => {
        const result = normalizeEndfieldDetails({ spaceShip: { rooms: [
            { id: 'reception', type: 5, level: 3, chars: [] },
            { id: 'old-room-type', type: 3, level: 1, chars: [] },
            { id: 'manufacture-a', type: 1, level: 2, chars: [{ charId: 'a' }, null] },
            { id: 'control', type: 0, level: 5 },
            { id: 'manufacture-b', type: 1, level: 0, chars: [] },
            { id: 'plant', type: 2, level: 1, chars: [{ charId: 'b' }] },
            { id: 'unlocked', type: 999997 },
        ] } });
        const rooms = result.sections[0].items;
        expect(rooms.map(room => room.id)).toEqual(['control', 'manufacture-a', 'manufacture-b', 'plant', 'reception']);
        expect(rooms.map(room => room.nameKey)).toEqual(['endfieldControl', 'endfieldManufacture1', 'endfieldManufacture2', 'endfieldPlant1', 'endfieldReception']);
        expect(rooms.map(room => room.current)).toEqual([null, 1, 0, 1, 0]);
        expect(rooms.every(room => room.total === 3 && room.status === 'unknown' && room.completeAt === null)).toBe(true);
        expect(rooms[2].level).toBe(0);
        expect(rooms.map(room => room.maxLevel)).toEqual([5, 3, 3, 3, 3]);
        expect(rooms[0].staff).toBeNull();
        expect(rooms[2].staff).toEqual([]);
    });

    it('returns actual room assignments, matches names by ID and selects only official public avatars', () => {
        const avatar = 'https://bbs.hycdn.cn/fixture/assigned.png';
        const fallback = 'https://assets.skland.com/fixture/operator.png';
        const raw = { detail: {
            base: { level: 1 },
            chars: [
                { id: 'owned-b', charData: { id: 'b', name: 'Beta', avatarSqUrl: fallback } },
                { charData: { id: 'a', name: 'Alpha', avatarSqUrl: fallback } },
                { id: 'unassigned', charData: { name: 'Not assigned' } },
            ],
            spaceShip: { rooms: [
                { id: 'control', type: 0, level: '0', chars: [
                    { charId: 'a', avatarUrl: avatar, privateField: 'secret' },
                    { charId: 'b', avatarUrl: 'https://example.com/untrusted.png' },
                    { charId: 'unknown', avatarUrl: 'https://user:pass@bbs.hycdn.cn/private.png' },
                    null, 'invalid', [],
                ] },
                { id: 'empty', type: 1, chars: [] },
                { id: 'missing', type: 2 },
            ] },
        } };
        const before = JSON.stringify(raw);
        const data = normalizeGameOverview({ appCode: 'endfield', uid: 'fixture', gameId: '2', nickName: 'Fixture' }, raw);
        const rooms = data.sections!.find(section => section.key === 'endfieldSpaceship')!.items;
        expect(rooms[0]).toMatchObject({ level: 0, maxLevel: 5, current: 3, total: 3, staff: [
            { id: 'a', name: 'Alpha', avatarUrl: avatar },
            { id: 'b', name: 'Beta', avatarUrl: fallback },
            { id: 'unknown', name: null },
        ] });
        expect(rooms[0].staff![2]).not.toHaveProperty('avatarUrl');
        expect(rooms[1]).toMatchObject({ current: 0, staff: [] });
        expect(rooms[2]).toMatchObject({ current: null, staff: null });
        expect(JSON.stringify(rooms)).not.toMatch(/Not assigned|secret|untrusted|private/);
        expect(JSON.stringify(raw)).toBe(before);
        const parsed = gameOverview.parse(data);
        expect(parsed.sections!.find(section => section.key === 'endfieldSpaceship')!.items).toEqual(rooms);
    });

    it('matches room assignments by both definition and owned-record IDs without list-order inference', () => {
        const result = normalizeEndfieldDetails({
            chars: [
                { id: 'owned-beta', charData: { id: 'char-beta', name: 'Beta' } },
                { id: 'owned-alpha', charData: { id: 'char-alpha', name: 'Alpha' } },
            ],
            spaceShip: { rooms: [{ type: 0, chars: [
                { charId: 'char-alpha' }, { charId: 'owned-beta' }, { charId: 'missing' },
            ] }] },
        });
        expect(result.sections[0].items[0].staff?.map(member => member.name)).toEqual(['Alpha', 'Beta', null]);
    });

    it('resolves differing room IDs by exact unique official avatar metadata, never by position or filename', () => {
        const alpha = 'https://bbs.hycdn.cn/fixture/a.png';
        const beta = 'https://assets.skland.com/fixture/b.png';
        const shared = 'https://bbs.hycdn.cn/fixture/shared.png';
        const result = normalizeEndfieldDetails({
            chars: [
                { id: 'record-beta', charData: { id: 'definition-beta', name: 'Beta', avatarSqUrl: beta, avatarRtUrl: beta } },
                { id: 'record-alpha', charData: { id: 'definition-alpha', name: 'Alpha', avatarSqUrl: alpha, avatarRtUrl: shared } },
                { id: 'record-gamma', charData: { name: 'Gamma', avatarSqUrl: shared } },
                { id: 'record-invalid', charData: { name: 'Untrusted', avatarSqUrl: 'https://example.com/a.png' } },
            ],
            spaceShip: { rooms: [{ type: 0, chars: [
                { charId: 'chr_alpha', avatarUrl: alpha },
                { charId: 'chr_beta', avatarUrl: beta },
                { charId: 'chr_shared', avatarUrl: shared },
                { charId: 'chr_unknown', avatarUrl: 'https://assets.skland.com/fixture/a.png' },
                { charId: 'chr_invalid', avatarUrl: 'https://example.com/a.png' },
                { charId: 'definition-alpha', avatarUrl: shared },
            ] }] },
        });
        const staff = result.sections[0].items[0].staff!;
        expect(staff.map(member => member.name)).toEqual(['Alpha', 'Beta', null, null, null, 'Alpha']);
        expect(staff[0].id).toBe('chr_alpha');
        expect(staff[1].avatarUrl).toBe(beta);
    });

    it('keeps domain dispatch tickets separate from settlement stock and avoids inferred production', () => {
        const result = normalizeEndfieldDetails({ domain: [{
            domainId: 'domain_1', name: '四号谷地', level: 3, moneyMgr: { count: '0', total: '100000' },
            settlements: [{ id: 'settlement', name: '源石研究园', level: 2, remainMoney: '120', moneyMax: '200', exp: '10', expToLevelUp: '20' }],
            collections: [], factory: { productivity: { item: 10000 } },
        }] });
        expect(result.sections[0].items[0]).toMatchObject({ name: '四号谷地', current: 0, total: 100000 });
        expect(result.sections[1].items[0]).toMatchObject({ id: 'domain_1:settlement', name: '源石研究园', subtitle: '四号谷地', current: 120, total: 200, status: 'unknown', completeAt: null });
        expect(JSON.stringify(result)).not.toContain('productivity');
    });

    it('reads six exploration categories from levels count/total, not collections totals', () => {
        const result = normalizeEndfieldDetails({ domain: [{ domainId: 'domain_2', name: '武陵', collections: [{ puzzleCount: 7, trchestCount: 9, pieceCount: 3 }], levels: [{
            levelId: 'level_a', name: '测试地区', puzzleCount: { count: 0, total: 10 }, trchestCount: { count: 9, total: 20 },
            pieceCount: { count: 3, total: 8 }, blackboxCount: { count: 1, total: 2 }, equipTrchestCount: { count: 2, total: 5 }, trstarCount: { count: 4, total: 6 },
        }] }] });
        expect(result.sections.slice(1).map(section => section.key)).toEqual(['endfieldExplorationPuzzles', 'endfieldExplorationChests', 'endfieldExplorationPieces', 'endfieldExplorationBlackboxes', 'endfieldExplorationEquipChests', 'endfieldExplorationTrstars']);
        expect(result.sections[1].items[0]).toMatchObject({ name: '测试地区', subtitle: '武陵', current: 0, total: 10 });
        expect(result.metrics.map(metric => [metric.key, metric.current, metric.total])).toEqual([['ether', 7, null], ['chests', 9, null], ['pieces', 3, null]]);
    });

    it('does not fabricate missing content or interpret absent/malformed numbers as zero', () => {
        expect(normalizeEndfieldDetails({})).toEqual({ metrics: [], sections: [] });
        const result = normalizeEndfieldDetails({ domain: [{ moneyMgr: { count: null, total: '' }, settlements: [{ remainMoney: -1, moneyMax: true }], levels: [{ puzzleCount: null }] }] });
        expect(result.sections[0].items[0]).toMatchObject({ current: null, total: null });
        expect(result.sections[1].items[0]).toMatchObject({ current: null, total: null });
        expect(result.sections[2].items[0]).toMatchObject({ current: null, total: null });
        expect(result.sections).toHaveLength(3);
        expect(result.metrics.every(metric => metric.current === null)).toBe(true);
    });

    it('does not show incomplete collection sums as complete totals', () => {
        const result = normalizeEndfieldDetails({ domain: [
            { collections: [{ puzzleCount: 10, trchestCount: 10, pieceCount: 10 }] },
            { collections: [{ puzzleCount: 5, trchestCount: null, pieceCount: 0 }] },
        ] });
        expect(result.metrics.map(metric => metric.current)).toEqual([15, null, 10]);
        expect(normalizeEndfieldDetails({ domain: [{ collections: [] }, {}] }).metrics.every(metric => metric.current === null)).toBe(true);
    });

    it('clamps the salvage display only when both official counters are known', () => {
        expect(normalizeEndfieldDetails({ seekSuspicion: { count: 12, total: 10 } }).metrics[0]).toEqual({ key: 'seekSuspicion', group: 'daily', current: 10, total: 10 });
        expect(normalizeEndfieldDetails({ seekSuspicion: { count: 0, total: 10 } }).metrics[0].current).toBe(0);
        expect(normalizeEndfieldDetails({ seekSuspicion: { count: 4 } }).metrics[0]).toMatchObject({ current: 4, total: null });
    });

    it('counts medal tiers using their initial level instead of assuming every medal starts at level one', () => {
        const result = normalizeEndfieldDetails({ achieve: { achieveMedals: [
            { level: 1, achievementData: { initLevel: 1 } },
            { level: 1, achievementData: { initLevel: 2 } },
            { level: 2, achievementData: { initLevel: 2 } },
        ] } });
        expect(result.metrics.map(metric => [metric.key, metric.current])).toEqual([['medalLevel1', 1], ['medalLevel2', 1], ['medalLevel3', 1]]);
        expect(normalizeEndfieldDetails({ achieve: { achieveMedals: [{ level: 1 }] } }).metrics.every(metric => metric.current === null)).toBe(true);
    });

    it('preserves seasonal, weekly and stage ratings without treating a date or partial score as completion', () => {
        const result = normalizeEndfieldDetails({ warEchoes: { seasons: [{
            id: 's1', name: '锚视赛季', stars: 9, allPlusTasks: true, endTs: '1',
            weeks: [{ id: 'w1', name: '锚视轮刻', stars: 7, allPlusTasks: false, dungeonGroups: [{ name: '重伤之国', star: 3, plusTask: true }] }],
        }, { id: 's2', name: '未有记录', stars: 0 }] } });
        expect(result.sections.map(section => section.key)).toEqual(['endfieldWarEchoes', 'endfieldWarEchoesWeeks', 'endfieldWarEchoesStages']);
        expect(result.sections[0].items[0]).toMatchObject({ current: 9, rating: 'S+', total: 9, status: 'unknown', completeAt: null });
        expect(result.sections[0].items[1]).toMatchObject({ current: 0, rating: null });
        expect(result.sections[1].items[0]).toMatchObject({ current: 7, subtitle: '锚视赛季', rating: 'A' });
        expect(result.sections[2].items[0]).toMatchObject({ current: 3, subtitle: '锚视赛季 · 锚视轮刻' });
    });

    it('counts only explicit normal/hard clears in the current monolith and selects its activity name', () => {
        const result = normalizeEndfieldDetails({ indieHard: { indieHardGroups: [{
            name: '常规标题', activityName: '山中见狩', isInActivity: true, dungeonGroups: [
                { normalDungeon: { name: '清波访客', isPass: true }, hardDungeon: { isPass: false } },
                { normalDungeon: { name: '未知记录', isPass: false } },
            ],
        }, { name: '旧分组', dungeonGroups: [{ normalDungeon: { name: '旧关卡', isPass: true } }] }] } });
        expect(result.sections[0].items).toHaveLength(2);
        expect(result.sections[0].items[0]).toMatchObject({ name: '清波访客', current: 1, total: 2, subtitle: '山中见狩' });
        expect(result.sections[0].items[1].current).toBeNull();
    });

    it('selects fields rather than exposing upstream credentials, icons or private room records', () => {
        const result = normalizeEndfieldDetails({ cred: 'secret', token: 'secret', spaceShip: { rooms: [{ id: 'control', type: 0, level: 1, chars: [{ charId: 'operator', avatarUrl: 'private', physicalStrength: 9000 }], reports: { secret: true } }] } });
        expect(JSON.stringify(result)).not.toMatch(/secret|private|physicalStrength|avatarUrl|reports/);
    });
});
