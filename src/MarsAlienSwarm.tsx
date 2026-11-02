import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MARS_POSITION, MARS_RADIUS } from './SpaceEnvironment';

const MARS_TOUCHDOWN_Y = MARS_POSITION.y + MARS_RADIUS + 0.2;
const MARS_LANDING_SITE = new THREE.Vector3(MARS_POSITION.x, MARS_TOUCHDOWN_Y, MARS_POSITION.z);

// Mars terrain elevation conforming
function getMarsSurfaceElevation(x: number, z: number): number {
  const dx = x - MARS_POSITION.x, dz = z - MARS_POSITION.z;
  const dSq = dx * dx + dz * dz, r = MARS_RADIUS;
  if (dSq <= 900) return MARS_TOUCHDOWN_Y;
  if (dSq < r * r) {
    const d = Math.sqrt(dSq);
    const noise = d < 380 ? (Math.sin(dx * 0.03) * 1.8 + Math.cos(dz * 0.03) * 1.8) * THREE.MathUtils.clamp((d - 30) / 25, 0, 1) : 0;
    return MARS_POSITION.y + Math.sqrt(r * r - dSq) + 0.25 + noise;
  }
  return MARS_POSITION.y;
}

// Mars surface normal quaternion alignment
function getMarsSurfaceQuat(x: number, z: number, heading: number): THREE.Quaternion {
  const normal = new THREE.Vector3(x - MARS_POSITION.x, getMarsSurfaceElevation(x, z) - MARS_POSITION.y, z - MARS_POSITION.z).normalize();
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const tFwd = fwd.sub(normal.clone().multiplyScalar(fwd.dot(normal))).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(normal, tFwd).normalize(), normal, tFwd)
  );
}

// Web Audio API Procedural Alien Screech Synthesizer
let audioCtx: AudioContext | null = null;
let lastScreechTime = 0;

function playAlienScreech(isAggressive = false) {
  const now = performance.now();
  if (now - lastScreechTime < (isAggressive ? 2200 : 4500)) return;
  lastScreechTime = now;

  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isAggressive ? 780 : 540, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(isAggressive ? 980 : 720, t + 0.65);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.95);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.Q.setValueAtTime(3.2, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(isAggressive ? 0.22 : 0.14, t + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.95);
  } catch (_) {}
}

export interface AlienSimData {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
  pitch: number;
  roll: number;
  bobY: number;
  health: number;
  state: 'STALKING' | 'SPRINTING' | 'ATTACKING' | 'FLEEING';
  attackTimer: number;
  strideTimer: number;
  stridePhase: number;
}

export interface MarsAlienSwarmProps {
  astronautPos: THREE.Vector3;
  roverPos: THREE.Vector3;
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  active: boolean;
  onThreatChange?: (threat: { count: number; nearestDist: number; isAttacking: boolean; isFleeing?: boolean }) => void;
}

interface AlienJointRefs {
  root: THREE.Group | null;
  body: THREE.Group | null;
  head: THREE.Group | null;
  jaw: THREE.Group | null;
  innerMouth: THREE.Group | null;
  leftThigh: THREE.Group | null;
  leftKnee: THREE.Group | null;
  rightThigh: THREE.Group | null;
  rightKnee: THREE.Group | null;
  leftArm: THREE.Group | null;
  leftForearm: THREE.Group | null;
  rightArm: THREE.Group | null;
  rightForearm: THREE.Group | null;
  tail1: THREE.Group | null;
  tail2: THREE.Group | null;
  tail3: THREE.Group | null;
  marker: THREE.Mesh | null;
}

