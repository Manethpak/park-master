import { advanceParkingHold, calculateScore, checkParking, ImpactTracker, nextPhase } from './rules.ts';
import type { CarPose, GameSession, LevelDefinition } from './types.ts';

export class ParkingGame {
    private listeners = new Set<() => void>();
    readonly contacts = new ImpactTracker();
    readonly level: LevelDefinition;
    resetRevision = 0;
    private hudElapsed = 0;
    session: GameSession;
    private snapshot: GameSession;

    constructor(level: LevelDefinition) {
        this.level = level;
        this.session = this.initialSession('loading');
        this.snapshot = { ...this.session };
    }

    private initialSession(phase: GameSession['phase']): GameSession {
        return {
            phase,
            hasMoved: false,
            remaining: this.level.timeLimit,
            impacts: 0,
            score: 1000,
            speed: 0,
            steering: 0,
            parkingProgress: 0,
            parkingHint: 'Find the green bay',
            impactFlash: 0,
            error: null
        };
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = () => this.snapshot;

    publish() {
        this.snapshot = { ...this.session };
        for (const listener of this.listeners) listener();
        this.hudElapsed = 0;
    }

    ready() {
        this.session.phase = nextPhase(this.session.phase, 'ready');
        this.publish();
    }

    fail(message: string) {
        this.session.phase = 'error';
        this.session.error = message;
        this.publish();
    }

    start = () => {
        if (nextPhase(this.session.phase, 'start') !== 'playing') return;
        this.session = this.initialSession('playing');
        this.contacts.reset();
        this.resetRevision++;
        this.publish();
    };

    togglePause = () => {
        const action = this.session.phase === 'paused' ? 'resume' : 'pause';
        this.session.phase = nextPhase(this.session.phase, action);
        this.publish();
    };

    pause = () => {
        if (this.session.phase !== 'playing') return;
        this.session.phase = nextPhase(this.session.phase, 'pause');
        this.publish();
    };

    impact(id: string) {
        if (this.session.phase !== 'playing' || !this.contacts.enter(id)) return;
        this.session.impacts++;
        this.session.impactFlash = 0.65;
        this.session.score = calculateScore(
            this.session.remaining,
            this.level.timeLimit,
            this.session.impacts,
            this.level.impactPenalty
        );
        this.publish();
    }

    tick(dt: number, pose: CarPose, steering: number) {
        if (this.session.phase !== 'playing') return;
        this.contacts.advance(dt);
        // Ignore tiny physics settling; once driving starts, stops do not pause the attempt.
        this.session.hasMoved ||= pose.speed > 0.05;
        if (this.session.hasMoved) this.session.remaining = Math.max(0, this.session.remaining - dt);
        this.session.speed = pose.speed;
        this.session.steering = steering;
        this.session.impactFlash = Math.max(0, this.session.impactFlash - dt);
        const parking = checkParking(pose, this.level.bay);
        this.session.parkingProgress = advanceParkingHold(this.session.parkingProgress, parking.valid, dt);
        this.session.parkingHint = !this.session.hasMoved
            ? 'Drive to start the clock'
            : !parking.contained
              ? 'Find the green bay'
              : !parking.aligned
                ? 'Face the arrow'
                : !parking.stopped
                  ? 'Brake and hold still'
                  : 'Perfect. Hold it…';
        this.session.score = calculateScore(
            this.session.remaining,
            this.level.timeLimit,
            this.session.impacts,
            this.level.impactPenalty
        );
        if (this.session.remaining <= 0) {
            this.session.phase = nextPhase(this.session.phase, 'timeout');
            this.session.score = 0;
            this.publish();
        } else if (this.session.parkingProgress >= 1) {
            this.session.phase = nextPhase(this.session.phase, 'win');
            this.publish();
        } else {
            this.hudElapsed += dt;
            if (this.hudElapsed >= 0.075) this.publish();
        }
    }
}
