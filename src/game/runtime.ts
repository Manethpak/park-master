import { Color, Vec3 } from 'playcanvas';
import type { Application, ContactResult, Entity } from 'playcanvas';

import { ASSETS, vehicleGeometry } from './assets.ts';
import { DRIVING, stepSpeed, stepSteering, steeringYawRate } from './driving.ts';
import { mouseSteering } from './rules.ts';
import type { ParkingGame } from './session.ts';
import type { GamePhase, Triple } from './types.ts';

export type ResetBody = { entity: Entity; position: Triple; heading: number };

export function getHeading(entity: Entity) {
    const forward = entity.forward;
    return ((Math.atan2(-forward.x, -forward.z) * 180) / Math.PI + 360) % 360;
}

/** Owns mutable Engine state and input; React only mounts and disposes this runtime. */
export class ParkingRuntime {
    private app: Application;
    private game: ParkingGame;
    private player: Entity;
    private camera: Entity;
    private bodies: Map<string, ResetBody>;
    private canvas: HTMLCanvasElement;
    private keys = new Set<string>();
    private steeringInput = 0;
    private steering = 0;
    private wheelRoll = 0;
    private resetRevision = -1;
    private initialized = false;
    private wheels: Entity[] = [];
    private cameraTarget = new Vec3(-1, 0, 0);
    private velocity = new Vec3();
    private angular = new Vec3();
    private previousPhase: GamePhase;
    private previousControlMode: ParkingGame['controlMode'];
    private lastClock = performance.now();
    private unsubscribe: () => void;

