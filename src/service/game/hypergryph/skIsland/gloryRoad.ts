import type { GloryRoadData, GloryMedal } from '@/model/game/hypergraph/skIsland/overview';
import { artworkUrl } from './artwork';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const text = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null;
const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null;

// Official AchieveMedalCodec / AchieveCodec, dist-BZImVwlH.js (2026-10-05).
// Display slots are user-chosen, 1..10; never replace them with recent medals.
export function normalizeGloryRoad(detail: Obj): GloryRoadData | undefined {
  if (!('achieve' in detail)) return undefined;
  const a = obj(detail.achieve);
  const rows = Array.isArray(a.achieveMedals) ? a.achieveMedals : null;
  const levels = rows?.map(raw => {
    const m = obj(raw), level = num(m.level), initial = num(obj(m.achievementData).initLevel);
    return level !== null && initial !== null && Number.isInteger(level) && Number.isInteger(initial) && level > 0 && initial > 0 ? level + initial - 1 : null;
  });
  const medals: GloryMedal[] | null = rows?.flatMap((raw, index) => {
    const m = obj(raw), d = obj(m.achievementData), id = text(d.id), obtained = num(m.obtainTs), level = num(m.level);
    if (!id || obtained === 0) return [];
    const icon = m.isPlated === true ? d.platedIcon : level === 3 ? d.reforge3Icon : level === 2 ? d.reforge2Icon : d.initIcon;
    return [{ id, name: text(d.name), category: text(d.cate), level: levels?.[index] ?? null, plated: bool(m.isPlated), canCertify: bool(d.canCertify), acquiredAt: obtained !== null && obtained > 0 && obtained < 1e11 ? obtained : null, artworkUrl: artworkUrl(icon) ?? artworkUrl(d.initIcon) ?? null }];
  }) ?? null;
  const display = a.display !== null && typeof a.display === 'object' && !Array.isArray(a.display)
    ? Object.entries(a.display).flatMap(([key, value]) => {
      const slot = Number(key);
      return Number.isInteger(slot) && slot >= 1 && slot <= 10 ? [{ slot, medalId: text(value) }] : [];
    }).sort((x, y) => x.slot - y.slot) : null;
  return {
    count: num(a.count),
    tiers: [1, 2, 3].map(level => ({ level, count: !levels || levels.some(x => x === null) ? null : levels.filter(x => x === level).length })),
    medals, display,
  };
}
