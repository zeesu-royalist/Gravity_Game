import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MARS_POSITION, MARS_RADIUS } from './SpaceEnvironment';
import { getMarsSurfaceElevation } from './MarsExploration';

const MARS_TOUCHDOWN_Y = MARS_POSITION.y + MARS_RADIUS + 0.2;
const MODEL_URL = '/models/gastaroid_queen.glb';
const MAX_BULLETS = 12;
const MAX_SPARKS = 12;
const BULLET_SPEED = 75.0;
const BULLET_MAX_DIST = 45.0;

useGLTF.preload(MODEL_URL);

// Ultra-lightweight Web Audio Synthesizer (Zero frame drop)
let audioCtx: AudioContext | null = null, lastScreech = 0;
function getAudio(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (_) { return null; }
}

function playPlasmaShot() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.07);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.07);
  } catch (_) {}
}

function playHitImpact() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.08);
  } catch (_) {}
}

function playAlienDeathRoar() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 1.1);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.1);
  } catch (_) {}
}

function playScreech(isAggressive = false) {
  const now = performance.now();
  if (now - lastScreech < (isAggressive ? 2500 : 5000)) return;
  lastScreech = now;
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isAggressive ? 700 : 500, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.6);
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(isAggressive ? 0.15 : 0.08, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.6);
  } catch (_) {}
}

export function playAstronautDamageSound() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.16);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.16);
  } catch (_) {}
}

export function playAstronautDeathSound() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 1.2);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.2);
  } catch (_) {}
}

// Module-level scratch memory for zero-allocation performance
const _qNorm = new THREE.Vector3();
const _qFwd = new THREE.Vector3();
const _qTFwd = new THREE.Vector3();
const _qRight = new THREE.Vector3();
const _qMat = new THREE.Matrix4();
const _qRot = new THREE.Quaternion();
const _qPitchRoll = new THREE.Quaternion();
const _qEuler = new THREE.Euler(0, 0, 0, 'YXZ');

const _gunOff = new THREE.Vector3();
const _fireDir = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _tempQuat = new THREE.Quaternion();
const _tempEuler = new THREE.Euler();

export interface MarsAlienSwarmProps {
  astronautPos: THREE.Vector3;
  astronautRotY?: number;
  astronautQuat?: THREE.Quaternion;
  roverPos: THREE.Vector3;
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  isShooting?: boolean;
  keysRef?: React.MutableRefObject<{ [key: string]: boolean }>;
  active: boolean;
  onThreatChange?: (threat: { count: number; nearestDist: number; isAttacking: boolean; isFleeing?: boolean; kills?: number; allDead?: boolean }) => void;
  onAstronautHit?: (damage: number) => void;
}

interface AlienSimData {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  pitch: number;
  roll: number;
  health: number;
  state: 'STALKING' | 'SPRINTING' | 'ATTACKING' | 'FLEEING' | 'DEAD';
  attackTimer: number;
  deathTimer: number;
  flinchTimer: number;
}

interface BulletItem {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Quaternion;
  dist: number;
}

interface SparkItem {
  active: boolean;
  pos: THREE.Vector3;
  life: number;
}

