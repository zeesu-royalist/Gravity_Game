import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MARS_POSITION, MARS_RADIUS } from './SpaceEnvironment';

const MARS_TOUCHDOWN_Y = MARS_POSITION.y + MARS_RADIUS + 0.2;
const MODEL_URL = '/models/gastaroid_queen.glb';

useGLTF.preload(MODEL_URL);

// Mars terrain elevation conforming
function getMarsElevation(x: number, z: number): number {
  const dx = x - MARS_POSITION.x, dz = z - MARS_POSITION.z, dSq = dx * dx + dz * dz, r = MARS_RADIUS;
  if (dSq <= 900) return MARS_TOUCHDOWN_Y;
  if (dSq < r * r) {
    const d = Math.sqrt(dSq);
    const noise = d < 380 ? (Math.sin(dx * 0.03) * 1.8 + Math.cos(dz * 0.03) * 1.8) * THREE.MathUtils.clamp((d - 30) / 25, 0, 1) : 0;
    return MARS_POSITION.y + Math.sqrt(r * r - dSq) + 0.25 + noise;
  }
  return MARS_POSITION.y;
}

// Procedural Alien Screech Synthesizer
let audioCtx: AudioContext | null = null, lastScreech = 0;
function playScreech(isAggressive = false) {
  const now = performance.now();
  if (now - lastScreech < (isAggressive ? 2200 : 4800)) return;
  lastScreech = now;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), filter = audioCtx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isAggressive ? 850 : 580, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.3);
    osc.frequency.exponentialRampToValueAtTime(isAggressive ? 1100 : 750, t + 0.6);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.9);
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(1250, t);
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(isAggressive ? 0.2 : 0.12, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.9);
  } catch (_) {}
}

export interface MarsAlienSwarmProps {
  astronautPos: THREE.Vector3;
  roverPos: THREE.Vector3;
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  active: boolean;
  onThreatChange?: (threat: { count: number; nearestDist: number; isAttacking: boolean; isFleeing?: boolean }) => void;
}

interface AlienSimData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  pitch: number;
  roll: number;
  state: 'STALKING' | 'SPRINTING' | 'ATTACKING' | 'FLEEING';
  attackTimer: number;
}

// Queen Instance with Independent Animation Controller & Smooth Crossfading
const QueenInstance: React.FC<{
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  alien: AlienSimData;
  index: number;
}> = ({ scene, clips, alien, index }) => {
  const rootRef = useRef<THREE.Group>(null);
  const curAction = useRef<'Run' | 'Attack' | 'Walk'>('Run');

  // Deep clone skinned mesh hierarchy with proper skeleton bindings & zero frustum-cull flickering
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false; // CRITICAL: Eliminates skinned-mesh camera flickering
      }
    });
    return c;
  }, [scene]);

  const { actions } = useAnimations(clips, cloned);

  useEffect(() => {
    const run = actions['Run'];
    if (run) {
      run.reset().play();
      // Stagger start phase so pack members don't run in identical lockstep
      run.time = (index * 0.22) % (run.getClip().duration || 1.0);
      curAction.current = 'Run';
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
    };
  }, [actions, index]);

  useFrame(() => {
    if (!rootRef.current) return;

    // 1. Smooth crossfade animation based on current behavioral state
    const desired: 'Run' | 'Attack' | 'Walk' =
      alien.state === 'ATTACKING' ? 'Attack' : alien.state === 'STALKING' ? 'Walk' : 'Run';

    if (desired !== curAction.current) {
      const prev = actions[curAction.current];
      const next = actions[desired];
      if (next) {
        next.reset().fadeIn(0.2).play();
        if (prev) prev.fadeOut(0.2);
        curAction.current = desired;
      }
    }

    // Dynamic locomotion playback speed
    const activeAct = actions[curAction.current];
    if (activeAct) {
      activeAct.timeScale = alien.state === 'ATTACKING' ? 1.35 : alien.state === 'STALKING' ? 1.0 : 1.35;
    }

    // 2. Align root to Mars surface normal, heading & dune pitch
    const norm = new THREE.Vector3(alien.pos.x - MARS_POSITION.x, alien.pos.y - MARS_POSITION.y, alien.pos.z - MARS_POSITION.z).normalize();
    const fwd = new THREE.Vector3(Math.sin(alien.rotY), 0, Math.cos(alien.rotY));
    const tFwd = fwd.sub(norm.clone().multiplyScalar(fwd.dot(norm))).normalize();
    rootRef.current.position.set(alien.pos.x, alien.pos.y, alien.pos.z);
    rootRef.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(norm, tFwd).normalize(), norm, tFwd))
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(alien.pitch, 0, alien.roll, 'YXZ')));
  });

  return (
    <group ref={rootRef}>
      {/* 3.3m Queen Scale & Ground-Contact Normalized Pivot Offset */}
      <group position={[-4.05, 1.625, 4.45]} scale={[0.005, 0.005, 0.005]}>
        <group rotation={[0, -Math.PI / 4, 0]}>
          <primitive object={cloned} />
        </group>
      </group>
    </group>
  );
};

