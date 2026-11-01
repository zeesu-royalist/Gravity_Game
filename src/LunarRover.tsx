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
  theme?: 'MOON' | 'EARTH';
}

const WHEELS = [
  { id: 'fl', x: -1.05, z: 1.15, isFront: true },
  { id: 'fr', x: 1.05, z: 1.15, isFront: true },
  { id: 'rl', x: -1.05, z: -1.15, isFront: false },
  { id: 'rr', x: 1.05, z: -1.15, isFront: false },
];

export const LunarRover: React.FC<LunarRoverProps> = ({
  position,
  rotationY,
  quaternion,
  steerAngle,
  wheelSpin,
  isDriven,
  headlightsOn = true,
  theme = 'MOON',
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<{ [key: string]: THREE.Group | null }>({});
  const beaconRef = useRef<THREE.PointLight>(null);
  const isEarth = theme === 'EARTH';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(position);
    if (quaternion) groupRef.current.quaternion.copy(quaternion);
    else groupRef.current.rotation.set(0, rotationY, 0);

    // Dynamic wheel steering & spinning
    WHEELS.forEach(({ id, isFront }) => {
      const g = wheelRefs.current[id];
      if (g) {
        if (isFront) g.rotation.y = steerAngle;
        if (g.children[0]) g.children[0].rotation.x = wheelSpin;
      }
    });

    if (beaconRef.current && isEarth) {
      beaconRef.current.intensity = isDriven ? 1.5 + Math.sin(clock.elapsedTime * 12) * 1.5 : 0;
    }
  });

  return (
    <group ref={groupRef} scale={[1.1, 1.1, 1.1]}>
      {/* 1. Main Chassis & Trim */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.22, 3.1]} />
        <meshStandardMaterial color={isEarth ? '#f8fafc' : '#cbd5e1'} roughness={isEarth ? 0.2 : 0.4} metalness={isEarth ? 0.4 : 0.7} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[1.65, 0.08, 2.95]} />
        <meshStandardMaterial color={isEarth ? '#0284c7' : '#d97706'} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Earth Safety Strobe */}
      {isEarth && (
        <group position={[0, 1.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={isDriven ? 1.5 : 0.2} />
          </mesh>
          <pointLight ref={beaconRef} color="#f59e0b" intensity={0} distance={12} />
        </group>
      )}

      {/* 2. Roll Cage */}
      <group position={[0, 1.0, 0]}>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.1]} />
            <meshStandardMaterial color={isEarth ? '#38bdf8' : '#94a3b8'} metalness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 1.5]} />
          <meshStandardMaterial color={isEarth ? '#38bdf8' : '#94a3b8'} metalness={0.9} />
        </mesh>
      </group>

      {/* 3. Dual Bucket Seats & Console */}
      {[-0.38, 0.38].map((sx, idx) => (
        <group key={idx} position={[sx, 0.72, -0.15]}>
          <mesh castShadow><boxGeometry args={[0.55, 0.12, 0.65]} /><meshStandardMaterial color={isEarth ? '#1e293b' : '#475569'} roughness={0.8} /></mesh>
          <mesh position={[0, 0.35, -0.28]} rotation={[0.2, 0, 0]} castShadow><boxGeometry args={[0.52, 0.65, 0.1]} /><meshStandardMaterial color={isEarth ? '#1e293b' : '#475569'} roughness={0.8} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.85, 0.25]}><boxGeometry args={[0.18, 0.45, 0.28]} /><meshStandardMaterial color="#334155" metalness={0.5} /></mesh>
      <mesh position={[0, 1.15, 0.25]} rotation={[-0.3, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.32]} /><meshStandardMaterial color={isEarth ? '#38bdf8' : '#eab308'} metalness={0.8} /></mesh>

      {/* 4. Four Optimized Wheels */}
      {WHEELS.map((w) => (
        <group key={w.id} position={[w.x, 0.45, w.z]} ref={(el) => { wheelRefs.current[w.id] = el; }}>
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.42, 0.42, 0.3, 16]} />
              <meshStandardMaterial color={isEarth ? '#18181b' : '#64748b'} roughness={isEarth ? 0.9 : 0.5} metalness={isEarth ? 0.1 : 0.7} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, 0.34, 10]} />
              <meshStandardMaterial color={isEarth ? '#e2e8f0' : '#eab308'} metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      ))}

      {/* 5. Equipment & Antenna */}
      <group position={[0.45, 1.25, 1.45]} rotation={[-0.3, 0.2, 0]}>
        <mesh position={[0, -0.4, 0]}><cylinderGeometry args={[0.025, 0.03, 0.8]} /><meshStandardMaterial color="#94a3b8" metalness={0.8} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><sphereGeometry args={[0.55, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} /><meshStandardMaterial color="#f8fafc" side={THREE.DoubleSide} roughness={0.3} metalness={0.5} /></mesh>
      </group>
      <mesh position={[-0.45, 0.85, 1.45]}><boxGeometry args={[0.22, 0.22, 0.35]} /><meshStandardMaterial color="#ca8a04" metalness={0.6} /></mesh>
      <mesh position={[0, 0.75, -1.1]} castShadow><boxGeometry args={[1.0, 0.32, 0.45]} /><meshStandardMaterial color="#cbd5e1" metalness={0.6} /></mesh>

      {/* 6. Dual Headlights */}
      {[-0.6, 0.6].map((lx, idx) => (
        <group key={idx} position={[lx, 0.65, 1.55]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.12, 0.14, 12]} /><meshStandardMaterial color="#334155" metalness={0.8} /></mesh>
          <mesh position={[0, 0, 0.07]}><circleGeometry args={[0.08, 12]} /><meshBasicMaterial color="#fffbe8" /></mesh>
          {headlightsOn && <spotLight position={[0, 0, 0.1]} target-position={[lx, 0, 25]} color="#fffbe8" intensity={40} distance={80} angle={0.55} penumbra={0.4} castShadow />}
        </group>
      ))}

      {/* 7. Seated Driver (Astronaut) */}
      {isDriven && (
        <group position={[-0.38, 0.88, -0.15]}>
          <mesh position={[0, 0.35, 0]}><capsuleGeometry args={[0.26, 0.42, 6, 10]} /><meshStandardMaterial color="#f8fafc" roughness={0.7} /></mesh>
          <mesh position={[0, 0.72, 0.05]}><sphereGeometry args={[0.22, 16, 16]} /><meshStandardMaterial color="#ffffff" roughness={0.4} /></mesh>
          <mesh position={[0, 0.74, 0.18]} rotation={[0.1, 0, 0]}><sphereGeometry args={[0.15, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} /></mesh>
          <mesh position={[0, 0.38, -0.28]}><boxGeometry args={[0.34, 0.52, 0.22]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
        </group>
      )}
    </group>
  );
};
