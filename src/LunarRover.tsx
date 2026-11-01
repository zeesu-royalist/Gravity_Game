import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LunarRoverProps {
  position: THREE.Vector3;
  rotationY: number;
  quaternion?: THREE.Quaternion;
  steerAngle: number;
  wheelSpin: number;
  isDriven: boolean;
  headlightsOn?: boolean;
}

export const LunarRover: React.FC<LunarRoverProps> = ({
  position,
  rotationY,
  quaternion,
  steerAngle,
  wheelSpin,
  isDriven,
  headlightsOn = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const frontLeftWheelRef = useRef<THREE.Group>(null);
  const frontRightWheelRef = useRef<THREE.Group>(null);
  const rearLeftWheelRef = useRef<THREE.Group>(null);
  const rearRightWheelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.copy(position);
    if (quaternion) {
      groupRef.current.quaternion.copy(quaternion);
    } else {
      groupRef.current.rotation.set(0, rotationY, 0);
    }

    // Front wheel steering
    if (frontLeftWheelRef.current) frontLeftWheelRef.current.rotation.y = steerAngle;
    if (frontRightWheelRef.current) frontRightWheelRef.current.rotation.y = steerAngle;

    // Wheel spin rotation
    if (frontLeftWheelRef.current) frontLeftWheelRef.current.children[0].rotation.x = wheelSpin;
    if (frontRightWheelRef.current) frontRightWheelRef.current.children[0].rotation.x = wheelSpin;
    if (rearLeftWheelRef.current) rearLeftWheelRef.current.children[0].rotation.x = wheelSpin;
    if (rearRightWheelRef.current) rearRightWheelRef.current.children[0].rotation.x = wheelSpin;
  });

  return (
    <group ref={groupRef} scale={[1.1, 1.1, 1.1]}>
      {/* ================= 1. CHASSIS & MAIN BODY ================= */}
      {/* Aluminum / Titanium Chassis Frame */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.22, 3.1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Gold Thermal Foil Underbelly Blanket */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.65, 0.08, 2.95]} />
        <meshStandardMaterial color="#d97706" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Tubular Steel Roll Cage & Seat Support */}
      <group position={[0, 1.0, 0]}>
        {/* Left Roll Bar */}
        <mesh position={[-0.75, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        {/* Right Roll Bar */}
        <mesh position={[0.75, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        {/* Overhead Crossbar */}
        <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 1.5]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
      </group>

      {/* Dual Astronaut Bucket Seats */}
      {[-0.38, 0.38].map((sx, idx) => (
        <group key={idx} position={[sx, 0.72, -0.15]}>
          {/* Seat Cushion */}
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.12, 0.65]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
          {/* Seat Backrest */}
          <mesh position={[0, 0.35, -0.28]} rotation={[0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.52, 0.65, 0.1]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Center Console & T-Handle Hand Controller */}
      <group position={[0, 0.85, 0.25]}>
        <mesh>
          <boxGeometry args={[0.18, 0.45, 0.28]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
        {/* T-Stick */}
        <mesh position={[0, 0.3, 0]} rotation={[-0.3, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.32]} />
          <meshStandardMaterial color="#eab308" metalness={0.8} />
        </mesh>
      </group>

      {/* ================= 2. 4 WIRE-MESH LUNAR WHEELS ================= */}
      {/* Front Left Wheel */}
      <group position={[-1.05, 0.45, 1.15]} ref={frontLeftWheelRef}>
        <group>
          {/* Mesh Tire Outer Ring */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 18]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.7} />
          </mesh>
          {/* Hub Motor */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.34, 12]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Front Right Wheel */}
      <group position={[1.05, 0.45, 1.15]} ref={frontRightWheelRef}>
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 18]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.34, 12]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Rear Left Wheel */}
      <group position={[-1.05, 0.45, -1.15]} ref={rearLeftWheelRef}>
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 18]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.34, 12]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Rear Right Wheel */}
      <group position={[1.05, 0.45, -1.15]} ref={rearRightWheelRef}>
        <group>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 18]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} metalness={0.7} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.34, 12]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ================= 3. SCIENTIFIC EQUIPMENT & DISH ANTENNA ================= */}
      {/* High-Gain Parabolic Umbrella Dish Antenna on Front Bumper */}
      <group position={[0.45, 1.25, 1.45]} rotation={[-0.3, 0.2, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.55, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} roughness={0.3} metalness={0.5} />
        </mesh>
      </group>

      {/* 70mm Lunar Television Camera on Front Bumper */}
      <group position={[-0.45, 0.85, 1.45]}>
        <mesh>
          <boxGeometry args={[0.22, 0.22, 0.35]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.6} />
        </mesh>
        {/* Lens */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.12, 12]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
        </mesh>
      </group>

      {/* Rear Equipment Pallet with Lunar Sample Boxes */}
      <group position={[0, 0.75, -1.1]}>
        {/* Sample Rock Boxes */}
        <mesh position={[-0.4, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.32, 0.45]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} />
        </mesh>
        <mesh position={[0.35, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.28, 0.45]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} />
        </mesh>
      </group>

      {/* ================= 4. DUAL HEADLIGHTS ILLUMINATING TERRAIN ================= */}
      {[-0.6, 0.6].map((lx, idx) => (
        <group key={idx} position={[lx, 0.65, 1.55]}>
          {/* Light Housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.12, 0.14, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          {/* Glowing Lens */}
          <mesh position={[0, 0, 0.07]}>
            <circleGeometry args={[0.08, 12]} />
            <meshBasicMaterial color="#fffbe8" />
          </mesh>
          {/* SpotLight projecting forward */}
          {headlightsOn && (
            <spotLight
              position={[0, 0, 0.1]}
              target-position={[lx, 0, 25]}
              color="#fffbe8"
              intensity={45}
              distance={85}
              angle={0.55}
              penumbra={0.4}
              castShadow
            />
          )}
        </group>
      ))}

      {/* ================= 5. ASTRONAUT SITTING IN ROVER (WHEN DRIVEN) ================= */}
      {isDriven && (
        <group position={[-0.38, 0.88, -0.15]}>
          {/* Body */}
          <mesh position={[0, 0.35, 0]}>
            <capsuleGeometry args={[0.26, 0.42, 6, 10]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          {/* Helmet & Visor */}
          <mesh position={[0, 0.72, 0.05]}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.74, 0.18]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
          </mesh>
          {/* Backpack */}
          <mesh position={[0, 0.38, -0.28]}>
            <boxGeometry args={[0.34, 0.52, 0.22]} />
            <meshStandardMaterial color="#e2e8f0" />
          </mesh>
        </group>
      )}
    </group>
  );
};
