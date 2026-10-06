import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stepSpeed, stepSteering, steeringYawRate } from '../src/game/driving.ts';
import {
    advanceParkingHold,
    angleDifference,
    calculateScore,
    checkParking,
    ImpactTracker,
    mouseSteering,
    nextPhase
} from '../src/game/rules.ts';
import { ParkingGame } from '../src/game/session.ts';
import type { CarPose, LevelDefinition } from '../src/game/types.ts';

const bay = { x: 0, z: 0, width: 3.4, length: 5.7, heading: 0 };
const car: CarPose = { x: 0, z: 0, width: 2.47, length: 4.2, heading: 0, speed: 0 };
const level: LevelDefinition = {
    id: 'test',
    name: 'Test',
    timeLimit: 90,
    impactPenalty: 50,
    spawn: { position: [0, 0, 0], heading: 0 },
    bay,
    objects: []
};

test('parking requires all corners, the correct facing, and a stopped car', () => {
    assert.equal(checkParking(car, bay).valid, true);
    assert.equal(checkParking({ ...car, x: 0.6 }, bay).contained, false);
    assert.equal(checkParking({ ...car, z: 0.8 }, bay).contained, false);
    assert.equal(checkParking({ ...car, heading: 180 }, bay).aligned, false);
    assert.equal(checkParking({ ...car, heading: 11 }, bay).aligned, false);
    assert.equal(checkParking({ ...car, speed: 0.15 }, bay).stopped, false);
    assert.equal(checkParking({ ...car, speed: 0.14 }, bay).valid, true);
});

test('parking containment transforms corners into a rotated bay', () => {
    const angled = { ...bay, x: 4, z: -8, heading: 90 };
    assert.equal(checkParking({ ...car, x: 4, z: -8, heading: 90 }, angled).valid, true);
    assert.equal(checkParking({ ...car, x: 4, z: -7.4, heading: 90 }, angled).contained, false);
    assert.equal(checkParking({ ...car, x: 4, z: -8, heading: 0 }, angled).contained, false);
});

test('alignment handles the 0/360 degree boundary', () => {
    assert.equal(angleDifference(355, 0), 5);
    assert.equal(angleDifference(0, 355), 5);
    assert.equal(angleDifference(0, 180), 180);
    assert.equal(checkParking({ ...car, heading: 355 }, bay).aligned, true);
});

test('parking must hold continuously for one second', () => {
    assert.equal(advanceParkingHold(0.7, false, 0.1), 0);
    assert.equal(advanceParkingHold(0.7, true, 0.1), 0.7999999999999999);
    assert.equal(advanceParkingHold(0.95, true, 0.1), 1);
});

test('score rewards time, deducts each impact, and never goes negative', () => {
    assert.equal(calculateScore(90, 90, 0, 50), 1000);
    assert.equal(calculateScore(45, 90, 2, 50), 400);
    assert.equal(calculateScore(1, 90, 1, 50), 0);
    assert.equal(calculateScore(-1, 90, 0, 50), 0);
});

test('a sustained contact counts once and a later re-impact counts again', () => {
    const impacts = new ImpactTracker();
    assert.equal(impacts.enter('fence'), true);
    assert.equal(impacts.enter('fence'), false);
    assert.equal(impacts.enter('cone'), true);
    impacts.leave('fence');
    impacts.advance(0.1);
    assert.equal(impacts.enter('fence'), false);
    impacts.leave('fence');
    impacts.advance(0.31);
    assert.equal(impacts.enter('fence'), true);
    impacts.reset();
    assert.equal(impacts.enter('cone'), true);
});

test('mouse steering uses the actual canvas bounds, a dead zone, and saturation', () => {
    assert.equal(mouseSteering(600, 100, 1000), 0);
    assert.equal(mouseSteering(605, 100, 1000), 0);
    assert.equal(mouseSteering(100, 100, 1000), -1);
    assert.equal(mouseSteering(1100, 100, 1000), 1);
    assert.ok(mouseSteering(750, 100, 1000) > 0);
});

test('session transitions reject premature wins and invalid resumes', () => {
    assert.equal(nextPhase('loading', 'start'), 'loading');
    assert.equal(nextPhase('ready', 'win'), 'ready');
    assert.equal(nextPhase('playing', 'pause'), 'paused');
    assert.equal(nextPhase('paused', 'resume'), 'playing');
    assert.equal(nextPhase('won', 'resume'), 'won');
});

test('parking and scoring are consistent across 30, 60, and 120 FPS', () => {
    for (const fps of [30, 60, 120]) {
        const game = new ParkingGame(level);
        game.ready();
        game.start();
        for (let i = 0; i < fps + 1; i++) game.tick(1 / fps, car, 0);
        assert.equal(game.session.phase, 'won');
        assert.ok(game.session.remaining >= 88.9 && game.session.remaining <= 89.01);
        assert.ok(Math.abs(game.session.score - 989) <= 1);
    }
});

test('pause freezes time and parking progress, and victory freezes the score', () => {
    const game = new ParkingGame(level);
    game.ready();
    game.start();
    game.tick(0.5, car, 0);
    game.pause();
    game.tick(20, car, 0);
    assert.equal(game.session.remaining, 89.5);
    assert.equal(game.session.parkingProgress, 0.5);
    game.togglePause();
    game.tick(0.5, car, 0);
    assert.equal(game.session.phase, 'won');
    const score = game.session.score;
    game.tick(10, car, 0);
    game.impact('fence');
    assert.equal(game.session.score, score);
});

test('timeout takes precedence at zero and restart clears all gameplay state', () => {
    const game = new ParkingGame(level);
    game.ready();
    game.start();
    game.impact('fence');
    game.impact('fence');
    assert.equal(game.session.impacts, 1);
    game.tick(90, car, 0);
    assert.equal(game.session.phase, 'lost');
    assert.equal(game.session.score, 0);
    game.start();
    assert.equal(game.session.phase, 'playing');
    assert.equal(game.session.remaining, 90);
    assert.equal(game.session.impacts, 0);
    assert.equal(game.session.parkingProgress, 0);
    game.impact('fence');
    assert.equal(game.session.impacts, 1);
});

test('acceleration, braking, and steering response agree across frame rates', () => {
    const results = [];
    for (const fps of [30, 60, 120]) {
        let speed = 0;
        let steering = 0;
        for (let i = 0; i < fps; i++) {
            speed = stepSpeed(speed, 1, false, 1 / fps);
            steering = stepSteering(steering, 1, 1 / fps);
        }
        assert.ok(Math.abs(speed - 3.8) < 0.0001);
        results.push(steering);
        for (let i = 0; i < fps / 2; i++) speed = stepSpeed(speed, 1, true, 1 / fps);
        assert.equal(speed, 0);
    }
    assert.ok(Math.max(...results) - Math.min(...results) < 0.0001);
});

test('reverse input brakes before backing up, speed caps hold, and stationary steering cannot rotate', () => {
    assert.equal(stepSpeed(2, -1, false, 0.1), 1);
    assert.equal(stepSpeed(1, -1, false, 0.1), 0);
    assert.ok(stepSpeed(0, -1, false, 0.1) < 0);
    assert.equal(stepSpeed(6, 1, false, 0.1), 6);
    assert.equal(stepSpeed(-3, -1, false, 0.1), -3);
    assert.equal(steeringYawRate(0, 35, 2.17), 0);
    assert.ok(steeringYawRate(3, 35, 2.17) > 0);
    assert.ok(steeringYawRate(-3, 35, 2.17) < 0);
});
