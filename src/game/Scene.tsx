import { Container, Entity } from '@playcanvas/react';
import { Camera, Collision, Light, Render, RigidBody, Script } from '@playcanvas/react/components';
import { useApp, useMaterial, useModel, usePhysics } from '@playcanvas/react/hooks';
import { PROJECTION_ORTHOGRAPHIC, Script as EngineScript, TONEMAP_NEUTRAL } from 'playcanvas';
import type { Asset, Entity as PcEntity } from 'playcanvas';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ASSETS, assetUrl, CAR_LENGTH, CAR_WIDTH } from './assets.ts';
import { COURTYARD } from './level.ts';
import { ParkingRuntime } from './runtime.ts';
import type { ResetBody } from './runtime.ts';
import type { ParkingGame } from './session.ts';
import type { SceneObject, Triple } from './types.ts';

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
    solid = false
}: {
    name: string;
    position: Triple;
    size: Triple;
    color: string;
    solid?: boolean;
}) {
    const material = useMaterial({ diffuse: color, gloss: 0.15 });
    return (
        <Entity name={name} position={position}>
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

function CourtyardGeometry() {
    const bay = COURTYARD.bay;
    return (
        <>
            <SolidBox name="ground" position={[0, -0.4, 0]} size={[90, 0.5, 90]} color="#9eaf8a" solid />
            <SolidBox name="court-floor" position={[1, -0.15, -4]} size={[24, 0.3, 18]} color="#747d7c" solid />
            <SolidBox name="approach-floor" position={[-7.1, -0.15, 11]} size={[5.5, 0.3, 16]} color="#747d7c" solid />
            <SolidBox name="taxi-pad" position={[-2.6, -0.02, 7.5]} size={[3, 0.04, 5.3]} color="#c5c4b4" />
            <SolidBox name="east-curb" position={[13.2, 0.22, -4]} size={[0.45, 0.44, 18]} color="#e2decf" solid />
            <SolidBox name="west-curb" position={[-11.2, 0.22, -4]} size={[0.45, 0.44, 18]} color="#e2decf" solid />
            <SolidBox name="south-curb" position={[4.1, 0.22, 5.15]} size={[18.5, 0.44, 0.45]} color="#e2decf" solid />
            <SolidBox
                name="entry-right-curb"
                position={[-4.2, 0.22, 12]}
                size={[0.4, 0.44, 14]}
                color="#e2decf"
                solid
            />
            <SolidBox name="entry-end-curb" position={[-7.1, 0.22, 19]} size={[6.3, 0.44, 0.4]} color="#e2decf" solid />
            <SolidBox name="turn-island" position={[-6.1, 0.2, -0.8]} size={[4.2, 0.4, 3]} color="#e2decf" solid />
            <SolidBox name="island-grass" position={[-6.1, 0.42, -0.8]} size={[3.7, 0.04, 2.5]} color="#9daf85" />
            <SolidBox
                name="parking-highlight"
                position={[bay.x, 0.009, bay.z]}
                size={[bay.width, 0.016, bay.length]}
                color="#90b48b"
            />
            {[0.3, bay.x, 8.1].map((x, i) => (
                <Entity key={x} name={`parking-bay-${i}`}>
                    {[-1, 1].map((side) => (
                        <SolidBox
                            key={side}
                            name={`bay-line-${i}-${side}`}
                            position={[x + (side * bay.width) / 2, 0.025, bay.z]}
                            size={[0.075, 0.03, bay.length]}
                            color={i === 1 ? '#e6f5b1' : '#e4e1d5'}
                        />
                    ))}
                    <SolidBox
                        name={`bay-back-${i}`}
                        position={[x, 0.025, bay.z - bay.length / 2]}
                        size={[bay.width, 0.03, 0.075]}
                        color={i === 1 ? '#e6f5b1' : '#e4e1d5'}
                    />
                </Entity>
            ))}
            <SolidBox
                name="bay-arrow-stem"
                position={[bay.x, 0.04, bay.z + 0.2]}
                size={[0.1, 0.025, 1.2]}
                color="#eff7ce"
            />
            <Entity position={[bay.x - 0.2, 0.04, bay.z + 0.6]} rotation={[0, 45, 0]}>
                <SolidBox name="bay-arrow-left" position={[0, 0, 0]} size={[0.09, 0.025, 0.65]} color="#eff7ce" />
            </Entity>
            <Entity position={[bay.x + 0.2, 0.04, bay.z + 0.6]} rotation={[0, -45, 0]}>
                <SolidBox name="bay-arrow-right" position={[0, 0, 0]} size={[0.09, 0.025, 0.65]} color="#eff7ce" />
            </Entity>
            {[0.3, bay.x, 8.1].map((x) => (
                <SolidBox
                    key={x}
                    name={`wheel-stop-${x}`}
                    position={[x, 0.1, -10.65]}
                    size={[1.8, 0.2, 0.22]}
                    color="#cdc6af"
                    solid
                />
            ))}
        </>
    );
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
    const carHeight = ASSETS.sedan.dimensions[1] * ASSETS.sedan.scale;
    const spawn = useMemo<Triple>(
        () => [COURTYARD.spawn.position[0], carHeight / 2, COURTYARD.spawn.position[2]],
        [carHeight]
    );
    const registerPlayer = useCallback(
        (entity: PcEntity | null) => {
            player.current = entity;
            if (entity) bodies.set('player', { entity, position: spawn, heading: COURTYARD.spawn.heading });
            else bodies.delete('player');
        },
        [bodies, spawn]
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
            <CourtyardGeometry />
            {COURTYARD.objects.map((object) => (
                <WorldObject key={object.id} object={object} assets={assets} bodies={bodies} />
            ))}
            <Entity name="player" ref={registerPlayer} position={spawn} rotation={[0, COURTYARD.spawn.heading, 0]}>
                <Collision type="box" halfExtents={[CAR_WIDTH / 2, carHeight / 2, CAR_LENGTH / 2]} />
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
                <Model id="sedan" assets={assets} baseY={-carHeight / 2} />
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