// Queen Instance with Independent Animation Controller & Zero-GC Surface Alignment
const QueenInstance: React.FC<{
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  alien: AlienSimData;
  index: number;
}> = ({ scene, clips, alien, index }) => {
  const rootRef = useRef<THREE.Group>(null);
  const curAction = useRef<'Run' | 'Attack' | 'Walk' | 'Die'>('Run');

  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = true;
      }
    });
    return c;
  }, [scene]);

  const { actions } = useAnimations(clips, cloned);

  useEffect(() => {
    const run = actions['Run'];
    if (run) {
      run.reset().play();
      run.time = (index * 0.22) % (run.getClip().duration || 1.0);
      curAction.current = 'Run';
    }
    return () => { Object.values(actions).forEach((a) => a?.stop()); };
  }, [actions, index]);

  useFrame(() => {
    if (!rootRef.current) return;

    let desired: 'Run' | 'Attack' | 'Walk' | 'Die' = 'Run';
    if (alien.state === 'DEAD') desired = 'Die';
    else if (alien.state === 'ATTACKING') desired = 'Attack';
    else if (alien.state === 'STALKING') desired = 'Walk';

    if (desired !== curAction.current) {
      const prev = actions[curAction.current];
      const next = actions[desired];
      if (next) {
        if (curAction.current === 'Die' && actions['Die']) {
          actions['Die'].stop();
        }
        if (desired === 'Die') {
          next.setLoop(THREE.LoopOnce, 1);
          next.clampWhenFinished = true;
          next.reset().fadeIn(0.12).play();
        } else {
          next.reset().fadeIn(0.2).play();
        }
        if (prev) prev.fadeOut(0.2);
        curAction.current = desired;
      }
    }

    const activeAct = actions[curAction.current];
    if (activeAct && alien.state !== 'DEAD') {
      activeAct.timeScale = alien.state === 'ATTACKING' ? 1.5 : alien.state === 'STALKING' ? 1.15 : 1.75;
    }

    // Zero-allocation surface orientation
    _qNorm.set(alien.pos.x - MARS_POSITION.x, alien.pos.y - MARS_POSITION.y, alien.pos.z - MARS_POSITION.z).normalize();
    _qFwd.set(Math.sin(alien.rotY), 0, Math.cos(alien.rotY));
    const dot = _qFwd.dot(_qNorm);
    _qTFwd.copy(_qFwd).addScaledVector(_qNorm, -dot).normalize();
    _qRight.crossVectors(_qNorm, _qTFwd).normalize();
    _qMat.makeBasis(_qRight, _qNorm, _qTFwd);
    _qRot.setFromRotationMatrix(_qMat);
    _qEuler.set(alien.pitch, 0, alien.roll, 'YXZ');
    _qPitchRoll.setFromEuler(_qEuler);
    _qRot.multiply(_qPitchRoll);

    rootRef.current.position.set(alien.pos.x, alien.pos.y, alien.pos.z);
    rootRef.current.quaternion.copy(_qRot);
  });

  return (
    <group ref={rootRef}>
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
  astronautRotY = 0,
  astronautQuat,
  roverPos,
  playerMode,
  isShooting = false,
  keysRef,
  active,
  onThreatChange,
  onAstronautHit,
}) => {
  const lastThreatUpdate = useRef(0);
  const lastShoot = useRef(0);
  const lastHitTime = useRef(0);

  const { scene: masterScene, animations } = useGLTF(MODEL_URL);

  const clips = useMemo(() => {
    if (!animations || animations.length === 0) return [];
    const origClip = animations[0];
    const filteredTracks = origClip.tracks.filter((t) => !t.name.includes('root_01_8.position'));
    const cleanClip = new THREE.AnimationClip('CleanBase', origClip.duration, filteredTracks);

    const fps = 30;
    const runClip = THREE.AnimationUtils.subclip(cleanClip, 'Run', 360, 390, fps);
    const attackClip = THREE.AnimationUtils.subclip(cleanClip, 'Attack', 660, 705, fps);
    const walkClip = THREE.AnimationUtils.subclip(cleanClip, 'Walk', 210, 300, fps);
    const dieClip = THREE.AnimationUtils.subclip(cleanClip, 'Die', 1380, 1420, fps);

    return [runClip, attackClip, walkClip, dieClip];
  }, [animations]);

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

  // Pack of 5 Alien Queens (100 HP each, takes exactly 5 shots to kill at 20 dmg/shot)
  const aliens = useRef<AlienSimData[]>([
    { id: 0, pos: new THREE.Vector3(MARS_POSITION.x + 24, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 20), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, health: 100, state: 'SPRINTING', attackTimer: 0, deathTimer: 0, flinchTimer: 0 },
    { id: 1, pos: new THREE.Vector3(MARS_POSITION.x - 26, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 18), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, health: 100, state: 'SPRINTING', attackTimer: 0, deathTimer: 0, flinchTimer: 0 },
    { id: 2, pos: new THREE.Vector3(MARS_POSITION.x + 28, MARS_TOUCHDOWN_Y, MARS_POSITION.z - 22), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, health: 100, state: 'SPRINTING', attackTimer: 0, deathTimer: 0, flinchTimer: 0 },
    { id: 3, pos: new THREE.Vector3(MARS_POSITION.x - 24, MARS_TOUCHDOWN_Y, MARS_POSITION.z - 24), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, health: 100, state: 'SPRINTING', attackTimer: 0, deathTimer: 0, flinchTimer: 0 },
    { id: 4, pos: new THREE.Vector3(MARS_POSITION.x + 12, MARS_TOUCHDOWN_Y, MARS_POSITION.z + 32), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, health: 100, state: 'SPRINTING', attackTimer: 0, deathTimer: 0, flinchTimer: 0 },
  ]);

  // Zero-allocation preallocated object pools (60 FPS, No React State re-rendering)
  const bulletsRef = useRef<BulletItem[]>(
    Array.from({ length: MAX_BULLETS }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Quaternion(),
      dist: 0,
    }))
  );

  const sparksRef = useRef<SparkItem[]>(
    Array.from({ length: MAX_SPARKS }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      life: 0,
    }))
  );

  const bulletsMeshRef = useRef<THREE.InstancedMesh>(null);
  const sparksMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const prevPlayerMode = useRef(playerMode);
  const prevActive = useRef(active);

  // 1. Rocket me baith ke utarne ke baad aliens phir se jinda ho jaye
  const resetAliens = () => {
    const spawns = [
      { x: 24, z: 20 },
      { x: -26, z: 18 },
      { x: 28, z: -22 },
      { x: -24, z: -24 },
      { x: 12, z: 32 },
    ];
    aliens.current.forEach((al, idx) => {
      al.health = 100;
      al.state = 'SPRINTING';
      al.attackTimer = 0;
      al.deathTimer = 0;
      al.flinchTimer = 0;
      al.vel.set(0, 0, 0);
      const off = spawns[idx % spawns.length];
      const sx = MARS_POSITION.x + off.x;
      const sz = MARS_POSITION.z + off.z;
      al.pos.set(sx, getMarsSurfaceElevation(sx, sz), sz);
    });
    bulletsRef.current.forEach((b) => { b.active = false; });
    sparksRef.current.forEach((s) => { s.active = false; });
    lastHitTime.current = 0;
  };

  if ((prevPlayerMode.current === 'ROCKET' || !prevActive.current) && active && (playerMode === 'ASTRONAUT' || playerMode === 'ROVER')) {
    resetAliens();
  }
  prevPlayerMode.current = playerMode;
  prevActive.current = active;

  // Master Unified 60 FPS Combat, Kinematics & AI Loop
  useFrame(({ clock }, delta) => {
    if (!active || playerMode === 'ROCKET') return;

    const dt = Math.min(0.04, delta);
    const decay = 1.0 - Math.exp(-5.5 * dt);
    const time = clock.getElapsedTime();
    const targetPos = playerMode === 'ROVER' ? roverPos : astronautPos;
    const alienList = aliens.current;
    let minDistance = 9999, anyAttacking = false, anyFleeing = false;
    let aliveCount = 0;

    // 1. Plasma Rifle Shooting Trigger (Key 'Q' / Touch Button)
    const isShootingActive = (keysRef?.current?.['KeyQ'] || isShooting) && playerMode === 'ASTRONAUT';
    if (isShootingActive) {
      const now = performance.now();
      if (now - lastShoot.current > 180) { // ~5.5 rounds/sec
        lastShoot.current = now;

        const q = astronautQuat || _tempQuat.setFromEuler(_tempEuler.set(0, astronautRotY, 0));
        _gunOff.set(0.35, 1.35, 0.4).applyQuaternion(q);
        const originX = astronautPos.x + _gunOff.x;
        const originY = astronautPos.y + _gunOff.y;
        const originZ = astronautPos.z + _gunOff.z;

        _fireDir.set(0, 0, 1).applyQuaternion(q).normalize();

        // Target assist within combat range (<= 45m) - Zero GC
        let bestTargetX = 0, bestTargetY = 0, bestTargetZ = 0;
        let hasTarget = false;
        let bestAngle = 0.55;

        for (let i = 0; i < alienList.length; i++) {
          const al = alienList[i];
          if (al.state === 'DEAD') continue;
          const toX = al.pos.x - originX;
          const toY = (al.pos.y + 1.6) - originY;
          const toZ = al.pos.z - originZ;
          const distSq = toX * toX + toY * toY + toZ * toZ;
          if (distSq < 2025.0) { // 45m range
            const invDist = 1 / Math.sqrt(distSq);
            _targetDir.set(toX * invDist, toY * invDist, toZ * invDist);
            const angle = _fireDir.angleTo(_targetDir);
            if (angle < bestAngle) {
              bestAngle = angle;
              bestTargetX = _targetDir.x;
              bestTargetY = _targetDir.y;
              bestTargetZ = _targetDir.z;
              hasTarget = true;
            }
          }
        }
        if (hasTarget) {
          _targetDir.set(bestTargetX, bestTargetY, bestTargetZ);
          _fireDir.lerp(_targetDir, 0.7).normalize();
        }

        // Find available preallocated bullet slot
        const freeBullet = bulletsRef.current.find((b) => !b.active);
        if (freeBullet) {
          freeBullet.active = true;
          freeBullet.pos.set(originX, originY, originZ);
          freeBullet.vel.copy(_fireDir).multiplyScalar(BULLET_SPEED);
          freeBullet.rot.setFromUnitVectors(_upVec, _fireDir);
          freeBullet.dist = 0;
          playPlasmaShot();
        }
      }
    }

    // 2. Bullets Simulation & Collision Detection - Zero GC
    const bList = bulletsRef.current;
    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = bList[i];
      if (!b.active) continue;

      b.pos.addScaledVector(b.vel, dt);
      b.dist += BULLET_SPEED * dt;

      let hit = false;
      for (let aIdx = 0; aIdx < alienList.length; aIdx++) {
        const al = alienList[aIdx];
        if (al.state === 'DEAD') continue;
        const dx = b.pos.x - al.pos.x;
        const dy = b.pos.y - (al.pos.y + 1.6);
        const dz = b.pos.z - al.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 10.24) { // 3.2m radius for solid hit confirmation on large queen
          hit = true;
          al.health = Math.max(0, al.health - 20); // Exactly 5 hits to kill (100 -> 80 -> 60 -> 40 -> 20 -> 0)
          al.flinchTimer = 0.2;
          playHitImpact();

          const freeSpark = sparksRef.current.find((s) => !s.active);
          if (freeSpark) {
            freeSpark.active = true;
            freeSpark.pos.copy(b.pos);
            freeSpark.life = 0.2;
          }

          if (al.health <= 0) {
            al.state = 'DEAD';
            al.vel.set(0, 0, 0);
            playAlienDeathRoar();

            // If the last living queen was just defeated, clear key
            const stillAlive = alienList.some((x) => x.state !== 'DEAD');
            if (!stillAlive && keysRef?.current) {
              keysRef.current['KeyQ'] = false;
            }
          }
          break;
        }
      }

      // Bullets expire after 45 meters or upon hit / terrain contact
      if (hit || b.dist > BULLET_MAX_DIST || b.pos.y < getMarsSurfaceElevation(b.pos.x, b.pos.z) - 0.25) {
        b.active = false;
      }
    }

    // 3. Fast GPU Instanced Matrix Update for Bullets
    if (bulletsMeshRef.current) {
      for (let i = 0; i < MAX_BULLETS; i++) {
        const b = bList[i];
        if (b.active) {
          dummy.position.copy(b.pos);
          dummy.quaternion.copy(b.rot);
          dummy.scale.set(1, 1, 1);
        } else {
          dummy.position.set(0, -9999, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        bulletsMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      bulletsMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 4. Fast GPU Instanced Matrix Update for Impact Sparks
    if (sparksMeshRef.current) {
      const sList = sparksRef.current;
      for (let i = 0; i < MAX_SPARKS; i++) {
        const s = sList[i];
        if (s.active) {
          s.life -= dt;
          if (s.life <= 0) {
            s.active = false;
            dummy.scale.set(0, 0, 0);
          } else {
            dummy.position.copy(s.pos);
            const scale = s.life * 3.5;
            dummy.scale.set(scale, scale, scale);
          }
        } else {
          dummy.position.set(0, -9999, 0);
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        sparksMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      sparksMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // 5. Flocking Separation
    for (let i = 0; i < alienList.length; i++) {
      if (alienList[i].state === 'DEAD') continue;
      for (let j = i + 1; j < alienList.length; j++) {
        if (alienList[j].state === 'DEAD') continue;
        const a1 = alienList[i], a2 = alienList[j];
        const dx = a1.pos.x - a2.pos.x, dz = a1.pos.z - a2.pos.z, dSq = dx * dx + dz * dz;
        if (dSq < 23.04 && dSq > 0.001) {
          const d = Math.sqrt(dSq), push = ((4.8 - d) / 4.8) ** 2 * 18.0 * dt;
          a1.vel.x += (dx / d) * push; a1.vel.z += (dz / d) * push;
          a2.vel.x -= (dx / d) * push; a2.vel.z -= (dz / d) * push;
        }
      }
    }

    // 6. Kinematics & AI Behaviors
    for (let i = 0; i < alienList.length; i++) {
      const a = alienList[i];
      if (a.state === 'DEAD') {
        a.vel.set(0, 0, 0);
        a.deathTimer += dt;
        continue;
      }
      aliveCount++;

      const toX = targetPos.x - a.pos.x, toZ = targetPos.z - a.pos.z, dist = Math.hypot(toX, toZ);
      if (dist < minDistance) minDistance = dist;

      // Hit & Run Wave Cycle
      const isRetreat = ((time + i * 1.6) % 18.0) > 11.0;
      let dirX = toX / (dist || 1), dirZ = toZ / (dist || 1), speed = 16.5;

      if (isRetreat) {
        a.state = 'FLEEING'; anyFleeing = true;
        dirX = -dirX; dirZ = -dirZ;
        speed = dist > 55.0 ? 5.0 : 18.0;
      } else if (a.state === 'ATTACKING' ? dist <= 6.2 : dist <= 4.8) {
        a.state = 'ATTACKING'; speed = 4.8; anyAttacking = true;
        a.attackTimer += dt * 8.0;
        const side = i % 2 === 0 ? 1 : -1;
        dirX = -dirZ * side * 0.7 + dirX * 0.4;
        dirZ = dirX * side * 0.7 + dirZ * 0.4;
      } else {
        a.state = dist < 28.0 ? 'SPRINTING' : 'STALKING';
        speed = dist < 28.0 ? 17.5 : 10.5;
      }

      a.vel.x += (dirX * speed - a.vel.x) * decay;
      a.vel.z += (dirZ * speed - a.vel.z) * decay;
      a.pos.x += a.vel.x * dt;
      a.pos.z += a.vel.z * dt;

      const currentSpeed = Math.hypot(a.vel.x, a.vel.z);
      if (currentSpeed > 0.5) {
        let diff = Math.atan2(a.vel.x, a.vel.z) - a.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        a.rotY += diff * Math.min(1.0, dt * 6.5);
        a.roll = THREE.MathUtils.clamp(-diff * 0.4, -0.25, 0.25);
      }

      const elev = getMarsSurfaceElevation(a.pos.x, a.pos.z);
      a.pos.y = elev;
      const slope = (getMarsSurfaceElevation(a.pos.x + dirX * 1.5, a.pos.z + dirZ * 1.5) - elev) / 1.5;
      a.pitch = -slope * 0.45 + (a.state === 'ATTACKING' ? 0.2 + Math.sin(a.attackTimer * 4) * 0.08 : 0.1);
    }

    if (minDistance < 28 && aliveCount > 0) playScreech(anyAttacking);

    // Astronaut Melee Damage on Mars (Balanced survival time)
    if (playerMode === 'ASTRONAUT' && anyAttacking && onAstronautHit && minDistance <= 4.5) {
      const now = performance.now();
      if (now - lastHitTime.current > 900) {
        lastHitTime.current = now;
        playAstronautDamageSound();
        onAstronautHit(5);
      }
    }

    // Throttled HUD Combat Telemetry
    const nowTime = performance.now();
    if (onThreatChange && nowTime - lastThreatUpdate.current > 200) {
      lastThreatUpdate.current = nowTime;
      onThreatChange({
        count: aliveCount,
        nearestDist: aliveCount > 0 ? Math.round(minDistance) : 0,
        isAttacking: anyAttacking && aliveCount > 0,
        isFleeing: anyFleeing,
        kills: alienList.length - aliveCount,
        allDead: aliveCount === 0,
      });
    }
  });

  if (!active || playerMode === 'ROCKET') return null;

  return (
    <group>
      {/* 1. Alien Queen Pack Members */}
      {aliens.current.map((alien, idx) => (
        <QueenInstance
          key={idx}
          scene={masterScene}
          clips={clips}
          alien={alien}
          index={idx}
        />
      ))}

      {/* 2. Instanced Plasma Bullets (Zero State Re-renders, Zero Dynamic PointLights, Locked 60 FPS) */}
      <instancedMesh ref={bulletsMeshRef} args={[undefined, undefined, MAX_BULLETS]} frustumCulled={false}>
        <cylinderGeometry args={[0.045, 0.045, 1.1, 6]} />
        <meshBasicMaterial color="#38bdf8" />
      </instancedMesh>

      {/* 3. Instanced Plasma Hit Sparks (Zero Lag) */}
      <instancedMesh ref={sparksMeshRef} args={[undefined, undefined, MAX_SPARKS]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.8} />
      </instancedMesh>
    </group>
  );
};
