import { describe, expect, it } from 'vitest';
import { normalizeGloryRoad } from '@/service/game/hypergryph/skIsland/gloryRoad';
import { normalizeGameOverview } from '@/service/game/hypergryph/skIsland/overview';
import { gameOverview } from '@/openapi/schemas';
const url = 'https://web.hycdn.cn/synthetic.png';
const medal = (id: string, level = 1, initLevel = 1) => ({ level, obtainTs: '1700000000', isPlated: false, achievementData: { id, name: id, initLevel, cate: 'test', canCertify: true, initIcon: url, reforge2Icon: url+'?two', reforge3Icon: url+'?three', platedIcon: url+'?plated' } });
describe('Glory Road official collection', () => {
  it('preserves the total, additive medal tiers, official image priority and chosen display slots', () => {
    const raw = { count: 100, display: { 10: 'plated', 1: 'two', 0: 'invalid', 11: 'invalid', 4: 'missing' }, achieveMedals: [medal('one'), medal('two',2), medal('gold',1,3), {...medal('plated',3),isPlated:true}, {...medal('locked'),obtainTs:'0'}] };
    const r = normalizeGloryRoad({achieve:raw})!;
    expect(r.count).toBe(100);
    expect(r.tiers).toEqual([{level:1,count:2},{level:2,count:1},{level:3,count:2}]);
    expect(r.medals!.map(m=>[m.id,m.level,m.artworkUrl])).toEqual([['one',1,url],['two',2,url+'?two'],['gold',3,url],['plated',3,url+'?plated']]);
    expect(r.display).toEqual([{slot:1,medalId:'two'},{slot:4,medalId:'missing'},{slot:10,medalId:'plated'}]);
    expect(gameOverview.shape.gloryRoad.safeParse(r).success).toBe(true);
    const overview = normalizeGameOverview({appCode:'endfield',gameId:'2',uid:'synthetic',nickName:'Synthetic'}, {detail:{base:{level:1},achieve:raw}});
    expect(overview.gloryRoad).toEqual(r);
  });
  it('distinguishes missing and empty collections, rejects foreign URLs and preserves unknown facts', () => {
    expect(normalizeGloryRoad({})).toBeUndefined();
    expect(normalizeGloryRoad({achieve:{}})).toMatchObject({count:null,medals:null,display:null,tiers:[{count:null},{count:null},{count:null}]});
    expect(normalizeGloryRoad({achieve:{count:0,achieveMedals:[],display:{}}})).toMatchObject({count:0,medals:[],display:[],tiers:[{count:0},{count:0},{count:0}]});
    const r = normalizeGloryRoad({achieve:{achieveMedals:[{achievementData:{id:'unknown',initIcon:'https://evil.test/a.png'}}]}})!;
    expect(r.medals![0]).toMatchObject({level:null,plated:null,canCertify:null,acquiredAt:null,artworkUrl:null});
    expect(r.tiers.every(t=>t.count===null)).toBe(true);
  });
});
