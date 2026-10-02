import { z } from '@hono/zod-openapi';
import { validateEmail } from '@/common/validation/email';
import { validatePasswordStrength } from '@/common/validation/password';

export const text = z.string().min(1);
export const password = text.openapi({ format: 'password', writeOnly: true });
export const newPassword = password
    .min(6)
    .refine(
        (value) => validatePasswordStrength(value).valid,
        'Password does not meet the password policy',
    )
    .openapi({
        description:
            '6 or more characters, at most 72 UTF-8 bytes; uppercase, lowercase and a supported special character are required.',
    });
export const email = text
    .refine((value) => validateEmail(value).valid, 'Invalid email')
    .openapi({
        description: 'Email address; trimmed and lowercased by the service.',
        example: 'user@example.com',
    });
export const secret = text.openapi({
    writeOnly: true,
    description: 'Sensitive credential. Do not store it in logs or shared examples.',
});
export const phone = z
    .string()
    .regex(/^1\d{10}$/)
    .openapi({ description: 'Mainland China mobile number (11 digits).' });
export const code = z
    .string()
    .regex(/^\d{6}$/)
    .openapi({ writeOnly: true, description: 'Six-digit verification code.' });
export const timestamps = { createdAt: z.string().datetime(), updatedAt: z.string().datetime() };
export const errorSchema = z
    .object({
        message: z.string(),
        error: z.union([z.string(), z.object({}).passthrough(), z.null()]),
        httpStatus: z.number().int(),
    })
    .openapi('ErrorResponse');
export function envelope<T extends z.ZodType>(data: T, status: number) {
    return z.object({ message: z.string(), data, httpStatus: z.literal(status) });
}
export const publicHypergryphAccount = z
    .object({ phone: z.string(), userId: z.number().int(), ...timestamps })
    .openapi('HypergryphAccount');
export const publicPostAdmin = z
    .object({
        id: z.number().int(),
        email: z.string(),
        organization: z.string(),
        role: z.string(),
        userId: z.number().int().nullable(),
        ...timestamps,
    })
    .openapi('PostAdmin');
export const userFields = {
    id: z.number().int(),
    username: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    isAdmin: z.boolean(),
    ...timestamps,
};
export const currentUser = z
    .object({
        ...userFields,
        hypergryphAccount: publicHypergryphAccount.nullable(),
        postAdmin: publicPostAdmin.nullable(),
    })
    .openapi('CurrentUser');
export const registrationResult = z
    .object({
        user: z.object({ ...userFields, sessionVersion: z.number().int() }),
        token: z.string(),
    })
    .openapi('RegistrationResult');
export const gameAccount = z
    .object({
        appCode: z.string(),
        nickName: z.string(),
        uid: z.string(),
        gameId: z.string(),
        serverName: z.string().optional(),
    })
    .openapi('GameAccount');
export const checkInResult = z
    .object({
        checkInResults: z.array(z.string()),
        errorResults: z.array(gameAccount.extend({ error: z.string() })),
    })
    .openapi('CheckInResult');
const nullableNumber = z.number().nullable();
export const gameOverview = z
    .object({
        account: gameAccount,
        fetchedAt: z.number().describe('Unix timestamp in seconds when fetched.'),
        calculatedAt: z.number().optional().describe('Upstream currentTs used for time-based resource calculations, in Unix seconds.'),
        updatedAt: nullableNumber.describe(
            'Upstream snapshot Unix timestamp in seconds; not necessarily live.',
        ),
        profile: z.object({
            level: nullableNumber,
            worldLevel: nullableNumber,
            registeredAt: nullableNumber,
            lastOnlineAt: nullableNumber,
            mainProgress: z.string().nullable(),
            endministratorGender: z.enum(['male', 'female']).nullable().optional(),
        }),
        metrics: z.array(
            z.object({
                key: z.string(),
                group: z.enum(['daily', 'base', 'collection']),
                current: nullableNumber,
                total: nullableNumber,
                recoveryAt: nullableNumber.optional(),
                recovery: z.object({
                    value: z.number().nonnegative(),
                    at: z.number().describe('Original recovery baseline, Unix seconds.'),
                    intervalSeconds: z.number().positive(),
                }).optional().describe('Natural recovery baseline for client-side updates without network polling; cap at total, preserve over-cap values.'),
            }),
        ),
        sections: z.array(z.object({
            key: z.string(),
            items: z.array(z.object({
                id: z.string(),
                name: z.string().nullable(),
                operatorId: z.string().optional().describe('Game operator identifier; avatar resolved from frontend static resources.'),
                nameKey: z.string().optional().describe('Stable client translation key for a known facility type.'),
                level: nullableNumber,
                status: z.enum(['idle', 'working', 'complete', 'locked', 'unknown']),
                current: nullableNumber,
                total: nullableNumber,
                completeAt: nullableNumber.describe('Completion Unix timestamp in seconds, when provided by the source or its verified timing rule.'),
                subtitle: z.string().nullable().optional(),
                rating: z.string().nullable().optional(),
            })),
        })).optional(),
        operators: z
            .array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    level: nullableNumber,
                    phase: nullableNumber,
                    rarity: nullableNumber.optional().describe('Displayed star count, already converted to one-based rarity.'),
                    potential: nullableNumber.optional().describe('Displayed potential: Arknights source rank + 1, Endfield potentialLevel unchanged (zero is valid).'),
                    profession: z.string().nullable().optional(),
                    element: z.string().nullable().optional(),
                }),
            )
            .nullable(),
    })
    .openapi('GameOverview');
export const bindHypergryphInput = z
    .discriminatedUnion('method', [
        z.object({ phone, method: z.literal('sms'), code }).passthrough(),
        z.object({ phone, method: z.literal('password'), password }).passthrough(),
    ])
    .openapi('BindHypergryphInput');
export const gameOverviewQuery = z.object({
    appCode: z.enum(['arknights', 'endfield']),
    uid: z.string().regex(/^[\w-]{1,128}$/),
    gameId: z.string().regex(/^[\w-]{1,128}$/),
});
export const hypergryphIdentity = z
    .object({
        hgId: z.string(),
        phone: z.string(),
        email: z.string().nullable(),
        identityNum: z.string(),
        identityName: z.string(),
        isMinor: z.boolean(),
        isLatestUserAgreement: z.boolean(),
    })
    .openapi('HypergryphIdentity');
export const sklandCred = z
    .object({ cred: z.string(), userId: z.string(), token: z.string() })
    .openapi('SklandCredential');
export const sklandIdentity = z
    .object({
        policyList: z
            .array(z.unknown())
            .describe('Upstream policy payloads; their internal shape is not stable.'),
        isNewUser: z.boolean(),
        nickName: z.string(),
    })
    .openapi('SklandIdentity');
