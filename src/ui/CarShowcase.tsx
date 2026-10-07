import { Application, Container, Entity } from '@playcanvas/react';
import { Camera, Light, Render } from '@playcanvas/react/components';
import { useApp, useMaterial, useModel } from '@playcanvas/react/hooks';
import { Color, PROJECTION_ORTHOGRAPHIC, TONEMAP_NEUTRAL } from 'playcanvas';
import type { Entity as PcEntity } from 'playcanvas';
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ASSETS, assetUrl } from '../game/assets.ts';

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <span className="preview-status">3D preview unavailable</span> : this.props.children; }
}

function DisplayScene({ active, onLoaded, onError }: { active: boolean; onLoaded: (meshes: number) => void; onError: () => void }) {
    const app = useApp();
    const { asset, error } = useModel(assetUrl(ASSETS.sedan));
    const camera = useRef<PcEntity>(null);
    const car = useRef<PcEntity>(null);
    const asphalt = useMaterial({ diffuse: '#779257', gloss: 0.1 });
    const lines = useMaterial({ diffuse: '#eeecc7', gloss: 0.1 });
    const definition = ASSETS.sedan;
    useLayoutEffect(() => {
        app.scene.ambientLight = new Color(0.66, 0.71, 0.77);
        app.scene.exposure = 1;
        app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio, 2);
        camera.current?.lookAt(0, 0.65, 0);
        if (active) app.resizeCanvas();
    }, [app, active]);
    useEffect(() => { if (error) onError(); }, [error, onError]);
    useEffect(() => {
        if (!asset || !active) return;
        const rendered = () => {
            const renders = car.current?.findComponents('render') ?? [];
            const count = renders.reduce((total, render) => total + render.meshInstances.length, 0);
            if (!count) return;
            for (const render of renders) { render.castShadows = true; render.receiveShadows = true; }
            onLoaded(count);
            app.off('postrender', rendered);
        };
        app.on('postrender', rendered);
        return () => { app.off('postrender', rendered); };
    }, [app, asset, active, onLoaded]);
    return <>
        <Entity name="showcase-camera" ref={camera} position={[7, 6.5, 8]}>
            <Camera projection={PROJECTION_ORTHOGRAPHIC} orthoHeight={3.2} clearColor="#253c35" nearClip={0.1} farClip={40} toneMapping={TONEMAP_NEUTRAL} />
        </Entity>
        <Entity name="showcase-sun" rotation={[42, -28, -22]}><Light type="directional" color="#fff1d6" intensity={1.65} castShadows shadowResolution={1024} shadowDistance={20} shadowBias={0.06} normalOffsetBias={0.03} /></Entity>
        <Entity name="showcase-pad" position={[0, -0.125, 0]} scale={[6.8, 0.25, 6.8]}><Render type="box" material={asphalt} receiveShadows /></Entity>
        {[-1, 1].map((side) => <Entity key={side} name={`showcase-line-${side}`} position={[side * 1.7, 0.015, 0]} scale={[0.075, 0.03, 5.7]}><Render type="box" material={lines} /></Entity>)}
        <Entity name="showcase-back-line" position={[0, 0.015, -2.85]} scale={[3.4, 0.03, 0.075]}><Render type="box" material={lines} /></Entity>
        {asset && <Entity name="showcase-sedan" ref={car} rotation={[0, definition.yaw, 0]}>
            <Entity position={[-definition.center[0] * definition.scale, 0, -definition.center[2] * definition.scale]} scale={[definition.scale, definition.scale, definition.scale]}><Container asset={asset} /></Entity>
        </Entity>}
    </>;
}

/** Keep the graphics owner mounted; hiding the menu stops preview rendering without destroying shared resources. */
export function CarShowcase({ active }: { active: boolean }) {
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [meshes, setMeshes] = useState(0);
    const loaded = useCallback((count: number) => { setMeshes(count); setState('ready'); }, []);
    const failed = useCallback(() => setState('error'), []);
    return <div className="car-showcase" role="img" aria-label="3D sedan preview" data-state={state} data-mesh-count={meshes}>
        <PreviewBoundary><Application autoRender={active} renderNextFrame={false} graphicsDeviceOptions={{ antialias: true, alpha: false }}><DisplayScene active={active} onLoaded={loaded} onError={failed} /></Application></PreviewBoundary>
        {state !== 'ready' && <span className="preview-status">{state === 'loading' ? 'Loading 3D car…' : '3D preview unavailable'}</span>}
    </div>;
}
