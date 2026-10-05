import type { SKLandGameAccount } from './user';

export interface OverviewSection {
    key: string;
    items: {
        id: string;
        name: string | null;
        nameKey?: string;
        operatorId?: string;
        skinId?: string | null;
        artworkUrl?: string;
        sandbox?: SandboxRecord;
        bossRush?: BossRushRecord;
        level: number | null;
        maxLevel?: number;
        /** Actual Endfield room assignments; null means unavailable, [] means unstaffed. */
        staff?: { id: string; name: string | null; avatarUrl?: string }[] | null;
        status: 'idle' | 'working' | 'complete' | 'locked' | 'unknown';
        current: number | null;
        total: number | null;
        completeAt: number | null;
        subtitle?: string | null;
        rating?: string | null;
    }[];
}

export interface OverviewMetric {
    key: string;
    group: 'daily' | 'base' | 'collection';
    current: number | null;
    total: number | null;
    recoveryAt?: number | null;
    recovery?: { value: number; at: number; intervalSeconds: number };
}
export interface GameOverview {
  gloryRoad?: GloryRoadData
  regionalDevelopment?: RegionalDevelopment
  monolith?: MonolithData
  warEchoes?: WarEchoesData
    account: SKLandGameAccount;
    fetchedAt: number;
    calculatedAt?: number;
    updatedAt: number | null;
    profile: {
        level: number | null;
        worldLevel: number | null;
        registeredAt: number | null;
        lastOnlineAt: number | null;
        /** Arknights: exact empty string means all completed; null means unavailable. */
        mainProgress: string | null;
        endministratorGender?: 'male' | 'female' | null;
    };
    metrics: OverviewMetric[];
    sections?: OverviewSection[];
    operators: { id: string; name: string; avatarUrl?: string; skinId?: string | null; level: number | null; phase: number | null; rarity?: number | null; potential?: number | null; profession?: string | null; element?: string | null }[] | null;
}

export interface SandboxRecord {
    maxDay: number | null;
    maxDayChallenge: number | null;
    mainQuest: number | null;
    subQuests: { id: string; name: string | null; done: boolean | null }[] | null;
    baseLv: number | null;
    unlockNode: number | null;
  /** Successful defenses, not individual enemies killed. */
    enemyKill: number | null;
    createRift: number | null;
    fixRift: { current: number | null; total: number | null };
}
export interface BossRushRecord {
    edition: string | null;
    played: boolean | null;
    difficulty: 'NORMAL' | 'TEAM' | 'EX' | 'SP' | null;
    stageCode: string | null;
}

export interface WarEchoesData {
  detailAvailable: boolean
  seasons: WarEchoesSeason[]
  honors: { name: string | null; stars: number | null; acquired: boolean | null; acquiredAt: number | null }[] | null
}
export interface WarEchoesSeason {
  id: string
  name: string | null
  artworkUrl: string | null
  startAt: number | null
  endAt: number | null
  stars: number | null
  rating: string | null
  weeks: WarEchoesWeek[] | null
}
export interface WarEchoesWeek {
  id: string
  name: string | null
  startAt: number | null
  endAt: number | null
  stars: number | null
  rating: string | null
  stages: WarEchoesStage[] | null
}
export interface WarEchoesStage {
  id: string
  name: string | null
  stars: number | null
  plusTask: boolean | null
  difficulties: WarEchoesDifficulty[] | null
}
export interface WarEchoesDifficulty {
  id: string
  difficulty: 'normal' | 'hard' | 'cruel'
  name: string | null
  isPassed: boolean | null
  firstPassAt: number | null
  plusTask: boolean | null
  description: string | null
  feature: string | null
  target: string | null
  recommendLevel: number | null
  enemies: { id: string; name: string | null; level: number | null; description: string | null; ability: string | null; artworkUrl: string | null }[] | null
  record: {
    recordedAt: number | null
    durationSeconds: number | null
    team: { id: string; name: string | null; avatarUrl: string | null; level: number | null; potential: number | null; phase: number | null; rarity: string | null; element: string | null }[] | null
  } | null
}

export interface RegionalDevelopment {
  regions: {
    id: string; name: string | null; level: number | null
    money: number | null; moneyMax: number | null
    settlements: {
      id: string; name: string | null; level: number | null; unlocked: boolean | null
      experience: number | null; experienceMax: number | null; isMaxLevel: boolean | null
      money: number | null; moneyMax: number | null
      officer: { id: string | null; name: string | null; avatarUrl: string | null } | null
    }[] | null
  }[]
}
export interface MonolithData {
  detailAvailable: boolean
  currentThemeId: string | null
  themes: {
    id: string; name: string | null; artworkUrl: string | null
    activityName: string | null; isInActivity: boolean | null; startAt: number | null; endAt: number | null
    medal: { name: string | null; acquired: boolean | null; plated: boolean | null; level: number | null; artworkUrl: string | null; acquiredAt: number | null } | null
    stages: { id: string; name: string | null; normal: WarEchoesDifficulty | null; hard: WarEchoesDifficulty | null }[] | null
  }[]
}

export interface GloryMedal {
  id: string
  name: string | null
  category: string | null
  level: number | null
  plated: boolean | null
  canCertify: boolean | null
  acquiredAt: number | null
  artworkUrl: string | null
}
export interface GloryRoadData {
  count: number | null
  tiers: { level: number; count: number | null }[]
  display: { slot: number; medalId: string | null }[] | null
  medals: GloryMedal[] | null
}
