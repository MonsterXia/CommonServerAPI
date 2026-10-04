import type { GameOverview, OverviewMetric } from '@/model/game/hypergraph/skIsland/overview';
import type { SKLandGameAccount } from '@/model/game/hypergraph/skIsland/user';
import { artworkUrl } from './artwork';
import { normalizeArknightsDetails } from './arknightsDetails';
import { normalizeEndfieldDetails } from './endfieldOverview';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] | null => Array.isArray(v) ? v : null;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => {
    if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
};
const timestamp = (v: unknown): number | null => {
    const n = num(v);
    if (!n) return null;
    const seconds = n > 1e12 ? n / 1000 : n;
    return seconds <= 8640000000000 ? Math.floor(seconds) : null;
};
const count = (v: unknown) => list(v)?.length ?? null;
function sumRows(v: unknown, read: (row: Obj) => number | null): number | null {
    const rows = list(v);
    if (!rows) return null;
    const values = rows.map(row => read(obj(row)));
    return values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);
}

// Verified against Skland's own web formatter (source links in the project skill).
function recover(metric: OverviewMetric, at: number | null, interval: number | null, now: number) {
    const { current, total, recoveryAt } = metric;
    if (current === null || total === null || total <= 0 || current >= total || !recoveryAt) return;
    if (recoveryAt <= now) { metric.current = total; return; }
    if (at === null || interval === null || interval <= 0) return;
    metric.recovery = { value: current, at, intervalSeconds: interval };
    metric.current = Math.min(total, current + Math.floor(Math.max(0, now - at) / interval + 1e-9));
}

function tradingValue(row: Obj, now: number): number | null {
    const stock = count(row.stock), limit = num(row.stockLimit), complete = timestamp(row.completeWorkTime), updated = timestamp(row.lastUpdateTime);
    if (stock === null) return null;
    if (limit === null || !complete || !updated || updated > now || complete > now || !list(row.chars)?.length) return stock;
    return stock + Math.max(0, Math.min(limit - stock, 1 + Math.floor((now - complete) / 10800)));
}

function tiredCount(building: Obj, formulas: Obj, now: number): number | null {
    const initial = list(building.tiredChars);
    if (!initial) return null;
    const tired = new Set(initial.map(v => text(obj(v).charId)).filter((id): id is string => id !== null));
    const anonymous = initial.filter(v => !text(obj(v).charId)).length;
    const resting = new Set((list(building.dormitories) ?? []).flatMap(v => list(obj(v).chars) ?? []).map(v => text(obj(v).charId)));
    function staff(values: unknown, workSeconds = Infinity) {
        for (const value of list(values) ?? []) {
            const char = obj(value), id = text(char.charId), ap = num(char.ap), at = timestamp(char.lastApAddTime);
            if (!id || resting.has(id) || ap === null || !at || at > now) continue;
            if (ap - 100 * Math.min(now - at, Math.max(0, workSeconds)) <= 360000) tired.add(id);
        }
    }
    for (const room of [...(list(building.tradings) ?? []), ...(list(building.powers) ?? [])]) staff(obj(room).chars);
    for (const room of list(building.manufactures) ?? []) {
        const row = obj(room), formula = obj(formulas[String(row.formulaId)]);
        const weight = num(formula.weight), cost = num(formula.costPoint), capacity = num(row.capacity), occupied = num(row.weight), remain = num(row.remain);
        if (!weight || !cost || capacity === null || occupied === null || remain === null) continue;
        const chars = list(row.chars) ?? [], speed = num(row.speed) || 1;
        const energy = chars.map(v => num(obj(v).ap)).filter((v): v is number => v !== null);
        const boosted = energy.length ? Math.min(...energy) / 100 : 0;
        const work = Math.max(0, Math.min(remain, Math.floor((capacity - occupied) / weight))) * cost - boosted * speed + boosted;
        staff(chars, work);
    }
    const hire = obj(building.hire), hireComplete = timestamp(hire.completeWorkTime), hires = num(hire.refreshCount);
    if (hireComplete && hireComplete <= now && hires !== null) staff(hire.chars, now - hireComplete + Math.max(0, 2 - hires) * 43200);
    const training = obj(building.training), trainingTime = num(training.remainSecs), trainingAt = timestamp(training.lastUpdateTime);
    if (trainingTime !== null && trainingAt && trainingAt <= now) staff([training.trainer], trainingTime);
    const meeting = obj(building.meeting), owned = num(obj(meeting.clue).own), complete = timestamp(meeting.completeWorkTime), updated = timestamp(meeting.lastUpdateTime);
    if (owned !== null && owned < 10 && complete && updated) staff(meeting.chars, complete - updated + Math.max(0, 9 - owned) * 43200);
    for (const id of resting) if (id) tired.delete(id);
    return tired.size + anonymous;
}

