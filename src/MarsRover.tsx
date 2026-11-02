import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.preload('/models/moon_rover.glb');

export interface MarsRoverProps {
  position: THREE.Vector3;
  rotationY: number;
  quaternion?: THREE.Quaternion;
  isDriven?: boolean;
}

export const MarsRover: React.FC<MarsRoverProps> = ({
  position,
  rotationY,
  quaternion,
  isDriven = false,
}) => {
  const { scene } = useGLTF('/models/moon_rover.glb');
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Clone scene once & optimize meshes to prevent GPU thrashing / laptop lag
  const roverScene = useMemo(() => {
    const cloned = scene.clone();
    // Center length along X (-2.97) and align bottom of wheels to ground level (+2.5325)
    cloned.position.set(-2.97, 2.5325, 0);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return cloned;
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(position);
    if (quaternion) groupRef.current.quaternion.copy(quaternion);
    else groupRef.current.rotation.set(0, rotationY, 0);

    if (lightRef.current) {
      lightRef.current.intensity = isDriven ? 2.8 : 0.8;
    }
  });

  return (
    <group ref={groupRef}>
      {/* -Math.PI / 2 rotates original +X forward orientation to align with game +Z forward driving vector */}
      <group rotation={[0, -Math.PI / 2, 0]} scale={0.24}>
        <primitive object={roverScene} />
      </group>

      {/* Martian Rover Headlight Beam */}
      <pointLight
        ref={lightRef}
        position={[0, 1.2, 2.6]}
        color="#fed7aa"
        distance={28}
        decay={2}
        intensity={0.8}
      />
    </group>
  );
};

