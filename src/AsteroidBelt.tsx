import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MARS_POSITION } from './SpaceEnvironment';

// Procedural Web Audio synthesizer (zero asset dependencies)
let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (_) { return null; }
}

export function playAsteroidExplosion() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime;
    // Sub-bass thump
    const osc = ctx.createOscillator(), g1 = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 1.2);
    g1.gain.setValueAtTime(0.5, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g1); g1.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1.2);

    // Blast noise crunch
    const bufSize = Math.floor(ctx.sampleRate * 0.8), buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.6, t);
    g2.gain.exponentialRampToValueAtTime(0.005, t + 0.8);
    noise.connect(filter); filter.connect(g2); g2.connect(ctx.destination);
    noise.start(t);
  } catch (_) { }
}

export function playDeflectionSound() {
  try {
    const ctx = getAudio(); if (!ctx) return;
    const t = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.22);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.3);
  } catch (_) { }
}

// Procedural high-contrast regolith crater texture (NASA-style celestial rock)
function createAsteroidTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8f939c';
  ctx.fillRect(0, 0, 256, 256);
  // Regolith noise grain
  const imgData = ctx.getImageData(0, 0, 256, 256), d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 55;
    d[i] = Math.max(30, Math.min(235, d[i] + n));
    d[i + 1] = Math.max(30, Math.min(235, d[i + 1] + n));
    d[i + 2] = Math.max(30, Math.min(235, d[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
  // Impact crater pits with sunlit rims
  for (let i = 0; i < 28; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 256, cr = 4 + Math.random() * 12;
    ctx.strokeStyle = 'rgba(235, 240, 250, 0.75)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(40, 42, 50, 0.6)';
    ctx.beginPath(); ctx.arc(cx, cy, cr * 0.75, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Procedural naturally deformed rocky geometries with distinct morphological profiles
function createRockyGeom(seed: number, stretch: [number, number, number]): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(1, 2);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 3.2 + seed) * 0.22 + Math.cos(v.y * 3.8 + seed * 1.6) * 0.18 + Math.sin(v.z * 4.4) * 0.14;
    v.multiplyScalar(1.0 + n);
    v.x *= stretch[0];
    v.y *= stretch[1];
    v.z *= stretch[2];
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

const _astCurPos = new THREE.Vector3();
const _astPrevPos = new THREE.Vector3();
const _astSeg = new THREE.Vector3();
const _astDiff = new THREE.Vector3();
const _astClosest = new THREE.Vector3();
const _astCurLocal = new THREE.Vector3();
const _astPrevLocal = new THREE.Vector3();
const _astLocalSeg = new THREE.Vector3();
const _astWorldHit = new THREE.Vector3();
const _astUp = new THREE.Vector3(0, 1, 0);

interface AsteroidBeltProps {
  altitude: number;
  rocketPos: THREE.Vector3;
  isFlying: boolean;
  isLanded: boolean;
  destination: 'MOON' | 'MARS' | 'EARTH';
  isExploding: boolean;
  resetCount: number;
  onBlast: (asteroidPos: THREE.Vector3, radius: number) => void;
  onDeflection: (asteroidPos: THREE.Vector3) => void;
}

export function AsteroidBelt({
  altitude,
  rocketPos,
  isFlying,
  isLanded,
  destination,
  isExploding,
  resetCount,
  onBlast,
  onDeflection,
}: AsteroidBeltProps) {
  const prevRocketPosRef = useRef<THREE.Vector3 | null>(null);
  const encounterCountRef = useRef(0);
  const ringAngleRef = useRef(0);
  const ringGroupRef = useRef<THREE.Group>(null);

  // 3 Distinct natural shapes (Potato monolith like Eros, fractured like Itokawa, cratered top like Ryugu)
  const geometries = useMemo(() => [
    createRockyGeom(1.2, [1.35, 0.85, 0.9]),
    createRockyGeom(4.7, [0.95, 1.25, 0.85]),
    createRockyGeom(8.3, [1.1, 0.95, 1.25]),
  ], []);

  // Photorealistic PBR material: flatShading gives sharp polygonal sunlit facet ridges and deep shadows
  const material = useMemo(() => {
    const tex = createAsteroidTexture();
    return new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: 0.85,
      roughness: 0.72,
      metalness: 0.12,
      flatShading: true,
    });
  }, []);

  // Natural Asteroid Field: 360° Planetary Belt around Mars + Deep Space Flight Corridor
  const { ringAsteroids, corridorAsteroids } = useMemo(() => {
    // 1. Full 360-degree Mars orbital belt (radius 1450m - 2700m from Mars center)
    const ring: { localPos: THREE.Vector3; radius: number; geomIdx: number; scale: [number, number, number]; rot: [number, number, number]; checked: boolean }[] = [];
    const RING_COUNT = 52;
    for (let i = 0; i < RING_COUNT; i++) {
      const angle = (i / RING_COUNT) * Math.PI * 2;
      const r = 1450 + (i % 6) * 220 + ((i * 37) % 110);
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      const y = -0.38 * r * Math.cos(angle) + 0.48 * r * Math.sin(angle) + ((i % 7) - 3) * 26;
      const isColossal = i % 8 === 0;
      const radius = isColossal ? 36 : 18 + (i % 5) * 4;
      ring.push({
        localPos: new THREE.Vector3(x, y, z),
        radius,
        geomIdx: i % 3,
        scale: [radius, radius * (0.85 + (i % 3) * 0.1), radius * (0.9 + (i % 4) * 0.08)],
        rot: [(i * 1.1) % Math.PI, (i * 2.3) % Math.PI, (i * 0.7) % Math.PI],
        checked: false,
      });
    }

    // 2. Flight corridor asteroids (Y=7500 to Y=23000) so space voyage has immediate encounters
    const corridor: { pos: THREE.Vector3; radius: number; geomIdx: number; scale: [number, number, number]; rot: [number, number, number]; checked: boolean }[] = [];
    [7500, 9500, 11500, 13500, 15500, 17500, 19500, 21500, 22700, 23200].forEach((alt, idx) => {
      const dy = alt - 6000;
      const x = -3129.6 - 0.56735 * dy;
      const z = 3576.6 + 0.64841 * dy;
      const radius = 26 + (idx % 3) * 4;
      corridor.push({
        pos: new THREE.Vector3(x, alt, z),
        radius,
        geomIdx: idx % 3,
        scale: [radius, radius * 0.9, radius * 0.95],
        rot: [idx * 0.8, idx * 1.4, idx * 0.5],
        checked: false,
      });
    });

    return { ringAsteroids: ring, corridorAsteroids: corridor };
  }, []);

  // Reset checked flags on mission restart
  useEffect(() => {
    encounterCountRef.current = 0;
    prevRocketPosRef.current = null;
    ringAsteroids.forEach((a) => { a.checked = false; });
    corridorAsteroids.forEach((a) => { a.checked = false; });
  }, [resetCount, ringAsteroids, corridorAsteroids]);

  // Continuous Collision Detection (CCD) & Natural Orbital Rotation
  useFrame((_, delta) => {
    // Natural orbital rotation of the 360° ring around Mars
    ringAngleRef.current += delta * 0.02;
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.y = ringAngleRef.current;
    }

    if (altitude < 3500 || !isFlying || isLanded || destination !== 'MARS' || isExploding) {
      prevRocketPosRef.current = null;
      return;
    }

    _astCurPos.copy(rocketPos);
    if (!prevRocketPosRef.current) {
      prevRocketPosRef.current = _astCurPos.clone();
      _astPrevPos.copy(_astCurPos);
    } else {
      _astPrevPos.copy(prevRocketPosRef.current);
      prevRocketPosRef.current.copy(_astCurPos);
    }

    _astSeg.copy(_astCurPos).sub(_astPrevPos);
    const segLenSq = _astSeg.lengthSq();

    // Check 1: Corridor Asteroids along the flight path (Zero GC)
    for (let i = 0; i < corridorAsteroids.length; i++) {
      const a = corridorAsteroids[i];
      if (a.checked) continue;
      if (Math.abs(_astCurPos.y - a.pos.y) > a.radius + 35) continue;

      let dist = 0;
      if (segLenSq < 0.001) {
        dist = _astCurPos.distanceTo(a.pos);
      } else {
        _astDiff.copy(a.pos).sub(_astPrevPos);
        const u = THREE.MathUtils.clamp(_astDiff.dot(_astSeg) / segLenSq, 0, 1);
        _astClosest.copy(_astPrevPos).addScaledVector(_astSeg, u);
        dist = _astClosest.distanceTo(a.pos);
      }

      if (dist <= a.radius + 8.5) {
        a.checked = true;
        encounterCountRef.current++;
        const isBlast = Math.random() < 0.25 || encounterCountRef.current >= 2;
        if (isBlast) {
          playAsteroidExplosion();
          onBlast(a.pos, a.radius);
        } else {
          playDeflectionSound();
          onDeflection(a.pos);
        }
        return;
      }
    }

    // Check 2: Mars 360° Ring Asteroids (transformed into ring's rotating local space - Zero GC)
    const distToMars = _astCurPos.distanceTo(MARS_POSITION);
    if (distToMars <= 3200 && distToMars >= 1000) {
      _astCurLocal.copy(_astCurPos).sub(MARS_POSITION).applyAxisAngle(_astUp, -ringAngleRef.current);
      _astPrevLocal.copy(_astPrevPos).sub(MARS_POSITION).applyAxisAngle(_astUp, -ringAngleRef.current);
      _astLocalSeg.copy(_astCurLocal).sub(_astPrevLocal);
      const localSegLenSq = _astLocalSeg.lengthSq();

      for (let i = 0; i < ringAsteroids.length; i++) {
        const a = ringAsteroids[i];
        if (a.checked) continue;

        let dist = 0;
        if (localSegLenSq < 0.001) {
          dist = _astCurLocal.distanceTo(a.localPos);
        } else {
          _astDiff.copy(a.localPos).sub(_astPrevLocal);
          const u = THREE.MathUtils.clamp(_astDiff.dot(_astLocalSeg) / localSegLenSq, 0, 1);
          _astClosest.copy(_astPrevLocal).addScaledVector(_astLocalSeg, u);
          dist = _astClosest.distanceTo(a.localPos);
        }

        if (dist <= a.radius + 8.5) {
          a.checked = true;
          encounterCountRef.current++;
          _astWorldHit.copy(a.localPos).applyAxisAngle(_astUp, ringAngleRef.current).add(MARS_POSITION);
          const isBlast = Math.random() < 0.25 || encounterCountRef.current >= 2;
          if (isBlast) {
            playAsteroidExplosion();
            onBlast(_astWorldHit, a.radius);
          } else {
            playDeflectionSound();
            onDeflection(_astWorldHit);
          }
          return;
        }
      }
    }
  });

  return (
    <group visible={altitude >= 3500}>
      {/* 1. 360-Degree Asteroid Belt orbiting around Mars */}
      <group position={MARS_POSITION} ref={ringGroupRef}>
        {ringAsteroids.map((a, i) => (
          <mesh
            key={`ring-${i}`}
            position={a.localPos}
            scale={a.scale}
            rotation={a.rot}
            geometry={geometries[a.geomIdx]}
            material={material}
            castShadow={false}
            receiveShadow={false}
          />
        ))}
      </group>

      {/* 2. Deep-Space Flight Corridor Asteroids */}
      {corridorAsteroids.map((a, i) => (
        <mesh
          key={`corridor-${i}`}
          position={a.pos}
          scale={a.scale}
          rotation={a.rot}
          geometry={geometries[a.geomIdx]}
          material={material}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}