function resetCounter(value: unknown, snapshot: number | null, now: number, weekly = false): number | null {
    const current = num(value);
    if (current === null || snapshot === null) return current;
    // CN game reset: 04:00 Asia/Shanghai; Monday for weekly missions/annihilation.
    const day = Math.floor((now + 4 * 3600) / 86400);
    const boundaryDay = weekly ? day - ((day + 3) % 7) : day;
    return snapshot < boundaryDay * 86400 - 4 * 3600 ? 0 : current;
}

// Deliberately select display fields; never pass the upstream payload or credentials through.
// Recover timed resources as the official client does; preserve non-timed snapshots.
export function normalizeGameOverview(account: SKLandGameAccount, raw: unknown, now = Date.now()): GameOverview {
    const data = obj(raw);
    const endfield = account.appCode === 'endfield';
    const detail = endfield ? obj(data.detail) : data;
    const base = obj(endfield ? detail.base : detail.status);
    if (!Object.keys(base).length) throw new Error('Game profile is missing from upstream response');
    const metrics: OverviewMetric[] = [];
    const calculatedAt = timestamp(detail.currentTs) ?? timestamp(data.currentTs) ?? Math.floor(now / 1000);
    const add = (key: string, group: OverviewMetric['group'], current: unknown, total?: unknown, recoveryAt?: unknown) =>
        metrics.push({ key, group, current: num(current), total: num(total), ...(recoveryAt === undefined ? {} : { recoveryAt: timestamp(recoveryAt) }) });
    const chars = list(detail.chars);
    const extra = endfield ? normalizeEndfieldDetails(detail) : { metrics: [], sections: normalizeArknightsDetails(detail, calculatedAt) };
    if (endfield) {
        const stamina = obj(detail.dungeon), daily = obj(detail.dailyMission), weekly = obj(detail.weeklyMission), pass = obj(detail.bpSystem);
        add('stamina', 'daily', stamina.curStamina, stamina.maxStamina, stamina.maxTs);
        add('activity', 'daily', daily.dailyActivation, daily.maxDailyActivation);
        add('weekly', 'daily', weekly.score, weekly.total);
        add('battlePass', 'daily', pass.curLevel, pass.maxLevel);
        add('operators', 'collection', base.charNum);
        add('weapons', 'collection', base.weaponNum);
        add('documents', 'collection', base.docNum);
        add('achievements', 'collection', obj(detail.achieve).count);
    } else {
        const ap = obj(base.ap), routine = obj(detail.routine), building = obj(detail.building);
        const daily = obj(routine.daily), weekly = obj(routine.weekly), campaign = obj(obj(detail.campaign).reward), labor = obj(building.labor);
        add('stamina', 'daily', ap.current, ap.max, ap.completeRecoveryTime);
        recover(metrics[metrics.length - 1], timestamp(ap.lastApAddTime), 360, calculatedAt);
        const snapshot = timestamp(base.storeTs);
        add('daily', 'daily', resetCounter(daily.current, snapshot, calculatedAt), daily.total);
        add('weekly', 'daily', resetCounter(weekly.current, snapshot, calculatedAt, true), weekly.total);
        add('orundum', 'daily', resetCounter(campaign.current, snapshot, calculatedAt, true), campaign.total);
        const laborAt = timestamp(labor.lastUpdateTime), remaining = num(labor.remainSecs), value = num(labor.value), max = num(labor.maxValue);
        add('drones', 'base', value, max, laborAt !== null && remaining !== null ? laborAt + remaining : null);
        recover(metrics[metrics.length - 1], laborAt, remaining !== null && value !== null && max !== null && max > value ? remaining / (max - value) : null, calculatedAt);
        add('tradingOrders', 'base', sumRows(building.tradings, row => tradingValue(row, calculatedAt)), sumRows(building.tradings, row => num(row.stockLimit)));
        add('tiredOperators', 'base', tiredCount(building, obj(detail.manufactureFormulaInfoMap), calculatedAt));
        add('recruitRefresh', 'base', obj(building.hire).refreshCount);
        add('operators', 'collection', chars?.filter(value => {
            const id = text(obj(value).charId);
            return id && (id === 'char_002_amiya' || !id.includes('_amiya'));
        }).length ?? base.charCnt);
        add('skins', 'collection', count(detail.skins) ?? base.skinCnt);
        add('furniture', 'collection', obj(building.furniture).total ?? base.furnitureCnt);
        add('medals', 'collection', obj(detail.medal).total);
        for (const [key, sectionKey, group] of [['manufacturing', 'arknightsManufacturing', 'base'], ['restedOperators', 'arknightsDormitories', 'base']] as const) {
            const section = extra.sections.find(s => s.key === sectionKey);
            if (section) {
                add(key, group, sumRows(section.items, row => num(row.current)), sumRows(section.items, row => num(row.total)));
            }
        }
        const recruits = list(detail.recruit);
        if (recruits) {
            const known = recruits.every(row => num(obj(row).state) !== null);
            add('recruitAvailable', 'daily', known ? recruits.filter(value => {
                const row = obj(value), state = num(row.state), finish = timestamp(row.finishTs);
                return state === 1 || state === 3 || (state === 2 && finish !== null && finish <= calculatedAt);
            }).length : null, known ? recruits.filter(value => num(obj(value).state) !== 0).length : null);
        }
        const tower = obj(obj(detail.tower).reward);
        for (const [key, source] of [['towerLower', tower.lowerItem], ['towerHigher', tower.higherItem]] as const) {
            if (source !== undefined) {
                const counter = obj(source), day = new Date((calculatedAt + 14400) * 1000);
                const reset = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() >= 16 ? 16 : 1) / 1000 - 14400;
                add(key, 'daily', snapshot !== null && snapshot < reset && num(counter.current) !== null ? 0 : counter.current, counter.total);
            }
        }
    }
    const info = obj(detail.charInfoMap), stageId = text(base.mainStageProgress), stage = obj(stageId ? obj(detail.stageInfoMap)[stageId] : null);
    const operators = chars?.map(value => {
        const char = obj(value), charData = obj(char.charData);
        const id = text(endfield ? char.id : char.charId) ?? (endfield ? text(charData.id) : null);
        if (!id) return null;
        const name = text(endfield ? charData.name : obj(info[id]).name) ?? id;
        const metadata = endfield ? charData : obj(info[id]);
        const rarity = endfield ? num(text(obj(metadata.rarity).key)?.replace(/^rarity_/, '')) : num(metadata.rarity);
        return { id, name, level: num(char.level), phase: num(char.evolvePhase),
            rarity: rarity !== null ? rarity + (endfield ? 0 : 1) : null,
            potential: num(endfield ? char.potentialLevel : char.potentialRank) === null ? null : Number(endfield ? char.potentialLevel : char.potentialRank) + (endfield ? 0 : 1),
            ...(endfield ? {
                profession: text(obj(metadata.profession).value), element: text(obj(metadata.property).value),
                avatarUrl: artworkUrl(charData.avatarSqUrl) ?? artworkUrl(charData.avatarRtUrl),
            } : {}),
        };
    }).filter((v): v is NonNullable<typeof v> => v !== null).sort((a, b) => (b.level ?? -1) - (a.level ?? -1)) ?? null;
    return {
        account,
        fetchedAt: Math.floor(now / 1000),
        calculatedAt,
        updatedAt: timestamp(endfield ? base.saveTime : base.storeTs),
        profile: {
            // Game protagonist appearance, not the account holder's gender. No image data is returned.
            ...(endfield ? { endministratorGender: num(base.gender) === 1 ? 'male' as const : num(base.gender) === 2 ? 'female' as const : null } : {}),
            level: num(base.level),
            worldLevel: endfield ? num(base.worldLevel) : null,
            registeredAt: timestamp(endfield ? base.createTime : base.registerTs),
            lastOnlineAt: timestamp(endfield ? base.lastLoginTime : base.lastOnlineTs),
            // Skland explicitly renders an exact empty Arknights progress string as all completed.
            mainProgress: endfield ? text(obj(base.mainMission).description)
                : base.mainStageProgress === '' ? '' : (text(stage.code) ?? text(stage.name) ?? stageId),
        },
        metrics: [...metrics, ...extra.metrics],
        sections: extra.sections,
        operators,
    };
}
