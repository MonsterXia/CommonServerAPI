import type { SKLandGameAccount } from './user';

export interface OverviewMetric {
    key: string;
    group: 'daily' | 'base' | 'collection';
    current: number | null;
    total: number | null;
    recoveryAt?: number | null;
}
export interface GameOverview {
    account: SKLandGameAccount;
    fetchedAt: number;
    updatedAt: number | null;
    profile: {
        level: number | null;
        worldLevel: number | null;
        registeredAt: number | null;
        lastOnlineAt: number | null;
        mainProgress: string | null;
    };
    metrics: OverviewMetric[];
    operators: { id: string; name: string; level: number | null; phase: number | null }[] | null;
}
