import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AstronautProps {
  position: THREE.Vector3;
  rotationY: number;
  isMoving: boolean;
  isJumping: boolean;
  visible: boolean;
}

export const Astronaut: React.FC<AstronautProps> = ({
  position,
  rotationY,
  isMoving,
  isJumping,
  visible,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  // Walking and lunar hop animation
  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(position);
    groupRef.current.rotation.y = rotationY;

    const time = state.clock.getElapsedTime() * 8;

    if (isMoving && !isJumping) {
      // Natural walking swing
      const swing = Math.sin(time) * 0.45;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
    } else if (isJumping) {
      // Low-gravity lunar hop posture
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.35;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0.2;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.4;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.4;
    } else {
      // Idle standing
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} scale={[0.9, 0.9, 0.9]}>
      {/* 1. Torso & Thermal Micrometeoroid Spacesuit */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.55, 8, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.65} metalness={0.1} />
      </mesh>

      {/* Chest Remote Control Unit (RCU) Box */}
      <mesh position={[0, 1.35, 0.32]} castShadow>
        <boxGeometry args={[0.26, 0.24, 0.12]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      {/* Chest RCU Controls & Mission Patch */}
      <mesh position={[-0.06, 1.38, 0.39]}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
      <mesh position={[0.06, 1.38, 0.39]}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* 2. Extravehicular Helmet & Gold Reflective Visor */}
      <group position={[0, 1.78, 0]}>
        {/* White Pressure Helmet Shell */}
        <mesh castShadow>
          <sphereGeometry args={[0.28, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} />
        </mesh>
        {/* Curved Golden Polarized Visor (Reflects Moon & Space) */}
        <mesh position={[0, 0.02, 0.16]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial
            color="#fbbf24"
            roughness={0.08}
            metalness={0.96}
            emissive="#d97706"
            emissiveIntensity={0.15}
          />
        </mesh>
        {/* Helmet Sunshade Cap */}
        <mesh position={[0, 0.18, 0.08]}>
          <boxGeometry args={[0.34, 0.08, 0.28]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
        </mesh>
      </group>

      {/* 3. Portable Life Support System (PLSS Backpack) */}
      <group position={[0, 1.32, -0.34]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.68, 0.26]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Oxygen Purge Tank */}
        <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.36, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} />
        </mesh>
        {/* Emergency VHF Antenna */}
        <mesh position={[0.15, 0.55, -0.05]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>

      {/* 4. Left Arm & Glove */}
      <group position={[-0.42, 1.45, 0]} ref={leftArmRef}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.38, 8, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        {/* Blue Glove Cuff */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.06, 12]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        {/* Grey Silicone Palm Glove */}
        <mesh position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>
      </group>

      {/* 5. Right Arm & Glove */}
      <group position={[0.42, 1.45, 0]} ref={rightArmRef}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.38, 8, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        {/* Blue Glove Cuff */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.06, 12]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        {/* Grey Silicone Palm Glove */}
        <mesh position={[0, -0.58, 0]} castShadow>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>
      </group>

      {/* 6. Left Leg & Lunar Overshoe Boot */}
      <group position={[-0.18, 0.82, 0]} ref={leftLegRef}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.48, 8, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        {/* Lunar Boot with Ridged Sole */}
        <mesh position={[0, -0.74, 0.08]} castShadow>
          <boxGeometry args={[0.22, 0.16, 0.38]} />
          <meshStandardMaterial color="#475569" roughness={0.9} />
        </mesh>
      </group>

      {/* 7. Right Leg & Lunar Overshoe Boot */}
      <group position={[0.18, 0.82, 0]} ref={rightLegRef}>
        <mesh position={[0, -0.38, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.48, 8, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        {/* Lunar Boot with Ridged Sole */}
        <mesh position={[0, -0.74, 0.08]} castShadow>
          <boxGeometry args={[0.22, 0.16, 0.38]} />
          <meshStandardMaterial color="#475569" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
};

