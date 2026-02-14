export interface UserToken {
    data: {
        token: string;
    };
    msg: string;
    status: number;
    type: string;
}

export interface UserTokenValidResponse {
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

export interface UserOAuth {
    status: number;
    type: string;
    msg: string;
    data: {
        code: string;
        uid: string;
    }
}

export interface Cred {
    cred: string;
    userId: string;
    token: string;
}

export interface UserCred {
    code: number;
    message: string;
    data: Cred
}

export interface GameUserRole {
    serverId: string;
    roleId: string;
    nickname: string;
    level: number;
    isDefault: boolean;
    isBanned: boolean;
    serverType: string;
    serverName: string;
}

export interface GameUser {
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


export interface UserInfoResponse {
    code: number;
    message: string;
    data: {
        list: GameUser[]
    }
}

export interface UserInfo {
    appCode: string;
    uid?: string;
    roleId?: string;
    channelMasterId?: string;
    serverId?: string;
    nickName: string;
}

export interface CheckInResultResponse {
    code: number;
    message: string;
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