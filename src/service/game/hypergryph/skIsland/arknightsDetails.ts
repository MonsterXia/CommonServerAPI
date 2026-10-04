import { artworkUrl } from './artwork';

import type { OverviewSection } from '../../../../model/game/hypergraph/skIsland/overview';

export type ArknightsDetailItem = OverviewSection['items'][number];
export type ArknightsDetailSection = { key: string; items: ArknightsDetailItem[] };

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] | null => Array.isArray(v) ? v : null;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => {
    if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
};
const time = (v: unknown): number | null => {
    const n = num(v);
    if (!n) return null;
    const seconds = n > 1e12 ? n / 1000 : n;
    return seconds <= 8640000000000 ? Math.floor(seconds) : null;
};
const stopped = (v: unknown) => v === -1 || v === '-1';
const item = (row: Obj, index = 0): ArknightsDetailItem => ({
    id: text(row.slotId) ?? String(index + 1), name: null, level: num(row.level),
    status: 'unknown', current: null, total: null, completeAt: null,
});

function manufacturing(row: Obj, index: number, formulas: Obj, now: number): ArknightsDetailItem {
    const result = item(row, index), formula = obj(formulas[String(row.formulaId)]);
    const weight = num(formula.weight), cost = num(formula.costPoint), occupied = num(row.weight), capacity = num(row.capacity);
    if (!text(formula.id) || !weight || !cost || occupied === null || capacity === null) return result;
    result.current = occupied / weight;
    result.total = Math.floor(capacity / weight);
    if (result.current >= result.total) { result.status = 'complete'; return result; }
    const staff = list(row.chars), remain = num(row.remain), at = time(row.lastUpdateTime);
    if (staff?.length === 0 || remain === 0) { result.status = 'idle'; return result; }
    if (!staff || remain === null || at === null || at > now) return result;
    const energies = staff.map(v => num(obj(v).ap));
    if (energies.some(ap => ap === null)) return result;
    // Skland's formatter models boosted work until the first worker's morale runs out,
    // followed by normal speed. Do not infer extra operator skill/buff multipliers.
    const boosted = Math.min(...energies as number[]) / 100, speed = num(row.speed) || 1;
    const remainingItems = Math.max(0, Math.min(remain, Math.floor((capacity - occupied) / weight)));
    const work = remainingItems * cost - boosted * speed + boosted, elapsed = now - at;
    const produced = elapsed >= work ? remainingItems : elapsed >= boosted
        ? Math.floor(boosted * speed / cost) + Math.floor((elapsed - boosted) / cost)
        : Math.floor(elapsed * speed / cost);
    result.current += Math.max(0, Math.min(remainingItems, produced));
    result.status = elapsed >= work ? 'complete' : 'working';
    // The official approximation can yield non-positive work for a small queue and
    // high morale. Preserve its stock display, but do not invent a completion clock.
    result.completeAt = work > 0 ? time(at + work) : null;
    return result;
}

function dormitory(row: Obj, index: number, now: number): ArknightsDetailItem {
    const result = item(row, index), staff = list(row.chars);
    if (!staff) return result;
    result.total = staff.length;
    if (!staff.length) { result.current = 0; result.status = 'idle'; return result; }
    const level = num(row.level), comfort = num(row.comfort);
    const rate = level !== null && comfort !== null ? (1.5 + 0.1 * level + 0.0004 * comfort) * 100 : null;
    let rested = 0, finish = 0;
    for (const value of staff) {
        const char = obj(value), ap = num(char.ap), at = time(char.lastApAddTime);
        if (ap === null) return result;
        if (ap >= 8640000) { rested++; continue; }
        if (!at || at > now || rate === null) return result;
        const complete = at + Math.ceil((8640000 - ap) / rate);
        if (complete <= now) rested++;
        finish = Math.max(finish, complete);
    }
    result.current = rested;
    result.status = rested === staff.length ? 'complete' : 'working';
    result.completeAt = time(finish);
    return result;
}

function trading(row: Obj, index: number, now: number): ArknightsDetailItem {
    const result = item(row, index), stock = list(row.stock), staff = list(row.chars);
    result.current = stock?.length ?? null;
    result.total = num(row.stockLimit);
    if (result.current === null || result.total === null) return result;
    if (result.current >= result.total) { result.status = 'complete'; return result; }
    if (staff?.length === 0 || stopped(row.completeWorkTime)) { result.status = 'idle'; return result; }
    const complete = time(row.completeWorkTime), at = time(row.lastUpdateTime);
    if (!staff || !complete || !at || at > now) return result;
    if (complete <= now) result.current += Math.max(0, Math.min(result.total - result.current, 1 + Math.floor((now - complete) / 10800)));
    result.status = result.current >= result.total ? 'complete' : 'working';
    // Completion time of the next order, using the same three-hour estimate as Skland.
    result.completeAt = result.status === 'complete' ? null : complete > now ? complete : complete + (1 + Math.floor((now - complete) / 10800)) * 10800;
    return result;
}

