import { Container, Entity } from '@playcanvas/react';
import { Camera, Collision, Light, Render, RigidBody, Script } from '@playcanvas/react/components';
import { useApp, useMaterial, useModel, usePhysics } from '@playcanvas/react/hooks';
import { PROJECTION_ORTHOGRAPHIC, Script as EngineScript, TONEMAP_NEUTRAL } from 'playcanvas';
import type { Asset, Entity as PcEntity } from 'playcanvas';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ASSETS, assetUrl, vehicleGeometry } from './assets.ts';
import { ParkingRuntime } from './runtime.ts';
import type { ResetBody } from './runtime.ts';
import type { ParkingGame } from './session.ts';
import type { LevelDefinition, ParkingBay, SceneObject, Triple } from './types.ts';

type LoadedAssets = Record<string, Asset>;

/** Give imported meshes the same shadow behavior without changing shared materials. */
class ModelShadows extends EngineScript {
    static scriptName = 'modelShadows';
    postInitialize() {
        for (const render of this.entity.findComponents('render')) {
            render.castShadows = true;
            render.receiveShadows = true;
        }
    }
}

function AssetLoader({
    id,
    onLoad,
    game
}: {
    id: string;
    onLoad: (id: string, asset: Asset) => void;
    game: ParkingGame;
}) {
    const { asset, error } = useModel(assetUrl(ASSETS[id]));
    useEffect(() => {
        if (error) game.fail(`Could not load ${ASSETS[id].file}. Check the connection and try again.`);
        if (asset) onLoad(id, asset);
    }, [asset, error, game, id, onLoad]);
    return null;
}

function Model({ id, assets, baseY = 0 }: { id: string; assets: LoadedAssets; baseY?: number }) {
    const definition = ASSETS[id];
    const s = definition.scale;
    return (
        <Entity rotation={[0, definition.yaw, 0]}>
            <Entity position={[-definition.center[0] * s, baseY, -definition.center[2] * s]} scale={[s, s, s]}>
                <Container asset={assets[id]} />
                <Script script={ModelShadows} />
            </Entity>
        </Entity>
    );
}

function SolidBox({
    name,
    position,
    size,
    color,
    solid = false,
    heading = 0
}: {
    name: string;
    position: Triple;
    size: Triple;
    color: string;
    solid?: boolean;
    heading?: number;
}) {
    const material = useMaterial({ diffuse: color, gloss: 0.15 });
    return (
        <Entity name={name} position={position} rotation={[0, heading, 0]}>
            {solid && (
                <>
                    <Collision type="box" halfExtents={[size[0] / 2, size[1] / 2, size[2] / 2]} />
                    <RigidBody type="static" friction={0.8} restitution={0} />
                </>
            )}
            <Entity scale={size}>
                <Render type="box" material={material} castShadows={size[1] > 0.1} receiveShadows />
            </Entity>
        </Entity>
    );
}

function WorldObject({
    object,
    assets,
    bodies
}: {
    object: SceneObject;
    assets: LoadedAssets;
    bodies: Map<string, ResetBody>;
}) {
    const definition = ASSETS[object.asset];
    const dims = definition.dimensions.map((d) => d * definition.scale) as Triple;
    const centerY = object.body ? dims[1] / 2 : 0;
    const position = useMemo<Triple>(
        () => [object.position[0], object.position[1] + centerY, object.position[2]],
        [object, centerY]
    );
    const register = useCallback(
        (entity: PcEntity | null) => {
            if (object.body !== 'dynamic') return;
            if (entity) bodies.set(object.id, { entity, position, heading: object.heading });
            else bodies.delete(object.id);
        },
        [bodies, object, position]
    );
    return (
        <Entity name={object.id} position={position} rotation={[0, object.heading, 0]} ref={register}>
            {object.body && (
                <>
                    <Collision type="box" halfExtents={[dims[0] / 2, dims[1] / 2, dims[2] / 2]} />
                    <RigidBody
                        type={object.body}
                        mass={object.mass ?? 1000}
                        friction={0.65}
                        restitution={0.04}
                        linearDamping={0.12}
                        angularDamping={0.3}
                    />
                </>
            )}
            <Model id={object.asset} assets={assets} baseY={-centerY} />
        </Entity>
    );
}

function BayMarking({ bay, id, target = false, wheelStop = true }: { bay: ParkingBay; id: string; target?: boolean; wheelStop?: boolean }) {
    return (
        <Entity name={id} position={[bay.x, 0, bay.z]} rotation={[0, bay.heading, 0]}>
            {target && <SolidBox name={`${id}-highlight`} position={[0, 0.009, 0]} size={[bay.width, 0.016, bay.length]} color="#90b48b" />}
            {[-1, 1].map((side) => (
                <SolidBox key={side} name={`${id}-line-${side}`} position={[side * bay.width / 2, 0.025, 0]} size={[0.075, 0.03, bay.length]} color={target ? '#e6f5b1' : '#e4e1d5'} />
            ))}
            <SolidBox name={`${id}-back`} position={[0, 0.025, -bay.length / 2]} size={[bay.width, 0.03, 0.075]} color={target ? '#e6f5b1' : '#e4e1d5'} />
            {target && <>
                <SolidBox name="bay-arrow-stem" position={[0, 0.04, 0.2]} size={[0.1, 0.025, 1.2]} color="#eff7ce" />
                <SolidBox name="bay-arrow-left" position={[-0.2, 0.04, 0.6]} size={[0.09, 0.025, 0.65]} color="#eff7ce" heading={45} />
                <SolidBox name="bay-arrow-right" position={[0.2, 0.04, 0.6]} size={[0.09, 0.025, 0.65]} color="#eff7ce" heading={-45} />
            </>}
            {wheelStop && <SolidBox name={`${id}-wheel-stop`} position={[0, 0.1, -bay.length / 2 + 0.3]} size={[1.8, 0.2, 0.22]} color="#cdc6af" solid />}
        </Entity>
    );
}

