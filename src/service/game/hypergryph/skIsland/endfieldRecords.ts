import type { WarEchoesDifficulty } from '@/model/game/hypergraph/skIsland/overview';
import { artworkUrl } from './artwork';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] | null => Array.isArray(v) ? v : null;
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const time = (v: unknown) => { const n = num(v); return n !== null && n > 0 && n < 1e11 ? n : null; };
const bool = (v: unknown) => typeof v === 'boolean' ? v : null;

export function endfieldChallengeNormalizer(detail: Obj) {
  const names = new Map<string, string>();
  const avatars = new Map<string, string | null>();
  for (const raw of list(detail.chars) ?? []) {
    const c = obj(raw), data = obj(c.charData), name = text(data.name);
    if (!name) continue;
    for (const id of [text(c.id), text(data.id)]) if (id) names.set(id, name);
    for (const url of new Set([artworkUrl(data.avatarSqUrl), artworkUrl(data.avatarRtUrl)])) if (url) avatars.set(url, avatars.has(url) ? null : name);
  }
  const difficulty = (raw: unknown, key: WarEchoesDifficulty['difficulty']): WarEchoesDifficulty => {
    const d = obj(raw), r = obj(d.bestRecord);
    const duration = num(r.passTs);
    return {
      id: text(d.id) ?? key, difficulty: key, name: text(d.name), isPassed: bool(d.isPass), firstPassAt: time(d.firstPassTs), plusTask: bool(d.plusTask),
      description: text(d.desc), feature: text(d.feature), target: text(d.additionalChallengeTarget), recommendLevel: num(d.recommendLevel),
      enemies: list(d.enemies)?.map((value, index) => { const e = obj(value); return { id: text(e.id) ?? `enemy-${index}`, name: text(e.name), level: num(e.level), description: text(e.desc), ability: text(e.ability), artworkUrl: artworkUrl(e.imageUrl) ?? null }; }) ?? null,
      record: d.isPass === true && duration !== null && duration > 0 ? {
        recordedAt: time(r.ts), durationSeconds: duration,
        team: list(r.chars)?.map((value, index) => {
          const c = obj(value), id = text(c.charId) ?? `member-${index}`, avatar = artworkUrl(c.avatarUrl) ?? null;
          return { id, name: names.get(id) ?? (avatar ? avatars.get(avatar) : null) ?? null, avatarUrl: avatar,
            level: num(c.level), potential: num(c.potentialLevel), phase: num(c.evolvePhase), rarity: text(obj(c.rarity).value) ?? text(obj(c.rarity).key) ?? text(c.rarity) ?? (num(c.rarity) !== null ? String(c.rarity) : null), element: text(obj(c.property).value) };
        }) ?? null,
      } : null,
    };
  };
  return difficulty;
}