// Field calculations follow Skland's public web formatter, main-0a037d97.3091b5d8.js.
// The returned records intentionally contain only selected display fields.
export function normalizeArknightsDetails(detail: unknown, currentTs: number): ArknightsDetailSection[] {
    const data = obj(detail), building = obj(data.building), sections: ArknightsDetailSection[] = [];
    function rows(key: string, values: unknown, map: (row: Obj, index: number) => ArknightsDetailItem) {
        const source = list(values);
        if (source) sections.push({ key, items: source.map((value, index) => map(obj(value), index)) });
    }
    rows('arknightsRecruitment', data.recruit, (row, index) => {
        const result = item(row, index), state = num(row.state), finish = time(row.finishTs);
        result.status = state === 0 ? 'locked' : state === 1 ? 'idle' : state === 3 ? 'complete'
            : state === 2 && finish ? (finish <= currentTs ? 'complete' : 'working') : 'unknown';
        result.completeAt = state === 2 || state === 3 ? finish : null;
        return result;
    });
    const hire = obj(building.hire);
    if (Object.keys(hire).length) {
        const result = item(hire), staff = list(hire.chars), complete = time(hire.completeWorkTime);
        result.nameKey = 'recruitRefresh';
        // Only status is projected by the official client, not an exact future count.
        result.current = num(hire.refreshCount);
        result.total = 3;
        if ((result.current !== null && result.current > 0) || (complete !== null && complete <= currentTs)) {
            result.status = 'complete';
            result.completeAt = complete;
        } else if (staff?.length === 0) result.status = 'idle';
        else if (staff?.length) { result.status = 'working'; result.completeAt = complete; }
        sections.push({ key: 'arknightsOffice', items: [result] });
    }
    if (Object.keys(obj(building.training)).length) {
        const row = obj(building.training), trainee = obj(row.trainee), result = item(row);
        const id = text(trainee.charId), remaining = num(row.remainSecs), target = num(trainee.targetSkill);
        result.name = id ? text(obj(obj(data.charInfoMap)[id]).name) : null;
        if (row.trainee === null || stopped(trainee.charId) || stopped(trainee.targetSkill)) result.status = 'idle';
        else if (id && target !== null && remaining !== null) {
            result.status = remaining === 0 ? 'complete' : 'working';
            // Unlike labor.remainSecs, training.remainSecs is already relative to currentTs.
            result.completeAt = time(currentTs + remaining);
        }
        sections.push({ key: 'arknightsTraining', items: [result] });
    }
    rows('arknightsManufacturing', building.manufactures, (row, index) => manufacturing(row, index, obj(data.manufactureFormulaInfoMap), currentTs));
    rows('arknightsDormitories', building.dormitories, (row, index) => dormitory(row, index, currentTs));
    const meeting = obj(building.meeting), clue = obj(meeting.clue);
    if (Object.keys(clue).length) {
        const result = item(meeting), complete = time(clue.shareCompleteTime);
        result.id = 'board';
        result.nameKey = 'clueBoard';
        result.current = list(clue.board)?.length ?? null;
        result.total = 7;
        result.status = clue.sharing === false ? 'idle' : clue.sharing === true && complete
            ? complete > currentTs ? 'working' : 'complete' : 'unknown';
        result.completeAt = clue.sharing === true ? complete : null;
        const items = [result];
        for (const [field, nameKey, total] of [['own', 'clueOwned', 10], ['received', 'clueReceived', null], ['needReceive', 'cluePending', null]] as const) {
            items.push({ ...item({}), id: field, nameKey, current: num(clue[field]), total });
        }
        // dailyReward is intentionally omitted: the inspected source confirms the
        // boolean field but does not establish whether true means claimed/claimable.
        sections.push({ key: 'arknightsClues', items });
    }
    rows('arknightsTrading', building.tradings, (row, index) => trading(row, index, currentTs));
    const assists = list(data.assistChars);
    if (assists) {
        sections.push({ key: 'arknightsSupport', items: assists.map(obj).filter(row => text(row.charId)).map((row, index) => ({
            ...item(row, index), id: `${String(row.charId)}:${index}`, operatorId: text(row.charId)!,
            name: text(obj(obj(data.charInfoMap)[String(row.charId)]).name) ?? text(row.charId),
        })) });
    }
    const activities = list(data.activity);
    if (activities) {
        const items: ArknightsDetailItem[] = [];
        for (const value of activities) {
            const row = obj(value), id = text(row.actId), info = obj(obj(data.activityInfoMap)[id ?? '']);
            if (!id || info.isReplicate === true || !['SIDESTORY', 'BRANCHLINE'].includes(String(info.type))) continue;
            const result = { ...item({}), id, name: text(info.name), artworkUrl: artworkUrl(info.picUrl) }, zones = list(row.zones);
            if (zones) {
                const sum = (key: string) => {
                    const values = zones.map(zone => num(obj(zone)[key]));
                    return values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + value!, 0);
                };
                result.current = sum('clearedStage');
                result.total = sum('totalStage');
                if (result.total !== null && result.total > 0 && result.current !== null && result.current >= result.total) result.status = 'complete';
            }
            items.unshift(result);
        }
        sections.push({ key: 'arknightsActivities', items });
    }
    function records(key: string, values: unknown, idField: string, infoMap: unknown, read: (row: Obj) => number | null, subtitle?: (info: Obj) => string | null) {
        const source = list(values);
        if (!source) return;
        const items: ArknightsDetailItem[] = [];
        for (const value of source) {
            const row = obj(value), id = text(row[idField]);
            if (!id) continue;
            const info = obj(obj(infoMap)[id]);
            items.unshift({ ...item({}), id, name: text(info.name), artworkUrl: artworkUrl(info.picUrl), current: read(row), ...(subtitle ? { subtitle: subtitle(info) } : {}) });
        }
        sections.push({ key, items });
    }
    records('arknightsRogueRelics', obj(data.rogue).records, 'rogueId', data.rogueInfoMap, row => num(row.relicCnt));
    records('arknightsRogueBank', obj(data.rogue).records, 'rogueId', data.rogueInfoMap, row => num(obj(row.bank).current));
    records('arknightsTower', obj(data.tower).records, 'towerId', data.towerInfoMap, row => num(row.best), info => text(info.subName));
    records('arknightsCampaign', obj(data.campaign).records, 'campaignId', data.campaignInfoMap, row => num(row.maxKills), info => text(obj(obj(data.campaignZoneInfoMap)[String(info.campaignZoneId)]).name));
    const bossRush = list(data.bossRush);
    if (bossRush) {
        const items: ArknightsDetailItem[] = [];
        for (const value of bossRush) {
            const row = obj(value), id = text(row.id);
            if (!id) continue;
            const record = obj(row.record), played = typeof record.played === 'boolean' ? record.played : null;
            const difficulty = ['NORMAL', 'TEAM', 'EX', 'SP'].includes(String(record.difficulty))
                ? record.difficulty as 'NORMAL' | 'TEAM' | 'EX' | 'SP' : null;
            const edition = /^act(\d+)bossrush$/.exec(id)?.[1]?.padStart(2, '0') ?? null;
            items.unshift({ ...item({}), id, name: null, artworkUrl: artworkUrl(row.picUrl), bossRush: {
                edition, played, difficulty: played === true ? difficulty : null,
                stageCode: played === true ? text(obj(obj(data.stageInfoMap)[String(record.stageId)]).code) : null,
            } });
        }
        sections.push({ key: 'arknightsBossRush', items });
    }
    // Official renderer selects the first record after reversing the source list.
    // Only verified display fields are exposed; never pass through arbitrary objects.
    const sandbox = list(data.sandbox);
    if (sandbox) {
        const row = obj(sandbox.at(-1));
        const quests = list(row.subQuest), rift = list(row.fixRift);
        sections.push({ key: 'arknightsSandbox', items: sandbox.length ? [{
            ...item({}), id: text(row.id) ?? 'current', name: text(row.name), sandbox: {
                maxDay: num(row.maxDay), maxDayChallenge: num(row.maxDayChallenge), mainQuest: num(row.mainQuest),
                subQuests: quests?.map((value, index) => {
                    const quest = obj(value);
                    return { id: text(quest.id) ?? String(index), name: text(quest.name), done: typeof quest.done === 'boolean' ? quest.done : null };
                }) ?? null,
                baseLv: num(row.baseLv), unlockNode: num(row.unlockNode), enemyKill: num(row.enemyKill), createRift: num(row.createRift),
                fixRift: { current: num(rift?.[0]), total: num(rift?.[1]) },
            },
        }] : [] });
    }
    return sections;
}
