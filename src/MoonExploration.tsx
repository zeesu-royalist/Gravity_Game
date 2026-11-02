import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Astronaut } from './Astronaut';
import { LunarRover } from './LunarRover';
import { MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';

export const MOON_TOUCHDOWN_Y = MOON_POSITION.y + MOON_RADIUS + 0.2;
export const MOON_LANDING_SITE = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y, MOON_POSITION.z);



function getMoonSurfaceElevation(x: number, z: number): number {
  const dx = x - MOON_POSITION.x, dz = z - MOON_POSITION.z;
  const dSq = dx * dx + dz * dz, r = MOON_RADIUS;
  if (dSq <= 676) return MOON_TOUCHDOWN_Y; // 26m flat pad
  if (dSq < r * r) {
    const d = Math.sqrt(dSq);
    const noise = d < 310 ? (Math.sin(dx * 0.035) * 1.6 + Math.cos(dz * 0.035) * 1.6 + Math.sin((dx + dz) * 0.07) * 0.9) * THREE.MathUtils.clamp((d - 26) / 20, 0, 1) : 0;
    return MOON_POSITION.y + Math.sqrt(r * r - dSq) + 0.25 + noise;
  }
  return MOON_POSITION.y;
}

function getMoonSurfaceQuat(x: number, z: number, heading: number): THREE.Quaternion {
  const normal = new THREE.Vector3(x - MOON_POSITION.x, getMoonSurfaceElevation(x, z) - MOON_POSITION.y, z - MOON_POSITION.z).normalize();
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  const tFwd = fwd.sub(normal.clone().multiplyScalar(fwd.dot(normal))).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(normal, tFwd).normalize(), normal, tFwd));
}

interface MoonExplorationProps {
  isLanded: boolean;
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  onPlayerModeChange: (mode: 'ROCKET' | 'ASTRONAUT' | 'ROVER') => void;
  onUpdateHUD: (data: {
    astronautPos: THREE.Vector3;
    roverPos: THREE.Vector3;
    canEnterRover: boolean;
    canEnterRocket: boolean;
    roverSpeed: number;
  }) => void;
  astronautPosRef: React.MutableRefObject<THREE.Vector3>;
  roverPosRef: React.MutableRefObject<THREE.Vector3>;
  keysRef: React.MutableRefObject<{ [key: string]: boolean }>;
  rocketOnMoon?: boolean;
}

