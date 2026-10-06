import type { CarPose, GamePhase, ParkingBay } from './types.ts';

export function calculateScore(remaining: number, timeLimit: number, impacts: number, penalty: number) {
    return Math.max(
        0,
        Math.round((1000 * Math.max(0, Math.min(remaining, timeLimit))) / timeLimit) - impacts * penalty
    );
}

export function angleDifference(a: number, b: number) {
    return Math.abs(((((a - b + 540) % 360) + 360) % 360) - 180);
}

export function checkParking(car: CarPose, bay: ParkingBay) {
    const theta = (car.heading * Math.PI) / 180;
    const bayTheta = (bay.heading * Math.PI) / 180;
    let contained = true;
    for (const side of [-1, 1]) {
        for (const end of [-1, 1]) {
            const dx =
                car.x - bay.x + ((side * car.width) / 2) * Math.cos(theta) + ((end * car.length) / 2) * Math.sin(theta);
            const dz =
                car.z - bay.z - ((side * car.width) / 2) * Math.sin(theta) + ((end * car.length) / 2) * Math.cos(theta);
            const localX = dx * Math.cos(bayTheta) - dz * Math.sin(bayTheta);
            const localZ = dx * Math.sin(bayTheta) + dz * Math.cos(bayTheta);
            if (Math.abs(localX) > bay.width / 2 || Math.abs(localZ) > bay.length / 2) contained = false;
        }
    }
    const aligned = angleDifference(car.heading, bay.heading) <= 10;
    const stopped = Math.abs(car.speed) < 0.15;
    return { contained, aligned, stopped, valid: contained && aligned && stopped };
}

export function advanceParkingHold(hold: number, valid: boolean, dt: number) {
    return valid ? Math.min(1, hold + dt) : 0;
}

export function mouseSteering(clientX: number, left: number, width: number) {
    // Full lock within a small, consistent distance of center, even on wide displays.
    const range = Math.min(240, width / 2);
    const offset = (clientX - left - width / 2) / Math.max(1, range);
    const deadZone = 0.08;
    return Math.abs(offset) <= deadZone
        ? 0
        : Math.sign(offset) * Math.min(1, (Math.abs(offset) - deadZone) / (1 - deadZone));
}

export function nextPhase(
    phase: GamePhase,
    action: 'ready' | 'start' | 'pause' | 'resume' | 'win' | 'timeout'
): GamePhase {
    if (action === 'ready' && phase === 'loading') return 'ready';
    if (action === 'start' && ['ready', 'playing', 'paused', 'won', 'lost'].includes(phase)) return 'playing';
    if (action === 'pause' && phase === 'playing') return 'paused';
    if (action === 'resume' && phase === 'paused') return 'playing';
    if (action === 'win' && phase === 'playing') return 'won';
    if (action === 'timeout' && phase === 'playing') return 'lost';
    return phase;
}

/** A contact remains one impact until separation, including a sustained scrape. */
export class ImpactTracker {
    private contacts = new Set<string>();
    private separating = new Map<string, number>();

    enter(id: string) {
        this.separating.delete(id);
        if (this.contacts.has(id)) return false;
        this.contacts.add(id);
        return true;
    }

    leave(id: string) {
        if (this.contacts.has(id)) this.separating.set(id, 0.3);
    }

    /** Ignore brief solver gaps so sliding along a surface stays one impact. */
    advance(dt: number) {
        for (const [id, remaining] of this.separating) {
            if (remaining > dt) this.separating.set(id, remaining - dt);
            else {
                this.separating.delete(id);
                this.contacts.delete(id);
            }
        }
    }

    reset() {
        this.contacts.clear();
        this.separating.clear();
    }
}
