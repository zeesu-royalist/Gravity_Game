import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';

const EARTH_RADIUS = 1800;

// Helper: Calculate Y elevation on the curved surface of spherical Earth
export function getCurvedEarthY(x: number, z: number): number {
  const r2 = x * x + z * z;
  if (r2 >= EARTH_RADIUS * EARTH_RADIUS) return -EARTH_RADIUS;
  return Math.sqrt(EARTH_RADIUS * EARTH_RADIUS - r2) - EARTH_RADIUS;
}

// Generate a soft, natural, light green grass texture (Light & Natural Earth meadow)
function createNaturalGrassTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Natural light sunlit meadow grass base
  ctx.fillStyle = '#a6dc6e';
  ctx.fillRect(0, 0, size, size);

  // 2. Gentle organic turf variation (Light natural tones)
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 24;
    const toneBias = (Math.random() - 0.5) * 14;

    data[i] = Math.min(255, Math.max(110, 150 + noise)); // R (warm sunlight)
    data[i + 1] = Math.min(255, Math.max(170, 212 + noise + toneBias)); // G (Fresh light green)
    data[i + 2] = Math.min(255, Math.max(70, 96 + noise * 0.6)); // B (natural warm earth)
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Crisp sunlit blade highlights
  ctx.strokeStyle = 'rgba(230, 255, 185, 0.45)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
    ctx.stroke();
  }

  // 4. Soft natural blade depth (gentle, NOT dark)
  ctx.strokeStyle = 'rgba(125, 178, 80, 0.3)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y + len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(110, 110);
  texture.colorSpace = THREE.SRGBColorSpace; // Preserves natural bright sRGB colors
  texture.anisotropy = 4;
  return texture;
}

let _cachedGrassTexture: THREE.CanvasTexture | null = null;
function getNaturalGrassTexture(): THREE.CanvasTexture {
  if (!_cachedGrassTexture) {
    _cachedGrassTexture = createNaturalGrassTexture();
  }
  return _cachedGrassTexture;
}

