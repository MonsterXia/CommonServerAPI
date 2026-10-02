import type { OverviewMetric, OverviewSection } from '@/model/game/hypergraph/skIsland/overview';

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const rows = (value: unknown): unknown[] | null => Array.isArray(value) ? value : null;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const item = (id: string, name: string | null, level: number | null, current: number | null, total: number | null): OverviewSection['items'][number] =>
    ({ id, name, level, current, total, status: 'unknown', completeAt: null });
const rating = (stars: number | null, bonus: unknown): string | null => stars === null || stars <= 0 ? null
    : stars >= 9 ? bonus === true ? 'S+' : 'S' : stars >= 7 ? 'A' : stars >= 5 ? 'B' : stars >= 3 ? 'C' : 'D';
const joinText = (...values: (string | null)[]): string | null => values.filter(Boolean).join(' · ') || null;
const stars = (value: unknown, max: number): number | null => {
    const count = num(value);
    return count === null ? null : Math.min(Math.round(count), max);
};

// Verified 2026-10-03 against the official Endfield GameDataInfoCodec, DomainDataCodec,
// and DomainExplorationCodec, plus the official room labels:
// https://assets.skland.com/_static_assets/game-tools/dist-BZImVwlH.js
// https://assets.skland.com/_static_assets/game-tools/GameData-CKtD4-ed.js
// https://assets.skland.com/_static_assets/game-tools/locales/zh_Hans.json
// Raw response shape is also documented by the open-source Skland client:
// https://github.com/FrostN0v0/nonebot-plugin-skland/blob/master/nonebot_plugin_skland/schemas/endfield/card.py
const roomOrder = [0, 1, 2, 5];
const exploration = [
    ['endfieldExplorationPuzzles', 'puzzleCount'],
    ['endfieldExplorationChests', 'trchestCount'],
    ['endfieldExplorationPieces', 'pieceCount'],
    ['endfieldExplorationBlackboxes', 'blackboxCount'],
    ['endfieldExplorationEquipChests', 'equipTrchestCount'],
    ['endfieldExplorationTrstars', 'trstarCount'],
] as const;

