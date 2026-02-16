export const hypergryphEndpoints = {
    sendSmsCode: 'general/v1/send_phone_code',
    tokenByPhoneCode: 'user/auth/v2/token_by_phone_code',
    tokenByPassword: 'user/auth/v1/token_by_phone_password',
    tokenValidation: 'user/info/v1/basic',
    grantOAuthToken: 'user/oauth2/v2/grant',
}

export const sklandEndpoints = {
    getCred: 'api/v1/user/auth/generate_cred_by_code',
    credValidation: 'api/v1/user/check',
    getGameAccounts: 'api/v1/game/player/binding',
    arknightsCheckIn: 'api/v1/game/attendance',
    endfieldCheckIn: 'web/v1/game/endfield/attendance'
}