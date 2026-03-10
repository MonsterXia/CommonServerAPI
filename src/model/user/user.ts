export interface UserRegisterRequestPayload {
    username: string;
    password: string;
    email: string;
    registrationCode: string;
}

export interface UserPasswordLoginRequestPayload {
    username: string;
    password: string;
}

export interface SendEmailVerificationCodeRequestPayload {
    email: string;
    type: 'register' | 'reset_password';
}