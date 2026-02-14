import axios from 'axios';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import path from 'node:path'
// import { JSDOM } from 'jsdom'
import { Script } from 'node:vm'
import { readFileSync } from 'node:fs'
const _path = process.cwd();

const SKISLAND_TOKEN_BY_PASSWORD = 'https://as.hypergryph.com/user/auth/v1/token_by_phone_password'
const SKISLAND_TOKEN_VALIDATION = 'https://as.hypergryph.com/user/info/v1/basic'
const SKISLAND_OAUTH_CODE_BY_TOKEN = 'https://as.hypergryph.com/user/oauth2/v2/grant'
const SKISLAND_CRED_BY_OAUTH_CODE = 'https://zonai.skland.com/api/v1/user/auth/generate_cred_by_code'
const SKISLAND_CRED_VALIDATION = 'https://zonai.skland.com/api/v1/user/check'
const SKISLAND_USER_INFO = 'https://zonai.skland.com/api/v1/game/player/binding'
const SKISLAND_ARKNIGHTS_CHECK_IN = 'https://zonai.skland.com/api/v1/game/attendance'
const SKISLAND_ENDFIELD_CHECK_IN = 'https://zonai.skland.com/web/v1/game/endfield/attendance'

const REQUEST_METHOD_GET = 'get'
const REQUEST_METHOD_POST = 'post'
const SKISLAND_APP_CODE = '4ca99fa6b56cc2ba'
const SKISLAND_OPERATION_TYPE_AUTHORIZAION_CODE = 0
const SKISLAND_KIND_TYPE_CRED = 1

const SKLAND_SM_CONFIG = {
    organization: 'UWXspnCCJN4sfYlNfqps',
    appId: 'default',
    publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB',
    protocol: 'https',
    apiHost: 'fp-it.portal101.cn',
    apiPath: '/deviceprofile/v4',
}

interface AppConfig {
    phone: string | undefined;
    password: string | undefined;
}

interface UserToken {
    data: {
        token: string;
    };
    msg: string;
    status: number;
    type: string;
}

interface UserTokenValidResponse {
    data: {
        hgId: string
        phone: string
        email: string
        identityNum: string
        identityName: string
        nickName: string,
        isMinor: boolean,
        isLatestUserAgreement: boolean
    },
    msg: string
    status: number
    type: string
}

interface UserOAuth {
    status: number;
    type: string;
    msg: string;
    data: {
        code: string;
        uid: string;
    }
}

interface Cred {
    cred: string;
    userId: string;
    token: string;
}

interface UserCred {
    code: number;
    message: string;
    data: Cred
}

interface GameUserRole {
    serverId: string;
    roleId: string;
    nickname: string;
    level: number;
    isDefault: boolean;
    isBanned: boolean;
    serverType: string;
    serverName: string;
}

interface GmaeUser {
    appCode: string;
    appName: string;
    bindingList: [
        {
            uid: string;
            isOfficial: boolean;
            isDefault: true;
            channelMasterId: string;
            channelName: string;
            nickName: string;
            isDelete: boolean;
            gameName: string;
            gameId: number;
            roles: GameUserRole[];
            defaultRole: GameUserRole | null;
        }
    ]
}


interface UserInfoResponse {
    code: number;
    message: string;
    data: {
        list: GmaeUser[]
    }
}

interface UserInfo {
    appCode: string;
    uid?: string;
    roleId?: string;
    channelMasterId?: string;
    serverId?: string;
    nickName: string;
}

interface CheckInResultResponse {
    code: number;
    message: string;
    data: {
        ts: string;
        awards?: ArknightsCheckInAward[]
        awardIds?: EndfieldCheckInAward[]
        resourceInfoMap?: any
    }
}

// {
//     resource: {
//         id: '2003',
//         type: 'CARD_EXP',
//         name: '中级作战记录',
//         rarity: 3,
//         stageDropList: [Array],
//         otherSource: [Array],
//         buildingProductList: [Array],
//         sortId: 70002,
//         classifyType: 'MATERIAL'
//     },
//     count: 2,
//     type: 'daily'
// }
//   {
//     resource: {
//       id: '4001',
//       type: 'GOLD',
//       name: '龙门币',
//       rarity: 3,
//       stageDropList: [Array],
//       otherSource: [Array],
//       buildingProductList: [],
//       sortId: 10201,
//       classifyType: 'NORMAL'
//     },
//     count: 1000,
//     type: 'daily'
//   }
interface ArknightsCheckInAward {
    resource: {
        id: string;
        type: string;
        name: string;
        rarity: number;
    };
    count: number;
    type: string;
}

interface EndfieldCheckInAward {
    id: string;
    type: number;
}