function LevelGeometry({ level }: { level: LevelDefinition }) {
    const zone = level.playableZone;
    return <>
        {zone && [-1, 1].flatMap((side) => [
            <SolidBox key={`x${side}`} name={`zone-boundary-x${side}`} position={[zone.x + side * (zone.width / 2 + 0.2), 0.6, zone.z]} size={[0.4, 1.2, zone.length + 0.8]} color="#dfd3ab" solid />,
            <SolidBox key={`z${side}`} name={`zone-boundary-z${side}`} position={[zone.x, 0.6, zone.z + side * (zone.length / 2 + 0.2)]} size={[zone.width, 1.2, 0.4]} color="#dfd3ab" solid />
        ])}
        {level.surfaces?.map((surface) => <SolidBox key={surface.id} name={surface.id} position={surface.position} size={surface.size} color={surface.color} solid={surface.solid} heading={surface.heading} />)}
        {level.parkingBays?.map((bay) => <BayMarking key={bay.id} bay={bay} id={bay.id} wheelStop={bay.wheelStop} />)}
        <BayMarking bay={level.bay} id="parking-target" target />
    </>;
}

function Simulation({
    game,
    player,
    camera,
    bodies
}: {
    game: ParkingGame;
    player: React.RefObject<PcEntity | null>;
    camera: React.RefObject<PcEntity | null>;
    bodies: Map<string, ResetBody>;
}) {
    const app = useApp();
    useEffect(() => {
        if (!player.current || !camera.current) return;
        const runtime = new ParkingRuntime(app, game, player.current, camera.current, bodies);
        return () => runtime.destroy();
    }, [app, bodies, camera, game, player]);
    return null;
}

function LoadedWorld({ assets, game }: { assets: LoadedAssets; game: ParkingGame }) {
    const player = useRef<PcEntity>(null);
    const camera = useRef<PcEntity>(null);
    const [bodies] = useState(() => new Map<string, ResetBody>());
    const level = game.level;
    const vehicle = vehicleGeometry(level.playerVehicle);
    const carHeight = vehicle.height;
    const spawn = useMemo<Triple>(
        () => [level.spawn.position[0], level.spawn.position[1] + carHeight / 2, level.spawn.position[2]],
        [carHeight, level]
    );
    const registerPlayer = useCallback(
        (entity: PcEntity | null) => {
            player.current = entity;
            if (entity) bodies.set('player', { entity, position: spawn, heading: level.spawn.heading });
            else bodies.delete('player');
        },
        [bodies, spawn, level]
    );
    return (
        <>
            <Entity name="camera" ref={camera} position={[15, 27, 18]}>
                <Camera
                    projection={PROJECTION_ORTHOGRAPHIC}
                    orthoHeight={20.5}
                    clearColor="#b5c5a1"
                    nearClip={0.1}
                    farClip={150}
                    toneMapping={TONEMAP_NEUTRAL}
                />
            </Entity>
            <Entity name="sun" rotation={[42, -28, -22]}>
                <Light
                    type="directional"
                    color="#fff1d6"
                    intensity={1.65}
                    castShadows
                    shadowResolution={2048}
                    shadowDistance={65}
                    shadowBias={0.12}
                    normalOffsetBias={0.04}
                />
            </Entity>
            <LevelGeometry level={level} />
            {level.objects.map((object) => (
                <WorldObject key={object.id} object={object} assets={assets} bodies={bodies} />
            ))}
            <Entity name="player" ref={registerPlayer} position={spawn} rotation={[0, level.spawn.heading, 0]}>
                <Collision type="box" halfExtents={[vehicle.width / 2, carHeight / 2, vehicle.length / 2]} />
                <RigidBody
                    type="dynamic"
                    mass={1000}
                    linearFactor={[1, 0, 1]}
                    angularFactor={[0, 1, 0]}
                    friction={0.3}
                    restitution={0}
                    linearDamping={0}
                    angularDamping={0}
                />
                <Model id={level.playerVehicle ?? 'sedan'} assets={assets} baseY={-carHeight / 2} />
            </Entity>
            <Simulation game={game} player={player} camera={camera} bodies={bodies} />
        </>
    );
}

export const GameScene = memo(function GameScene({ game }: { game: ParkingGame }) {
    const [assets, setAssets] = useState<LoadedAssets>({});
    const { isPhysicsLoaded, physicsError } = usePhysics();
    const onLoad = useCallback((id: string, asset: Asset) => {
        setAssets((previous) => ({ ...previous, [id]: asset }));
    }, []);
    useEffect(() => {
        if (physicsError) game.fail('The physics engine could not start. Please retry.');
    }, [game, physicsError]);
    const loaded = Object.keys(assets).length === Object.keys(ASSETS).length && isPhysicsLoaded;
    return (
        <>
            {Object.keys(ASSETS).map((id) => (
                <AssetLoader key={id} id={id} onLoad={onLoad} game={game} />
            ))}
            {loaded && <LoadedWorld assets={assets} game={game} />}
        </>
    );
});
