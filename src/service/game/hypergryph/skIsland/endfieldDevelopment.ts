import type { RegionalDevelopment, MonolithData } from '@/model/game/hypergraph/skIsland/overview';
import { artworkUrl } from './artwork';
import { endfieldChallengeNormalizer } from './endfieldRecords';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] | null => Array.isArray(v) ? v.filter(x => x !== null && typeof x === 'object' && !Array.isArray(x)) : null;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const time = (v: unknown) => { const n = num(v); return n !== null && n > 0 && n < 1e11 ? n : null; };
const bool = (v: unknown) => typeof v === 'boolean' ? v : null;

// DomainDataCodec maps officerCharIds -> officerCharId and expToLevelUp -> expMax.
// Read raw API fields here. Level 0 is locked; only isFinalMaxLevel signals MAX.
export function normalizeRegionalDevelopment(detail: Obj): RegionalDevelopment | undefined {
  const regions = list(detail.domain);
  if (!regions) return undefined;
  const names = new Map<string, { name: string | null; avatarUrl: string | null }>();
  const avatars = new Map<string, string | null>();
  for (const value of list(detail.chars) ?? []) {
    const c = obj(value), d = obj(c.charData), name = text(d.name), avatarUrl = artworkUrl(d.avatarSqUrl) ?? artworkUrl(d.avatarRtUrl) ?? null;
    for (const id of [text(d.id), text(c.id)]) if (id) names.set(id, { name, avatarUrl });
    for (const url of new Set([artworkUrl(d.avatarSqUrl), artworkUrl(d.avatarRtUrl)])) if (url) avatars.set(url, avatars.has(url) ? null : name);
  }
  return { regions: regions.map((value, index) => {
    const d = obj(value), money = obj(d.moneyMgr);
    return { id: text(d.domainId) ?? `region-${index}`, name: text(d.name), level: num(d.level), money: num(money.count), moneyMax: num(money.total),
      settlements: list(d.settlements)?.map((value, index) => {
        const s = obj(value), id = text(s.officerCharIds), matched = id ? names.get(id) : undefined;
        const avatarUrl = artworkUrl(s.officerCharAvatar) ?? matched?.avatarUrl ?? null;
        const level = num(s.level);
        return { id: text(s.id) ?? `settlement-${index}`, name: text(s.name), level, unlocked: level === null ? null : level > 0,
          experience: num(s.exp), experienceMax: num(s.expToLevelUp), isMaxLevel: bool(s.isFinalMaxLevel), money: num(s.remainMoney), moneyMax: num(s.moneyMax),
          officer: id || avatarUrl ? { id, name: matched?.name ?? (avatarUrl ? avatars.get(avatarUrl) : null) ?? null, avatarUrl } : null };
      }) ?? null };
  }) };
}

// ShadowmarkMonolithCodec + umbral-monument UI: On=hard, Off=normal.
// Keep unknown booleans unknown (the official codec's false defaults lose evidence).
export function normalizeMonolith(detail: Obj): MonolithData | undefined {
  const full = list(obj(detail.monolithFull).indieHardGroups), brief = list(obj(detail.indieHard).indieHardGroups);
  if (!full && !brief) return undefined;
  const merged = new Map<string, Obj>();
  for (const [i, raw] of (brief ?? []).entries()) merged.set(text(obj(raw).id) ?? `theme-${i}`, obj(raw));
  for (const [i, raw] of (full ?? []).entries()) { const id = text(obj(raw).id) ?? `theme-${i}`; merged.set(id, { ...merged.get(id), ...obj(raw) }); }
  const challenge = endfieldChallengeNormalizer(detail);
  return { detailAvailable: full !== null, currentThemeId: text(obj(brief?.[0]).id) ?? merged.keys().next().value ?? null,
    themes: [...merged].map(([id, g]) => {
      const a = obj(g.achieve), data = obj(a.achievementData), level = num(a.level), obtained = num(a.obtainTs);
      const icon = a.isPlated === true ? data.platedIcon : level === 3 ? data.reforge3Icon : level === 2 ? data.reforge2Icon : data.initIcon;
      return { id, name: text(g.name), artworkUrl: artworkUrl(g.pic) ?? null, activityName: text(g.activityName), isInActivity: bool(g.isInActivity), startAt: time(g.activityStartTs), endAt: time(g.activityEndTs),
        medal: Object.keys(a).length ? { name: text(data.name), acquired: obtained === null ? null : obtained > 0, plated: bool(a.isPlated), level, artworkUrl: artworkUrl(icon) ?? artworkUrl(data.initIcon) ?? null, acquiredAt: time(a.obtainTs) } : null,
        stages: list(g.dungeonGroups)?.map((value, index) => { const s = obj(value), n = obj(s.normalDungeon), h = obj(s.hardDungeon); return {
          id: text(n.id) ?? text(h.id) ?? `stage-${index}`, name: text(n.name) ?? text(h.name),
          normal: Object.keys(n).length ? challenge(n, 'normal') : null, hard: Object.keys(h).length ? challenge(h, 'hard') : null,
        }; }) ?? null };
    }) };
}
