import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import { MOON_LANDING_SITE, MOON_TOUCHDOWN_Y } from './MoonExploration';

useGLTF.preload('/models/buran_energia_launchpad.glb');
useGLTF.preload('/models/rocket.glb');

const BOOSTER_OFFSETS: [number, number, number][] = [
  [2.1, 0, 0], [-2.1, 0, 0], [0, 0, 1.35], [0, 0, -1.35],
];

// Buran-Energia Launchpad on Earth
export function BuranLaunchpad() {
  const { scene } = useGLTF('/models/buran_energia_launchpad.glb');
  const alignedPad = useMemo(() => {
    const clone = scene.clone();
    clone.position.set(0, 24.03, -2.85);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        if (child.name === 'Object_1158' || child.name === 'Object_1157') child.visible = false;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={alignedPad} />;
}

// Procedural Insignia Badge for Commander ZEESU
function createZeesuEmblemTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const gradBg = ctx.createLinearGradient(0, 10, 0, 246);
  gradBg.addColorStop(0, '#0a1224');
  gradBg.addColorStop(0.5, '#182644');
  gradBg.addColorStop(1, '#0a1224');
  ctx.fillStyle = gradBg;
  ctx.beginPath();
  ctx.roundRect(14, 10, 484, 236, 24);
  ctx.fill();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 20, 464, 216);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('✦  COMMANDER SHIP  ✦', 256, 46);

  const gradText = ctx.createLinearGradient(0, 60, 0, 155);
  gradText.addColorStop(0, '#ffffff');
  gradText.addColorStop(0.3, '#fef08a');
  gradText.addColorStop(0.7, '#eab308');
  gradText.addColorStop(1, '#ca8a04');
  ctx.shadowColor = 'rgba(234, 179, 8, 0.75)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = gradText;
  ctx.font = '900 84px "Arial Black", Impact, sans-serif';
  ctx.letterSpacing = '10px';
  ctx.fillText('ZEESU', 256, 140);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 13px monospace';
  ctx.letterSpacing = '3px';
  ctx.fillText('◄◄  Z-SPACE FLAGSHIP  ►►', 256, 182);

  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('★  OFFICIAL PILOT: ZEESU  ★', 256, 216);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Active Rocket Mesh with Engine Exhaust, RCS Puffs and Mission Decal
interface RocketProps {
  isFlying: boolean;
  isLanded: boolean;
  throttle: number;
  rocketPos: THREE.Vector3;
  rocketQuat: THREE.Quaternion;
  rcsActive: { pitch: number; yaw: number };
  isExploding?: boolean;
}

function RocketExplosionVisual() {
  const fireballRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Random debris directions and rotation velocities
  const debrisData = useMemo(() => {
    return Array.from({ length: 22 }, () => {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      const speed = 15 + Math.random() * 28;
      const rot = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12
      );
      const size = 0.5 + Math.random() * 1.4;
      return { dir, speed, rot, size };
    });
  }, []);

  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Fireball expands and fades
    const fireScale = Math.min(32, 2.5 + t * 26);
    const fireOpacity = Math.max(0, 1 - t / 2.6);
    if (fireballRef.current) {
      fireballRef.current.scale.setScalar(fireScale);
      (fireballRef.current.material as THREE.MeshBasicMaterial).opacity = fireOpacity * 0.88;
    }

    if (coreRef.current) {
      const coreScale = Math.min(18, 1.5 + t * 16);
      coreRef.current.scale.setScalar(coreScale);
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 1.7);
    }

    // Shockwave ring expands horizontally
    if (shockwaveRef.current) {
      const ringScale = Math.min(48, 2.5 + t * 38);
      shockwaveRef.current.scale.set(ringScale, ringScale, 1);
      (shockwaveRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 - t / 2.2);
    }

    // Debris fragments expand outward
    if (debrisRef.current) {
      debrisRef.current.children.forEach((child, i) => {
        const d = debrisData[i];
        if (d && child) {
          child.position.addScaledVector(d.dir, d.speed * delta);
          child.rotation.x += d.rot.x * delta;
          child.rotation.y += d.rot.y * delta;
          child.rotation.z += d.rot.z * delta;
        }
      });
    }

    // Blast point light flash
    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0, 140 * (1 - t / 2.4));
    }
  });

  return (
    <group position={[0, 13.5, 0]}>
      {/* Outer Fireball Sphere */}
      <mesh ref={fireballRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color="#ff4200" transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Inner White-Hot Core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#fffbe6" transparent opacity={0.96} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Expanding Shockwave Ring */}
      <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.3, 32]} />
        <meshBasicMaterial color="#ff8800" transparent opacity={0.95} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Debris Shrapnel Particles */}
      <group ref={debrisRef}>
        {debrisData.map((d, i) => (
          <mesh key={i} scale={[d.size, d.size * 1.6, d.size]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#1e293b' : '#ff5500'}
              roughness={0.4}
              metalness={0.6}
              emissive={i % 2 === 0 ? '#000000' : '#ff2200'}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </group>

      <pointLight ref={lightRef} color="#ff7700" intensity={140} distance={380} decay={1.5} />
    </group>
  );
}

export function ActiveRocketMesh({ isFlying, isLanded, throttle, rocketPos, rocketQuat, rcsActive, isExploding }: RocketProps) {
  const { scene } = useGLTF('/models/rocket.glb');
  const groupRef = useRef<THREE.Group>(null);
  const flameGroupRef = useRef<THREE.Group>(null);
  const flameOuterRef = useRef<THREE.Mesh>(null);
  const flameCoreRef = useRef<THREE.Mesh>(null);
  const boosterFlamesRef = useRef<THREE.Group>(null);
  const flameLightRef = useRef<THREE.PointLight>(null);

  const zeesuTexture = useMemo(() => createZeesuEmblemTexture(), []);
  const zeesuDecalGeom = useMemo(() => {
    const thetaLen = Math.PI * 0.32; // ~57° sleek wrap around fuselage
    return new THREE.CylinderGeometry(1.80, 1.80, 2.2, 32, 1, true, -thetaLen / 2, thetaLen);
  }, []);

  const centeredRocket = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -box.min.y, -center.z);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Base-anchored flame cone: base at y=0.0, tip at y=-1.0
  const flameConeGeom = useMemo(() => {
    const geom = new THREE.ConeGeometry(1.0, 1.0, 24);
    geom.rotateX(Math.PI);
    geom.translate(0, -0.5, 0);
    return geom;
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(rocketPos);
    groupRef.current.quaternion.copy(rocketQuat);

    const isBurning = isFlying && !isLanded && throttle > 0.05;
    const isSpace = rocketPos.y > 3500;

    if (flameOuterRef.current) flameOuterRef.current.visible = isBurning;
    if (flameCoreRef.current) flameCoreRef.current.visible = isBurning;
    if (boosterFlamesRef.current) boosterFlamesRef.current.visible = isBurning;
    if (flameLightRef.current) flameLightRef.current.intensity = isBurning ? throttle * (isSpace ? 35 : 24) : 0;

    if (isBurning) {
      const flicker = 1.0 + Math.sin(state.clock.elapsedTime * 45) * 0.12;
      const coreRad = (isSpace ? 1.6 : 1.1) * (0.85 + throttle * 0.3);
      const coreLen = (10.0 + throttle * 6.5) * flicker * (isSpace ? 1.25 : 1.0);
      flameCoreRef.current?.scale.set(coreRad, coreLen, coreRad);
      flameOuterRef.current?.scale.set(coreRad * 1.65, coreLen * 1.35, coreRad * 1.65);

      const bRad = (isSpace ? 1.05 : 0.78) * (0.8 + throttle * 0.25);
      const bLen = (7.5 + throttle * 5.0) * flicker * (isSpace ? 1.2 : 1.0);
      boosterFlamesRef.current?.children.forEach((b) => b.scale.set(bRad, bLen, bRad));

      if (flameGroupRef.current) {
        flameGroupRef.current.rotation.z = THREE.MathUtils.lerp(flameGroupRef.current.rotation.z, rcsActive.yaw * 0.12, delta * 8);
        flameGroupRef.current.rotation.x = THREE.MathUtils.lerp(flameGroupRef.current.rotation.x, rcsActive.pitch * 0.12, delta * 8);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.2, 0]}>
      {isExploding ? (
        <RocketExplosionVisual />
      ) : (
        <>
          {/* 3D Rocket Model - Rotated 180° so front faces camera */}
          <group scale={[1.2, 1.2, 1.2]} rotation={[0, Math.PI, 0]}>
            <primitive object={centeredRocket} />
          </group>

          {/* Commander ZEESU Official Mission Insignia */}
          <mesh geometry={zeesuDecalGeom} position={[0, 16.5, 0]}>
            <meshStandardMaterial map={zeesuTexture} transparent opacity={0.99} roughness={0.22} metalness={0.68} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 16.5, 2.2]} color="#fef08a" intensity={1.8} distance={3.5} />

          {/* Engine Exhaust Flames (Base at y = 0, pointing downwards) */}
          <group ref={flameGroupRef} position={[0, 0, 0]}>
            <mesh ref={flameOuterRef} geometry={flameConeGeom} position={[0, 0, 0.15]} visible={false}>
              <meshBasicMaterial color="#ff6a00" transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <mesh ref={flameCoreRef} geometry={flameConeGeom} position={[0, 0, 0.15]} visible={false}>
              <meshBasicMaterial color="#fffdf0" transparent opacity={0.96} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <group ref={boosterFlamesRef} visible={false}>
              {BOOSTER_OFFSETS.map(([bx, by, bz], idx) => (
                <group key={idx} position={[bx, by, bz]}>
                  <mesh geometry={flameConeGeom}>
                    <meshBasicMaterial color="#ff7a00" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
                  </mesh>
                  <mesh geometry={flameConeGeom} scale={[0.55, 0.7, 0.55]}>
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>

          <pointLight ref={flameLightRef} position={[0, -1.0, 0]} color="#ff8800" intensity={0} distance={220} decay={2} />

          {/* RCS Steering Cold-Gas Puffs */}
          {rcsActive.yaw > 0 && <mesh position={[-1.2, 18, 0]} rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.35, 1.6, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.75} /></mesh>}
          {rcsActive.yaw < 0 && <mesh position={[1.2, 18, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.35, 1.6, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.75} /></mesh>}
          {rcsActive.pitch > 0 && <mesh position={[0, 18, 1.2]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.35, 1.6, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.75} /></mesh>}
          {rcsActive.pitch < 0 && <mesh position={[0, 18, -1.2]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.35, 1.6, 8]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.75} /></mesh>}
        </>
      )}
    </group>
  );
}

// Lunar Landing Marker Flag & Base Plaque
export function LunarLandingSiteMarker() {
  return (
    <group position={[MOON_LANDING_SITE.x + 5.2, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z - 4]}>
      <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.04, 0.04, 5]} /><meshStandardMaterial color="#cbd5e1" metalness={0.9} /></mesh>
      <mesh position={[1.1, 4.2, 0]}><boxGeometry args={[2.2, 1.4, 0.04]} /><meshStandardMaterial color="#0284c7" roughness={0.3} /></mesh>
      <Text position={[1.1, 4.2, 0.03]} fontSize={0.25} color="#ffffff" anchorX="center" anchorY="middle"> Uff Moon P♡</Text>
      <Text position={[1.1, 4.2, -0.03]} rotation={[0, Math.PI, 0]} fontSize={0.25} color="#ffffff" anchorX="center" anchorY="middle">Uff Moon P♡</Text>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[1.2, 1.4, 0.1, 16]} /><meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

