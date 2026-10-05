import { describe, it, expect } from 'vitest';
import { normalizeWarEchoes } from '@/service/game/hypergryph/skIsland/warEchoes';
import { gameOverview } from '@/openapi/schemas';
const avatar = 'https://web.hycdn.cn/war-fixture.png';
const challenge = { id: 'd', name: 'Challenge', isPass: true, plusTask: false, firstPassTs: '1700000000', recommendLevel: 60,
  bestRecord: { ts: '1700000600', passTs: '125', chars: [{ charId: 'history-id', avatarUrl: avatar, level: 30, evolvePhase: 1, potentialLevel: 0, rarity: {value: '6'}, property: {value: 'Heat'} }] },
  enemies: [{id:'e',name:'Enemy',level:50,imageUrl:'https://evil.test/enemy.png',desc:'Enemy description',ability:'Ability'}] };
const season = { id:'s', name:'Season', stars:9, allPlusTasks:true, startTs:'1699000000', endTs:'1701000000', weeks:[{id:'w',name:'Week',stars:0,startTs:'1700000000',endTs:'1700500000',dungeonGroups:[{name:'Stage',star:3,plusTask:false,normalDungeon:challenge,hardDungeon:{...challenge,id:'hard',isPass:false,bestRecord:{passTs:'0'}},cruelDungeon:{id:'cruel'}}]}] };
describe('War Echoes nested records',()=>{
  it('preserves difficulty ownership, record duration, historical team attributes and nullable fields',()=>{
    const result=normalizeWarEchoes({ chars:[{id:'owned',charData:{id:'definition',name:'Named operator',avatarSqUrl:avatar}}],warEchoesFull:{seasons:[season],achieves:[{name:'Honor',star:3,firstPassTs:'1700000000'},{star:2,firstPassTs:'0'}]} })!;
    expect(result.detailAvailable).toBe(true);
    expect(result.seasons[0].rating).toBe('S+');
    expect(result.seasons[0].weeks![0].rating).toBeNull();
    const d=result.seasons[0].weeks![0].stages![0].difficulties!;
    expect(d.map(d=>d.difficulty)).toEqual(['normal','hard','cruel']);
    expect(d[0].record).toMatchObject({durationSeconds:125,recordedAt:1700000600,team:[{name:'Named operator',level:30,potential:0}]});
    expect(d[0].enemies![0].artworkUrl).toBeNull();
    expect(d[1].record).toBeNull(); expect(d[2].isPassed).toBeNull();
    expect(result.honors!.map(h=>h.acquired)).toEqual([true,false]);
    expect(gameOverview.shape.warEchoes.safeParse(result).success).toBe(true);
  });
  it('keeps brief data on optional failure, merges by season ID and never invents zero honors',()=>{
    const brief=normalizeWarEchoes({warEchoes:{seasons:[season]}})!;
    expect(brief.detailAvailable).toBe(false);expect(brief.honors).toBeNull();
    const merged=normalizeWarEchoes({warEchoes:{seasons:[season,{id:'old',weeks:[]}]},warEchoesFull:{seasons:[{...season,name:'Detailed'}],achieves:[]}})!;
    expect(merged.seasons.map(s=>s.name)).toEqual(['Detailed',null]);expect(merged.honors).toEqual([]);
    expect(normalizeWarEchoes({})).toBeUndefined();
    expect(normalizeWarEchoes({warEchoesFull:{seasons:[],achieves:[{}]}})!.honors![0].acquired).toBeNull();
  });
});
