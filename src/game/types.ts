export type Triple = [number, number, number];
export const PLAYER_VEHICLES = ['sedan', 'suv', 'taxi', 'hatchbackSports', 'sedanSports', 'van', 'pickup'] as const;
export type PlayerVehicle = typeof PLAYER_VEHICLES[number];
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PlayableZone = { x: number; z: number; width: number; length: number };
export type ColliderBox = { dimensions: Triple; center: Triple };

export type AssetDefinition = {
    label: string;
    category: 'Vehicles' | 'Buildings' | 'Nature' | 'Paths & driveways' | 'Props & barriers' | 'Roads';
    body?: 'static' | 'dynamic';
    mass?: number;
    impactKind?: 'small' | 'hard';
    /** Unscaled distance from the authored pivot to ground. Defaults to zero. */
    groundOffset?: number;
    pack: 'car-kit' | 'city-kit-road' | 'city-kit-suburban';
    file: string;
    dimensions: Triple;
    center: Triple;
    /** Optional unscaled box, centred relative to the grounded, pivot-compensated visual. */
    collider?: ColliderBox;
    /** Compound boxes in the same coordinate space as collider; each is part of one body. */
    colliderBoxes?: ColliderBox[];
    /** Static concave collision from the imported render mesh (rail-only assets). */
    colliderMesh?: boolean;
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

export type RoadAsset = 'road' | 'roadBend' | 'roadIntersection' | 'roadCrossroad'
    | 'roadCrossing' | 'roadEnd' | 'roadEndRound' | 'roadBendSquare' | 'roadBendSidewalk'
    | 'roadCrossroadLine' | 'roadCrossroadPath' | 'roadIntersectionLine' | 'roadIntersectionPath'
    | 'roadDrivewaySingle' | 'roadDrivewayDouble' | 'roadSquare'
    | 'roadCurve' | 'roadCurveIntersection' | 'roadCurvePavement' | 'roadRoundabout'
    | 'roadSide' | 'roadSideEntry' | 'roadSideExit' | 'roadSplit' | 'roadHalf' | 'tileLow';
export type RoadTile = {
    id: string;
    asset: RoadAsset;
    cell: [number, number];
    rotation: number;
};

export type LevelDefinition = {
    difficulty?: Difficulty;
    challenge?: string;
    campaignOrder?: number;
    playerVehicle?: PlayerVehicle;
    playableZone?: PlayableZone;
    id: string;
    name: string;
    timeLimit: number;
    /** Points deducted for a hard-object impact. */
    impactPenalty: number;
    smallImpactPenalty?: number;
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
    /** Back-to-front drafting order; has no effect on gameplay height or physics. */
    editorOrder?: string[];
};

export type GamePhase = 'loading' | 'ready' | 'playing' | 'paused' | 'won' | 'lost' | 'error';

export type GameSession = {
    phase: GamePhase;
    hasMoved: boolean;
    remaining: number;
    impacts: number;
    impactPoints: number;
    lastImpactPenalty: number;
    lastImpactKind: 'small' | 'hard' | null;
    score: number;
    speed: number;
    steering: number;
    parkingProgress: number;
    parkingInBay: boolean;
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
