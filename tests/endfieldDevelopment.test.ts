import { describe, expect, it } from 'vitest';
import { normalizeRegionalDevelopment, normalizeMonolith } from '@/service/game/hypergryph/skIsland/endfieldDevelopment';
import { gameOverview } from '@/openapi/schemas';
const avatar = 'https://web.hycdn.cn/synthetic-history.png';
const chars = [{ id: 'owned', level: 90, charData: { id: 'definition', name: 'Archive name', avatarSqUrl: avatar } }];
describe('official regional development and monolith', () => {
  it('retains ownership, officer identity, balances, exp and explicit MAX independently', () => {
    const result = normalizeRegionalDevelopment({ chars, domain: [{ domainId: 'domain_2', name: 'Region', level: 18, moneyMgr: { count: 0, total: 20 }, settlements: [
      { id: 'a', level: 3, exp: '180', expToLevelUp: '180', remainMoney: '0', moneyMax: '100', officerCharIds: 'definition', isFinalMaxLevel: false },
      { id: 'b', level: 4, isFinalMaxLevel: true, officerCharIds: 'different', officerCharAvatar: avatar },
      { id: 'c', level: 0, exp: '0', expToLevelUp: '0', remainMoney: '0' }, { id: 'unknown' },
    ] }, { domainId: 'domain_1' }] })!;
    const [a,b,c,d] = result.regions[0].settlements!;
    expect(a).toMatchObject({ experience: 180, experienceMax: 180, isMaxLevel: false, money: 0, officer: { name: 'Archive name' } });
    expect(b).toMatchObject({ isMaxLevel: true, officer: { id: 'different', name: 'Archive name' } });
    expect(c).toMatchObject({ unlocked: false, experience: 0, money: 0 });
    expect(d.unlocked).toBeNull(); expect(d.isMaxLevel).toBeNull();
    expect(result.regions[1].settlements).toBeNull();
    expect(gameOverview.shape.regionalDevelopment.safeParse(result).success).toBe(true);
    expect(normalizeRegionalDevelopment({})).toBeUndefined();
    expect(normalizeRegionalDevelopment({domain:[]})).toEqual({regions:[]});
  });
  it('preserves all themes, unknown status, historical records and medal tiers', () => {
    const record = { isPass: true, bestRecord: { passTs: '124', ts: '1700000000', chars: [{ charId: 'definition', level: 30, potentialLevel: 0, evolvePhase: 1, rarity: { value: '6' }, avatarUrl: avatar }] }, enemies: [{id:'e',name:'Enemy',imageUrl:'https://evil.test/e.png',desc:'Info',ability:'Mechanic'}], desc: 'Description', feature: 'Feature' };
    const result = normalizeMonolith({ chars, indieHard: { indieHardGroups: [{ id: 'current', name: 'Current' }] }, monolithFull: { indieHardGroups: [
      {id:'current',dungeonGroups:[{normalDungeon: {id:'n',isPass:false},hardDungeon: {id:'h',...record}},{normalDungeon:{id:'unknown'}}],achieve:{obtainTs:'1700000000',isPlated:true,level:3,achievementData:{name:'Medal',initIcon:avatar,platedIcon:avatar+'?plated'}}},
      {id:'old',dungeonGroups:[],achieve:{obtainTs:'0',isPlated:false,level:2,achievementData:{initIcon:avatar,reforge2Icon:avatar+'?tier2'}}}, {id:'missing'}
    ] } })!;
    expect(result.detailAvailable).toBe(true); expect(result.currentThemeId).toBe('current');expect(result.themes).toHaveLength(3);
    expect(result.themes[0].name).toBe('Current');
    const [a,b]=result.themes[0].stages!;
    expect(a.hard!.record).toMatchObject({durationSeconds:124,recordedAt:1700000000,team:[{name:'Archive name',level:30,potential:0}]});
    expect(a.hard!.enemies![0].artworkUrl).toBeNull();expect(a.normal!.record).toBeNull();expect(b.normal!.isPassed).toBeNull();expect(b.hard).toBeNull();
    expect(result.themes[0].medal).toMatchObject({acquired:true,plated:true,artworkUrl:avatar+'?plated'});
    expect(result.themes[1].medal).toMatchObject({acquired:false,plated:false,artworkUrl:avatar+'?tier2'});
    expect(result.themes[2].medal).toBeNull();expect(result.themes[2].stages).toBeNull();
    expect(gameOverview.shape.monolith.safeParse(result).success).toBe(true);
  });
  it('keeps overview on optional failure and never fabricates missing data',()=>{
    expect(normalizeMonolith({})).toBeUndefined();
    const r=normalizeMonolith({indieHard:{indieHardGroups:[{id:'brief',dungeonGroups:[{normalDungeon:{isPass:false},hardDungeon:{bestRecord:{passTs:'125'}}}],achieve:{}}]}})!;
    expect(r.detailAvailable).toBe(false);expect(r.themes[0].medal).toBeNull();expect(r.themes[0].stages![0].hard!.record).toBeNull();
    expect(normalizeMonolith({monolithFull:{indieHardGroups:[]}})).toMatchObject({detailAvailable:true,themes:[]});
  });
});
