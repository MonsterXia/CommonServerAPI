export interface SkLandGetCredRequestPayload {
    code: string;
}

export interface SkLandCredValidateRequestParams {
    cred: string;
}

export interface SKLandAccountsRequestParams {
    cred: string;
    token: string;
}

export interface SkLandCommonResponse {
    code: number;
    message: string;
}

export interface SkLandCredResponse extends SkLandCommonResponse {
    data: {
        cred: string;
        userId: string;
        token: string;
    }
}

export interface SkLandCredValidateResponse extends SkLandCommonResponse {
    data: {
        policyList: any[];
        isNewUser: boolean;
        nickName: string;
    }
}

export interface SklandAccountListResponse extends SkLandCommonResponse {
    data: {
        list: GameAccount[];
    }
}

export interface GameAccount {
    appCode: string;
    appName: string;
    bindingList: BindingRole[];
}

export interface BindingRole {
    uid: string;
    isOfficial: boolean;
    isDefault: boolean;
    channelMasterId: string;
    channelName: string;
    nickName: string;
    isDelete: boolean;
    gameName: string;
    gameId: number;
    roles: GameRole[];
    defaultRole: GameRole | null;
}

export interface GameRole {
    serverId: string;
    roleId: string;
    nickname: string;
    level: number;
    isDefault: boolean;
    isBanned: boolean;
    serverType: string;
    serverName: string;
}

export interface Cred {
    cred: string;
    userId: string;
    token: string;
}

export interface SKLandCheckInRequestPayload {
    appCode: string;
    nickName: string;
    uid: string;
    gameId: string;
}

export interface SKLandCheckInAPIRequestParams {
    uid: string;
    gameId: string;
}

export interface SKLandCheckInResultResponse extends SkLandCommonResponse {
    data: {
        ts: string;
        awards?: ArknightsCheckInAward[]
        awardIds?: EndfieldCheckInAward[]
        resourceInfoMap?: any
    }
}

export interface ArknightsCheckInAward {
    resource: {
        id: string;
        type: string;
        name: string;
        rarity: number;
    };
    count: number;
    type: string;
}

export interface EndfieldCheckInAward {
    id: string;
    type: number;
}