/** Select additional display fields from data.detail; never serialize raw records. */
export function normalizeEndfieldDetails(raw: unknown): { metrics: OverviewMetric[]; sections: OverviewSection[] } {
    const detail = obj(raw);
    const metrics: OverviewMetric[] = [];
    const sections: OverviewSection[] = [];
    const ship = rows(obj(detail.spaceShip).rooms);
    if (ship) {
        const occurrences = new Map<number, number>();
        const items = ship.map(obj).filter(room => roomOrder.includes(num(room.type) ?? -1))
            .sort((a, b) => roomOrder.indexOf(num(a.type)!) - roomOrder.indexOf(num(b.type)!))
            .map((room, index) => {
                const type = num(room.type)!;
                const ordinal = (occurrences.get(type) ?? 0) + 1;
                occurrences.set(type, ordinal);
                const nameKey = type === 0 ? 'endfieldControl'
                    : type === 5 ? 'endfieldReception'
                    : type === 1 ? (ordinal <= 2 ? `endfieldManufacture${ordinal}` : 'endfieldManufacture')
                    : ordinal === 1 ? 'endfieldPlant1' : 'endfieldPlant';
                const staff = rows(room.chars);
                return {
                    ...item(text(room.id) ?? `room-${index}`, null, num(room.level), staff?.filter(value => value !== null && typeof value === 'object' && !Array.isArray(value)).length ?? null, 3),
                    nameKey,
                };
            });
        sections.push({ key: 'endfieldSpaceship', items });
        const control = ship.map(obj).find(room => num(room.type) === 0);
        if (control) metrics.push({ key: 'cnsLevel', group: 'base', current: num(control.level), total: 5 });
    }

    const domains = rows(detail.domain);
    if (domains) {
        const domainItems: OverviewSection['items'] = [];
        const settlements: OverviewSection['items'] = [];
        const explorationItems = exploration.map(([key]) => ({ key, items: [] as OverviewSection['items'] }));
        const collections: Obj[] = [];
        let completeCollections = true;
        for (const [index, rawDomain] of domains.entries()) {
            const domain = obj(rawDomain), domainId = text(domain.domainId) ?? `domain-${index}`, name = text(domain.name);
            const money = obj(domain.moneyMgr);
            domainItems.push(item(domainId, name, num(domain.level), num(money.count), num(money.total)));
            for (const [settlementIndex, rawSettlement] of (rows(domain.settlements) ?? []).entries()) {
                const settlement = obj(rawSettlement);
                settlements.push({
                    ...item(`${domainId}:${text(settlement.id) ?? settlementIndex}`, text(settlement.name), num(settlement.level), num(settlement.remainMoney), num(settlement.moneyMax)),
                    subtitle: name,
                });
            }
            const domainCollections = rows(domain.collections);
            if (domainCollections === null) completeCollections = false;
            else collections.push(...domainCollections.map(obj));
            // levels contains counts AND denominators. collections contains only raw counts.
            for (const [levelIndex, rawLevel] of (rows(domain.levels) ?? []).entries()) {
                const level = obj(rawLevel), levelId = text(level.levelId) ?? String(levelIndex);
                for (const [typeIndex, [, field]] of exploration.entries()) {
                    // New categories can be absent in older payloads; don't invent six zero rows.
                    if (!(field in level)) continue;
                    const progress = obj(level[field]);
                    explorationItems[typeIndex].items.push({
                        ...item(`${domainId}:${levelId}`, text(level.name), null, num(progress.count), num(progress.total)),
                        subtitle: name,
                    });
                }
            }
        }
        sections.push({ key: 'endfieldDomains', items: domainItems });
        if (settlements.length) sections.push({ key: 'endfieldSettlements', items: settlements });
        sections.push(...explorationItems.filter(section => section.items.length));
        for (const [key, field] of [['ether', 'puzzleCount'], ['chests', 'trchestCount'], ['pieces', 'pieceCount']] as const) {
            const values = collections.map(collection => num(collection[field]));
            const current = completeCollections && values.every(value => value !== null)
                ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
            metrics.push({ key, group: 'collection', current, total: null });
        }
    }
    if ('seekSuspicion' in detail) {
        const seek = obj(detail.seekSuspicion), current = num(seek.count), total = num(seek.total);
        metrics.push({ key: 'seekSuspicion', group: 'daily', current: current !== null && total !== null ? Math.min(current, total) : current, total });
    }

    const medals = rows(obj(detail.achieve).achieveMedals);
    if (medals) {
        const tiers = medals.map(value => {
            const medal = obj(value), level = num(medal.level), initial = num(obj(medal.achievementData).initLevel);
            return level !== null && initial !== null ? level + initial - 1 : null;
        });
        for (const tier of [1, 2, 3]) {
            metrics.push({ key: `medalLevel${tier}`, group: 'collection', current: tiers.some(value => value === null) ? null : tiers.filter(value => value === tier).length, total: null });
        }
    }

    const seasons = rows(obj(detail.warEchoes).seasons);
    if (seasons) {
        const seasonItems: OverviewSection['items'] = [], weekItems: OverviewSection['items'] = [], stageItems: OverviewSection['items'] = [];
        for (const [seasonIndex, rawSeason] of seasons.entries()) {
            const season = obj(rawSeason), seasonId = text(season.id) ?? `season-${seasonIndex}`, seasonName = text(season.name), seasonStars = stars(season.stars, 9);
            seasonItems.push({ ...item(seasonId, seasonName, null, seasonStars, 9), rating: rating(seasonStars, season.allPlusTasks) });
            for (const [weekIndex, rawWeek] of (rows(season.weeks) ?? []).entries()) {
                const week = obj(rawWeek), weekId = `${seasonId}:${text(week.id) ?? weekIndex}`, weekName = text(week.name), weekStars = stars(week.stars, 9);
                weekItems.push({ ...item(weekId, weekName, null, weekStars, 9), subtitle: seasonName, rating: rating(weekStars, week.allPlusTasks) });
                for (const [stageIndex, rawStage] of (rows(week.dungeonGroups) ?? []).entries()) {
                    const stage = obj(rawStage);
                    stageItems.push({ ...item(`${weekId}:${stageIndex}`, text(stage.name), null, stars(stage.star, 3), 3), subtitle: joinText(seasonName, weekName) });
                }
            }
        }
        sections.push({ key: 'endfieldWarEchoes', items: seasonItems });
        if (weekItems.length) sections.push({ key: 'endfieldWarEchoesWeeks', items: weekItems });
        if (stageItems.length) sections.push({ key: 'endfieldWarEchoesStages', items: stageItems });
    }

    // The official overview shows only the first/current monolith group.
    const monolith = obj(rows(obj(detail.indieHard).indieHardGroups)?.[0]);
    const dungeons = rows(monolith.dungeonGroups);
    if (dungeons) {
        const title = text(monolith.isInActivity === true ? monolith.activityName : monolith.name);
        sections.push({ key: 'endfieldMonolith', items: dungeons.map((value, index) => {
            const dungeon = obj(value), normal = obj(dungeon.normalDungeon), hard = obj(dungeon.hardDungeon);
            const flags = [normal.isPass, hard.isPass];
            const current = flags.every(flag => typeof flag === 'boolean') ? flags.filter(flag => flag === true).length : null;
            return { ...item(text(normal.id) ?? `monolith-${index}`, text(normal.name), null, current, 2), subtitle: title };
        }) });
    }
    return { metrics, sections };
}