export const RealisticLandscape: React.FC<{ altitude?: number }> = ({ altitude = 0 }) => {
  const radarRef = useRef<THREE.Group>(null);

  // Natural desaturated grass texture (Module cached)
  const grassTexture = useMemo(() => getNaturalGrassTexture(), []);

  // 1. Curved Round Earth Sphere Cap (Curved Globe - optimized 64x32 segments)
  const earthSphereGeom = useMemo(() => {
    return new THREE.SphereGeometry(
      EARTH_RADIUS,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.35
    );
  }, []);

  // 2. Alpine Mountain Horizon on Curved Earth
  const mountainGeometry = useMemo(() => {
    const segments = 140;
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const innerRadius = 380;
    const midRadius = 540;
    const outerRadius = 880;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const peakNoise =
        Math.sin(angle * 3) * 65 +
        Math.cos(angle * 7 + 0.8) * 45 +
        Math.sin(angle * 13 + 1.4) * 28 +
        Math.cos(angle * 27) * 15 +
        135;

      // Inner base (conforms to curved Earth)
      const xInner = cos * innerRadius;
      const zInner = sin * innerRadius;
      const yInner = getCurvedEarthY(xInner, zInner) - 1;
      vertices.push(xInner, yInner, zInner);
      colors.push(0.55, 0.78, 0.38); // Natural light green foothill slope

      // Peak ridge
      const xMid = cos * midRadius;
      const zMid = sin * midRadius;
      const yMid = getCurvedEarthY(xMid, zMid) + peakNoise;
      vertices.push(xMid, yMid, zMid);
      colors.push(0.44, 0.46, 0.42); // Rocky alpine slate

      // Outer foothills
      const xOuter = cos * outerRadius;
      const zOuter = sin * outerRadius;
      const yOuter = getCurvedEarthY(xOuter, zOuter) - 5;
      vertices.push(xOuter, yOuter, zOuter);
      colors.push(0.34, 0.44, 0.32);
    }

    for (let i = 0; i < segments; i++) {
      const r1 = i * 3;
      const r2 = (i + 1) * 3;

      indices.push(r1, r2, r1 + 1);
      indices.push(r2, r2 + 1, r1 + 1);

      indices.push(r1 + 1, r2 + 1, r1 + 2);
      indices.push(r2 + 1, r2 + 2, r1 + 2);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  // 3. Realistic 3D Pine Trees on Curved Earth
  const treeCount = 420;
  const treeTransforms = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number; rotY: number }[] = [];
    let count = 0;
    while (count < treeCount) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 52 + Math.random() * 295;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Keep clearance for buildings
      if (x < -45 && z < 0) continue;
      if (x > 55 && z < -35) continue;
      if (x < -50 && z > 5) continue;

      const y = getCurvedEarthY(x, z);

      list.push({
        pos: [x, y, z],
        scale: 0.85 + Math.random() * 0.75,
        rotY: Math.random() * Math.PI * 2,
      });
      count++;
    }
    return list;
  }, [treeCount]);

  // 4. Soft Physical 3D Grass Blade Tufts around the Pad
  const grassTuftCount = 180;
  const grassTuftTransforms = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number; rotY: number }[] = [];
    for (let i = 0; i < grassTuftCount; i++) {
      const angle = (i / grassTuftCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const radius = 40 + Math.random() * 45;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const y = getCurvedEarthY(x, z);
      list.push({
        pos: [x, y, z],
        scale: 0.6 + Math.random() * 0.6,
        rotY: Math.random() * Math.PI,
      });
    }
    return list;
  }, [grassTuftCount]);

  // High-performance Instanced Mesh buffers (reduces draw calls from 2,220 down to 7)
  const trunkGeom = useMemo(() => new THREE.CylinderGeometry(0.22, 0.36, 4, 8), []);
  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#38281a', roughness: 0.94 }), []);
  const folGeom1 = useMemo(() => new THREE.ConeGeometry(2.5, 4.6, 8), []);
  const folMat1 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#233a23', roughness: 0.88 }), []);
  const folGeom2 = useMemo(() => new THREE.ConeGeometry(1.9, 4.1, 8), []);
  const folMat2 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a452a', roughness: 0.88 }), []);
  const folGeom3 = useMemo(() => new THREE.ConeGeometry(1.2, 3.5, 8), []);
  const folMat3 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#335233', roughness: 0.88 }), []);

  const grassGeom = useMemo(() => new THREE.PlaneGeometry(0.75, 0.75), []);
  const grassMat1 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b5e87a', side: THREE.DoubleSide, roughness: 0.8 }), []);
  const grassMat2 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a2db6c', side: THREE.DoubleSide, roughness: 0.8 }), []);
  const grassMat3 = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8ecc58', side: THREE.DoubleSide, roughness: 0.8 }), []);

  const stairGeom = useMemo(() => new THREE.BoxGeometry(3.2, 0.35, 0.65), []);
  const stairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.85 }), []);

  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const fol1MeshRef = useRef<THREE.InstancedMesh>(null);
  const fol2MeshRef = useRef<THREE.InstancedMesh>(null);
  const fol3MeshRef = useRef<THREE.InstancedMesh>(null);
  const grass1MeshRef = useRef<THREE.InstancedMesh>(null);
  const grass2MeshRef = useRef<THREE.InstancedMesh>(null);
  const grass3MeshRef = useRef<THREE.InstancedMesh>(null);
  const stairsMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();

    treeTransforms.forEach((t, i) => {
      // Trunk (local y = 2)
      dummy.position.set(t.pos[0], t.pos[1] + 2 * t.scale, t.pos[2]);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.rotation.set(0, t.rotY, 0);
      dummy.updateMatrix();
      trunkMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // Foliage 1 (local y = 4.2)
      dummy.position.set(t.pos[0], t.pos[1] + 4.2 * t.scale, t.pos[2]);
      dummy.updateMatrix();
      fol1MeshRef.current?.setMatrixAt(i, dummy.matrix);

      // Foliage 2 (local y = 6.6)
      dummy.position.set(t.pos[0], t.pos[1] + 6.6 * t.scale, t.pos[2]);
      dummy.updateMatrix();
      fol2MeshRef.current?.setMatrixAt(i, dummy.matrix);

      // Foliage 3 (local y = 8.5)
      dummy.position.set(t.pos[0], t.pos[1] + 8.5 * t.scale, t.pos[2]);
      dummy.updateMatrix();
      fol3MeshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (trunkMeshRef.current) {
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      trunkMeshRef.current.computeBoundingSphere();
    }
    if (fol1MeshRef.current) {
      fol1MeshRef.current.instanceMatrix.needsUpdate = true;
      fol1MeshRef.current.computeBoundingSphere();
    }
    if (fol2MeshRef.current) {
      fol2MeshRef.current.instanceMatrix.needsUpdate = true;
      fol2MeshRef.current.computeBoundingSphere();
    }
    if (fol3MeshRef.current) {
      fol3MeshRef.current.instanceMatrix.needsUpdate = true;
      fol3MeshRef.current.computeBoundingSphere();
    }

    grassTuftTransforms.forEach((t, i) => {
      dummy.position.set(t.pos[0], t.pos[1] + 0.35 * t.scale, t.pos[2]);
      dummy.scale.set(t.scale, t.scale, t.scale);

      dummy.rotation.set(0, t.rotY, 0);
      dummy.updateMatrix();
      grass1MeshRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(0, t.rotY + Math.PI / 3, 0);
      dummy.updateMatrix();
      grass2MeshRef.current?.setMatrixAt(i, dummy.matrix);

      dummy.rotation.set(0, t.rotY - Math.PI / 3, 0);
      dummy.updateMatrix();
      grass3MeshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (grass1MeshRef.current) {
      grass1MeshRef.current.instanceMatrix.needsUpdate = true;
      grass1MeshRef.current.computeBoundingSphere();
    }
    if (grass2MeshRef.current) {
      grass2MeshRef.current.instanceMatrix.needsUpdate = true;
      grass2MeshRef.current.computeBoundingSphere();
    }
    if (grass3MeshRef.current) {
      grass3MeshRef.current.instanceMatrix.needsUpdate = true;
      grass3MeshRef.current.computeBoundingSphere();
    }

    // 12 Catwalk Stairs (Instanced Mesh - cuts 12 draw calls to 1)
    for (let stepIdx = 0; stepIdx < 12; stepIdx++) {
      dummy.position.set(0, stepIdx * 0.35 + 0.18, stepIdx * 0.6);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stairsMeshRef.current?.setMatrixAt(stepIdx, dummy.matrix);
    }
    if (stairsMeshRef.current) {
      stairsMeshRef.current.instanceMatrix.needsUpdate = true;
      stairsMeshRef.current.computeBoundingSphere();
    }
  }, [treeTransforms, grassTuftTransforms]);

  useFrame((state) => {
    if (altitude > 3000) return;
    if (radarRef.current) {
      radarRef.current.rotation.y = state.clock.getElapsedTime() * 0.4;
    }
  });

  return (
    <group>
      {/* ================= NATURAL EARTH ATMOSPHERE (Fades out into Deep Space) ================= */}
      {altitude < 4500 && (
        <Sky
          distance={450000}
          sunPosition={[180, 220, 160]} // High, clear, bright natural daylight
          turbidity={2.4}
          rayleigh={Math.max(0.01, 0.85 * (1 - Math.max(0, altitude) / 4500))}
          mieCoefficient={0.005}
          mieDirectionalG={0.82}
        />
      )}

      {/* Atmospheric Haze on Earth surface (fades out in space, clamped so never collapses) */}
      {altitude < 2500 && (
        <fog
          attach="fog"
          args={[
            '#b8daf0',
            Math.max(250, 400 + Math.max(0, altitude) * 0.4),
            Math.max(1600, 3000 + Math.max(0, altitude) * 1.5),
          ]}
        />
      )}

      {/* ================= CURVED GOL EARTH - NATURAL LIGHT GREEN GRASS ================= */}
      <group position={[0, -EARTH_RADIUS + 0.25, 0]}>
        <mesh geometry={earthSphereGeom} receiveShadow>
          <meshStandardMaterial
            map={grassTexture}
            color="#ffffff" // Crisp white so the light natural grass texture is 100% true!
            roughness={0.78}
            metalness={0.0}
          />
        </mesh>
      </group>

      {/* Concrete Launchpad Blast Apron Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]} receiveShadow>
        <circleGeometry args={[38, 48]} />
        <meshStandardMaterial color="#64748b" roughness={0.86} metalness={0.14} />
      </mesh>

      {/* Soft Grassy Border Ring touching Concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.255, 0]} receiveShadow>
        <ringGeometry args={[38, 46, 48]} />
        <meshStandardMaterial
          color="#a6dc6e"
          roughness={0.8}
        />
      </mesh>

      {/* ================= PHYSICAL 3D GREEN GRASS BLADES (INSTANCED) ================= */}
      <instancedMesh ref={grass1MeshRef} args={[grassGeom, grassMat1, grassTuftCount]} />
      <instancedMesh ref={grass2MeshRef} args={[grassGeom, grassMat2, grassTuftCount]} />
      <instancedMesh ref={grass3MeshRef} args={[grassGeom, grassMat3, grassTuftCount]} />

      {/* ================= CURVED HORIZON MOUNTAINS ================= */}
      <mesh geometry={mountainGeometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.96}
          metalness={0.02}
          flatShading={false}
        />
      </mesh>

      {/* ================= 3D PINE FOREST FOLLOWING EARTH CURVE (INSTANCED) ================= */}
      <instancedMesh ref={trunkMeshRef} args={[trunkGeom, trunkMat, treeCount]} castShadow receiveShadow />
      <instancedMesh ref={fol1MeshRef} args={[folGeom1, folMat1, treeCount]} castShadow receiveShadow />
      <instancedMesh ref={fol2MeshRef} args={[folGeom2, folMat2, treeCount]} castShadow receiveShadow />
      <instancedMesh ref={fol3MeshRef} args={[folGeom3, folMat3, treeCount]} castShadow receiveShadow />

      {/* ================= REALISTIC SUPPORT BUILDINGS (Active below 4000m) ================= */}
      {altitude < 4000 && (
        <>
          {/* 1. Launch Control Blockhouse Bunker */}
          <group position={[-68, getCurvedEarthY(-68, -48), -48]}>
            <mesh position={[0, 4, 0]} castShadow receiveShadow>
              <boxGeometry args={[28, 8, 20]} />
              <meshStandardMaterial color="#4a5568" roughness={0.84} metalness={0.18} />
            </mesh>
            {/* Sloped Blast Berm */}
            <mesh position={[0, 2.5, 11]} rotation={[-0.4, 0, 0]} castShadow>
              <boxGeometry args={[29, 6, 4]} />
              <meshStandardMaterial color="#3d4654" roughness={0.9} />
            </mesh>
            {/* Observation Windows */}
            <mesh position={[0, 5.2, 10.1]}>
              <boxGeometry args={[16, 1.2, 0.2]} />
              <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Rooftop HVAC */}
            <mesh position={[-6, 8.5, -3]} castShadow>
              <boxGeometry args={[4, 1.6, 6]} />
              <meshStandardMaterial color="#718096" roughness={0.6} metalness={0.6} />
            </mesh>
            <mesh position={[4, 8.5, -3]} castShadow>
              <boxGeometry args={[4, 1.6, 6]} />
              <meshStandardMaterial color="#718096" roughness={0.6} metalness={0.6} />
            </mesh>
            {/* Tracking Radar Dish */}
            <group position={[0, 8.2, 4]} ref={radarRef}>
              <mesh position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.2, 0.3, 3, 12]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
              </mesh>
              <mesh position={[0, 3.2, 0]} rotation={[0.4, 0, 0]}>
                <sphereGeometry args={[1.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#f1f5f9" side={THREE.DoubleSide} roughness={0.3} />
              </mesh>
            </group>
          </group>

          {/* 2. Vehicle Assembly / Integration Hangar */}
          <group position={[95, getCurvedEarthY(95, -68), -68]}>
            <mesh position={[0, 14, 0]} castShadow receiveShadow>
              <boxGeometry args={[34, 28, 48]} />
              <meshStandardMaterial color="#5e6d82" roughness={0.78} metalness={0.32} />
            </mesh>
            {/* Roof Arch */}
            <mesh position={[0, 28.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[17.2, 17.2, 48, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#475569" roughness={0.8} metalness={0.3} />
            </mesh>
            {/* Vertical Bay Door */}
            <mesh position={[-17.1, 10, 0]}>
              <boxGeometry args={[0.2, 20, 22]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.6} />
            </mesh>
            {/* Yellow Safety Trim */}
            <mesh position={[-17.2, 21.2, 0]}>
              <boxGeometry args={[0.1, 1.2, 24]} />
              <meshStandardMaterial color="#eab308" roughness={0.5} />
            </mesh>
          </group>

          {/* 3. Cryogenic Propellant Storage Depot */}
          <group position={[-75, getCurvedEarthY(-75, 26), 26]}>
            <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
              <boxGeometry args={[26, 1.6, 22]} />
              <meshStandardMaterial color="#5a6778" roughness={0.9} />
            </mesh>
            {/* Spherical LOX Tank */}
            <group position={[-4, 7, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[5.2, 24, 24]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.42} />
              </mesh>
              {[-3, 3].map((lx) =>
                [-3, 3].map((lz) => (
                  <mesh key={`${lx}-${lz}`} position={[lx, -4.5, lz]}>
                    <cylinderGeometry args={[0.2, 0.2, 5]} />
                    <meshStandardMaterial color="#334155" metalness={0.8} />
                  </mesh>
                ))
              )}
            </group>
            {/* Horizontal Propellant Tank */}
            <group position={[6.5, 4.5, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh castShadow>
                <cylinderGeometry args={[2.6, 2.6, 14, 20]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.5} />
              </mesh>
            </group>
            {/* Pipelines leading toward Launchpad */}
            <group position={[18, 2, -10]}>
              <mesh position={[0, 0, 0]} rotation={[0, -0.3, Math.PI / 2]}>
                <cylinderGeometry args={[0.3, 0.3, 38]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.8} />
              </mesh>
              <mesh position={[0, 0.7, 0]} rotation={[0, -0.3, Math.PI / 2]}>
                <cylinderGeometry args={[0.2, 0.2, 38]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
              </mesh>
            </group>
          </group>

          {/* 4. Concrete Catwalk Stairs near Launch Apron (InstancedMesh - 1 draw call) */}
          <group position={[18, 0, 16]} rotation={[0, -0.5, 0]}>
            <instancedMesh ref={stairsMeshRef} args={[stairGeom, stairMat, 12]} castShadow receiveShadow />
            {/* Yellow Handrails */}
            <mesh position={[1.5, 2.8, 3.6]} rotation={[0.52, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 8.5]} />
              <meshStandardMaterial color="#facc15" metalness={0.6} />
            </mesh>
            <mesh position={[-1.5, 2.8, 3.6]} rotation={[0.52, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 8.5]} />
              <meshStandardMaterial color="#facc15" metalness={0.6} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
};
