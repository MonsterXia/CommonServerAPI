import crypto from 'crypto';
import { Cred, SKLandAccountsRequestParams } from '../model/game/hypergraph/skIsland/user';
import { skLandBasicSignHeaders } from '../common/constant/hypergryph';

const skLandEmbedPayolad = (payload: Record<string, any> | URLSearchParams): string => {
    if (payload instanceof URLSearchParams) {
        // GET
        return payload.toString();
    } else {
        // POST
        return JSON.stringify(payload)
    }
}

const generateSkLandSignature = async (token: string, url: string, body: string, delay?: number): Promise<[string, typeof header]> => {
    const time = String(Math.floor(Date.now() / 1000) - (delay ?? 0))
    let header = {
        platform: '',
        timestamp: time,
        dId: '',
        vName: ''
    }
    let sign = new URL(url).pathname + body + time + JSON.stringify(header);

    // Do hmac
    const hmacOperator = crypto.createHmac('SHA256', token);
    hmacOperator.update(sign, 'utf-8')
    sign = hmacOperator.digest('hex');

    // Do md5
    const md5Operator = crypto.createHash('MD5');
    md5Operator.update(sign, 'utf-8');
    sign = md5Operator.digest('hex')

    return [sign, header] as [string, typeof header];
}

export const getSkLandSignHeader = async (cred: SKLandAccountsRequestParams, url: string, body: Record<string, any> | URLSearchParams, delay?: number): Promise<Record<string, string>> => {
    const formattedBody = skLandEmbedPayolad(body);
    const [sign, header] = await generateSkLandSignature(cred.token, url, formattedBody, delay);
    const headerWithSign: Record<string, string> = {
        cred: cred.cred,
        ...skLandBasicSignHeaders,
        sign: sign,
        platform: header.platform,
        dId: header.dId,
        vName: header.vName,
        timeStamp: header.timestamp,
    };

    return headerWithSign;
}
