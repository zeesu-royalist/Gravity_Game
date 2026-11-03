import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Astronaut } from './Astronaut';
import { MarsRover } from './MarsRover';
import { MarsAlienSwarm } from './MarsAlienSwarm';
import { MARS_POSITION, MARS_RADIUS } from './SpaceEnvironment';

export const MARS_TOUCHDOWN_Y = MARS_POSITION.y + MARS_RADIUS + 0.2;
export const MARS_LANDING_SITE = new THREE.Vector3(MARS_POSITION.x, MARS_TOUCHDOWN_Y, MARS_POSITION.z);

function getMarsSurfaceElevation(x: number, z: number): number {
  const dx = x - MARS_POSITION.x, dz = z - MARS_POSITION.z;
  const dSq = dx * dx + dz * dz, r = MARS_RADIUS;
  if (dSq <= 900) return MARS_TOUCHDOWN_Y; // 30m flat landing pad
  if (dSq < r * r) {
    const d = Math.sqrt(dSq);
    const noise = d < 380 ? (Math.sin(dx * 0.03) * 1.8 + Math.cos(dz * 0.03) * 1.8 + Math.sin((dx + dz) * 0.06) * 1.1) * THREE.MathUtils.clamp((d - 30) / 25, 0, 1) : 0;
    return MARS_POSITION.y + Math.sqrt(r * r - dSq) + 0.25 + noise;
  }
  return MARS_POSITION.y;
}

function getMarsSurfaceQuat(x: number, z: number, heading: number): THREE.Quaternion {
  const normal = new THREE.Vector3(x - MARS_POSITION.x, getMarsSurfaceElevation(x, z) - MARS_POSITION.y, z - MARS_POSITION.z).normalize();
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const tFwd = fwd.sub(normal.clone().multiplyScalar(fwd.dot(normal))).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(normal, tFwd).normalize(), normal, tFwd));
}

interface MarsExplorationProps {
  isLanded: boolean;
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  onPlayerModeChange: (mode: 'ROCKET' | 'ASTRONAUT' | 'ROVER') => void;
  onUpdateHUD: (data: {
    astronautPos: THREE.Vector3;
    roverPos: THREE.Vector3;
    canEnterRover: boolean;
    canEnterRocket: boolean;
    roverSpeed: number;
    alienThreat?: {
      count: number;
      nearestDist: number;
      isAttacking: boolean;
      isFleeing?: boolean;
      kills?: number;
      allDead?: boolean;
      hitConfirmed?: boolean;
    };
  }) => void;
  astronautPosRef: React.MutableRefObject<THREE.Vector3>;
  roverPosRef: React.MutableRefObject<THREE.Vector3>;
  keysRef: React.MutableRefObject<{ [key: string]: boolean }>;
  rocketOnMars?: boolean;
  onAstronautHit?: (damage: number) => void;
}

