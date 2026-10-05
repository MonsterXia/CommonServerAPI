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
        requestId: z.string().uuid().optional(),
        completedAt: z.number().int().nonnegative().optional().describe('Unix seconds'),
        durationMs: z.number().nonnegative().optional(),
        summary: z.object({ total: z.number().int().nonnegative(), success: z.number().int().nonnegative(), alreadyCheckedIn: z.number().int().nonnegative(), failed: z.number().int().nonnegative() }).optional(),
        results: z.array(z.object({
            account: gameAccount,
            status: z.enum(['success', 'already_checked_in', 'failed']),
            rewards: z.array(z.object({ id: z.string().nullable(), name: z.string().nullable(), count: z.number().nonnegative().nullable(), type: z.string().nullable() })),
            rewardsComplete: z.boolean(),
            errorCode: z.enum(['clock_skew', 'timeout', 'network_error', 'auth_expired', 'rate_limited', 'upstream_error', 'invalid_response', 'unsupported_game']).nullable(),
            retryable: z.boolean(),
            upstreamCode: z.number().nullable(),
        })).optional(),
    })
    .openapi('CheckInResult');
const nullableNumber = z.number().nullable();
const warMember = z.object({
  id: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  level: z.number().nonnegative().nullable(),
  potential: z.number().nonnegative().nullable(),
  phase: z.number().nonnegative().nullable(),
  rarity: z.string().nullable(),
  element: z.string().nullable(),
})

const warEnemy = z.object({
  id: z.string(),
  name: z.string().nullable(),
  level: z.number().nonnegative().nullable(),
  description: z.string().nullable(),
  ability: z.string().nullable(),
  artworkUrl: z.string().nullable(),
})

const warRecord = z.object({
  recordedAt: z.number().nonnegative().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  team: z.array(warMember).nullable(),
})

const warDifficulty = z.object({
  id: z.string(),
  difficulty: z.enum(['normal', 'hard', 'cruel']),
  name: z.string().nullable(),
  isPassed: z.boolean().nullable(),
  firstPassAt: z.number().nonnegative().nullable(),
  plusTask: z.boolean().nullable(),
  description: z.string().nullable(),
  feature: z.string().nullable(),
  target: z.string().nullable(),
  recommendLevel: z.number().nonnegative().nullable(),
  enemies: z.array(warEnemy).nullable(),
  record: warRecord.nullable(),
})

const warStage = z.object({
  id: z.string(),
  name: z.string().nullable(),
  stars: z.number().nonnegative().nullable(),
  plusTask: z.boolean().nullable(),
  difficulties: z.array(warDifficulty).nullable(),
})

const warWeek = z.object({
  id: z.string(),
  name: z.string().nullable(),
  startAt: z.number().nonnegative().nullable(),
  endAt: z.number().nonnegative().nullable(),
  stars: z.number().nonnegative().nullable(),
  rating: z.string().nullable(),
  stages: z.array(warStage).nullable(),
})

const warSeason = z.object({
  id: z.string(),
  name: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  startAt: z.number().nonnegative().nullable(),
  endAt: z.number().nonnegative().nullable(),
  stars: z.number().nonnegative().nullable(),
  rating: z.string().nullable(),
  weeks: z.array(warWeek).nullable(),
})

const warHonor = z.object({
  acquired: z.boolean().nullable(),
  name: z.string().nullable(),
  stars: z.number().nonnegative().nullable(),
  acquiredAt: z.number().nonnegative().nullable(),
})

const warEchoes = z.object({
  detailAvailable: z.boolean(),
  seasons: z.array(warSeason),
  honors: z.array(warHonor).nullable(),
})

