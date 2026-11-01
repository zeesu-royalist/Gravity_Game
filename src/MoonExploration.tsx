import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Astronaut } from './Astronaut';
import { LunarRover } from './LunarRover';
import { MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';

export const MOON_TOUCHDOWN_Y = MOON_POSITION.y + MOON_RADIUS + 0.2;
export const MOON_LANDING_SITE = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y, MOON_POSITION.z);

// Calculate exact Moon surface elevation conforming to the spherical Moon body
function getMoonSurfaceElevation(x: number, z: number): number {
  const dx = x - MOON_POSITION.x;
  const dz = z - MOON_POSITION.z;
  const distSq = dx * dx + dz * dz;
  const r = MOON_RADIUS;

  // Flat landing pad blast apron zone (radius 26m)
  if (distSq <= 26 * 26) {
    return MOON_TOUCHDOWN_Y;
  }

  // True spherical Moon elevation
  if (distSq < r * r) {
    const sphereY = MOON_POSITION.y + Math.sqrt(r * r - distSq);
    const dist = Math.sqrt(distSq);
    let terrainNoise = 0;
    if (dist < 310) {
      terrainNoise =
        Math.sin(dx * 0.035) * 1.6 +
        Math.cos(dz * 0.035) * 1.6 +
        Math.sin((dx + dz) * 0.07) * 0.9;
      const blend = THREE.MathUtils.clamp((dist - 26) / 20, 0, 1);
      terrainNoise *= blend;
    }
    return sphereY + 0.25 + terrainNoise;
  }

  return MOON_POSITION.y;
}

