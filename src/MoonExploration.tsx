import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Astronaut } from './Astronaut';
import { LunarRover } from './LunarRover';
import { MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';

export const MOON_TOUCHDOWN_Y = MOON_POSITION.y + MOON_RADIUS + 0.2;
export const MOON_LANDING_SITE = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y, MOON_POSITION.z);

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
  onPlayerModeChange,
  onUpdateHUD,
  astronautPosRef,
  roverPosRef,
  keysRef,
  rocketOnMoon = true,
}) => {
  // Astronaut state
  const astronautRotY = useRef(0);
  const astronautVelY = useRef(0);
  const isJumping = useRef(false);
  const isMoving = useRef(false);

  // Rover state
  const roverRotY = useRef(0.4);
  const roverSpeed = useRef(0);
  const roverSteerAngle = useRef(0);
  const roverWheelSpin = useRef(0);

  // 1. Expansive Cratered Lunar Terrain Mesh (500m radius surrounding landing site)
  const lunarTerrainGeom = useMemo(() => {
    const segments = 90;
    const geom = new THREE.PlaneGeometry(650, 650, segments, segments);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const dist = Math.hypot(vx, vy);

      // Keep landing pad area completely flat
      if (dist < 28) {
        pos.setZ(i, 0);
        continue;
      }

      // Rolling craters and ridges
      const craterNoise =
        Math.sin(vx * 0.03) * 3.8 +
        Math.cos(vy * 0.03) * 3.8 +
        Math.sin((vx + vy) * 0.06) * 2.2 +
        Math.cos((vx - vy) * 0.015) * 6.5;

      // Natural drop-off conforming to Moon sphere curvature
      const curvatureDrop = -(dist * dist) / (2 * MOON_RADIUS);

      pos.setZ(i, craterNoise + curvatureDrop);
    }

    geom.computeVertexNormals();
    return geom;
  }, []);

  // 2. 45+ Random Lunar Boulders and Rock Clusters
  const boulders = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 240;
      const bx = MOON_LANDING_SITE.x + Math.cos(angle) * dist;
      const bz = MOON_LANDING_SITE.z + Math.sin(angle) * dist;
      const by = MOON_TOUCHDOWN_Y - (dist * dist) / (2 * MOON_RADIUS) + 0.4;

      list.push({
        pos: [bx, by, bz],
        scale: [
          0.8 + Math.random() * 2.2,
          0.6 + Math.random() * 1.6,
          0.8 + Math.random() * 2.2,
        ],
        rot: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      });
    }
    return list;
  }, []);

  // Frame physics loop for Astronaut & Rover
  useFrame((_, delta) => {
    if (!isLanded) return;

    const keys = keysRef.current;
    const astroPos = astronautPosRef.current;
    const rovPos = roverPosRef.current;

    // Proximity checks
    const distToRover = astroPos.distanceTo(rovPos);
    const distToRocket = astroPos.distanceTo(MOON_LANDING_SITE);
    const canEnterRover = playerMode === 'ASTRONAUT' && distToRover < 4.8;
    const canEnterRocket = playerMode === 'ASTRONAUT' && distToRocket < 5.5;

    // -------------------------------------------------------------
    // A. ASTRONAUT FREE ROAMING ON MOON (Low Lunar Gravity Physics)
    // -------------------------------------------------------------
    if (playerMode === 'ASTRONAUT') {
      const walkSpeed = 5.2; // m/s
      let moving = false;

      // Calculate move vector based on camera/player orientation
      const moveVec = new THREE.Vector3(0, 0, 0);

      if (keys['KeyW'] || keys['ArrowUp']) {
        moveVec.z -= 1;
        moving = true;
      }
      if (keys['KeyS'] || keys['ArrowDown']) {
        moveVec.z += 1;
        moving = true;
      }
      if (keys['KeyA'] || keys['ArrowLeft']) {
        moveVec.x -= 1;
        astronautRotY.current += 2.4 * delta;
        moving = true;
      }
      if (keys['KeyD'] || keys['ArrowRight']) {
        moveVec.x += 1;
        astronautRotY.current -= 2.4 * delta;
        moving = true;
      }

      if (moveVec.lengthSq() > 0) {
        moveVec.normalize();
        // Move in facing direction
        const facing = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), astronautRotY.current);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), astronautRotY.current);

        astroPos.addScaledVector(facing, -moveVec.z * walkSpeed * delta);
        astroPos.addScaledVector(right, moveVec.x * walkSpeed * delta);
      }

      // Low Lunar Gravity Jump (1.62 m/s^2)
      const MOON_SURFACE_Y = MOON_TOUCHDOWN_Y;
      if (keys['Space'] && !isJumping.current && astroPos.y <= MOON_SURFACE_Y + 0.1) {
        astronautVelY.current = 4.2; // Lunar hop impulse
        isJumping.current = true;
      }

      if (isJumping.current || astroPos.y > MOON_SURFACE_Y) {
        astronautVelY.current -= 1.62 * 3.5 * delta; // Low moon gravity
        astroPos.y += astronautVelY.current * delta;

        if (astroPos.y <= MOON_SURFACE_Y) {
          astroPos.y = MOON_SURFACE_Y;
          astronautVelY.current = 0;
          isJumping.current = false;
        }
      }

      isMoving.current = moving;
    }

    // -------------------------------------------------------------
    // B. LUNAR ROVER DRIVING PHYSICS
    // -------------------------------------------------------------
    if (playerMode === 'ROVER') {
      const maxSpeed = 16.0; // m/s (~58 km/h)
      const accel = 9.0;
      const steerSpeed = 1.8;

      // Steering
      if (keys['KeyA'] || keys['ArrowLeft']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0.45, delta * 8);
        roverRotY.current += steerSpeed * (roverSpeed.current / maxSpeed) * delta;
      } else if (keys['KeyD'] || keys['ArrowRight']) {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, -0.45, delta * 8);
        roverRotY.current -= steerSpeed * (roverSpeed.current / maxSpeed) * delta;
      } else {
        roverSteerAngle.current = THREE.MathUtils.lerp(roverSteerAngle.current, 0, delta * 8);
      }

      // Acceleration / Reverse
      if (keys['KeyW'] || keys['ArrowUp']) {
        roverSpeed.current = Math.min(maxSpeed, roverSpeed.current + accel * delta);
      } else if (keys['KeyS'] || keys['ArrowDown']) {
        roverSpeed.current = Math.max(-6.0, roverSpeed.current - accel * 1.5 * delta);
      } else {
        // Rolling resistance / drag
        roverSpeed.current = THREE.MathUtils.lerp(roverSpeed.current, 0, delta * 1.8);
      }

      // Move Rover
      const rovForward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), roverRotY.current);
      rovPos.addScaledVector(rovForward, roverSpeed.current * delta);

      // Keep rover on Moon surface
      rovPos.y = MOON_TOUCHDOWN_Y;

      // Spin wheels
      roverWheelSpin.current += (roverSpeed.current / 0.42) * delta;

      // Astronaut moves with rover
      astroPos.copy(rovPos);
    }

    onUpdateHUD({
      astronautPos: astroPos.clone(),
      roverPos: rovPos.clone(),
      canEnterRover,
      canEnterRocket,
      roverSpeed: Math.round(Math.abs(roverSpeed.current) * 3.6),
    });
  });

  return (
    <group>
      {/* 1. Expansive Lunar Terrain Sheet surrounding landing site */}
      <group position={[MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y - 0.2, MOON_LANDING_SITE.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={lunarTerrainGeom} receiveShadow>
          <meshStandardMaterial
            color="#565961"
            roughness={0.92}
            metalness={0.06}
          />
        </mesh>
      </group>

      {/* 2. Lunar Rocks & Boulders scattered across terrain */}
      {boulders.map((b, idx) => (
        <mesh
          key={idx}
          position={b.pos}
          scale={b.scale}
          rotation={b.rot}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3f4247" roughness={0.96} metalness={0.05} />
        </mesh>
      ))}

      {/* 3. Rocket Access Ladder deployed to Moon ground (only when rocket is on Moon) */}
      {rocketOnMoon && (
        <group position={[MOON_LANDING_SITE.x + 2.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.2]} rotation={[0, -0.6, 0]}>
          {/* Vertical Rails */}
          {[-0.35, 0.35].map((rx) => (
            <mesh key={rx} position={[rx, 6, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
            </mesh>
          ))}
          {/* Rungs */}
          {Array.from({ length: 18 }).map((_, rIdx) => (
            <mesh key={rIdx} position={[0, rIdx * 0.65 + 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Apollo EVA Spacesuit Astronaut */}
      <Astronaut
        position={astronautPosRef.current}
        rotationY={astronautRotY.current}
        isMoving={isMoving.current}
        isJumping={isJumping.current}
        visible={playerMode === 'ASTRONAUT'}
      />

      {/* 5. Lunar Roving Vehicle (LRV) */}
      <LunarRover
        position={roverPosRef.current}
        rotationY={roverRotY.current}
        steerAngle={roverSteerAngle.current}
        wheelSpin={roverWheelSpin.current}
        isDriven={playerMode === 'ROVER'}
      />
    </group>
  );
};