export const MarsAlienSwarm: React.FC<MarsAlienSwarmProps> = ({
  astronautPos,
  roverPos,
  playerMode,
  active,
  onThreatChange,
}) => {
  const lastThreatUpdate = useRef(0);

  // 5 Alien Predators with physical velocity and smooth inertia
  const aliens = useRef<AlienSimData[]>([
    { id: 0, pos: new THREE.Vector3(MARS_LANDING_SITE.x + 20, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 18), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, bobY: 0, health: 100, state: 'SPRINTING', attackTimer: 0, strideTimer: 0, stridePhase: 0 },
    { id: 1, pos: new THREE.Vector3(MARS_LANDING_SITE.x - 22, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 15), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, bobY: 0, health: 100, state: 'SPRINTING', attackTimer: 0, strideTimer: 0, stridePhase: 1.25 },
    { id: 2, pos: new THREE.Vector3(MARS_LANDING_SITE.x + 24, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z - 18), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, bobY: 0, health: 100, state: 'SPRINTING', attackTimer: 0, strideTimer: 0, stridePhase: 2.5 },
    { id: 3, pos: new THREE.Vector3(MARS_LANDING_SITE.x - 19, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z - 22), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, bobY: 0, health: 100, state: 'SPRINTING', attackTimer: 0, strideTimer: 0, stridePhase: 3.75 },
    { id: 4, pos: new THREE.Vector3(MARS_LANDING_SITE.x + 8, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 26), vel: new THREE.Vector3(), rotY: 0, pitch: 0, roll: 0, bobY: 0, health: 100, state: 'SPRINTING', attackTimer: 0, strideTimer: 0, stridePhase: 5.0 },
  ]);

  // Pre-allocated Joint References for direct zero-overhead 60 FPS matrix updates
  const jointRefs = useRef<AlienJointRefs[]>(
    Array.from({ length: 5 }, () => ({
      root: null,
      body: null,
      head: null,
      jaw: null,
      innerMouth: null,
      leftThigh: null,
      leftKnee: null,
      rightThigh: null,
      rightKnee: null,
      leftArm: null,
      leftForearm: null,
      rightArm: null,
      rightForearm: null,
      tail1: null,
      tail2: null,
      tail3: null,
      marker: null,
    }))
  );

  // High-performance Shared Materials (Glistening Bio-mechanical Chitin)
  const materials = useMemo(() => ({
    chitinDark: new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.24,
      metalness: 0.35,
    }),
    chitinRibs: new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.32,
      metalness: 0.28,
    }),
    fangs: new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.16,
      metalness: 0.05,
    }),
    glowingEyes: new THREE.MeshBasicMaterial({
      color: '#ff1a1a',
    }),
    hudMarker: new THREE.MeshBasicMaterial({
      color: '#ef4444',
      wireframe: true,
    }),
  }), []);

  // Shared Procedural Geometries (Reused across all instances for 0 memory overhead)
  const geoms = useMemo(() => ({
    thorax: new THREE.CapsuleGeometry(0.32, 0.75, 6, 12),
    ribPlate: new THREE.BoxGeometry(0.52, 0.06, 0.26),
    dorsalSpine: new THREE.CylinderGeometry(0.035, 0.07, 0.65, 6),
    skullDome: new THREE.CapsuleGeometry(0.22, 0.92, 8, 14),
    snout: new THREE.BoxGeometry(0.24, 0.18, 0.38),
    fang: new THREE.ConeGeometry(0.025, 0.1, 5),
    mandible: new THREE.BoxGeometry(0.22, 0.11, 0.34),
    eye: new THREE.SphereGeometry(0.042, 8, 8),
    limbUpper: new THREE.CapsuleGeometry(0.08, 0.45, 5, 8),
    limbLower: new THREE.CapsuleGeometry(0.065, 0.42, 5, 8),
    claw: new THREE.ConeGeometry(0.02, 0.14, 5),
    thigh: new THREE.CapsuleGeometry(0.12, 0.52, 5, 8),
    shank: new THREE.CapsuleGeometry(0.085, 0.58, 5, 8),
    foot: new THREE.BoxGeometry(0.17, 0.06, 0.28),
    toeClaw: new THREE.ConeGeometry(0.024, 0.12, 5),
    tailSeg1: new THREE.CylinderGeometry(0.09, 0.14, 0.48, 6),
    tailSeg2: new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6),
    tailTip: new THREE.ConeGeometry(0.05, 0.45, 5),
    tacticalMarker: new THREE.OctahedronGeometry(0.22, 0),
  }), []);

  // Master Unified 60 FPS Simulation Loop
  useFrame(({ clock }, delta) => {
    if (!active || playerMode === 'ROCKET') return;

    // Clamp delta to prevent physics explosion on lag spikes
    const dt = Math.min(0.05, delta);
    const time = clock.getElapsedTime();
    const targetPos = playerMode === 'ROVER' ? roverPos : astronautPos;
    const alienList = aliens.current;
    let minDistance = 9999;
    let anyAttacking = false;

    // 1. Soft Flocking Separation Force (Smooth Quadratic Damping - NO JITTER)
    for (let i = 0; i < alienList.length; i++) {
      for (let j = i + 1; j < alienList.length; j++) {
        const a1 = alienList[i];
        const a2 = alienList[j];
        const diffX = a1.pos.x - a2.pos.x;
        const diffZ = a1.pos.z - a2.pos.z;
        const distSq = diffX * diffX + diffZ * diffZ;
        const minDist = 3.6;

        if (distSq < minDist * minDist && distSq > 0.001) {
          const d = Math.sqrt(distSq);
          const overlap = (minDist - d) / minDist; // 0 to 1
          const pushForce = overlap * overlap * 16.0 * dt;
          const nx = diffX / d;
          const nz = diffZ / d;

          a1.vel.x += nx * pushForce;
          a1.vel.z += nz * pushForce;
          a2.vel.x -= nx * pushForce;
          a2.vel.z -= nz * pushForce;
        }
      }
    }

    // 2. Individual Alien AI, Kinematics & Joint Updates
    for (let i = 0; i < alienList.length; i++) {
      const a = alienList[i];
      const joints = jointRefs.current[i];
      if (!joints.root) continue;

      // Vector to target
      const toTargetX = targetPos.x - a.pos.x;
      const toTargetZ = targetPos.z - a.pos.z;
      const dist = Math.hypot(toTargetX, toTargetZ);
      if (dist < minDistance) minDistance = dist;

      // Predatory Wave Strike Cycle: 0 to 11s = Chase & Attack, 11s to 18s = Flee into dunes & regroup
      const cycleTime = (time + i * 1.6) % 18.0;
      const isFleeing = cycleTime > 11.0;

      let dirX = toTargetX / (dist || 1);
      let dirZ = toTargetZ / (dist || 1);
      let desiredSpeed = 11.2;

      if (isFleeing) {
        a.state = 'FLEEING';
        // Run in opposite direction away from player into dunes
        dirX = -dirX;
        dirZ = -dirZ;
        desiredSpeed = dist > 48.0 ? 3.5 : 12.0;
      } else {
        // Hysteresis for attack state: enter at <= 4.2m, stay attacking until > 5.8m (Zero boundary flicker!)
        const wasAttacking = a.state === 'ATTACKING';
        const isAttackRange = wasAttacking ? dist <= 5.8 : dist <= 4.2;

        if (isAttackRange) {
          // Attack range: fast circling and striking
          a.state = 'ATTACKING';
          desiredSpeed = 3.2;
          anyAttacking = true;
          a.attackTimer += dt * 8.0;

          // Strafe & circle target while striking
          const strafeSide = i % 2 === 0 ? 1 : -1;
          dirX = -dirZ * strafeSide * 0.7 + dirX * 0.4;
          dirZ = dirX * strafeSide * 0.7 + dirZ * 0.4;
        } else if (dist < 20.0) {
          // Full aggressive sprint towards target
          a.state = 'SPRINTING';
          desiredSpeed = 11.5;
        } else {
          // Stalking
          a.state = 'STALKING';
          desiredSpeed = 7.5;
        }
      }

      const desiredVelX = dirX * desiredSpeed;
      const desiredVelZ = dirZ * desiredSpeed;

      // Smooth inertia lerp (Butter-smooth acceleration, zero snap)
      a.vel.x = THREE.MathUtils.lerp(a.vel.x, desiredVelX, dt * 5.0);
      a.vel.z = THREE.MathUtils.lerp(a.vel.z, desiredVelZ, dt * 5.0);

      // Integrate position
      a.pos.x += a.vel.x * dt;
      a.pos.z += a.vel.z * dt;

      // Smooth continuous heading orientation
      const currentSpeed = Math.hypot(a.vel.x, a.vel.z);
      if (currentSpeed > 0.5) {
        const targetRotY = Math.atan2(a.vel.x, a.vel.z);
        // Angle diff wrap-around
        let diffAngle = targetRotY - a.rotY;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        a.rotY += diffAngle * Math.min(1.0, dt * 6.5);

        // Banking into turns (realistic predator weight transfer)
        a.roll = THREE.MathUtils.clamp(-diffAngle * 0.35, -0.22, 0.22);
      }

      // Surface normal alignment and ground conforming
      const elev = getMarsSurfaceElevation(a.pos.x, a.pos.z);
      a.pos.y = elev;

      // Stride timer advances proportionally to ground speed (Zero foot sliding!)
      a.strideTimer += dt * currentSpeed * 2.2;
      const strideCycle = a.strideTimer + a.stridePhase;

      // Running stride & vertical body bobbing
      const strideSin = Math.sin(strideCycle);
      const strideCos = Math.cos(strideCycle);
      a.pitch = a.state === 'ATTACKING' ? 0.38 + Math.sin(a.attackTimer * 4) * 0.15 : 0.26 + (currentSpeed / 12) * 0.12;
      a.bobY = Math.abs(strideSin) * 0.18;

      // Apply Matrix Transforms to Root Group
      const surfaceQuat = getMarsSurfaceQuat(a.pos.x, a.pos.z, a.rotY);
      const poseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.pitch, 0, a.roll, 'YXZ'));
      surfaceQuat.multiply(poseQuat);

      joints.root.position.set(a.pos.x, a.pos.y + a.bobY, a.pos.z);
      joints.root.quaternion.copy(surfaceQuat);

      // ================= SKELETAL JOINT KINEMATICS =================
      // Hind Leg Gait: Hip extension + Knee flexion for high clearance
      const legL = strideSin;
      const legR = -strideSin;
      const kneeL = 0.55 + Math.max(0, -legL) * 0.75;
      const kneeR = 0.55 + Math.max(0, -legR) * 0.75;

      if (joints.leftThigh) joints.leftThigh.rotation.x = legL * 0.72;
      if (joints.leftKnee) joints.leftKnee.rotation.x = kneeL;
      if (joints.rightThigh) joints.rightThigh.rotation.x = legR * 0.72;
      if (joints.rightKnee) joints.rightKnee.rotation.x = kneeR;

      // Forelimb Motion (Reaching & Slashing)
      if (a.state === 'ATTACKING') {
        const slashL = Math.sin(a.attackTimer * 7.0);
        const slashR = Math.cos(a.attackTimer * 7.0);
        if (joints.leftArm) joints.leftArm.rotation.x = -0.3 + slashL * 0.75;
        if (joints.leftForearm) joints.leftForearm.rotation.x = 0.5 + slashL * 0.35;
        if (joints.rightArm) joints.rightArm.rotation.x = -0.3 + slashR * 0.75;
        if (joints.rightForearm) joints.rightForearm.rotation.x = 0.5 + slashR * 0.35;

        // Snapping jaws & striking inner mouth
        const bite = Math.abs(Math.sin(a.attackTimer * 9.0));
        if (joints.jaw) joints.jaw.rotation.x = 0.15 + bite * 0.45;
        if (joints.head) joints.head.rotation.x = -0.1 + Math.sin(a.attackTimer * 6.0) * 0.2;
      } else {
        // Natural predatory sprint arms
        if (joints.leftArm) joints.leftArm.rotation.x = -legL * 0.55;
        if (joints.leftForearm) joints.leftForearm.rotation.x = 0.6 + Math.max(0, -legL) * 0.4;
        if (joints.rightArm) joints.rightArm.rotation.x = -legR * 0.55;
        if (joints.rightForearm) joints.rightForearm.rotation.x = 0.6 + Math.max(0, -legR) * 0.4;

        if (joints.jaw) joints.jaw.rotation.x = 0.08;
        if (joints.head) joints.head.rotation.x = -0.18 + strideCos * 0.05;
      }

      // Serpentine Traveling Tail Wave (Phase-delayed sinusoidal whip)
      const tailWave1 = Math.sin(strideCycle * 0.5);
      const tailWave2 = Math.sin(strideCycle * 0.5 - 0.45);
      const tailWave3 = Math.sin(strideCycle * 0.5 - 0.9);

      if (joints.tail1) joints.tail1.rotation.y = tailWave1 * 0.3;
      if (joints.tail2) joints.tail2.rotation.y = tailWave2 * 0.45;
      if (joints.tail3) joints.tail3.rotation.y = tailWave3 * 0.6;

      // Smooth floating tactical diamond marker (Zero DOM, zero z-fighting, zero pulse jitter)
      if (joints.marker) {
        joints.marker.rotation.y = time * 1.5 + i;
        const markerScale = a.state === 'ATTACKING' ? 1.25 : 0.95;
        joints.marker.scale.set(markerScale, markerScale, markerScale);
      }
    }

    // Audio Screech trigger when closing distance
    if (minDistance < 24) {
      playAlienScreech(anyAttacking);
    }

    // Report threat status to HUD (throttled to 5Hz to prevent React state churn)
    const nowTime = performance.now();
    if (onThreatChange && nowTime - lastThreatUpdate.current > 200) {
      lastThreatUpdate.current = nowTime;
      const anyFleeing = alienList.some((al) => al.state === 'FLEEING');
      onThreatChange({
        count: alienList.length,
        nearestDist: Math.round(minDistance),
        isAttacking: anyAttacking,
        isFleeing: anyFleeing,
      });
    }
  });

  if (!active || playerMode === 'ROCKET') return null;

  return (
    <group>
      {aliens.current.map((alien, idx) => {
        const j = jointRefs.current[idx];

        return (
          <group
            key={alien.id}
            ref={(el) => { j.root = el; }}
            position={alien.pos.toArray()}
          >
            <group scale={[1.22, 1.22, 1.22]}>
              {/* ================= 1. Armored Thorax & Ribs ================= */}
              <group ref={(el) => { j.body = el; }} position={[0, 1.45, 0]}>
                {/* Main Chitin Thorax */}
                <mesh geometry={geoms.thorax} material={materials.chitinDark} />

                {/* Exoskeleton Rib Plates */}
                {[-0.24, -0.08, 0.08, 0.24].map((yo, ri) => (
                  <mesh
                    key={ri}
                    position={[0, yo, 0.16]}
                    rotation={[0.2, 0, 0]}
                    geometry={geoms.ribPlate}
                    material={materials.chitinRibs}
                  />
                ))}

                {/* 4 Dorsal Biomechanical Spines */}
                {[
                  [-0.14, 0.22, -0.22, -0.38],
                  [0.14, 0.22, -0.22, -0.38],
                  [-0.18, 0.02, -0.25, -0.48],
                  [0.18, 0.02, -0.25, -0.48],
                ].map(([tx, ty, tz, rotX], si) => (
                  <mesh
                    key={si}
                    position={[tx, ty, tz]}
                    rotation={[rotX, 0, tx > 0 ? 0.15 : -0.15]}
                    geometry={geoms.dorsalSpine}
                    material={materials.chitinDark}
                  />
                ))}

                {/* ================= 2. Aerodynamic Xenomorph Head ================= */}
                <group ref={(el) => { j.head = el; }} position={[0, 0.48, 0.32]}>
                  {/* Elongated Skull Dome */}
                  <mesh
                    position={[0, 0.08, -0.32]}
                    rotation={[Math.PI / 2 + 0.15, 0, 0]}
                    geometry={geoms.skullDome}
                    material={materials.chitinDark}
                  />

                  {/* Upper Snout */}
                  <mesh position={[0, -0.02, 0.24]} geometry={geoms.snout} material={materials.chitinRibs} />

                  {/* Razor Upper Fangs */}
                  {[-0.08, 0, 0.08].map((fx, fi) => (
                    <mesh
                      key={fi}
                      position={[fx, -0.14, 0.34]}
                      rotation={[Math.PI, 0, 0]}
                      geometry={geoms.fang}
                      material={materials.fangs}
                    />
                  ))}

                  {/* Articulated Lower Mandible */}
                  <group ref={(el) => { j.jaw = el; }} position={[0, -0.1, 0.1]}>
                    <mesh position={[0, -0.04, 0.18]} geometry={geoms.mandible} material={materials.chitinDark} />
                    {/* Lower Fangs */}
                    {[-0.07, 0.07].map((tx, ti) => (
                      <mesh
                        key={ti}
                        position={[tx, 0.05, 0.28]}
                        geometry={geoms.fang}
                        material={materials.fangs}
                      />
                    ))}
                  </group>

                  {/* Piercing Crimson Ocular Slit (Pure unlit emissive - Zero Lighting Flicker) */}
                  {[-0.11, 0.11].map((ex, ei) => (
                    <mesh
                      key={ei}
                      position={[ex, 0.04, 0.28]}
                      geometry={geoms.eye}
                      material={materials.glowingEyes}
                    />
                  ))}
                </group>

                {/* ================= 3. Slashing Forelimbs ================= */}
                {/* Left Arm */}
                <group ref={(el) => { j.leftArm = el; }} position={[-0.32, 0.28, 0.12]}>
                  <mesh position={[0, -0.24, 0]} geometry={geoms.limbUpper} material={materials.chitinDark} />
                  <group ref={(el) => { j.leftForearm = el; }} position={[0, -0.46, 0]} rotation={[0.65, 0, 0.15]}>
                    <mesh position={[0, -0.22, 0]} geometry={geoms.limbLower} material={materials.chitinRibs} />
                    {/* 3 Hand Claws */}
                    {[-0.04, 0, 0.04].map((cx, ci) => (
                      <mesh
                        key={ci}
                        position={[cx, -0.45, 0.04]}
                        rotation={[0.4, 0, 0]}
                        geometry={geoms.claw}
                        material={materials.fangs}
                      />
                    ))}
                  </group>
                </group>

                {/* Right Arm */}
                <group ref={(el) => { j.rightArm = el; }} position={[0.32, 0.28, 0.12]}>
                  <mesh position={[0, -0.24, 0]} geometry={geoms.limbUpper} material={materials.chitinDark} />
                  <group ref={(el) => { j.rightForearm = el; }} position={[0, -0.46, 0]} rotation={[0.65, 0, -0.15]}>
                    <mesh position={[0, -0.22, 0]} geometry={geoms.limbLower} material={materials.chitinRibs} />
                    {/* 3 Hand Claws */}
                    {[-0.04, 0, 0.04].map((cx, ci) => (
                      <mesh
                        key={ci}
                        position={[cx, -0.45, 0.04]}
                        rotation={[0.4, 0, 0]}
                        geometry={geoms.claw}
                        material={materials.fangs}
                      />
                    ))}
                  </group>
                </group>

                {/* ================= 4. Segmented Whipping Tail ================= */}
                <group ref={(el) => { j.tail1 = el; }} position={[0, -0.38, -0.18]} rotation={[-0.45, 0, 0]}>
                  <mesh position={[0, -0.22, -0.18]} geometry={geoms.tailSeg1} material={materials.chitinDark} />
                  <group ref={(el) => { j.tail2 = el; }} position={[0, -0.45, -0.36]} rotation={[0.25, 0, 0]}>
                    <mesh position={[0, -0.18, -0.2]} geometry={geoms.tailSeg2} material={materials.chitinDark} />
                    <group ref={(el) => { j.tail3 = el; }} position={[0, -0.46, -0.44]} rotation={[1.2, 0, 0]}>
                      <mesh geometry={geoms.tailTip} material={materials.fangs} />
                    </group>
                  </group>
                </group>
              </group>

              {/* ================= 5. Digitigrade Hind Legs ================= */}
              {/* Left Hind Leg */}
              <group ref={(el) => { j.leftThigh = el; }} position={[-0.28, 1.25, -0.1]}>
                <mesh position={[0, -0.32, 0.08]} rotation={[-0.35, 0, 0]} geometry={geoms.thigh} material={materials.chitinDark} />
                <group ref={(el) => { j.leftKnee = el; }} position={[0, -0.62, 0.22]}>
                  <mesh position={[0, -0.32, -0.06]} geometry={geoms.shank} material={materials.chitinRibs} />
                  <group position={[0, -0.62, -0.14]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, 0, 0.12]} geometry={geoms.foot} material={materials.chitinDark} />
                    {[-0.05, 0, 0.05].map((tx, ti) => (
                      <mesh
                        key={ti}
                        position={[tx, -0.02, 0.28]}
                        rotation={[0.3, 0, 0]}
                        geometry={geoms.toeClaw}
                        material={materials.fangs}
                      />
                    ))}
                  </group>
                </group>
              </group>

              {/* Right Hind Leg */}
              <group ref={(el) => { j.rightThigh = el; }} position={[0.28, 1.25, -0.1]}>
                <mesh position={[0, -0.32, 0.08]} rotation={[-0.35, 0, 0]} geometry={geoms.thigh} material={materials.chitinDark} />
                <group ref={(el) => { j.rightKnee = el; }} position={[0, -0.62, 0.22]}>
                  <mesh position={[0, -0.32, -0.06]} geometry={geoms.shank} material={materials.chitinRibs} />
                  <group position={[0, -0.62, -0.14]} rotation={[-0.4, 0, 0]}>
                    <mesh position={[0, 0, 0.12]} geometry={geoms.foot} material={materials.chitinDark} />
                    {[-0.05, 0, 0.05].map((tx, ti) => (
                      <mesh
                        key={ti}
                        position={[tx, -0.02, 0.28]}
                        rotation={[0.3, 0, 0]}
                        geometry={geoms.toeClaw}
                        material={materials.fangs}
                      />
                    ))}
                  </group>
                </group>
              </group>
            </group>

            {/* Tactical 3D Holographic Diamond Glyph (Zero DOM, Zero Flickering) */}
            <mesh
              ref={(el) => { j.marker = el; }}
              position={[0, 2.7, 0]}
              geometry={geoms.tacticalMarker}
              material={materials.hudMarker}
            />
          </group>
        );
      })}
    </group>
  );
};
