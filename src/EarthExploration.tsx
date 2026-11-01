import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Astronaut } from './Astronaut';
import { LunarRover } from './LunarRover';
import { getCurvedEarthY } from './RealisticLandscape';
import { CosmodromeScientists } from './Scientists';

// Placed further back behind the rocket on the launch apron
export const EARTH_CAR_DEFAULT_POS = new THREE.Vector3(0, 0.35, -24.0);
export const EARTH_ASTRONAUT_DEFAULT_POS = new THREE.Vector3(0, 0.26, -6.0);



export function getEarthSurfaceElevation(x: number, z: number): number {
  return Math.hypot(x, z) <= 38 ? 0.26 : getCurvedEarthY(x, z) + 0.25;
}

export function getEarthSurfaceQuat(x: number, z: number, headingAngle: number): THREE.Quaternion {
  const normal = new THREE.Vector3(x, getEarthSurfaceElevation(x, z) + 1799.75, z).normalize();
  const flatForward = new THREE.Vector3(Math.sin(headingAngle), 0, Math.cos(headingAngle));
  const tangentForward = flatForward.sub(normal.clone().multiplyScalar(flatForward.dot(normal))).normalize();
  const tangentRight = new THREE.Vector3().crossVectors(normal, tangentForward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangentRight, normal, tangentForward));
}

interface EarthExplorationProps {
  isActive: boolean;
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
  carPosRef: React.MutableRefObject<THREE.Vector3>;
  keysRef: React.MutableRefObject<{ [key: string]: boolean }>;
  rocketPos: THREE.Vector3;
}

export const EarthExploration: React.FC<EarthExplorationProps> = ({
  isActive,
  playerMode,
  onUpdateHUD,
  astronautPosRef,
  carPosRef,
  keysRef,
  rocketPos,
}) => {
  const astronautRotY = useRef(0);
  const astronautQuat = useRef(new THREE.Quaternion());
  const astronautVelY = useRef(0);
  const isJumping = useRef(false);
  const isMoving = useRef(false);

  const carRotY = useRef(0.55);
  const carQuat = useRef(new THREE.Quaternion());
  const carSpeed = useRef(0);
  const carSteerAngle = useRef(0);
  const carWheelSpin = useRef(0);

  useFrame((_, delta) => {
    if (!isActive) return;
    const keys = keysRef.current;
    const astroPos = astronautPosRef.current;
    const carPos = carPosRef.current;

    const canEnterCar = playerMode === 'ASTRONAUT' && astroPos.distanceTo(carPos) < 4.8;
    const canEnterRocket = playerMode === 'ASTRONAUT' && Math.hypot(astroPos.x - rocketPos.x, astroPos.z - rocketPos.z) < 5.8;

    // A. Astronaut Roaming
    if (playerMode === 'ASTRONAUT') {
      let forwardDir = 0;
      if (keys['KeyW'] || keys['ArrowUp']) forwardDir += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forwardDir -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) astronautRotY.current += 2.8 * delta;
      if (keys['KeyD'] || keys['ArrowRight']) astronautRotY.current -= 2.8 * delta;

      astronautQuat.current.slerp(getEarthSurfaceQuat(astroPos.x, astroPos.z, astronautRotY.current), delta * 12);
      if (forwardDir !== 0) {
        const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(astronautQuat.current);
        astroPos.addScaledVector(facing, forwardDir * 5.6 * delta);
      }

      const surfaceY = getEarthSurfaceElevation(astroPos.x, astroPos.z);
      if (keys['Space'] && !isJumping.current && astroPos.y <= surfaceY + 0.15) {
        astronautVelY.current = 4.8;
        isJumping.current = true;
      }
      if (isJumping.current || astroPos.y > surfaceY) {
        astronautVelY.current -= 17.6 * delta;
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

    // B. Car Driving
    if (playerMode === 'ROVER') {
      const maxSpeed = 22.0;
      if (keys['KeyA'] || keys['ArrowLeft']) {
        carSteerAngle.current = THREE.MathUtils.lerp(carSteerAngle.current, 0.45, delta * 8);
        carRotY.current += 2.0 * (carSpeed.current / maxSpeed) * delta;
      } else if (keys['KeyD'] || keys['ArrowRight']) {
        carSteerAngle.current = THREE.MathUtils.lerp(carSteerAngle.current, -0.45, delta * 8);
        carRotY.current -= 2.0 * (carSpeed.current / maxSpeed) * delta;
      } else {
        carSteerAngle.current = THREE.MathUtils.lerp(carSteerAngle.current, 0, delta * 8);
      }

      if (keys['KeyW'] || keys['ArrowUp']) carSpeed.current = Math.min(maxSpeed, carSpeed.current + 12.0 * delta);
      else if (keys['KeyS'] || keys['ArrowDown']) carSpeed.current = Math.max(-8.0, carSpeed.current - 19.2 * delta);
      else carSpeed.current = THREE.MathUtils.lerp(carSpeed.current, 0, delta * 2.2);

      carQuat.current.slerp(getEarthSurfaceQuat(carPos.x, carPos.z, carRotY.current), delta * 12);
      carPos.addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat.current), carSpeed.current * delta);
      carPos.y = getEarthSurfaceElevation(carPos.x, carPos.z);
      carWheelSpin.current += (carSpeed.current / 0.42) * delta;

      astroPos.copy(carPos).add(new THREE.Vector3(0, 0.35, 0));
      astronautRotY.current = carRotY.current;
      astronautQuat.current.copy(carQuat.current);
    }

    onUpdateHUD({
      astronautPos: astroPos.clone(),
      roverPos: carPos.clone(),
      canEnterRover: canEnterCar,
      canEnterRocket,
      roverSpeed: Math.round(Math.abs(carSpeed.current) * 3.6),
    });
  });

  return (
    <group>
      <CosmodromeScientists astronautPosRef={astronautPosRef} />
      {(playerMode === 'ASTRONAUT' || playerMode === 'ROVER') && (
        <Astronaut
          position={astronautPosRef.current}
          rotationY={astronautRotY.current}
          quaternion={astronautQuat.current}
          isMoving={isMoving.current}
          isJumping={isJumping.current}
          visible={true}
        />
      )}
      <LunarRover
        position={carPosRef.current}
        rotationY={carRotY.current}
        quaternion={carQuat.current}
        steerAngle={carSteerAngle.current}
        wheelSpin={carWheelSpin.current}
        isDriven={playerMode === 'ROVER'}
        theme="EARTH"
      />
    </group>
  );
};
