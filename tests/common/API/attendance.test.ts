import { beforeEach, expect, it, vi } from 'vitest';
import { fetchSkLandCheckInAPI } from '@/common/API/skLand';
import { skLandCheckInCore } from '@/service/game/hypergryph/skIsland/checkIn';
const { post, sign } = vi.hoisted(() => ({ post: vi.fn(), sign: vi.fn() }));
vi.mock('@/lib/gatewayManager', () => ({ getGatewayManager: () => ({ post, buildSKLandURL: (p: string) => `https://zonai.skland.com/${p}` }) }));
vi.mock('@/util/skLand', () => ({ getSkLandSignHeader: sign }));
const cred = { cred: 'private-cred', token: 'private-token' };
const role = { appCode: 'arknights', uid: '1', gameId: '1', nickName: 'Doctor' };
beforeEach(() => { vi.resetAllMocks(); sign.mockResolvedValue({ timeStamp: '100' }); });
it('sends and signs an empty Endfield body with the exact game role header', async () => {
 post.mockResolvedValue({code:0,data:{awardIds:[{id:'a',type:1}],resourceInfoMap:{a:{name:'Reward',count:80}}}});
 const result = await fetchSkLandCheckInAPI(cred, {...role,appCode:'endfield'});
 expect(post.mock.calls[0][1]).toBeUndefined();
 expect(sign.mock.calls[0][2].toString()).toBe('');
 expect(post.mock.calls[0][2]).toMatchObject({headers:{'sk-game-role':'3_1_1'},timeout:12000});
 expect(result).toMatchObject({status:'success',rewards:[{id:'a',name:'Reward',count:80,type:'1'}]});
});
it('preserves zero and all reward types without inventing missing rewards', async () => {
 post.mockResolvedValue({code:0,data:{awards:[{resource:{id:'a',name:'Reward'},count:0,type:'daily'}, {resource:{id:'b',name:'Bonus'},count:1,type:'first'}]}});
 expect(await fetchSkLandCheckInAPI(cred,role)).toMatchObject({status:'success',rewards:[{count:0,type:'daily'},{count:1,type:'first'}],rewardsComplete:true});
 post.mockResolvedValue({code:0,data:{awardIds:[{id:'missing'}],resourceInfoMap:{}}});
 expect(await fetchSkLandCheckInAPI(cred,{...role,appCode:'endfield'})).toMatchObject({status:'success',rewards:[{id:'missing',name:null,count:null}],rewardsComplete:false});
});
it('recognizes explicit already-attended responses even on HTTP 403 but not arbitrary code 10001 errors', async () => {
 post.mockRejectedValue({isAxiosError:true,response:{status:403,data:{code:10001,message:'今日已签到'}}});
 expect(await fetchSkLandCheckInAPI(cred,role)).toMatchObject({status:'already_checked_in',rewards:[]});
 post.mockResolvedValue({code:10001,message:'Invalid role'});
 await expect(fetchSkLandCheckInAPI(cred,role)).rejects.toMatchObject({code:'upstream_error'});
});
it('never retries uncertain writes or propagates raw transport messages', async () => {
 post.mockRejectedValue({isAxiosError:true,code:'ETIMEDOUT',message:'private-token'});
 const result = await skLandCheckInCore(cred,[role]);
 expect(post).toHaveBeenCalledTimes(1);
 expect(result.data).toMatchObject({results:[{status:'failed',errorCode:'timeout',retryable:true}],summary:{total:1,failed:1}});
 expect(JSON.stringify(result)).not.toContain('private-token');
});
it('rejects malformed responses, bounds timestamp correction, and ignores invalid server time', async () => {
 post.mockResolvedValue({data:{awards:[]}});
 await expect(fetchSkLandCheckInAPI(cred,role)).rejects.toMatchObject({code:'invalid_response'});
 post.mockRejectedValue({isAxiosError:true,response:{status:401,data:{code:10003,timestamp:'bad'}}});
 post.mockClear();
 await expect(fetchSkLandCheckInAPI(cred,role)).rejects.toMatchObject({code:'clock_skew',retryable:true});
 expect(post).toHaveBeenCalledTimes(1);
 post.mockRejectedValue({isAxiosError:true,response:{status:401,data:{code:10003,timestamp:'90'}}});
 post.mockClear();
 await expect(fetchSkLandCheckInAPI(cred,role)).rejects.toMatchObject({code:'clock_skew',retryable:true});
 expect(post).toHaveBeenCalledTimes(2);
 expect(sign.mock.calls.at(-1)?.[3]).toBe(10);
});
it('deduplicates exact roles, keeps different servers, and preserves mixed results', async () => {
 post.mockResolvedValueOnce({code:0,data:{awards:[]}}).mockResolvedValueOnce({code:10001,message:'今日已签到'}).mockRejectedValueOnce(new Error('private-cred'));
 const response = await skLandCheckInCore(cred,[role,role,{...role,gameId:'2'},{...role,uid:'3'}]);
 expect(post).toHaveBeenCalledTimes(3);
 expect(response.httpStatus).toBe(207);
 expect(response.data).toMatchObject({summary:{total:3,success:1,alreadyCheckedIn:1,failed:1}});
 expect(response.data!.results.map((r:any)=>r.status)).toEqual(['success','already_checked_in','failed']);
 expect(JSON.stringify(response)).not.toContain('private-cred');
});

it.each(['arknights', 'endfield'])('corrects the official clock then succeeds for %s without changing request identity', async appCode => {
 post.mockRejectedValueOnce({isAxiosError:true,response:{status:401,data:{code:10003,timestamp:'90'}}})
     .mockResolvedValueOnce({code:0,data:{awards:[],awardIds:[],resourceInfoMap:{}}});
 expect(await fetchSkLandCheckInAPI(cred,{...role,appCode})).toMatchObject({status:'success'});
 expect(sign.mock.calls[1][3]).toBe(10);
 expect(post.mock.calls[1][0]).toBe(post.mock.calls[0][0]);
 expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
 if(appCode==='endfield') expect(post.mock.calls[1][2].headers['sk-game-role']).toBe('3_1_1');
});