export const MarsExploration: React.FC<MarsExplorationProps> = ({
  isLanded,
  playerMode,
  onUpdateHUD,
  astronautPosRef,
  roverPosRef,
  keysRef,
  rocketOnMars = true,
  onAstronautHit,
}) => {
  const astronautRotY = useRef(0);
  const astronautQuat = useRef(new THREE.Quaternion());
  const astronautVelY = useRef(0);
  const isJumping = useRef(false);
  const isMoving = useRef(false);

  const roverRotY = useRef(0.4);
  const roverQuat = useRef(new THREE.Quaternion());
  const roverSpeed = useRef(0);
  const roverSteerAngle = useRef(0);
  const roverWheelSpin = useRef(0);
  const lastHud = useRef({ canEnterRover: false, canEnterRocket: false, speed: 0 });
  const lastThreat = useRef<{ count: number; nearestDist: number; isAttacking: boolean; isFleeing?: boolean } | undefined>(undefined);

  // 1. Curved Red Martian Terrain Sheet
  const marsTerrainGeom = useMemo(() => {
    const geom = new THREE.PlaneGeometry(720, 720, 80, 80);
    const pos = geom.attributes.position;
    const r = MARS_RADIUS;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i);
      const dSq = vx * vx + vy * vy;
      if (dSq <= 900) { pos.setZ(i, 0.25); continue; }
      if (dSq < r * r) {
        const d = Math.sqrt(dSq);
        const noise = d < 380 ? (Math.sin(vx * 0.03) * 1.8 + Math.cos(-vy * 0.03) * 1.8 + Math.sin((vx - vy) * 0.06) * 1.1) * THREE.MathUtils.clamp((d - 30) / 25, 0, 1) : 0;
        pos.setZ(i, Math.sqrt(r * r - dSq) - r + 0.25 + noise);
      } else {
        pos.setZ(i, -r);
      }
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  // 2. Scattered Volcanic Martian Rocks
  const boulders = useMemo(() => Array.from({ length: 48 }).map((_, i) => {
    const ang = (i / 48) * Math.PI * 2 + (i % 6) * 0.35;
    const dist = 36 + (i * 21) % 250;
    const bx = MARS_LANDING_SITE.x + Math.cos(ang) * dist;
    const bz = MARS_LANDING_SITE.z + Math.sin(ang) * dist;
    return {
      pos: [bx, getMarsSurfaceElevation(bx, bz) + 0.35, bz] as [number, number, number],
      scale: [1.2 + (i % 3) * 0.7, 0.9 + (i % 2) * 0.6, 1.2 + ((i + 1) % 3) * 0.7] as [number, number, number],
      rot: [i * 0.6, i * 1.2, i * 0.5] as [number, number, number],
    };
  }), []);

  useFrame((_, delta) => {
    if (!isLanded) return;
    const keys = keysRef.current;
    const astroPos = astronautPosRef.current;
    const rovPos = roverPosRef.current;

    const canEnterRover = playerMode === 'ASTRONAUT' && astroPos.distanceTo(rovPos) < 5.5;
    const canEnterRocket = playerMode === 'ASTRONAUT' && astroPos.distanceTo(MARS_LANDING_SITE) < 6.0;

    // A. Astronaut EVA on Mars (0.38 G Gravity)
    if (playerMode === 'ASTRONAUT') {
      let forwardDir = 0;
      if (keys['KeyW'] || keys['ArrowUp']) forwardDir += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forwardDir -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) astronautRotY.current += 2.8 * delta;
      if (keys['KeyD'] || keys['ArrowRight']) astronautRotY.current -= 2.8 * delta;

      astronautQuat.current.slerp(getMarsSurfaceQuat(astroPos.x, astroPos.z, astronautRotY.current), delta * 12);
      if (forwardDir !== 0) {
        astroPos.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(astronautQuat.current), forwardDir * 5.4 * delta);
      }

      const surfaceY = getMarsSurfaceElevation(astroPos.x, astroPos.z);
      // Mars 0.38 G jump (3.72 m/s^2)
      if (keys['Space'] && !isJumping.current && astroPos.y <= surfaceY + 0.15) {
        astronautVelY.current = 5.0;
        isJumping.current = true;
      }
      if (isJumping.current || astroPos.y > surfaceY) {
        astronautVelY.current -= 11.16 * delta; // 3.72 * 3.0
        astroPos.y += astronautVelY.current * delta;
        if (astroPos.y <= surfaceY) {
          astroPos.y = surfaceY;
          astronautVelY.current = 0;
          isJumping.current = false;
        }
      } else {
        astroPos.y = surfaceY;
      }
      isMoving.current = forwardDir !== 0;
    }

    // B. Mars Rover Driving
    if (playerMode === 'ROVER') {
      const maxSpeed = 18.0;
      if (keys['KeyA'] || keys['ArrowLeft']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0.45, delta * 8);
        roverRotY.current += 1.8 * (roverSpeed.current / maxSpeed) * delta;
      } else if (keys['KeyD'] || keys['ArrowRight']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, -0.45, delta * 8);
        roverRotY.current -= 1.8 * (roverSpeed.current / maxSpeed) * delta;
      } else {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0, delta * 8);
      }

      if (keys['KeyW'] || keys['ArrowUp']) roverSpeed.current = Math.min(maxSpeed, roverSpeed.current + 10.0 * delta);
      else if (keys['KeyS'] || keys['ArrowDown']) roverSpeed.current = Math.max(-6.0, roverSpeed.current - 15.0 * delta);
      else roverSpeed.current = THREE.MathUtils.lerp(roverSpeed.current, 0, delta * 1.8);

      roverQuat.current.slerp(getMarsSurfaceQuat(rovPos.x, rovPos.z, roverRotY.current), delta * 12);
      rovPos.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(roverQuat.current), roverSpeed.current * delta);
      rovPos.y = getMarsSurfaceElevation(rovPos.x, rovPos.z);
      roverWheelSpin.current += (roverSpeed.current / 0.42) * delta;

      astroPos.copy(rovPos).add(new THREE.Vector3(0, 0.35, 0));
      astronautRotY.current = roverRotY.current;
      astronautQuat.current.copy(roverQuat.current);
    }

    const speedKmh = Math.round(Math.abs(roverSpeed.current) * 3.6);
    if (
      lastHud.current.canEnterRover !== canEnterRover ||
      lastHud.current.canEnterRocket !== canEnterRocket ||
      lastHud.current.speed !== speedKmh
    ) {
      lastHud.current = { canEnterRover, canEnterRocket, speed: speedKmh };
      onUpdateHUD({
        astronautPos: astroPos,
        roverPos: rovPos,
        canEnterRover,
        canEnterRocket,
        roverSpeed: speedKmh,
        alienThreat: lastThreat.current,
      });
    }
  });

  return (
    <group>
      {/* 1. Curved Martian Red Regolith Surface */}
      <group position={[MARS_LANDING_SITE.x, MARS_TOUCHDOWN_Y - 0.2, MARS_LANDING_SITE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={marsTerrainGeom} receiveShadow>
          <meshStandardMaterial color="#94340d" roughness={0.94} metalness={0.05} />
        </mesh>
      </group>

      {/* 2. Martian Basalt Boulders */}
      {boulders.map((b, i) => (
        <mesh key={i} position={b.pos} scale={b.scale} rotation={b.rot} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#451a08" roughness={0.96} metalness={0.04} />
        </mesh>
      ))}

      {/* 3. Ares Base Alpha Habitat Dome & Solar Array */}
      <group position={[MARS_LANDING_SITE.x - 22, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z - 16]}>
        {/* Geodesic Dome */}
        <mesh position={[0, 4.5, 0]}>
          <sphereGeometry args={[9, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.6} />
        </mesh>
        {/* Airburst Solar Array */}
        <mesh position={[18, 3, 0]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[12, 0.2, 5]} />
          <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.8} />
        </mesh>
      </group>

      {/* 4. Access Ladder deployed to Mars ground */}
      {rocketOnMars && (
        <group position={[MARS_LANDING_SITE.x + 2.8, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 1.2]} rotation={[0, -0.6, 0]}>
          {[-0.35, 0.35].map((rx) => (
            <mesh key={rx} position={[rx, 6, 0]}><cylinderGeometry args={[0.03, 0.03, 12]} /><meshStandardMaterial color="#cbd5e1" metalness={0.8} /></mesh>
          ))}
          {Array.from({ length: 18 }).map((_, rIdx) => (
            <mesh key={rIdx} position={[0, rIdx * 0.65 + 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7]} /><meshStandardMaterial color="#cbd5e1" metalness={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* 5. Commander Astronaut on Mars with Tactical Plasma Blaster */}
      <Astronaut
        position={astronautPosRef.current}
        rotationY={astronautRotY.current}
        quaternion={astronautQuat.current}
        isMoving={isMoving.current}
        isJumping={isJumping.current}
        visible={playerMode === 'ASTRONAUT'}
        hasWeapon={true}
        isShooting={playerMode === 'ASTRONAUT' && !!keysRef.current['KeyQ']}
      />

      {/* 6. Realistic 3D Mars Exploration Rover Model */}
      <MarsRover
        position={roverPosRef.current}
        rotationY={roverRotY.current}
        quaternion={roverQuat.current}
        isDriven={playerMode === 'ROVER'}
      />

      {/* 7. Proto-Xenomorph Deacon Alien Swarm */}
      <MarsAlienSwarm
        astronautPos={astronautPosRef.current}
        astronautRotY={astronautRotY.current}
        astronautQuat={astronautQuat.current}
        roverPos={roverPosRef.current}
        playerMode={playerMode}
        isShooting={playerMode === 'ASTRONAUT' && !!keysRef.current['KeyQ']}
        active={isLanded && (playerMode === 'ASTRONAUT' || playerMode === 'ROVER')}
        onAstronautHit={onAstronautHit}
        onThreatChange={(threat) => {
          lastThreat.current = threat;
          if (threat.allDead && keysRef.current) {
            keysRef.current['KeyQ'] = false;
          }
          onUpdateHUD({
            astronautPos: astronautPosRef.current,
            roverPos: roverPosRef.current,
            canEnterRover: lastHud.current.canEnterRover,
            canEnterRocket: lastHud.current.canEnterRocket,
            roverSpeed: lastHud.current.speed,
            alienThreat: threat,
          });
        }}
      />
    </group>
  );
};
