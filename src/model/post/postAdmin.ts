export interface PostAdminRegisterRequestPayload {
    email: string;
    password: string;
}

export interface PostAdminValidateRequestPayload {
    email: string;
    code: string;
}

export interface PostAdminLoginRequestPayload {
    email: string;
    password: string;
}

export interface PostAdminIdentity {
    id: number;
    email: string;
}

export interface PublicPostAdmin {
    id: number;
    email: string;
    organization: string;
    role: string;
    userId: number | null;
    createdAt: Date;
    updatedAt: Date;
}
