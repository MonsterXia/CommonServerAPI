import { expect, it } from 'vitest';
import { artworkUrl } from '@/service/game/hypergryph/skIsland/artwork';
import { normalizeArknightsDetails } from '@/service/game/hypergryph/skIsland/arknightsDetails';
import { normalizeEndfieldDetails } from '@/service/game/hypergryph/skIsland/endfieldOverview';

const cover = 'https://bbs.hycdn.cn/public/skland-game/image/fixture.png';
it('preserves the matching info-map artwork without copying arbitrary upstream fields', () => {
    const result = normalizeArknightsDetails({
        activity: [{ actId: 'a', zones: [] }, { actId: 'missing', zones: [] }],
        activityInfoMap: { a: { type: 'SIDESTORY', name: 'A', picUrl: cover, secret: 'not-returned' }, missing: { type: 'BRANCHLINE' } },
        rogue: { records: [{ rogueId: 'r', bank: { current: 0 }, relicCnt: 0 }] },
        rogueInfoMap: { r: { name: 'R', picUrl: cover } },
        tower: { records: [{ towerId: 't', best: 0 }] }, towerInfoMap: { t: { picUrl: cover } },
        campaign: { records: [{ campaignId: 'c', maxKills: 0 }] }, campaignInfoMap: { c: { picUrl: cover } },
    }, 1800000000);
    for (const key of ['arknightsActivities', 'arknightsRogueRelics', 'arknightsRogueBank', 'arknightsTower', 'arknightsCampaign']) {
        const rows = result.find(section => section.key === key)!.items;
        expect(rows.find(row => row.id !== 'missing')?.artworkUrl).toBe(cover);
    }
    expect(result[0]!.items.find(row => row.id === 'missing')?.artworkUrl).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('not-returned');
});
it('retains official Endfield season and current mode artwork without guessing dungeon art', () => {
    const header = 'https://assets.skland.com/header.png';
    const result = normalizeEndfieldDetails({
        warEchoes: { seasons: [{ id: 's', kvImage: cover, headerImage: header, weeks: [{ id: 'w', dungeonGroups: [{ name: 'Stage' }] }] }] },
        indieHard: { indieHardGroups: [{ pic: cover, dungeonGroups: [{ normalDungeon: { id: 'd', name: 'Dungeon', isPass: true }, hardDungeon: { isPass: false } }] }] },
    }).sections;
    expect(result.find(row => row.key === 'endfieldWarEchoes')!.items[0]!.artworkUrl).toBe(cover);
    expect(result.find(row => row.key === 'endfieldWarEchoesWeeks')!.items[0]!.artworkUrl).toBe(header);
    expect(result.find(row => row.key === 'endfieldWarEchoesStages')!.items[0]!.artworkUrl).toBeUndefined();
    expect(result.find(row => row.key === 'endfieldMonolith')!.items[0]).toMatchObject({ artworkUrl: cover, current: 1, total: 2 });
});
it('drops invalid and nonofficial URLs without making otherwise usable data fail', () => {
    for (const value of [null, undefined, 0, '', 'bad', 'https://evil.invalid/p.png', 'https://bbs.hycdn.cn.evil.invalid/p.png', 'http://bbs.hycdn.cn/p.png', 'https://user:pass@bbs.hycdn.cn/p.png', 'data:image/png;base64,AA']) {
        expect(artworkUrl(value)).toBeUndefined();
    }
    expect(artworkUrl(cover)).toBe(cover);
    expect(artworkUrl('https://web.hycdn.cn/image.png')).toBe('https://web.hycdn.cn/image.png');
});