// Compute surface orientation quaternion (Pitch, Roll & Yaw) conforming to spherical Moon
function getMoonSurfaceQuat(x: number, z: number, headingAngle: number): THREE.Quaternion {
  const y = getMoonSurfaceElevation(x, z);
  const normal = new THREE.Vector3(
    x - MOON_POSITION.x,
    y - MOON_POSITION.y,
    z - MOON_POSITION.z
  ).normalize();

  const flatForward = new THREE.Vector3(Math.sin(headingAngle), 0, Math.cos(headingAngle));
  const tangentForward = flatForward.sub(normal.clone().multiplyScalar(flatForward.dot(normal))).normalize();
  const tangentRight = new THREE.Vector3().crossVectors(normal, tangentForward).normalize();

  const mat = new THREE.Matrix4().makeBasis(tangentRight, normal, tangentForward);
  return new THREE.Quaternion().setFromRotationMatrix(mat);
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
  onPlayerModeChange,
  onUpdateHUD,
  astronautPosRef,
  roverPosRef,
  keysRef,
  rocketOnMoon = true,
}) => {
  // Astronaut state
  const astronautRotY = useRef(0);
  const astronautQuat = useRef(new THREE.Quaternion());
  const astronautVelY = useRef(0);
  const isJumping = useRef(false);
  const isMoving = useRef(false);

  // Rover state
  const roverRotY = useRef(0.4);
  const roverQuat = useRef(new THREE.Quaternion());
  const roverSpeed = useRef(0);
  const roverSteerAngle = useRef(0);
  const roverWheelSpin = useRef(0);

  // 1. Expansive Cratered Lunar Terrain Mesh conforming to Moon sphere curvature
  const lunarTerrainGeom = useMemo(() => {
    const segments = 100;
    const geom = new THREE.PlaneGeometry(640, 640, segments, segments);
    const pos = geom.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const distSq = vx * vx + vy * vy;
      const dist = Math.sqrt(distSq);

      if (dist <= 26) {
        pos.setZ(i, 0.25);
        continue;
      }

      const r = MOON_RADIUS;
      if (distSq < r * r) {
        const sphereDrop = Math.sqrt(r * r - distSq) - r;
        let noise = 0;
        if (dist < 300) {
          noise =
            Math.sin(vx * 0.035) * 1.6 +
            Math.cos(-vy * 0.035) * 1.6 +
            Math.sin((vx - vy) * 0.07) * 0.9;
          const blend = THREE.MathUtils.clamp((dist - 26) / 20, 0, 1);
          noise *= blend;
        }
        pos.setZ(i, sphereDrop + 0.25 + noise);
      } else {
        pos.setZ(i, -r);
      }
    }

    geom.computeVertexNormals();
    return geom;
  }, []);

  // 2. Random Lunar Boulders planted directly on curved spherical surface
  const boulders = useMemo(() => {
    const list: { pos: [number, number, number]; scale: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 32 + Math.random() * 240;
      const bx = MOON_LANDING_SITE.x + Math.cos(angle) * dist;
      const bz = MOON_LANDING_SITE.z + Math.sin(angle) * dist;
      const by = getMoonSurfaceElevation(bx, bz) + 0.3;

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
    // A. ASTRONAUT FREE ROAMING ON MOON (Conforming to Spherical Moon)
    // -------------------------------------------------------------
    if (playerMode === 'ASTRONAUT') {
      const walkSpeed = 5.2; // m/s
      let moving = false;
      let forwardDir = 0;

      // W / ▲ moves astronaut forward (visor/chest direction)
      if (keys['KeyW'] || keys['ArrowUp']) {
        forwardDir += 1;
        moving = true;
      }
      // S / ▼ moves astronaut backward
      if (keys['KeyS'] || keys['ArrowDown']) {
        forwardDir -= 1;
        moving = true;
      }
      // A / ◀ turns astronaut left
      if (keys['KeyA'] || keys['ArrowLeft']) {
        astronautRotY.current += 2.8 * delta;
      }
      // D / ▶ turns astronaut right
      if (keys['KeyD'] || keys['ArrowRight']) {
        astronautRotY.current -= 2.8 * delta;
      }

      // Smooth surface orientation matching Moon curve
      const targetQuat = getMoonSurfaceQuat(astroPos.x, astroPos.z, astronautRotY.current);
      astronautQuat.current.slerp(targetQuat, delta * 12);

      if (forwardDir !== 0) {
        const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(astronautQuat.current);
        astroPos.addScaledVector(facing, forwardDir * walkSpeed * delta);
      }

      // Elevation matching spherical Moon surface
      const surfaceY = getMoonSurfaceElevation(astroPos.x, astroPos.z);

      // Low Lunar Gravity Hop Jump (1.62 m/s^2)
      if (keys['Space'] && !isJumping.current && astroPos.y <= surfaceY + 0.15) {
        astronautVelY.current = 4.2;
        isJumping.current = true;
      }

      if (isJumping.current || astroPos.y > surfaceY) {
        astronautVelY.current -= 1.62 * 3.5 * delta;
        astroPos.y += astronautVelY.current * delta;

        if (astroPos.y <= surfaceY) {
          astroPos.y = surfaceY;
          astronautVelY.current = 0;
          isJumping.current = false;
        }
      } else {
        astroPos.y = surfaceY;
      }

      isMoving.current = moving;
    }

    // -------------------------------------------------------------
    // B. LUNAR ROVER DRIVING (Tightly Hugging Spherical Moon Surface)
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
        roverSpeed.current = THREE.MathUtils.lerp(roverSpeed.current, 0, delta * 1.8);
      }

      // Orientation matching Moon curvature (Pitch, Roll & Yaw)
      const targetQuat = getMoonSurfaceQuat(rovPos.x, rovPos.z, roverRotY.current);
      roverQuat.current.slerp(targetQuat, delta * 12);

      // Move Rover along surface tangent forward
      const rovForward = new THREE.Vector3(0, 0, 1).applyQuaternion(roverQuat.current);
      rovPos.addScaledVector(rovForward, roverSpeed.current * delta);

      // FIRMLY SNAP ROVER WHEELS TO MOON SURFACE ELEVATION
      rovPos.y = getMoonSurfaceElevation(rovPos.x, rovPos.z);

      // Spin wheels
      roverWheelSpin.current += (roverSpeed.current / 0.42) * delta;

      // Astronaut seated in rover
      astroPos.copy(rovPos);
      astroPos.y += 0.35;
      astronautRotY.current = roverRotY.current;
      astronautQuat.current.copy(roverQuat.current);
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
      {/* 1. Expansive Lunar Terrain Sheet conforming to Moon sphere curvature */}
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
        quaternion={astronautQuat.current}
        isMoving={isMoving.current}
        isJumping={isJumping.current}
        visible={playerMode === 'ASTRONAUT' || playerMode === 'ROVER'}
      />

      {/* 5. Lunar Roving Vehicle (LRV) */}
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
