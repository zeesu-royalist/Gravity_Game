import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getCurvedEarthY } from './RealisticLandscape';

export interface ScientistData {
  id: string;
  name: string;
  role: string;
  quote: string;
  position: [number, number, number];
  rotationY: number;
  accessory: 'CLIPBOARD' | 'TABLET' | 'BINOCULARS' | 'HEADSET';
}

export const SCIENTISTS_DATA: ScientistData[] = [
  {
    id: 'director',
    name: 'Dr. Alex Reed',
    role: 'Flight Director',
    quote: 'All systems green for interplanetary flight, Commander ZEESU!',
    position: [-6, 0.26, 16],
    rotationY: 0.3,
    accessory: 'CLIPBOARD',
  },
  {
    id: 'transport',
    name: 'Eng. Marcus Vance',
    role: 'Ground Transport Lead',
    quote: 'Cosmodrome Car is charged and ready for inspection drive!',
    position: [-12.5, 0.26, 14.5],
    rotationY: 0.8,
    accessory: 'TABLET',
  },
  {
    id: 'inspector',
    name: 'Eng. Viktor Cole',
    role: 'Rocket Inspector',
    quote: 'Fuselage and thermal tiles inspected. Zero anomalies detected.',
    position: [7, 0.26, 12],
    rotationY: -2.3,
    accessory: 'BINOCULARS',
  },
  {
    id: 'propulsion',
    name: 'Dr. Elena Rostova',
    role: 'Propulsion Chief',
    quote: 'Liquid oxygen tanks pressurized. Boosters at 100% readiness!',
    position: [-22, 0.26, 20],
    rotationY: 1.1,
    accessory: 'TABLET',
  },
  {
    id: 'flight_dynamics',
    name: 'Dr. Sarah Patel',
    role: 'Orbital Navigator',
    quote: 'TLI lunar transit vector locked in. Safe voyage, Commander!',
    position: [-45, getCurvedEarthY(-45, -30) + 0.25, -30],
    rotationY: -0.8,
    accessory: 'HEADSET',
  },
  {
    id: 'radar',
    name: 'Dr. David Chen',
    role: 'Deep Space Telemetry',
    quote: 'Long-range radar tracking station online. Signals crystal clear!',
    position: [16, 0.26, 16],
    rotationY: -0.5,
    accessory: 'HEADSET',
  },
  {
    id: 'hangar',
    name: 'Eng. Yuri Sokolov',
    role: 'Systems Engineer',
    quote: 'Assembly hangar standing by for mission payload telemetry.',
    position: [60, getCurvedEarthY(60, -45) + 0.25, -45],
    rotationY: 2.1,
    accessory: 'CLIPBOARD',
  },
];

export function SingleScientist({ data, astronautPos }: { data: ScientistData; astronautPos: THREE.Vector3 }) {
  const headRef = useRef<THREE.Group>(null);
  const chestRef = useRef<THREE.Group>(null);
  const isNearby = astronautPos.distanceTo(new THREE.Vector3(...data.position)) < 7.0;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + data.position[0];
    if (headRef.current) headRef.current.rotation.y = Math.sin(t * 0.8) * 0.15;
    if (chestRef.current) chestRef.current.position.y = 0.95 + Math.sin(t * 1.5) * 0.015;
  });

  return (
    <group position={data.position} rotation={[0, data.rotationY, 0]}>
      {/* Shoes & Dark Trousers */}
      {[-0.12, 0.12].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.08, 0]}><boxGeometry args={[0.14, 0.16, 0.28]} /><meshStandardMaterial color="#0f172a" roughness={0.8} /></mesh>
          <mesh position={[x, 0.44, 0]}><cylinderGeometry args={[0.08, 0.09, 0.6, 10]} /><meshStandardMaterial color="#1e293b" roughness={0.8} /></mesh>
        </group>
      ))}

      {/* Lab Coat */}
      <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.22, 0.26, 0.35, 10]} /><meshStandardMaterial color="#f8fafc" roughness={0.5} /></mesh>
      <group ref={chestRef} position={[0, 0.95, 0]}>
        <mesh castShadow><boxGeometry args={[0.42, 0.48, 0.24]} /><meshStandardMaterial color="#f8fafc" roughness={0.4} /></mesh>
        <mesh position={[0, 0.08, 0.125]}><boxGeometry args={[0.06, 0.24, 0.01]} /><meshStandardMaterial color="#0284c7" /></mesh>
        <mesh position={[-0.12, 0.12, 0.125]}><boxGeometry args={[0.07, 0.09, 0.01]} /><meshStandardMaterial color="#ef4444" /></mesh>
      </group>

      {/* Head, Glasses & Hair */}
      <group ref={headRef} position={[0, 1.42, 0]}>
        <mesh castShadow><sphereGeometry args={[0.14, 14, 14]} /><meshStandardMaterial color="#fcd34d" roughness={0.6} /></mesh>
        <mesh position={[0, 0.06, -0.02]}><sphereGeometry args={[0.145, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color="#475569" roughness={0.9} /></mesh>
        <mesh position={[0, 0.02, 0.13]}><boxGeometry args={[0.2, 0.05, 0.02]} /><meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} /></mesh>
      </group>

      {/* Accessory */}
      {data.accessory === 'CLIPBOARD' && (
        <group position={[0.15, 0.96, 0.22]} rotation={[0.5, 0.2, -0.2]}>
          <mesh castShadow><boxGeometry args={[0.18, 0.26, 0.02]} /><meshStandardMaterial color="#b45309" roughness={0.8} /></mesh>
          <mesh position={[0, 0, 0.012]}><boxGeometry args={[0.15, 0.22, 0.005]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      )}
      {data.accessory === 'TABLET' && (
        <group position={[0, 0.95, 0.22]} rotation={[0.6, 0, 0]}>
          <mesh castShadow><boxGeometry args={[0.26, 0.18, 0.015]} /><meshStandardMaterial color="#0f172a" metalness={0.8} /></mesh>
          <mesh position={[0, 0, 0.01]}><planeGeometry args={[0.24, 0.16]} /><meshBasicMaterial color="#38bdf8" /></mesh>
        </group>
      )}
      {data.accessory === 'BINOCULARS' && (
        <group position={[0, 1.4, 0.16]} rotation={[-0.3, 0, 0]}>
          {[-0.05, 0.05].map((bx, i) => (
            <mesh key={i} position={[bx, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.14, 10]} /><meshStandardMaterial color="#1e293b" metalness={0.7} />
            </mesh>
          ))}
        </group>
      )}

      {/* Nearby Proximity Tag */}
      {isNearby && (
        <Html position={[0, 2.15, 0]} center distanceFactor={14}>
          <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-400/60 text-white font-sans text-xs shadow-2xl whitespace-nowrap pointer-events-none text-center">
            <div className="font-extrabold text-cyan-400 text-[11px] flex items-center justify-center gap-1">
              <span>👨‍🔬</span><span>{data.name}</span><span className="text-[9px] text-gray-400 font-normal">[{data.role}]</span>
            </div>
            <div className="text-[10px] text-amber-200 font-mono mt-0.5">"{data.quote}"</div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function CosmodromeScientists({ astronautPos }: { astronautPos: THREE.Vector3 }) {
  return (
    <group>
      {SCIENTISTS_DATA.map((s) => (
        <SingleScientist key={s.id} data={s} astronautPos={astronautPos} />
      ))}
    </group>
  );
}
