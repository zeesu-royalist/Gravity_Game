import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_PATH = '/models/lunar_rover.glb';
useGLTF.preload(MODEL_PATH);

export interface LunarRoverProps {
  position: THREE.Vector3;
  rotationY: number;
  quaternion?: THREE.Quaternion;
  steerAngle?: number;
  wheelSpin?: number;
  isDriven?: boolean;
}

export const LunarRover: React.FC<LunarRoverProps> = ({
  position,
  rotationY,
  quaternion,
  isDriven = false,
}) => {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.SpotLight>(null);

  // Balanced PBR optimization so the rover details look clear and not pitch black
  const roverScene = useMemo(() => {
    const cloned = scene.clone();
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = true;
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) {
          // 1. Moderate color brightness lift
          mat.color.setRGB(1.22, 1.22, 1.22);
          // 2. Reduce metallic absorption so diffuse textures and details are clearly visible
          mat.metalness = 0.25;
          mat.roughness = 0.52;
          // 3. Subtle ambient lift to prevent deep pitch-black shadows
          mat.emissive = new THREE.Color('#22252a');
          mat.emissiveIntensity = 0.35;
        }
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
      lightRef.current.intensity = isDriven ? 3.0 : 1.0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Real-scale Apollo LRV: rotation [0, Math.PI, 0] points front to +Z driving vector */}
      <group rotation={[0, Math.PI, 0]} scale={1.05}>
        <primitive object={roverScene} />
      </group>

      {/* Gentle localized fill light to reveal rover body & cabin details */}
      <pointLight position={[0, 1.8, 0.2]} color="#f1f5f9" intensity={1.6} distance={10} decay={2} />

      {/* Lunar Rover Forward Spotlight Beam */}
      <spotLight
        ref={lightRef}
        position={[0, 0.9, 1.4]}
        target-position={[0, 0, 30]}
        color="#fffbf0"
        distance={50}
        angle={0.65}
        penumbra={0.4}
        intensity={1.0}
      />

      {/* Seated Astronaut Commander in Lunar Rover */}
      {isDriven && (
        <group position={[-0.32, 0.85, -0.05]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <capsuleGeometry args={[0.22, 0.36, 6, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.58, 0.04]} castShadow>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.6, 0.15]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.13, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0.3, -0.22]}>
            <boxGeometry args={[0.28, 0.42, 0.18]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
};
