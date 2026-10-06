export const DRIVING = {
    forwardSpeed: 6,
    reverseSpeed: 3,
    acceleration: 3.8,
    rollingResistance: 1.9,
    brakeDeceleration: 10,
    maximumSteering: 35,
    steeringResponse: 8,
    lateralGrip: 16
} as const;

/** Opposite pedal input first stops the car, then accelerates in the new direction. */
export function stepSpeed(speed: number, throttle: number, brake: boolean, dt: number) {
    const braking = brake || (throttle !== 0 && speed * throttle < -0.08);
    if (braking || throttle === 0) {
        const deceleration = braking ? DRIVING.brakeDeceleration : DRIVING.rollingResistance;
        return Math.sign(speed) * Math.max(0, Math.abs(speed) - deceleration * dt);
    }
    return Math.max(
        -DRIVING.reverseSpeed,
        Math.min(DRIVING.forwardSpeed, speed + throttle * DRIVING.acceleration * dt)
    );
}

export function stepSteering(angle: number, input: number, dt: number) {
    return angle + (input * DRIVING.maximumSteering - angle) * (1 - Math.exp(-DRIVING.steeringResponse * dt));
}

export function steeringYawRate(speed: number, steering: number, wheelbase: number) {
    return (speed / wheelbase) * Math.tan((steering * Math.PI) / 180);
}