    constructor(app: Application, game: ParkingGame, player: Entity, camera: Entity, bodies: Map<string, ResetBody>) {
        this.app = app;
        this.game = game;
        this.player = player;
        this.camera = camera;
        this.bodies = bodies;
        this.canvas = app.graphicsDevice.canvas as HTMLCanvasElement;
        this.previousPhase = game.session.phase;
        this.previousControlMode = game.controlMode;
        app.scene.ambientLight = new Color(0.66, 0.71, 0.77);
        app.scene.exposure = 1;
        app.maxDeltaTime = 0.1;
        if (app.systems.rigidbody) {
            app.systems.rigidbody.fixedTimeStep = 1 / 120;
            app.systems.rigidbody.maxSubSteps = 8;
        }
        app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
        app.resizeCanvas();
        this.canvas.tabIndex = 0;
        this.canvas.setAttribute('aria-label', 'Parking game. W and S or touch pedals drive. Steering uses A/D or left/right arrows in Buttons mode, mouse or touch slider in Precise steering mode. Space or Stop brakes.');
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.blur);
        document.addEventListener('visibilitychange', this.visibility);
        this.canvas.addEventListener('pointermove', this.pointerMove);
        this.canvas.addEventListener('pointerleave', this.clearInput);
        this.canvas.addEventListener('pointerdown', this.focusCanvas);
        app.on('update', this.update);
        this.unsubscribe = game.subscribe(this.syncPhase);
        this.exposeTestApi();
    }

    private clearInput = () => {
        this.keys.clear();
        this.game.clearTouchInput();
        this.steeringInput = 0;
    };
    private focusCanvas = () => this.canvas.focus();
    private blur = () => {
        this.clearInput();
        this.game.pause();
    };
    private visibility = () => {
        if (document.hidden) this.blur();
    };
    private isUi(target: EventTarget | null) {
        return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, [role="dialog"]'));
    }

    private keyDown = (event: KeyboardEvent) => {
        if (this.isUi(event.target) && !['Escape', 'KeyR'].includes(event.code)) return;
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Escape', 'KeyR'].includes(event.code))
            event.preventDefault();
        if (event.code === 'Escape' && !event.repeat) {
            this.clearInput();
            this.game.togglePause();
        } else if (event.code === 'KeyR' && !event.repeat) {
            this.clearInput();
            this.game.start();
            this.focusCanvas();
        } else if (this.game.session.phase === 'playing') this.keys.add(event.code);
    };

    private keyUp = (event: KeyboardEvent) => {
        this.keys.delete(event.code);
    };
    private pointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || this.game.controlMode !== 'precise' || this.game.session.phase !== 'playing') return;
        if (this.isUi(event.target)) {
            this.steeringInput = 0;
            return;
        }
        const rect = this.canvas.getBoundingClientRect();
        this.steeringInput = mouseSteering(event.clientX, rect.left, rect.width);
    };

    private collisionStart = (result: ContactResult) => {
        if (this.game.level.surfaces?.some((surface) => surface.support && surface.id === result.other.name)) return;
        const object = this.game.level.objects.find((object) => object.id === result.other.name);
        this.game.impact(result.other.guid, object ? ASSETS[object.asset].impactKind ?? 'hard' : 'hard');
    };
    private collisionEnd = (other: Entity) => this.game.contacts.leave(other.guid);

    private syncPhase = () => {
        const phase = this.game.session.phase;
        if (this.previousControlMode !== this.game.controlMode) {
            this.clearInput();
            this.previousControlMode = this.game.controlMode;
        }
        this.app.timeScale = phase === 'playing' ? 1 : 0;
        if (phase !== this.previousPhase) {
            this.clearInput();
            this.previousPhase = phase;
            this.lastClock = performance.now();
        }
        if (this.initialized && this.resetRevision !== this.game.resetRevision) this.reset();
    };

    private reset() {
        for (const { entity, position, heading } of this.bodies.values()) {
            if (!entity.rigidbody) continue;
            entity.rigidbody.teleport(...position, 0, heading, 0);
            entity.rigidbody.linearVelocity = Vec3.ZERO;
            entity.rigidbody.angularVelocity = Vec3.ZERO;
        }
        this.resetRevision = this.game.resetRevision;
        this.steering = 0;
        this.wheelRoll = 0;
        this.wheels.forEach((wheel) => wheel.setLocalEulerAngles(0, 0, 0));
        this.clearInput();
        this.game.contacts.reset();
    }

    private update = (dt: number) => {
        const now = performance.now();
        const clockDt = Math.max(0, (now - this.lastClock) / 1000);
        this.lastClock = now;
        const body = this.player.rigidbody;
        if (!body?.body || !this.camera.camera) return;
        if (!this.initialized) {
            this.initialized = true;
            this.wheels = ['wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']
                .map((name) => this.player.findByName(name))
                .filter((wheel): wheel is Entity => Boolean(wheel));
            this.player.collision?.on('collisionstart', this.collisionStart);
            this.player.collision?.on('collisionend', this.collisionEnd);
            this.game.ready();
        }
        if (this.resetRevision !== this.game.resetRevision) this.reset();
        const phase = this.game.session.phase;
        const heading = getHeading(this.player);
        const radians = (heading * Math.PI) / 180;
        const fx = Math.sin(radians);
        const fz = Math.cos(radians);
        const position = this.player.getPosition();
        const actualSpeed = Math.hypot(body.linearVelocity.x, body.linearVelocity.z);
        const longitudinal = body.linearVelocity.x * fx + body.linearVelocity.z * fz;
        const vehicle = vehicleGeometry(this.game.level.playerVehicle);
        if (phase === 'playing' && dt > 0) {
            const touch = new Set(this.game.touchControls.values());
            const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp') || touch.has('forward');
            const reverse = this.keys.has('KeyS') || this.keys.has('ArrowDown') || touch.has('reverse');
            const throttle = Number(forward) - Number(reverse);
            const speed = stepSpeed(longitudinal, throttle, this.keys.has('Space') || touch.has('stop'), dt);
            const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || touch.has('left');
            const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || touch.has('right');
            const steeringInput = this.game.controlMode === 'buttons'
                ? Number(right) - Number(left)
                : this.game.touchSteering ?? this.steeringInput;
            this.steering = stepSteering(this.steering, steeringInput, dt);
            const grip = Math.exp(-DRIVING.lateralGrip * dt);
            body.linearVelocity = this.velocity.set(
                fx * speed + (body.linearVelocity.x - fx * longitudinal) * grip,
                0,
                fz * speed + (body.linearVelocity.z - fz * longitudinal) * grip
            );
            const yawRate = steeringYawRate(speed, this.steering, vehicle.wheelbase);
            body.angularVelocity = this.angular.set(0, yawRate, 0);
            this.wheelRoll += (((speed * dt) / vehicle.wheelRadius) * 180) / Math.PI;
            this.wheels.forEach((wheel, index) =>
                wheel.setLocalEulerAngles(this.wheelRoll % 360, index < 2 ? -this.steering : 0, 0)
            );
            this.game.tick(
                clockDt,
                { x: position.x, z: position.z, heading, width: vehicle.width, length: vehicle.length, speed: actualSpeed },
                this.steering / DRIVING.maximumSteering
            );
        }
        const visualDt = dt || 1 / 60;
        const overview = phase === 'ready';
        const blend = 1 - Math.exp(-4 * visualDt);
        this.cameraTarget.x += ((overview ? (this.game.level.spawn.position[0] + this.game.level.bay.x) / 2 : position.x + fx * 1.5) - this.cameraTarget.x) * blend;
        this.cameraTarget.z += ((overview ? (this.game.level.spawn.position[2] + this.game.level.bay.z) / 2 : position.z + fz * 1.5) - this.cameraTarget.z) * blend;
        this.camera.setPosition(this.cameraTarget.x + 16, 27, this.cameraTarget.z + 17.5);
        this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        const desiredHeight = (overview ? 20.5 : 12.5) * Math.max(1, 1.3 / aspect);
        this.camera.camera.orthoHeight += (desiredHeight - this.camera.camera.orthoHeight) * blend;
    };

    private exposeTestApi() {
        if (!import.meta.env.DEV || import.meta.env.VITE_E2E !== 'true') return;
        Object.assign(window, {
            __parkTest: {
                snapshot: () => ({
                    ...this.game.session,
                    level: { id: this.game.level.id, name: this.game.level.name, timeLimit: this.game.level.timeLimit, impactPenalty: this.game.level.impactPenalty, smallImpactPenalty: this.game.level.smallImpactPenalty ?? 10, spawn: this.game.level.spawn, bay: this.game.level.bay, playerVehicle: this.game.level.playerVehicle ?? 'sedan', playableZone: this.game.level.playableZone },
                    vehicle: vehicleGeometry(this.game.level.playerVehicle),
                    carCollider: this.player.collision?.halfExtents.toArray().map((extent) => extent * 2),
                    objects: this.game.level.objects.map((object) => {
                        const entity = this.app.root.findByName(object.id) as Entity;
                        const bounds = entity.findComponents('render').flatMap((render) => render.meshInstances.map((mesh) => mesh.aabb));
                        return {
                            id: object.id, asset: object.asset, body: entity.rigidbody?.type,
                            colliderType: entity.collision?.type,
                            collider: entity.collision?.type === 'box' ? entity.collision.halfExtents.toArray().map((extent) => extent * 2) : undefined,
                            colliderOffset: entity.collision?.linearOffset.toArray(),
                             colliderParts: entity.collision?.type === 'compound' ? entity.findComponents('collision').filter((collision) => collision.entity !== entity && collision.type === 'box').map((collision) => ({
                                position: collision.entity.getLocalPosition().toArray(),
                                dimensions: collision.halfExtents.toArray().map((extent) => extent * 2)
                            })) : undefined,
                            min: ['x', 'y', 'z'].map((axis) => {
                                const key = axis as 'x' | 'y' | 'z';
                                return Math.min(...bounds.map((bound) => bound.center[key] - bound.halfExtents[key]));
                            }),
                            max: ['x', 'y', 'z'].map((axis) => {
                                const key = axis as 'x' | 'y' | 'z';
                                return Math.max(...bounds.map((bound) => bound.center[key] + bound.halfExtents[key]));
                            })
                        };
                    }),
                    roads: this.game.level.objects.filter((object) => ASSETS[object.asset].category === 'Roads').map((object) => {
                        const entity = this.app.root.findByName(object.id) as Entity;
                        const bounds = entity.findComponents('render').flatMap((render) => render.meshInstances.map((mesh) => mesh.aabb));
                        return {
                            id: object.id, position: entity.getPosition().toArray(), heading: getHeading(entity),
                            supportCollider: (this.app.root.findByName(`road-support-${object.id}`) as Entity | null)?.collision?.halfExtents.toArray().map((extent) => extent * 2),
                            dimensions: ['x', 'y', 'z'].map((axis) => {
                                const key = axis as 'x' | 'y' | 'z';
                                return Math.max(...bounds.map((bound) => bound.center[key] + bound.halfExtents[key])) - Math.min(...bounds.map((bound) => bound.center[key] - bound.halfExtents[key]));
                            })
                        };
                    }),
                    car: this.player.getPosition().toArray(),
                    heading: getHeading(this.player),
                    props: [...this.bodies].map(([id, body]) => ({
                        id,
                        position: body.entity.getPosition().toArray()
                    })),
                    meshes: this.app.root.findComponents('render').length,
                    wheelAngles: this.wheels.map((wheel) => wheel.getLocalEulerAngles().toArray())
                }),
                teleport: (x: number, z: number, heading: number) => {
                    const body = this.player.rigidbody;
                    if (!body) return;
                    body.teleport(x, vehicleGeometry(this.game.level.playerVehicle).height / 2, z, 0, heading, 0);
                    body.linearVelocity = Vec3.ZERO;
                    body.angularVelocity = Vec3.ZERO;
                    this.game.contacts.reset();
                },
                setRemaining: (seconds: number) => {
                    this.game.session.remaining = seconds;
                },
                addImpacts: (count: number) => {
                    for (let index = 0; index < Math.min(100, Math.max(0, Math.floor(count))); index++) this.game.impact(`e2e-impact-${index}`);
                },
                app: this.app
            }
        });
    }

    destroy() {
        this.clearInput();
        this.unsubscribe();
        this.app.off('update', this.update);
        this.player.collision?.off('collisionstart', this.collisionStart);
        this.player.collision?.off('collisionend', this.collisionEnd);
        window.removeEventListener('keydown', this.keyDown);
        window.removeEventListener('keyup', this.keyUp);
        window.removeEventListener('blur', this.blur);
        document.removeEventListener('visibilitychange', this.visibility);
        this.canvas.removeEventListener('pointermove', this.pointerMove);
        this.canvas.removeEventListener('pointerleave', this.clearInput);
        this.canvas.removeEventListener('pointerdown', this.focusCanvas);
        this.app.timeScale = 1;
        if (import.meta.env.DEV && import.meta.env.VITE_E2E === 'true') Reflect.deleteProperty(window, '__parkTest');
    }
}
