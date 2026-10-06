export type Triple = [number, number, number];

export type AssetDefinition = {
    pack: 'car-kit' | 'city-kit-road' | 'city-kit-suburban';
    file: string;
    dimensions: Triple;
    center: Triple;
    scale: number;
    yaw: number;
};

export type SceneObject = {
    id: string;
    asset: string;
    position: Triple;
    heading: number;
    body?: 'static' | 'dynamic';
    mass?: number;
};

export type ParkingBay = {
    x: number;
    z: number;
    width: number;
    length: number;
    heading: number;
};

export type LevelDefinition = {
    id: string;
    name: string;
    timeLimit: number;
    impactPenalty: number;
    spawn: { position: Triple; heading: number };
    bay: ParkingBay;
    objects: SceneObject[];
};

export type GamePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'error';

export type GameSession = {
    phase: GamePhase;
    remaining: number;
    impacts: number;
    score: number;
    speed: number;
    steering: number;
    parkingProgress: number;
    parkingHint: string;
    impactFlash: number;
    error: string | null;
};

export type CarPose = {
    x: number;
    z: number;
    heading: number;
    width: number;
    length: number;
    speed: number;
};
