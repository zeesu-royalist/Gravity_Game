import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const MOON_POSITION = new THREE.Vector3(2600, 16500, -9200);
export const MOON_RADIUS = 680;
export const MARS_POSITION = new THREE.Vector3(-14000, 24000, 16000);
export const MARS_RADIUS = 920;
export const SUN_POSITION = new THREE.Vector3(22000, 26000, 18000);

// ------------------------------------------------------------------
// 1. Procedural Photorealistic Moon Texture (Cratered Regolith & Maria)
// ------------------------------------------------------------------
function createMoonTextures() {
  const size = 1024;

  // Color Texture Canvas
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Highland regolith base (stark lunar grey)
  ctx.fillStyle = '#8f9298';
  ctx.fillRect(0, 0, size, size);

  // Lunar Maria (dark basalt volcanic plains)
  const mariaCenters = [
    { x: 340, y: 380, r: 180 }, // Mare Tranquillitatis
    { x: 580, y: 320, r: 210 }, // Oceanus Procellarum
    { x: 420, y: 640, r: 160 }, // Mare Imbrium
    { x: 740, y: 560, r: 140 }, // Mare Serenitatis
    { x: 220, y: 520, r: 130 },
  ];

  mariaCenters.forEach((m) => {
    const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    grad.addColorStop(0, '#3f4247');
    grad.addColorStop(0.65, '#565a61');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Micro regolith gravel & dust noise
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 38;
    data[i] = Math.min(255, Math.max(25, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(25, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(25, data[i + 2] + noise));
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Impact Craters with raised bright rims and depressed dark floors
  const craters = [
    { x: 512, y: 780, r: 42, rays: true }, // Tycho-like crater with rays
    { x: 410, y: 310, r: 35, rays: true }, // Copernicus-like
    { x: 670, y: 440, r: 28, rays: false },
    { x: 280, y: 240, r: 32, rays: false },
    { x: 790, y: 720, r: 24, rays: false },
    { x: 180, y: 710, r: 30, rays: false },
    { x: 860, y: 280, r: 22, rays: false },
  ];

  // Add 60 smaller random micro-craters
  for (let i = 0; i < 65; i++) {
    craters.push({
      x: Math.random() * size,
      y: Math.random() * size,
      r: 4 + Math.random() * 14,
      rays: false,
    });
  }

  craters.forEach((c) => {
    // Ejecta Rays (long bright streaks radiating outward)
    if (c.rays) {
      ctx.strokeStyle = 'rgba(235, 238, 245, 0.28)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < 18; a++) {
        const angle = (a / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
        const len = c.r * (3 + Math.random() * 6);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(angle) * len, c.y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    // Outer raised rim (bright sunlit ring)
    ctx.strokeStyle = 'rgba(235, 240, 248, 0.85)';
    ctx.lineWidth = Math.max(1.5, c.r * 0.16);
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.stroke();

    // Dark crater bowl interior
    const bowlGrad = ctx.createRadialGradient(c.x - c.r * 0.2, c.y - c.r * 0.2, 0, c.x, c.y, c.r);
    bowlGrad.addColorStop(0, '#25272a');
    bowlGrad.addColorStop(0.7, '#383b40');
    bowlGrad.addColorStop(1, '#656972');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Central peak rebound in large craters
    if (c.r > 20) {
      ctx.fillStyle = '#b0b5be';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const colorTexture = new THREE.CanvasTexture(canvas);
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  colorTexture.colorSpace = THREE.SRGBColorSpace;

  return colorTexture;
}

// Procedural Photorealistic Mars Texture (Iron Oxide, Canyons, Volcanoes, Polar Ice)
function createMarsTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Rust-red/orange iron oxide base
  ctx.fillStyle = '#b8420e';
  ctx.fillRect(0, 0, size, size);

  // 2. Dark Volcanic Basalt Provinces
  const darkBasins = [
    { x: 580, y: 520, rx: 160, ry: 100 },
    { x: 380, y: 320, rx: 190, ry: 130 },
    { x: 740, y: 580, rx: 170, ry: 90 },
    { x: 240, y: 640, rx: 140, ry: 110 },
    { x: 480, y: 680, rx: 180, ry: 80 },
  ];
  darkBasins.forEach((r) => {
    const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, Math.max(r.rx, r.ry));
    grad.addColorStop(0, '#421707');
    grad.addColorStop(0.55, '#5c220a');
    grad.addColorStop(0.85, '#82300f');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Valles Marineris (Grand Canyon of Mars)
  ctx.strokeStyle = '#381205';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(180, 500);
  ctx.bezierCurveTo(340, 520, 520, 490, 720, 530);
  ctx.stroke();

  // 4. Olympus Mons (Giant Shield Volcano)
  const oGrad = ctx.createRadialGradient(280, 360, 0, 280, 360, 85);
  oGrad.addColorStop(0, '#2b0d04');
  oGrad.addColorStop(0.25, '#78280a');
  oGrad.addColorStop(0.8, '#d45618');
  oGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = oGrad;
  ctx.beginPath();
  ctx.arc(280, 360, 85, 0, Math.PI * 2);
  ctx.fill();

  // 5. Dust noise
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 26;
    data[i] = Math.min(255, Math.max(30, data[i] + noise * 1.2));
    data[i + 1] = Math.min(255, Math.max(10, data[i + 1] + noise * 0.6));
    data[i + 2] = Math.min(255, Math.max(5, data[i + 2] + noise * 0.3));
  }
  ctx.putImageData(imgData, 0, 0);

  // 6. Polar Ice Caps (North & South)
  const nGrad = ctx.createLinearGradient(0, 0, 0, 95);
  nGrad.addColorStop(0, '#ffffff');
  nGrad.addColorStop(0.7, '#e0f2fe');
  nGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = nGrad;
  ctx.fillRect(0, 0, size, 95);

  const sGrad = ctx.createLinearGradient(0, size, 0, size - 85);
  sGrad.addColorStop(0, '#ffffff');
  sGrad.addColorStop(0.75, '#e0f2fe');
  sGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = sGrad;
  ctx.fillRect(0, size - 85, size, 85);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------
// 2. Procedural Earth Globe Texture (As seen from Deep Space)
// ------------------------------------------------------------------
function createEarthGlobeTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean blue base
  ctx.fillStyle = '#0c2e56';
  ctx.fillRect(0, 0, size, size);

  // Continental landmasses
  const continents = [
    { x: 420, y: 460, rx: 110, ry: 190, color: '#386a3d' }, // Africa
    { x: 560, y: 320, rx: 220, ry: 130, color: '#4a7541' }, // Eurasia
    { x: 210, y: 320, rx: 140, ry: 120, color: '#3d6c38' }, // North America
    { x: 260, y: 620, rx: 90, ry: 170, color: '#2d6835' },  // South America
    { x: 740, y: 620, rx: 100, ry: 80, color: '#b89458' },  // Australia
  ];

  continents.forEach((c) => {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.rx, c.ry, Math.random() * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Swirling white atmospheric cloud systems
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = 100 + Math.random() * (size - 200);
    const w = 60 + Math.random() * 160;
    const h = 18 + Math.random() * 45;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, (Math.random() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, size, 70); // North pole
  ctx.fillRect(0, size - 80, size, 80); // South pole

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ------------------------------------------------------------------
// 3. Deep Space Stars & Milky Way Galaxy Band
// ------------------------------------------------------------------
function DeepSpaceStarfield({ opacity }: { opacity: number }) {
  const { geometry, material } = useMemo(() => {
    const count = 9000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const radius = 26000;

    for (let i = 0; i < count; i++) {
      // 60% uniform celestial sphere, 40% concentrated in Milky Way galactic band
      const isMilkyWay = Math.random() < 0.45;
      let theta: number;
      let phi: number;

      if (isMilkyWay) {
        theta = Math.random() * Math.PI * 2;
        // Narrow strip around galactic equator
        phi = Math.PI / 2 + (Math.random() - 0.5) * 0.45;
      } else {
        theta = Math.random() * Math.PI * 2;
        phi = Math.acos(2 * Math.random() - 1);
      }

      const r = radius * (0.85 + Math.random() * 0.3);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Star color temperatures: White, Blue-White, Pale Golden Amber
      const colorType = Math.random();
      if (colorType > 0.75) {
        // Hot blue-white star
        colors[i * 3] = 0.75;
        colors[i * 3 + 1] = 0.88;
        colors[i * 3 + 2] = 1.0;
      } else if (colorType > 0.3) {
        // Pure crisp white
        colors[i * 3] = 0.98;
        colors[i * 3 + 1] = 0.98;
        colors[i * 3 + 2] = 1.0;
      } else {
        // Warm golden star
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.88;
        colors[i * 3 + 2] = 0.68;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: false,
    });

    return { geometry: geom, material: mat };
  }, []);

  useFrame(() => {
    material.opacity = opacity;
  });

  if (opacity <= 0.01) return null;

  return <points geometry={geometry} material={material} />;
}

// ------------------------------------------------------------------
// 4. Main SpaceEnvironment Component
// ------------------------------------------------------------------
interface SpaceProps {
  altitude: number;
  rocketPos: THREE.Vector3;
}

export const SpaceEnvironment: React.FC<SpaceProps> = ({ altitude, rocketPos }) => {
  const moonRef = useRef<THREE.Group>(null);
  const marsRef = useRef<THREE.Group>(null);

  const moonTexture = useMemo(() => createMoonTextures(), []);
  const marsTexture = useMemo(() => createMarsTexture(), []);
  const earthTexture = useMemo(() => createEarthGlobeTexture(), []);

  // Space factor: 0.0 at Earth surface -> 1.0 in deep space (4500m+)
  const spaceFactor = useMemo(() => {
    return THREE.MathUtils.clamp((altitude - 1200) / 4000, 0, 1);
  }, [altitude]);

  // Rotate moon & mars slowly on their axes
  useFrame((_, delta) => {
    if (moonRef.current) moonRef.current.rotation.y += delta * 0.02;
    if (marsRef.current) marsRef.current.rotation.y += delta * 0.015;
  });

  return (
    <group>
      {/* 1. Deep Space Pitch-Black Void & Stars (Fades in as altitude increases) */}
      <DeepSpaceStarfield opacity={spaceFactor} />

      {/* 2. Realistic 3D Moon Body (Pure natural Moon, NO artificial ring) */}
      <group ref={moonRef} position={MOON_POSITION.toArray()}>
        {/* Moon Sphere */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[MOON_RADIUS, 64, 64]} />
          <meshStandardMaterial
            map={moonTexture}
            roughness={0.94}
            metalness={0.04}
          />
        </mesh>

        {/* Subtle Lunar Limb Atmospheric Glow */}
        <mesh scale={[1.02, 1.02, 1.02]}>
          <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
          <meshBasicMaterial
            color="#e2e8f0"
            side={THREE.BackSide}
            transparent
            opacity={0.12 * spaceFactor}
          />
        </mesh>

        {/* Lunar Surface Landing Pad (Tranquility Base) */}
        <group position={[0, MOON_RADIUS, 0]}>
          {/* Circular Landing Blast Pad */}
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[22, 23, 0.25, 32]} />
            <meshStandardMaterial color="#383d44" roughness={0.88} metalness={0.15} />
          </mesh>
          {/* Target Bullseye Ring */}
          <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[7, 8.5, 32]} />
            <meshBasicMaterial color="#eab308" side={THREE.DoubleSide} />
          </mesh>
          {/* Target Crosshairs */}
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[18, 0.02, 0.8]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[0.8, 0.02, 18]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>
          {/* 8 Perimeter Runway Hazard Strobe Lights */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const lx = Math.cos(angle) * 21;
            const lz = Math.sin(angle) * 21;
            return (
              <group key={i} position={[lx, 0.4, lz]}>
                <mesh>
                  <cylinderGeometry args={[0.25, 0.35, 0.7, 8]} />
                  <meshStandardMaterial color="#475569" />
                </mesh>
                <mesh position={[0, 0.45, 0]}>
                  <sphereGeometry args={[0.22, 8, 8]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
              </group>
            );
          })}
        </group>
      </group>

      {/* 2B. Realistic 3D Mars Planet Body (Red Planet with Ares Base 1) */}
      <group ref={marsRef} position={MARS_POSITION.toArray()}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[MARS_RADIUS, 64, 64]} />
          <meshStandardMaterial map={marsTexture} roughness={0.92} metalness={0.06} />
        </mesh>
        <mesh scale={[1.025, 1.025, 1.025]}>
          <sphereGeometry args={[MARS_RADIUS, 32, 32]} />
          <meshBasicMaterial color="#ea580c" side={THREE.BackSide} transparent opacity={0.22 * spaceFactor} />
        </mesh>
        {/* Martian Ares Base 1 Landing Pad */}
        <group position={[0, MARS_RADIUS, 0]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[24, 25, 0.25, 32]} />
            <meshStandardMaterial color="#2d1308" roughness={0.9} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[8, 9.8, 32]} />
            <meshBasicMaterial color="#f97316" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.27, 0]}><boxGeometry args={[20, 0.02, 0.9]} /><meshBasicMaterial color="#f97316" /></mesh>
          <mesh position={[0, 0.27, 0]}><boxGeometry args={[0.9, 0.02, 20]} /><meshBasicMaterial color="#f97316" /></mesh>
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(angle) * 23, 0.4, Math.sin(angle) * 23]}>
                <mesh><cylinderGeometry args={[0.25, 0.35, 0.7, 8]} /><meshStandardMaterial color="#334155" /></mesh>
                <mesh position={[0, 0.45, 0]}><sphereGeometry args={[0.22, 8, 8]} /><meshBasicMaterial color="#f97316" /></mesh>
              </group>
            );
          })}
        </group>
      </group>

      {/* 3. Distant Realistic 3D Sun in Deep Space */}
      {spaceFactor > 0.05 && (
        <group position={SUN_POSITION.toArray()}>
          {/* Blinding White Solar Core Sphere */}
          <mesh>
            <sphereGeometry args={[1400, 32, 32]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          {/* Radiant Solar Corona Flare */}
          <mesh scale={[1.4, 1.4, 1.4]}>
            <sphereGeometry args={[1400, 32, 32]} />
            <meshBasicMaterial
              color="#fffce8"
              transparent
              opacity={0.45 * spaceFactor}
              side={THREE.BackSide}
            />
          </mesh>
          {/* Outer Golden Solar Halo */}
          <mesh scale={[2.4, 2.4, 2.4]}>
            <sphereGeometry args={[1400, 32, 32]} />
            <meshBasicMaterial
              color="#fde047"
              transparent
              opacity={0.15 * spaceFactor}
              side={THREE.BackSide}
            />
          </mesh>
          {/* High-Intensity Sunlight Casting Crisp Space Shadows */}
          <directionalLight
            position={[0, 0, 0]}
            intensity={3.5 * spaceFactor}
            color="#fffcf2"
            castShadow={false}
          />
        </group>
      )}

      {/* 4. Planet Earth Globe (Seen looking back from Orbit / Space) */}
      {spaceFactor > 0.35 && (
        <group position={[0, -1800, 0]}>
          {/* Main Earth Sphere */}
          <mesh>
            <sphereGeometry args={[1800, 64, 64]} />
            <meshStandardMaterial
              map={earthTexture}
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>

          {/* Luminous Blue Atmospheric Limb Glow Ring */}
          <mesh scale={[1.02, 1.02, 1.02]}>
            <sphereGeometry args={[1800, 32, 32]} />
            <meshBasicMaterial
              color="#0284c7"
              side={THREE.BackSide}
              transparent
              opacity={0.35 * spaceFactor}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

