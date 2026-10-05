import { endfieldChallengeNormalizer } from './endfieldRecords';
import type { WarEchoesData, WarEchoesDifficulty } from '@/model/game/hypergraph/skIsland/overview';
import { artworkUrl } from './artwork';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] | null => Array.isArray(v) ? v : null;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const time = (v: unknown) => { const n = num(v); return n !== null && n > 0 && n < 1e11 ? n : null; };
const bool = (v: unknown) => typeof v === 'boolean' ? v : null;
const score = (v: unknown, max: number) => { const n = num(v); return n === null ? null : Math.min(max, Math.round(n)); };
const rating = (n: number | null, plus: unknown): string | null => n === null || n === 0 ? null : n === 9 ? plus === true ? 'S+' : 'S' : n >= 7 ? 'A' : n >= 5 ? 'B' : n >= 3 ? 'C' : 'D';

// Official WarEchoesCodec and war-echoes / silver UI modules, verified 2026-10-05.
// passTs is duration in seconds, ts/firstPassTs are Unix seconds. Honors belong
// to warEchoes.achieves, not the account-wide achievement collection.
export function normalizeWarEchoes(detail: Obj): WarEchoesData | undefined {
  const full = obj(detail.warEchoesFull), brief = obj(detail.warEchoes);
  const detailedSeasons = list(full.seasons), briefSeasons = list(brief.seasons);
  if (!detailedSeasons && !briefSeasons) return undefined;
  const merged = new Map<string, unknown>();
  for (const [i, value] of (briefSeasons ?? []).entries()) merged.set(text(obj(value).id) ?? `season-${i}`, value);
  for (const [i, value] of (detailedSeasons ?? []).entries()) merged.set(text(obj(value).id) ?? `season-${i}`, value);
  const difficulty = endfieldChallengeNormalizer(detail);
  return {
    detailAvailable: detailedSeasons !== null,
    honors: list(full.achieves)?.map(value => { const a = obj(value); return { name: text(a.name), stars: score(a.star, 3), acquired: num(a.firstPassTs) === null ? null : Number(a.firstPassTs) > 0, acquiredAt: time(a.firstPassTs) }; }) ?? null,
    seasons: [...merged].map(([id, raw]) => {
      const s = obj(raw), stars = score(s.stars, 9);
      return { id, name: text(s.name), artworkUrl: artworkUrl(s.headerImage) ?? artworkUrl(s.kvImage) ?? null, startAt: time(s.startTs), endAt: time(s.endTs), stars, rating: rating(stars, s.allPlusTasks),
        weeks: list(s.weeks)?.map((raw, index) => {
          const w = obj(raw), stars = score(w.stars, 9);
          return { id: text(w.id) ?? `week-${index}`, name: text(w.name), startAt: time(w.startTs), endAt: time(w.endTs), stars, rating: rating(stars, w.allPlusTasks),
            stages: list(w.dungeonGroups)?.map((raw, index) => {
              const g = obj(raw), keys = ['normal', 'hard', 'cruel'] as const;
              const available = keys.filter(k => Object.keys(obj(g[`${k}Dungeon`])).length);
              return { id: text(obj(g.normalDungeon).id) ?? `stage-${index}`, name: text(g.name) ?? text(obj(g.normalDungeon).name), stars: score(g.star, 3), plusTask: bool(g.plusTask), difficulties: available.length ? available.map(k => difficulty(g[`${k}Dungeon`], k)) : null };
            }) ?? null };
        }) ?? null };
    }),
  };
}