const developmentOfficer = z.object({ id: z.string().nullable(), name: z.string().nullable(), avatarUrl: z.string().nullable() })
const settlement = z.object({ id: z.string(), name: z.string().nullable(), level: z.number().nullable(), unlocked: z.boolean().nullable(), experience: z.number().nullable(), experienceMax: z.number().nullable(), isMaxLevel: z.boolean().nullable(), money: z.number().nullable(), moneyMax: z.number().nullable(), officer: developmentOfficer.nullable() })
const developmentRegion = z.object({ id: z.string(), name: z.string().nullable(), level: z.number().nullable(), money: z.number().nullable(), moneyMax: z.number().nullable(), settlements: z.array(settlement).nullable() })
const regionalDevelopment = z.object({ regions: z.array(developmentRegion) })
const monolithMedal = z.object({ name: z.string().nullable(), acquired: z.boolean().nullable(), plated: z.boolean().nullable(), level: z.number().nullable(), artworkUrl: z.string().nullable(), acquiredAt: z.number().nullable() })
const monolithStage = z.object({ id: z.string(), name: z.string().nullable(), normal: warDifficulty.nullable(), hard: warDifficulty.nullable() })
const monolithTheme = z.object({ id: z.string(), name: z.string().nullable(), artworkUrl: z.string().nullable(), activityName: z.string().nullable(), isInActivity: z.boolean().nullable(), startAt: z.number().nullable(), endAt: z.number().nullable(), medal: monolithMedal.nullable(), stages: z.array(monolithStage).nullable() })
const monolith = z.object({ detailAvailable: z.boolean(), currentThemeId: z.string().nullable(), themes: z.array(monolithTheme) })

const gloryMedal = z.object({ id: z.string(), name: z.string().nullable(), category: z.string().nullable(), level: z.number().nullable(), plated: z.boolean().nullable(), canCertify: z.boolean().nullable(), acquiredAt: z.number().nullable().describe('Acquisition Unix timestamp in seconds.'), artworkUrl: z.string().nullable() })
const gloryRoad = z.object({ count: z.number().nullable(), tiers: z.array(z.object({level: z.number(), count: z.number().nullable()})), display: z.array(z.object({slot: z.number().int().min(1).max(10), medalId: z.string().nullable()})).nullable(), medals: z.array(gloryMedal).nullable() })

export const gameOverview = z
    .object({
        gloryRoad: gloryRoad.optional(),
        warEchoes: warEchoes.optional(),
        regionalDevelopment: regionalDevelopment.optional(),
        monolith: monolith.optional(),
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
            mainProgress: z.string().nullable().describe('Main story stage or mission. For Arknights only, an exact empty string means all completed; null means unavailable.'),
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
                skinId: z.string().nullable().optional().describe('Arknights equipped skin from chars[].skinId, matched by operatorId for support. Null when unknown; no inference from owned skins.'),
                operatorId: z.string().optional().describe('Game operator identifier; Arknights avatar resolved using official CDN rules.'),
                artworkUrl: z.string().url().optional().describe('Public HTTPS artwork from the official Skland CDN for this record or its season/mode. Optional; frontend uses local artwork on absence or load failure. No image proxy or extra upstream request.'),
                sandbox: z.object({
                    maxDay: nullableNumber, maxDayChallenge: nullableNumber, mainQuest: nullableNumber,
                    subQuests: z.array(z.object({ id: z.string(), name: z.string().nullable(), done: z.boolean().nullable() })).nullable(),
                    baseLv: nullableNumber, unlockNode: nullableNumber,
                    enemyKill: nullableNumber.describe('Number of successfully defended attacks, not individual enemy kills.'),
                    createRift: nullableNumber, fixRift: z.object({ current: nullableNumber, total: nullableNumber }),
                }).optional().describe('Latest Reclamation Algorithm record. Missing measures are null; zero remains a valid value.'),
                bossRush: z.object({
                    edition: z.string().nullable(), played: z.boolean().nullable(),
                    difficulty: z.enum(['NORMAL', 'TEAM', 'EX', 'SP']).nullable(), stageCode: z.string().nullable(),
                }).optional(),
                nameKey: z.string().optional().describe('Stable client translation key for a known facility type.'),
                level: nullableNumber,
                maxLevel: z.number().nonnegative().optional().describe('Verified Endfield room level cap: control 5, other supported rooms 3.'),
                staff: z.array(z.object({
                    id: z.string(), name: z.string().nullable(), avatarUrl: z.string().url().optional(),
                })).nullable().optional().describe('Actual Endfield room assignments from spaceShip.rooms[].chars. Names matched by charId against detail.chars; public official avatar URL only. Null means unavailable, [] means unstaffed. Older responses may omit this field.'),
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
                    skinId: z.string().nullable().optional().describe('Arknights currently equipped chars[].skinId; null when unknown. Frontend prefers this skin avatar, then the default operator avatar.'),
                    avatarUrl: z.string().url().optional().describe('Endfield official charData.avatarSqUrl, falling back to avatarRtUrl when absent or invalid. No additional upstream request. Missing or failed images use a text avatar.'),
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
