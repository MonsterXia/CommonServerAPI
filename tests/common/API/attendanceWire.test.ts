import { afterEach, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { request } from '@/common/gateway/axiosClient';
import { fetchSkLandCheckInAPI } from '@/common/API/skLandAttendance';
afterEach(()=>vi.unstubAllGlobals());
it.each(['arknights','endfield'])('regenerates the real signature over the exact %s wire body after official clock correction',async appCode=>{
 const wire: Request[]=[];
 vi.stubGlobal('fetch', vi.fn(async (req: Request)=>{
  wire.push(req.clone());
  return wire.length===1 ? new Response(JSON.stringify({code:10003,timestamp:'100',message:'clock'}),{status:401,headers:{'Content-Type':'application/json'}})
    : new Response(JSON.stringify({code:0,data:{awards:[],awardIds:[],resourceInfoMap:{}}}),{headers:{'Content-Type':'application/json'}});
 }));
 // Use the real Workers fetch adapter and signer; no official network requests.
 expect(request.defaults.adapter).toBe('fetch');
 const result=await fetchSkLandCheckInAPI({cred:'synthetic',token:'key'},{appCode,uid:'role',gameId:'server',nickName:'Fixture'});
 expect(result.status).toBe('success');expect(wire).toHaveLength(2);
 for(const req of wire){
  const body=await req.text(), timestamp=req.headers.get('timestamp')!;
  expect(body).toBe(appCode==='endfield' ? '' : '{"uid":"role","gameId":"server"}');
  const canonical=JSON.stringify({platform:'',timestamp,dId:'',vName:''});
  const mac=crypto.createHmac('sha256','key').update(new URL(req.url).pathname+body+timestamp+canonical).digest('hex');
  expect(req.headers.get('sign')).toBe(crypto.createHash('md5').update(mac).digest('hex'));
  if(appCode==='endfield') expect(req.headers.get('sk-game-role')).toBe('3_role_server');
 }
 expect(Math.abs(Number(wire[1].headers.get('timestamp'))-100)).toBeLessThanOrEqual(1);
});
