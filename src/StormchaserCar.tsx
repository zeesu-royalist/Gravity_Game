import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.preload('/models/lynx_stormchaser_ex2.glb');

export const StormchaserCar: React.FC<{
  position: THREE.Vector3;
  rotationY: number;
  quaternion?: THREE.Quaternion;
}> = ({ position, rotationY, quaternion }) => {
  const { scene } = useGLTF('/models/lynx_stormchaser_ex2.glb');
  const ref = useRef<THREE.Group>(null);

  const carScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = true;
      }
    });
    return clone;
  }, [scene]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(position);
    if (quaternion) ref.current.quaternion.copy(quaternion);
    else ref.current.rotation.set(0, rotationY, 0);
  });

  return (
    <group ref={ref}>
      <primitive object={carScene} scale={108} />
    </group>
  );
};