// const createDeviceId = (): Promise<string> => {
//     const sdkJsPath = path.resolve(_path, './sm.sdk.js')
//     return new Promise((resolve) => {
//         const dom = new JSDOM(
//             '',
//             {
//                 runScripts: 'outside-only',
//                 beforeParse(window) {
//                     window._smReadyFuncs = [
//                         () => {
//                             resolve(window.SMSdk.getDeviceId())
//                         },
//                     ]
//                     window._smConf = SKLAND_SM_CONFIG
//                 },
//             },
//         )

//         const script = new Script(readFileSync(sdkJsPath, 'utf-8'))
//         const vmContext = dom.getInternalVMContext()
//         script.runInNewContext(vmContext)
//     })
// }

const dealBody = (payload: Record<string, any> | URLSearchParams): string => {
    if (payload instanceof URLSearchParams) {
        // GET
        return payload.toString();
    } else {
        // POST
        return JSON.stringify(payload)
    }
}

const generateSignature = async (token: string, url: string, body: string, delay?: number) => {
    const time = String(Math.floor(Date.now() / 1000) - (delay ?? 0))
    // console.log('timestamp = ', time)
    // const deviceId: string = await createDeviceId()
    // let header = {
    //     platform: 'MonsterArknightAssitant',
    //     timestamp: time,
    //     dId: deviceId,
    //     vName: '1.32.1'
    // }
    let header = {
        platform: '',
        timestamp: time,
        dId: '',
        vName: ''
    }
    // console.log('dId = ', header.dId)
    let sign = new URL(url).pathname + body + time + JSON.stringify(header);
    // console.log('string to be signed : ', sign)

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

const getSignHeader = async (cred: Cred, url: string, body: string, delay?: number): Promise<Record<string, string>> => {
    const [sign, header] = await generateSignature(cred.token, url, body, delay);
    const headerWithSign: Record<string, string> = {
        cred: cred.cred,
        'User-Agent': 'Skland/1.32.1 (com.hypergryph.skland; build:103201004; Android 33; ) Okhttp/4.11.0',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'Accept-Language': 'zh-Hans-CN;q=1.0',
        "Connection": "close",
        language: 'zh-hans-CN',
        sign: sign,
        platform: header.platform,
        dId: header.dId,
        vName: header.vName,
        timeStamp: header.timestamp,
    };

    return headerWithSign;
}

dotenv.config();
const config = {
    phone: process.env.PHONE,
    password: process.env.PASSWORD
}

const getUserToken = async (config: AppConfig): Promise<string> => {
    try {
        const response = await axios.post<UserToken>(SKISLAND_TOKEN_BY_PASSWORD, {
            phone: config.phone,
            password: config.password
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return response.data.data.token;
    } catch (error) {
        throw new Error(`Error occurs :${error}`)
    }
}

const validateUserToken = async (token: string): Promise<boolean> => {
    try {
        const response = await axios.get<UserTokenValidResponse>(SKISLAND_TOKEN_VALIDATION, {
            params: {
                token: token
            }
        });
        return response.data.status === 0
    } catch (error) {
        throw new Error(`Error occurs :${error}`)
    }
}

const getOAuthCode = async (token: string): Promise<string> => {
    try {
        const response = await axios.post<UserOAuth>(SKISLAND_OAUTH_CODE_BY_TOKEN, {
            token: token,
            appCode: SKISLAND_APP_CODE,
            type: SKISLAND_OPERATION_TYPE_AUTHORIZAION_CODE
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return response.data.data.code;
    } catch (error) {
        throw new Error(`Error occurs :${error}`)
    }
}

const getCred = async (code: string): Promise<Cred> => {
    try {
        const response = await axios.post<UserCred>(SKISLAND_CRED_BY_OAUTH_CODE, {
            kind: SKISLAND_KIND_TYPE_CRED,
            code: code
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return response.data.data;
    } catch (error) {
        throw new Error(`Error occurs :${error}`)
    }
}

const validateCred = async (cred: Cred): Promise<any> => {
    try {
        const response = await axios.get<UserInfoResponse>(SKISLAND_CRED_VALIDATION, {
            // headers: signedHeader
            headers: {
                Cred: cred.cred
            }
        });
        return response.data.code === 0
    } catch (error) {
        throw new Error(`Error occurs :${error}`)
    }
}

const getUserInfo = async (cred: Cred, delay?: number): Promise<UserInfo[]> => {
    const signedHeader = await getSignHeader(cred, SKISLAND_USER_INFO, dealBody(new URLSearchParams()), delay)
    try {
        // console.log('request header: ', signedHeader)
        const response = await axios.get<UserInfoResponse>(SKISLAND_USER_INFO, {
            headers: signedHeader
        });
        // console.log(JSON.stringify(response.data.data.list, null, 2))
        // Maybe multipul accounts in the list: bilibili/Official etc.
        const gameUsers: UserInfo[] = response.data.data.list.map(s => {
            return {
                appCode: s.appCode,
                uid: s.bindingList[0].uid,
                roleId: s.bindingList[0].defaultRole?.roleId,
                channelMasterId: s.bindingList[0].channelMasterId,
                serverId: s.bindingList[0].defaultRole?.serverId,
                nickName: s.bindingList[0].nickName || s.bindingList[0].defaultRole?.nickname || 'Unknown'
            }
        })
        
        return gameUsers;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 401 && delay !== undefined) {
                const result = error.response.data
                if (result.code === 10003) {
                    let timestampDiff = Number(signedHeader.timeStamp) - Number(result.timestamp)
                    console.log('Adjusting time difference beturn standart time and Hypergrypy by ', timestampDiff, ' seconds')
                    return await getUserInfo(cred, timestampDiff)
                }
                // console.log('error response data = ', result)
                throw new Error(`Error occurs :${error}`)
            }else {
                throw new Error(`Error occurs :${error}`)
            }
        } else {
            throw new Error(`Error occurs :${error}`)
        }
    }
}


const checkIn = async (cred: Cred, userInfo: UserInfo, delay?: number): Promise<string[] | string> => {
    let checkInUrl = ''
    let payload: Record<string, any> = {}

    if (userInfo.appCode === 'arknights') {
        payload.uid = userInfo.uid
        payload.gameId = userInfo.channelMasterId
        checkInUrl = SKISLAND_ARKNIGHTS_CHECK_IN
    }else if (userInfo.appCode === 'endfield') {
        payload.uid = userInfo.roleId
        payload.gameId = userInfo.serverId
        checkInUrl = SKISLAND_ENDFIELD_CHECK_IN
    }

    const signedHeader = await getSignHeader(cred, checkInUrl, dealBody(payload), delay)
    if (userInfo.appCode === 'endfield') {
        signedHeader["sk-game-role"] = `3_${userInfo.roleId}_${userInfo.serverId}`
    }

    try {
        const response = await axios.post<CheckInResultResponse>(checkInUrl, payload, {
            headers: signedHeader
        });

        // console.log('Check-in response data = ', JSON.stringify(response.data, null, 2))
        const resultResponse = response.data

        if (resultResponse.code === 0) {
            if (userInfo.appCode === 'arknights') {
                let result = resultResponse.data.awards!
                const output = result.map(s => `${s.type}: ${s.resource.name} x ${s.count}`)
                return output
            }else if (userInfo.appCode === 'endfield') {
                let result = resultResponse.data.awardIds!
                let endfieldAwardMap = resultResponse.data.resourceInfoMap!
                const awardIds = result.map(s => {
                    const resInfo = endfieldAwardMap[s.id]
                    return `${resInfo.name} x ${resInfo.count}`
                })
                return awardIds
            }else {
                return JSON.stringify(response.data)
            }
            // [
            //     {
            //         resource: {
            //             id: '4001',
            //             type: 'GOLD',
            //             name: '龙门币',
            //             rarity: 3,
            //             stageDropList: [Array],
            //             otherSource: [Array],
            //             buildingProductList: [],
            //             sortId: 10201,
            //             classifyType: 'NORMAL'
            //         },
            //         count: 500,
            //         type: 'daily'
            //     }
            // ]  
        } else {
            return JSON.stringify(response.data)
        }
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
            if (error.response.status === 403) {
                const result = error.response.data
                // console.log('error response data = ', result)
                // console.log(result)
                if (result.code === 10001) {
                    // Already checked in today
                    return result.message
                } else {
                    throw new Error(`Error occurs :${error}`)
                }
            }else if (error.response.status === 401) {
                const result = error.response.data
                if (result.code === 10003) {
                    let timestampDiff = Number(signedHeader.timeStamp) - Number(result.timestamp)
                    console.log('Adjusting time difference beturn standart time and Hypergrypy by ', timestampDiff, ' seconds')
                    return await checkIn(cred, userInfo, timestampDiff)
                }
                throw new Error(`Error occurs :${error}`)
            }else {
                console.log(error)
                throw new Error(`Error occurs :${error}`)
            }
        } else {
            throw new Error(`Error occurs :${error}`)
        }
    }
}


// run
(async () => {
    try {
        const token = await getUserToken(config);
        // console.log('token = ', token)
        // const validState = await validateUserToken(token)
        // console.log('token validation is ', validState)
        const authCode = await getOAuthCode(token);
        const cred = await getCred(authCode);
        const userInfo = await getUserInfo(cred);
        // console.log('User Info = ', userInfo)
        console.log(`🕓 Start check-in for ${userInfo.length} games`)
        for (const user of userInfo) {
            const result = await checkIn(cred, user)
            console.log(`${user.appCode}: ${result}`)
        }
        // const result = await checkIn(cred, userInfo)
        // console.log(result)
        // const credValid = await validateCred(cred)
        // console.log('cred validation is ', credValid)
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
