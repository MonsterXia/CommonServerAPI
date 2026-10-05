import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), account: vi.fn(), oauth: vi.fn(), cred: vi.fn(), games: vi.fn(), checkIn: vi.fn() }));
vi.mock('@/lib/prisma', () => ({getPrismaClient:()=>({user:{findUnique:mocks.user},hypergryphAccount:{findUnique:mocks.account}})}));
vi.mock('@/service/game/hypergryph/loginService',()=>({fetchHypergryphOauthToken:mocks.oauth}));
vi.mock('@/service/game/hypergryph/skIsland/loginService',()=>({fetchSkLandCred:mocks.cred,fetchSkLandGameAccounts:mocks.games}));
vi.mock('@/service/game/hypergryph/skIsland/checkIn',()=>({skLandCheckInCore:mocks.checkIn}));
import { getBoundGames } from '@/service/game/hypergryph/accountService';
const role = {appCode:'arknights',uid:'a',gameId:'1',nickName:'Trusted'};
const c = {get:()=>({username:'test'})} as any;
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({id:1});mocks.account.mockResolvedValue({token:'secret'});mocks.oauth.mockResolvedValue({success:true,data:'oauth'});mocks.cred.mockResolvedValue({success:true,data:{cred:'cred',token:'token'}});mocks.games.mockResolvedValue({success:true,data:[role,{...role,uid:'b'}]});});
it('checks only requested owned roles, using server-owned display metadata',async()=>{
 const input = {...role,nickName:'Untrusted'};
 await getBoundGames(c,true,[input]);
 expect(mocks.checkIn).toHaveBeenCalledWith({cred:'cred',token:'token'},[role]);
});
it('rejects the entire request before any write if a selected role is unowned',async()=>{
 expect((await getBoundGames(c,true,[role,{...role,gameId:'wrong'}])).httpStatus).toBe(403);
 expect(mocks.checkIn).not.toHaveBeenCalled();
});
