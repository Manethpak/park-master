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

export type SurfaceDefinition = {
    id: string;
    position: Triple;
    size: Triple;
    heading: number;
    color: string;
    solid: boolean;
    support: boolean;
};

export type ParkingMarking = ParkingBay & { id: string; wheelStop: boolean };

export type RoadAsset = 'road' | 'roadBend' | 'roadIntersection' | 'roadCrossroad';
export type RoadTile = {
    id: string;
    asset: RoadAsset;
    cell: [number, number];
    rotation: number;
};

export type LevelDefinition = {
    id: string;
    name: string;
    timeLimit: number;
    impactPenalty: number;
    spawn: { position: Triple; heading: number };
    bay: ParkingBay;
    objects: SceneObject[];
    surfaces?: SurfaceDefinition[];
    parkingBays?: ParkingMarking[];
};

/** Portable authored data. Calibration and generated road supports stay in code. */
export type MapDefinition = Omit<LevelDefinition, 'surfaces' | 'parkingBays'> & {
    schemaVersion: 1;
    grid: { cellSize: number; origin: [number, number] };
    roads: RoadTile[];
    surfaces: SurfaceDefinition[];
    parkingBays: ParkingMarking[];
};

export type GamePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'error';

export type GameSession = {
    phase: GamePhase;
    hasMoved: boolean;
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
