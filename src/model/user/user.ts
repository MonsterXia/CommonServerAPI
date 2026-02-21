export interface UserRegisterRequestPayload {
    username: string;
    password: string;
}

export interface UserPasswordLoginRequestPayload {
    username: string;
    password: string;
}

export interface SendEmailVerificationCodeRequestPayload {
    email: string;
}