export const MoonExploration: React.FC<MoonExplorationProps> = ({
  isLanded,
  playerMode,
  onUpdateHUD,
  astronautPosRef,
  roverPosRef,
  keysRef,
  rocketOnMoon = true,
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

  const lunarTerrainGeom = useMemo(() => {
    const geom = new THREE.PlaneGeometry(640, 640, 80, 80);
    const pos = geom.attributes.position;
    const r = MOON_RADIUS;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i);
      const dSq = vx * vx + vy * vy;
      if (dSq <= 676) { pos.setZ(i, 0.25); continue; }
      if (dSq < r * r) {
        const d = Math.sqrt(dSq);
        const noise = d < 300 ? (Math.sin(vx * 0.035) * 1.6 + Math.cos(-vy * 0.035) * 1.6 + Math.sin((vx - vy) * 0.07) * 0.9) * THREE.MathUtils.clamp((d - 26) / 20, 0, 1) : 0;
        pos.setZ(i, Math.sqrt(r * r - dSq) - r + 0.25 + noise);
      } else {
        pos.setZ(i, -r);
      }
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  const boulders = useMemo(() => Array.from({ length: 42 }).map((_, i) => {
    const ang = (i / 42) * Math.PI * 2 + (i % 5) * 0.4;
    const dist = 32 + (i * 19) % 210;
    const bx = MOON_LANDING_SITE.x + Math.cos(ang) * dist;
    const bz = MOON_LANDING_SITE.z + Math.sin(ang) * dist;
    return {
      pos: [bx, getMoonSurfaceElevation(bx, bz) + 0.3, bz] as [number, number, number],
      scale: [1 + (i % 3) * 0.6, 0.8 + (i % 2) * 0.5, 1 + ((i + 1) % 3) * 0.6] as [number, number, number],
      rot: [i * 0.7, i * 1.1, i * 0.4] as [number, number, number],
    };
  }), []);

  useFrame((_, delta) => {
    if (!isLanded) return;
    const keys = keysRef.current;
    const astroPos = astronautPosRef.current;
    const rovPos = roverPosRef.current;

    const canEnterRover = playerMode === 'ASTRONAUT' && astroPos.distanceTo(rovPos) < 4.8;
    const canEnterRocket = playerMode === 'ASTRONAUT' && astroPos.distanceTo(MOON_LANDING_SITE) < 5.5;

    // A. Astronaut EVA
    if (playerMode === 'ASTRONAUT') {
      let forwardDir = 0;
      if (keys['KeyW'] || keys['ArrowUp']) forwardDir += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forwardDir -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) astronautRotY.current += 2.8 * delta;
      if (keys['KeyD'] || keys['ArrowRight']) astronautRotY.current -= 2.8 * delta;

      astronautQuat.current.slerp(getMoonSurfaceQuat(astroPos.x, astroPos.z, astronautRotY.current), delta * 12);
      if (forwardDir !== 0) {
        astroPos.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(astronautQuat.current), forwardDir * 5.2 * delta);
      }

      const surfaceY = getMoonSurfaceElevation(astroPos.x, astroPos.z);
      if (keys['Space'] && !isJumping.current && astroPos.y <= surfaceY + 0.15) {
        astronautVelY.current = 4.2;
        isJumping.current = true;
      }
      if (isJumping.current || astroPos.y > surfaceY) {
        astronautVelY.current -= 5.67 * delta; // 1.62 * 3.5
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

    // B. Lunar Rover
    if (playerMode === 'ROVER') {
      const maxSpeed = 16.0;
      if (keys['KeyA'] || keys['ArrowLeft']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0.45, delta * 8);
        roverRotY.current += 1.8 * (roverSpeed.current / maxSpeed) * delta;
      } else if (keys['KeyD'] || keys['ArrowRight']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, -0.45, delta * 8);
        roverRotY.current -= 1.8 * (roverSpeed.current / maxSpeed) * delta;
      } else {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0, delta * 8);
      }

      if (keys['KeyW'] || keys['ArrowUp']) roverSpeed.current = Math.min(maxSpeed, roverSpeed.current + 9.0 * delta);
      else if (keys['KeyS'] || keys['ArrowDown']) roverSpeed.current = Math.max(-6.0, roverSpeed.current - 13.5 * delta);
      else roverSpeed.current = THREE.MathUtils.lerp(roverSpeed.current, 0, delta * 1.8);

      roverQuat.current.slerp(getMoonSurfaceQuat(rovPos.x, rovPos.z, roverRotY.current), delta * 12);
      rovPos.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(roverQuat.current), roverSpeed.current * delta);
      rovPos.y = getMoonSurfaceElevation(rovPos.x, rovPos.z);
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
      });
    }
  });

  return (
    <group>
      <group position={[MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y - 0.2, MOON_LANDING_SITE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={lunarTerrainGeom} receiveShadow>
          <meshStandardMaterial color="#565961" roughness={0.92} metalness={0.06} />
        </mesh>
      </group>

      {boulders.map((b, i) => (
        <mesh key={i} position={b.pos} scale={b.scale} rotation={b.rot} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3f4247" roughness={0.96} metalness={0.05} />
        </mesh>
      ))}

      {rocketOnMoon && (
        <group position={[MOON_LANDING_SITE.x + 2.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.2]} rotation={[0, -0.6, 0]}>
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

      <Astronaut
        position={astronautPosRef.current}
        rotationY={astronautRotY.current}
        quaternion={astronautQuat.current}
        isMoving={isMoving.current}
        isJumping={isJumping.current}
        visible={playerMode === 'ASTRONAUT'}
      />
      <LunarRover
        position={roverPosRef.current}
        rotationY={roverRotY.current}
        quaternion={roverQuat.current}
        steerAngle={roverSteerAngle.current}
        wheelSpin={roverWheelSpin.current}
        isDriven={playerMode === 'ROVER'}
      />
    </group>
  );
};
