import type { GameOverview, OverviewMetric } from '@/model/game/hypergraph/skIsland/overview';
import type { SKLandGameAccount } from '@/model/game/hypergraph/skIsland/user';

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

// Deliberately select display fields; never pass the upstream payload or credentials through.
// Values are upstream snapshots, not extrapolated live resource counters.
export function normalizeGameOverview(account: SKLandGameAccount, raw: unknown, now = Date.now()): GameOverview {
    const data = obj(raw);
    const endfield = account.appCode === 'endfield';
    const detail = endfield ? obj(data.detail) : data;
    const base = obj(endfield ? detail.base : detail.status);
    if (!Object.keys(base).length) throw new Error('Game profile is missing from upstream response');
    const metrics: OverviewMetric[] = [];
    const add = (key: string, group: OverviewMetric['group'], current: unknown, total?: unknown, recoveryAt?: unknown) =>
        metrics.push({ key, group, current: num(current), total: num(total), ...(recoveryAt === undefined ? {} : { recoveryAt: timestamp(recoveryAt) }) });
    const chars = list(detail.chars);
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
        add('daily', 'daily', daily.current, daily.total);
        add('weekly', 'daily', weekly.current, weekly.total);
        add('orundum', 'daily', campaign.current, campaign.total);
        add('drones', 'base', labor.value, labor.maxValue);
        add('tradingOrders', 'base', sumRows(building.tradings, row => count(row.stock)));
        add('tiredOperators', 'base', count(building.tiredChars));
        add('recruitRefresh', 'base', obj(building.hire).refreshCount);
        add('operators', 'collection', chars?.length ?? base.charCnt);
        add('skins', 'collection', count(detail.skins) ?? base.skinCnt);
        add('furniture', 'collection', obj(building.furniture).total ?? base.furnitureCnt);
    }
    const info = obj(detail.charInfoMap), stageId = text(base.mainStageProgress), stage = obj(stageId ? obj(detail.stageInfoMap)[stageId] : null);
    const operators = chars?.map(value => {
        const char = obj(value), charData = obj(char.charData);
        const id = text(endfield ? charData.id : char.charId);
        if (!id) return null;
        const name = text(endfield ? charData.name : obj(info[id]).name) ?? id;
        return { id, name, level: num(char.level), phase: num(char.evolvePhase) };
    }).filter((v): v is NonNullable<typeof v> => v !== null).sort((a, b) => (b.level ?? -1) - (a.level ?? -1)) ?? null;
    return {
        account,
        fetchedAt: Math.floor(now / 1000),
        updatedAt: timestamp(endfield ? base.saveTime : base.storeTs),
        profile: {
            level: num(base.level),
            worldLevel: endfield ? num(base.worldLevel) : null,
            registeredAt: timestamp(endfield ? base.createTime : base.registerTs),
            lastOnlineAt: timestamp(endfield ? base.lastLoginTime : base.lastOnlineTs),
            mainProgress: endfield ? text(obj(base.mainMission).description) : (text(stage.code) ?? text(stage.name) ?? stageId),
        },
        metrics,
        operators,
    };
}