export const MarsAlienSwarm: React.FC<MarsAlienSwarmProps> = ({
  astronautPos,
  roverPos,
  playerMode,
  active,
  onThreatChange,
}) => {
  const lastThreatUpdate = useRef(0);
  const { scene: masterScene, animations } = useGLTF(MODEL_URL);

  // Split master multi-take animation into clean in-place subclips (Zero teleport jumps)
  const clips = useMemo(() => {
    if (!animations || animations.length === 0) return [];
    const origClip = animations[0];
    // Remove root_01_8.position track to eliminate teleport jumps & snapping
    const filteredTracks = origClip.tracks.filter((t) => !t.name.includes('root_01_8.position'));
    const cleanClip = new THREE.AnimationClip('CleanBase', origClip.duration, filteredTracks);

    const fps = 30;
    // 12.0s to 13.0s => frame 360 to 390: Perfect seamless Run cycle
    const runClip = THREE.AnimationUtils.subclip(cleanClip, 'Run', 360, 390, fps);
    // 22.0s to 23.5s => frame 660 to 705: Furious claw slash & bite Attack cycle
    const attackClip = THREE.AnimationUtils.subclip(cleanClip, 'Attack', 660, 705, fps);
    // 7.0s to 10.0s => frame 210 to 300: Predatory stalking Walk cycle
    const walkClip = THREE.AnimationUtils.subclip(cleanClip, 'Walk', 210, 300, fps);

    return [runClip, attackClip, walkClip];
  }, [animations]);

  // Optimize material specular & shadows once on master scene
  useMemo(() => {
    masterScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.roughness = Math.min(mat.roughness ?? 0.35, 0.38);
          mat.metalness = Math.max(mat.metalness ?? 0.25, 0.32);
        }
      }
    });
  }, [masterScene]);

  // Pack of 5 Predators with physical inertia & kinematic states
  const aliens = useRef<AlienSimData[]>([
    { pos: new THREE.Vector3(MARS_POSITION.x + 24, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 20), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, state: 'SPRINTING', attackTimer: 0 },
    { pos: new THREE.Vector3(MARS_POSITION.x - 26, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 18), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, state: 'SPRINTING', attackTimer: 0 },
    { pos: new THREE.Vector3(MARS_POSITION.x + 28, MARS_TOUCHDOWN_Y, MARS_POSITION.z - 22), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, state: 'SPRINTING', attackTimer: 0 },
    { pos: new THREE.Vector3(MARS_POSITION.x - 24, MARS_TOUCHDOWN_Y, MARS_POSITION.z - 24), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, state: 'SPRINTING', attackTimer: 0 },
    { pos: new THREE.Vector3(MARS_POSITION.x + 12, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 32), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, state: 'SPRINTING', attackTimer: 0 },
  ]);

  // Master Unified 60 FPS Simulation Loop
  useFrame(({ clock }, delta) => {
    if (!active || playerMode === 'ROCKET') return;

    const dt = Math.min(0.05, delta);
    const decay = 1.0 - Math.exp(-5.5 * dt); // Exponential frame-rate independent physics
    const time = clock.getElapsedTime();
    const targetPos = playerMode === 'ROVER' ? roverPos : astronautPos;
    let minDistance = 9999, anyAttacking = false, anyFleeing = false;

    // 1. Quadratic Soft-Flocking Separation (Zero clipping or jitter)
    for (let i = 0; i < aliens.current.length; i++) {
      for (let j = i + 1; j < aliens.current.length; j++) {
        const a1 = aliens.current[i], a2 = aliens.current[j];
        const dx = a1.pos.x - a2.pos.x, dz = a1.pos.z - a2.pos.z, dSq = dx * dx + dz * dz;
        if (dSq < 23.04 && dSq > 0.001) { // 4.8m radius
          const d = Math.sqrt(dSq), push = ((4.8 - d) / 4.8) ** 2 * 18.0 * dt;
          a1.vel.x += (dx / d) * push; a1.vel.z += (dz / d) * push;
          a2.vel.x -= (dx / d) * push; a2.vel.z -= (dz / d) * push;
        }
      }
    }

    // 2. AI Hunting Waves, Kinematics & Realistic Surface Conform
    for (let i = 0; i < aliens.current.length; i++) {
      const a = aliens.current[i];
      const toX = targetPos.x - a.pos.x, toZ = targetPos.z - a.pos.z, dist = Math.hypot(toX, toZ);
      if (dist < minDistance) minDistance = dist;

      // Hit & Run Predatory Wave Cycle: 0-11s attack, 11-18s dune retreat & regroup
      const isRetreat = ((time + i * 1.6) % 18.0) > 11.0;
      let dirX = toX / (dist || 1), dirZ = toZ / (dist || 1), speed = 11.5;

      if (isRetreat) {
        a.state = 'FLEEING'; anyFleeing = true;
        dirX = -dirX; dirZ = -dirZ;
        speed = dist > 55.0 ? 3.5 : 12.5;
      } else if (a.state === 'ATTACKING' ? dist <= 6.2 : dist <= 4.8) {
        a.state = 'ATTACKING'; speed = 3.6; anyAttacking = true;
        a.attackTimer += dt * 8.0;
        const side = i % 2 === 0 ? 1 : -1;
        dirX = -dirZ * side * 0.7 + dirX * 0.4;
        dirZ = dirX * side * 0.7 + dirZ * 0.4;
      } else {
        a.state = dist < 25.0 ? 'SPRINTING' : 'STALKING';
        speed = dist < 25.0 ? 12.0 : 7.8;
      }

      // Smooth exponential velocity lerp
      a.vel.x += (dirX * speed - a.vel.x) * decay;
      a.vel.z += (dirZ * speed - a.vel.z) * decay;
      a.pos.x += a.vel.x * dt;
      a.pos.z += a.vel.z * dt;

      // Heading rotation with realistic banking roll into turns
      const currentSpeed = Math.hypot(a.vel.x, a.vel.z);
      if (currentSpeed > 0.5) {
        let diff = Math.atan2(a.vel.x, a.vel.z) - a.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        a.rotY += diff * Math.min(1.0, dt * 6.5);
        a.roll = THREE.MathUtils.clamp(-diff * 0.4, -0.25, 0.25);
      }

      // Terrain elevation conforming & slope pitch
      const elev = getMarsElevation(a.pos.x, a.pos.z);
      a.pos.y = elev;
      const slope = (getMarsElevation(a.pos.x + dirX * 1.5, a.pos.z + dirZ * 1.5) - elev) / 1.5;
      a.pitch = -slope * 0.45 + (a.state === 'ATTACKING' ? 0.2 + Math.sin(a.attackTimer * 4) * 0.08 : 0.1);
    }

    if (minDistance < 28) playScreech(anyAttacking);

    // Stable HUD threat reporting (throttled to 5 Hz)
    const now = performance.now();
    if (onThreatChange && now - lastThreatUpdate.current > 200) {
      lastThreatUpdate.current = now;
      onThreatChange({ count: aliens.current.length, nearestDist: Math.round(minDistance), isAttacking: anyAttacking, isFleeing: anyFleeing });
    }
  });

  if (!active || playerMode === 'ROCKET') return null;

  return (
    <group>
      {aliens.current.map((alien, idx) => (
        <QueenInstance
          key={idx}
          scene={masterScene}
          clips={clips}
          alien={alien}
          index={idx}
        />
      ))}
    </group>
  );
};
