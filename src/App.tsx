import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { RealisticLandscape } from './RealisticLandscape';
import { SpaceEnvironment, MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';

// Preload 3D Models
useGLTF.preload('/models/buran_energia_launchpad.glb');
useGLTF.preload('/models/rocket.glb');

const MOON_TOUCHDOWN_Y = MOON_POSITION.y + MOON_RADIUS + 0.2;
const MOON_LANDING_SITE = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y, MOON_POSITION.z);
const MOON_APPROACH_POINT = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y + 180, MOON_POSITION.z);

// -------------------------------------------------------------
// 1. Buran-Energia Launchpad Model (Positioned on Earth at [0, 0, 0])
// -------------------------------------------------------------
function BuranLaunchpad() {
  const { scene } = useGLTF('/models/buran_energia_launchpad.glb');

  const alignedPad = useMemo(() => {
    const clone = scene.clone();
    clone.position.set(0, 24.03, -2.85);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        if (child.name === 'Object_1158' || child.name === 'Object_1157') {
          child.visible = false;
        }
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={alignedPad} />;
}

// -------------------------------------------------------------
// 2. Active Rocket with Multi-Engine Flames, RCS & Gimbal
// -------------------------------------------------------------
interface RocketMeshProps {
  isFlying: boolean;
  isLanded: boolean;
  throttle: number;
  rocketPos: THREE.Vector3;
  rocketQuat: THREE.Quaternion;
  rcsActive: { pitch: number; yaw: number };
}

function ActiveRocketMesh({
  isFlying,
  isLanded,
  throttle,
  rocketPos,
  rocketQuat,
  rcsActive,
}: RocketMeshProps) {
  const { scene } = useGLTF('/models/rocket.glb');
  const groupRef = useRef<THREE.Group>(null);
  const flameGroupRef = useRef<THREE.Group>(null);
  const flameOuterRef = useRef<THREE.Mesh>(null);
  const flameCoreRef = useRef<THREE.Mesh>(null);
  const boosterFlamesRef = useRef<THREE.Group>(null);
  const flameLightRef = useRef<THREE.PointLight>(null);

  // RCS Thruster Puffs
  const rcsPuffLeftRef = useRef<THREE.Mesh>(null);
  const rcsPuffRightRef = useRef<THREE.Mesh>(null);
  const rcsPuffFrontRef = useRef<THREE.Mesh>(null);
  const rcsPuffBackRef = useRef<THREE.Mesh>(null);

  // Center rocket model with base at y = 0
  const centeredRocket = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);

    clone.position.x = -center.x;
    clone.position.y = -box.min.y;
    clone.position.z = -center.z;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Apply translation and rotation
    groupRef.current.position.copy(rocketPos);
    groupRef.current.quaternion.copy(rocketQuat);

    const isBurning = isFlying && !isLanded && throttle > 0.05;
    const isSpace = rocketPos.y > 3500;

    if (isBurning) {
      const flicker = 1.0 + Math.sin(state.clock.elapsedTime * 45) * 0.16;
      const plumeWidth = isSpace ? 2.5 : 1.4;
      const plumeLength = (6.0 + throttle * 4.5) * flicker;

      if (flameCoreRef.current) {
        flameCoreRef.current.visible = true;
        flameCoreRef.current.scale.set(plumeWidth * 0.55, plumeLength * 0.7, plumeWidth * 0.55);
      }
      if (flameOuterRef.current) {
        flameOuterRef.current.visible = true;
        flameOuterRef.current.scale.set(plumeWidth, plumeLength, plumeWidth);
      }
      if (boosterFlamesRef.current) {
        boosterFlamesRef.current.visible = true;
        const bs = (0.7 + throttle * 0.4) * flicker;
        boosterFlamesRef.current.scale.set(bs, bs * (isSpace ? 1.4 : 1.05), bs);
      }
      if (flameLightRef.current) {
        flameLightRef.current.intensity = throttle * (isSpace ? 35 : 22);
      }

      // Nozzle Gimbaling
      if (flameGroupRef.current) {
        flameGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          flameGroupRef.current.rotation.z,
          rcsActive.yaw * 0.12,
          delta * 8
        );
        flameGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          flameGroupRef.current.rotation.x,
          rcsActive.pitch * 0.12,
          delta * 8
        );
      }

      // Visual RCS Puffs
      if (rcsPuffLeftRef.current) rcsPuffLeftRef.current.visible = rcsActive.yaw > 0;
      if (rcsPuffRightRef.current) rcsPuffRightRef.current.visible = rcsActive.yaw < 0;
      if (rcsPuffFrontRef.current) rcsPuffFrontRef.current.visible = rcsActive.pitch > 0;
      if (rcsPuffBackRef.current) rcsPuffBackRef.current.visible = rcsActive.pitch < 0;
    } else {
      if (flameCoreRef.current) flameCoreRef.current.visible = false;
      if (flameOuterRef.current) flameOuterRef.current.visible = false;
      if (boosterFlamesRef.current) boosterFlamesRef.current.visible = false;
      if (flameLightRef.current) flameLightRef.current.intensity = 0;
      if (rcsPuffLeftRef.current) rcsPuffLeftRef.current.visible = false;
      if (rcsPuffRightRef.current) rcsPuffRightRef.current.visible = false;
      if (rcsPuffFrontRef.current) rcsPuffFrontRef.current.visible = false;
      if (rcsPuffBackRef.current) rcsPuffBackRef.current.visible = false;
    }
  });

  const ROCKET_SCALE = 1.2;

  // 4 Strap-on booster engine offsets
  const boosterOffsets: [number, number, number][] = [
    [1.75, -2.1, 0],
    [-1.75, -2.1, 0],
    [0, -2.1, 1.75],
    [0, -2.1, -1.75],
  ];

  return (
    <group ref={groupRef} position={[0, 0.2, 0]}>
      {/* 3D Rocket Model */}
      <group scale={[ROCKET_SCALE, ROCKET_SCALE, ROCKET_SCALE]}>
        <primitive object={centeredRocket} />
      </group>

      {/* Engine Exhaust Flames Group */}
      <group ref={flameGroupRef}>
        {/* Core Main Engine Flame */}
        <mesh
          ref={flameOuterRef}
          position={[0, -2.4, 0]}
          rotation={[Math.PI, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[1.5, 6.5, 16]} />
          <meshBasicMaterial color="#ff7700" transparent opacity={0.88} />
        </mesh>
        <mesh
          ref={flameCoreRef}
          position={[0, -1.8, 0]}
          rotation={[Math.PI, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.85, 4.2, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* 4 Strap-On Booster Engine Flames */}
        <group ref={boosterFlamesRef} visible={false}>
          {boosterOffsets.map(([bx, by, bz], idx) => (
            <group key={idx} position={[bx, by, bz]}>
              <mesh rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.8, 4.8, 12]} />
                <meshBasicMaterial color="#ff8800" transparent opacity={0.85} />
              </mesh>
              <mesh position={[0, 0.4, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.45, 3.2, 12]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* Thruster Illumination Light */}
      <pointLight
        ref={flameLightRef}
        position={[0, -2.5, 0]}
        color="#ff8800"
        intensity={0}
        distance={220}
        decay={2}
      />

      {/* RCS Steering Cold-Gas Puffs at Nose */}
      <mesh ref={rcsPuffLeftRef} position={[-1.2, 18, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <coneGeometry args={[0.35, 1.6, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
      <mesh ref={rcsPuffRightRef} position={[1.2, 18, 0]} rotation={[0, 0, -Math.PI / 2]} visible={false}>
        <coneGeometry args={[0.35, 1.6, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
      <mesh ref={rcsPuffFrontRef} position={[0, 18, 1.2]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.35, 1.6, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
      <mesh ref={rcsPuffBackRef} position={[0, 18, -1.2]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.35, 1.6, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// 3. Moon Landing Flag & Base Marker
// -------------------------------------------------------------
function LunarLandingSiteMarker({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <group position={[MOON_LANDING_SITE.x + 4.5, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z - 4]}>
      {/* Flagpole */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 5]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      {/* Mission Flag Banner */}
      <mesh position={[1.1, 4.2, 0]}>
        <boxGeometry args={[2.2, 1.4, 0.04]} />
        <meshStandardMaterial color="#0284c7" roughness={0.3} />
      </mesh>
      {/* Golden Base Plaque */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 0.1, 16]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// -------------------------------------------------------------
// 4. Smooth Close-Up Third-Person Orbit Camera
// -------------------------------------------------------------
interface CameraProps {
  isFlying: boolean;
  rocketPos: THREE.Vector3;
}

function ThirdPersonCameraController({ isFlying, rocketPos }: CameraProps) {
  const controlsRef = useRef<any>(null);
  const prevRocketPos = useRef(new THREE.Vector3(0, 14, 0));
  const { camera } = useThree();

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Focus target at upper-mid section of rocket
    const targetPos = new THREE.Vector3(rocketPos.x, rocketPos.y + 10, rocketPos.z);

    if (isFlying) {
      // Shift camera by the exact delta vector so mouse viewing angle is 100% preserved
      const deltaMove = new THREE.Vector3().subVectors(targetPos, prevRocketPos.current);
      camera.position.add(deltaMove);

      controls.target.copy(targetPos);
      prevRocketPos.current.copy(targetPos);
    } else {
      // Standby on launchpad
      controls.target.set(0, 14, 0);
      prevRocketPos.current.set(0, 14, 0);
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 14, 0]}
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      minDistance={7}    // Close-up view of rocket details
      maxDistance={60}   // Zoom out for wide scenic view
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={1.2}
    />
  );
}

// -------------------------------------------------------------
// 5. Loading Progress Indicator
// -------------------------------------------------------------
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="bg-black/85 text-white px-6 py-4 rounded-xl border border-cyan-500/40 text-center font-sans shadow-2xl backdrop-blur-md">
        <div className="text-sm font-semibold tracking-wide text-cyan-400 mb-2">
          Initializing Flight & Solar System...
        </div>
        <div className="w-52 bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
          <div
            className="bg-cyan-400 h-full transition-all duration-200"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2 font-mono">{Math.round(progress)}%</div>
      </div>
    </Html>
  );
}

// -------------------------------------------------------------
// 6. Main Application: Manual Flight + Instant Autopilot Recovery
// -------------------------------------------------------------
export default function App() {
  const [isFlying, setIsFlying] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [throttle, setThrottle] = useState(1.0);

  const [stats, setStats] = useState({
    altitude: 0,
    speed: 0,
    moonDist: 19500,
    stage: 'STANDBY ON EARTH PAD',
  });

  // Rocket physical state vectors
  const posRef = useRef(new THREE.Vector3(0, 0.2, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const quatRef = useRef(new THREE.Quaternion());
  const rcsActiveRef = useRef<{ pitch: number; yaw: number }>({ pitch: 0, yaw: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // F or Space to Launch
      if (e.code === 'KeyF' || (e.code === 'Space' && !isFlying)) {
        setIsFlying(true);
      }
      // R to Reset
      if (e.code === 'KeyR') {
        handleReset();
      }
      // T to Toggle Autopilot to Moon
      if (e.code === 'KeyT') {
        setAutopilot((prev) => !prev);
      }
      // Shift / Ctrl for Throttle
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setThrottle((prev) => Math.min(1.0, prev + 0.15));
      }
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        setThrottle((prev) => Math.max(0.1, prev - 0.15));
      }

      // If user presses steering keys, disengage autopilot so manual control takes over
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        if (autopilot) setAutopilot(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isFlying, autopilot]);

  // Main Flight Physics & Autopilot Engine Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (isFlying && !isLanded) {
        const keys = keysRef.current;
        const currentPos = posRef.current;
        const currentAlt = currentPos.y;
        const isSpace = currentAlt > 3500;

        let rcsPitch = 0;
        let rcsYaw = 0;

        // -------------------------------------------------------
        // A. AUTOPILOT MODE (Smooth Guidance to Moon & Flawless Soft Landing)
        // -------------------------------------------------------
        if (autopilot) {
          const altitudeAbovePad = currentPos.y - MOON_LANDING_SITE.y;
          const horizontalDistToPad = Math.hypot(
            currentPos.x - MOON_LANDING_SITE.x,
            currentPos.z - MOON_LANDING_SITE.z
          );

          // 1. TOUCHDOWN CONFIRMED (within 0.5m of pad)
          if (altitudeAbovePad <= 0.5 && horizontalDistToPad <= 8.0) {
            currentPos.copy(MOON_LANDING_SITE);
            velRef.current.set(0, 0, 0);
            quatRef.current.set(0, 0, 0, 1);
            setIsLanded(true);
            setAutopilot(false);
          }
          // 2. POWERED VERTICAL DESCENT (when within 220m of pad and hovering above it)
          else if (horizontalDistToPad < 65 && altitudeAbovePad < 220) {
            // Reorient 100% vertical upright for landing
            const uprightQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(0, 1, 0)
            );
            quatRef.current.slerp(uprightQuat, delta * 4.5);

            // Center horizontally onto landing pad
            currentPos.x = THREE.MathUtils.lerp(currentPos.x, MOON_LANDING_SITE.x, delta * 3.0);
            currentPos.z = THREE.MathUtils.lerp(currentPos.z, MOON_LANDING_SITE.z, delta * 3.0);

            // Smooth gentle vertical descent velocity (slows to 1.6 m/s near touchdown)
            const descentSpeed = Math.max(1.6, Math.min(30, altitudeAbovePad * 0.38));
            currentPos.y -= descentSpeed * delta;
            velRef.current.set(0, -descentSpeed, 0);
          }
          // 3. TRANSIT & APPROACH TO WAYPOINT (airspace 180m directly above landing pad)
          else {
            const toWaypoint = new THREE.Vector3().subVectors(MOON_APPROACH_POINT, currentPos);
            const distToWaypoint = toWaypoint.length();
            const targetHeading = toWaypoint.clone().normalize();

            // Align rocket heading toward approach point
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              targetHeading
            );
            quatRef.current.slerp(targetQuat, delta * 3.5);

            const forwardDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);

            // Cruise speed: 1400 m/s in deep space, decelerates to 75 m/s near approach point
            const cruiseSpeed = distToWaypoint > 2500 ? 1400 : Math.max(65, distToWaypoint * 0.55);
            velRef.current.lerp(forwardDir.multiplyScalar(cruiseSpeed), delta * 2.8);

            currentPos.addScaledVector(velRef.current, delta);
          }
        }
        // -------------------------------------------------------
        // B. MANUAL FLIGHT MODE (Direct Responsive Player Control)
        // -------------------------------------------------------
        else {
          const turnSpeed = isSpace ? 1.6 : 1.2;

          // Manual Pitch (W: Nose forward/down, S: Nose up)
          if (keys['KeyW'] || keys['ArrowDown']) {
            rotRef.current.x -= turnSpeed * delta;
            rcsPitch = -1;
          }
          if (keys['KeyS'] || keys['ArrowUp']) {
            rotRef.current.x += turnSpeed * delta;
            rcsPitch = 1;
          }

          // Manual Yaw (A: Steer Left, D: Steer Right)
          if (keys['KeyA'] || keys['ArrowLeft']) {
            rotRef.current.y += turnSpeed * delta;
            rcsYaw = -1;
          }
          if (keys['KeyD'] || keys['ArrowRight']) {
            rotRef.current.y -= turnSpeed * delta;
            rcsYaw = 1;
          }

          // Roll (Q / E)
          if (keys['KeyQ']) rotRef.current.z += turnSpeed * delta;
          if (keys['KeyE']) rotRef.current.z -= turnSpeed * delta;

          // Update Quaternion from Euler
          quatRef.current.setFromEuler(rotRef.current);

          // Thrust acceleration along rocket's longitudinal axis (+Y)
          const forwardDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);

          const spaceBoost = THREE.MathUtils.clamp((currentAlt - 2000) / 4000, 0, 1);
          const accel = (38 + spaceBoost * 85) * throttle;

          velRef.current.addScaledVector(forwardDir, accel * delta);

          // Atmospheric gravity near Earth
          if (currentAlt < 2500) {
            velRef.current.y -= 9.8 * (1 - currentAlt / 2500) * delta;
          }

          // Update Position
          currentPos.addScaledVector(velRef.current, delta);

          // Check if manually arrived at Moon landing site or contacted surface
          const distToSite = currentPos.distanceTo(MOON_LANDING_SITE);
          const distFromMoonCenter = currentPos.distanceTo(MOON_POSITION);

          if (distToSite < 24 || (distFromMoonCenter <= MOON_RADIUS + 2.0 && currentAlt > 10000)) {
            currentPos.copy(MOON_LANDING_SITE);
            velRef.current.set(0, 0, 0);
            quatRef.current.set(0, 0, 0, 1);
            setIsLanded(true);
          }
        }

        rcsActiveRef.current = { pitch: rcsPitch, yaw: rcsYaw };

        // Telemetry Update
        const moonDist = Math.max(0, Math.round(currentPos.distanceTo(MOON_POSITION) - MOON_RADIUS));
        const speedKmH = Math.round(velRef.current.length() * 3.6);

        let stage = 'STAGE 1: ATMOSPHERIC ASCENT';
        if (currentAlt > 1200 && currentAlt < 4000) stage = 'STAGE 2: STRATOSPHERE TRANSITION';
        else if (currentAlt >= 4000 && currentAlt < 10000) stage = 'STAGE 3: TRANSLUNAR INJECTION';
        else if (currentAlt >= 10000 && moonDist > 3000) stage = 'STAGE 4: DEEP SPACE CISLUNAR CRUISE';
        else if (moonDist <= 3000 && moonDist > 500) stage = 'STAGE 5: LUNAR APPROACH & DESCENT';
        else if (moonDist <= 500 && !isLanded) stage = 'STAGE 6: FINAL TOUCHDOWN APPROACH';
        else if (isLanded) stage = '🌕 MISSION COMPLETE: TOUCHDOWN ON MOON!';

        setStats({
          altitude: Math.round(currentAlt),
          speed: isLanded ? 0 : speedKmH,
          moonDist,
          stage,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isFlying, isLanded, autopilot, throttle]);

  const handleLaunch = () => {
    setIsFlying(true);
    setIsLanded(false);
  };

  const handleReset = () => {
    setIsFlying(false);
    setIsLanded(false);
    setAutopilot(false);
    setThrottle(1.0);
    posRef.current.set(0, 0.2, 0);
    velRef.current.set(0, 0, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
    rcsActiveRef.current = { pitch: 0, yaw: 0 };
    setStats({
      altitude: 0,
      speed: 0,
      moonDist: 19500,
      stage: 'STANDBY ON EARTH PAD',
    });
  };

  // Helper for on-screen D-pad steering buttons
  const handleDpadPress = (code: string) => {
    keysRef.current[code] = true;
    if (autopilot) setAutopilot(false); // Yield to player manual steering
  };
  const handleDpadRelease = (code: string) => {
    keysRef.current[code] = false;
  };

  const isInSpace = stats.altitude > 3500;

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none font-sans transition-colors duration-1000 ${
        isInSpace ? 'bg-[#000003]' : 'bg-[#87ceeb]'
      }`}
    >
      {/* ================= TOP HEADER & MISSION BADGE ================= */}
      <div className="absolute top-4 left-4 z-10 bg-black/75 backdrop-blur-md px-4 py-3 rounded-xl border border-cyan-500/30 text-white flex items-center gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-cyan-400">Z-SPACE</h1>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono rounded font-bold border ${
                autopilot
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-400 animate-pulse'
                  : 'bg-amber-950/80 text-amber-300 border-amber-400'
              }`}
            >
              {autopilot ? '🤖 AUTOPILOT ACTIVE' : '🎮 MANUAL CONTROL'}
            </span>
          </div>
          <p className="text-xs text-gray-300 font-medium">Earth-to-Moon Interactive Mission</p>
        </div>
        <div className="h-8 w-[1px] bg-white/20" />
        <div className="text-xs font-mono">
          <div className="text-gray-400 text-[10px]">MISSION STATUS:</div>
          <div
            className={`font-bold ${
              isLanded
                ? 'text-emerald-400 animate-pulse'
                : isFlying
                ? 'text-cyan-300'
                : 'text-gray-300'
            }`}
          >
            {stats.stage}
          </div>
        </div>
      </div>

      {/* ================= FLIGHT TELEMETRY HUD ================= */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        <div className="bg-black/80 backdrop-blur-md px-5 py-3 rounded-xl border border-cyan-500/40 text-white font-mono flex items-center gap-6 shadow-2xl">
          {/* Altitude */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Altitude</div>
            <div className="text-lg font-bold text-cyan-300">
              {stats.altitude >= 10000
                ? `${(stats.altitude / 1000).toFixed(1)} km`
                : `${stats.altitude.toLocaleString()} m`}
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/20" />
          {/* Velocity */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Velocity</div>
            <div className="text-lg font-bold text-amber-300">
              {stats.speed.toLocaleString()} km/h
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/20" />
          {/* Moon Distance */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Distance to Moon</div>
            <div
              className={`text-lg font-bold ${
                isLanded ? 'text-emerald-400' : 'text-purple-300'
              }`}
            >
              {isLanded ? '0 m (TOUCHDOWN)' : `${stats.moonDist.toLocaleString()} m`}
            </div>
          </div>
        </div>

        {/* Throttle Bar Gauge */}
        {isFlying && !isLanded && (
          <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-white font-mono flex items-center justify-between text-xs shadow-lg">
            <span className="text-gray-400 text-[10px]">THROTTLE:</span>
            <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden mx-2 border border-gray-700">
              <div
                className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-150"
                style={{ width: `${Math.round(throttle * 100)}%` }}
              />
            </div>
            <span className="font-bold text-amber-400">{Math.round(throttle * 100)}%</span>
          </div>
        )}
      </div>

      {/* ================= TOUCHDOWN CELEBRATION BANNER ================= */}
      {isLanded && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/90 backdrop-blur-md px-8 py-4 rounded-2xl border-2 border-emerald-400 text-center shadow-[0_0_45px_rgba(16,185,129,0.7)] animate-bounce">
          <div className="text-emerald-400 font-extrabold text-base tracking-wider uppercase flex items-center justify-center gap-2">
            <span>🌕</span>
            <span>TOUCHDOWN CONFIRMED: SUCCESSFUL MOON LANDING!</span>
            <span>🚀</span>
          </div>
          <div className="text-xs text-emerald-200 font-mono mt-1">
            The rocket has landed safely on the lunar surface. Apollo Flag planted!
          </div>
        </div>
      )}

      {/* ================= BOTTOM LEFT: INTERACTIVE D-PAD & GUIDE ================= */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2.5">
        {/* On-Screen Mouse & Touch Steering D-Pad */}
        {isFlying && !isLanded && (
          <div className="bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-1.5 select-none">
            <div className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-0.5">
              Manual Steering
            </div>
            {/* Pitch Down (Nose Forward) */}
            <button
              onMouseDown={() => handleDpadPress('KeyW')}
              onMouseUp={() => handleDpadRelease('KeyW')}
              onTouchStart={() => handleDpadPress('KeyW')}
              onTouchEnd={() => handleDpadRelease('KeyW')}
              className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
              title="Pitch Down [W]"
            >
              ▲
            </button>
            <div className="flex items-center gap-1.5">
              {/* Steer Left */}
              <button
                onMouseDown={() => handleDpadPress('KeyA')}
                onMouseUp={() => handleDpadRelease('KeyA')}
                onTouchStart={() => handleDpadPress('KeyA')}
                onTouchEnd={() => handleDpadRelease('KeyA')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
                title="Steer Left [A]"
              >
                ◀
              </button>
              {/* Pitch Up */}
              <button
                onMouseDown={() => handleDpadPress('KeyS')}
                onMouseUp={() => handleDpadRelease('KeyS')}
                onTouchStart={() => handleDpadPress('KeyS')}
                onTouchEnd={() => handleDpadRelease('KeyS')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
                title="Pitch Up [S]"
              >
                ▼
              </button>
              {/* Steer Right */}
              <button
                onMouseDown={() => handleDpadPress('KeyD')}
                onMouseUp={() => handleDpadRelease('KeyD')}
                onTouchStart={() => handleDpadPress('KeyD')}
                onTouchEnd={() => handleDpadRelease('KeyD')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
                title="Steer Right [D]"
              >
                ▶
              </button>
            </div>
          </div>
        )}

        {/* Clean Controls Guide Badge */}
        <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs text-gray-200 flex flex-col gap-1 shadow-xl">
          <div className="font-semibold text-cyan-300">Controls:</div>
          <div className="text-[11px] font-mono text-gray-300">
            • <strong>[ W / A / S / D ]</strong>: Manual Pitch & Steer Rocket
          </div>
          <div className="text-[11px] font-mono text-gray-300">
            • <strong>[ T ]</strong>: Auto-Pilot Rescue (Fly Straight to Moon)
          </div>
          <div className="text-[11px] font-mono text-gray-300">
            • <strong>Left Click + Drag</strong>: 360° Free Camera Orbit around Rocket
          </div>
          <div className="text-[11px] font-mono text-gray-300">
            • <strong>Scroll Wheel</strong>: Zoom In Close-Up / Zoom Out
          </div>
        </div>
      </div>

      {/* ================= BOTTOM RIGHT: ACTION BUTTONS ================= */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
        {/* Dedicated Autopilot & Landing Toggle Button */}
        {isFlying && !isLanded && (
          <button
            onClick={() => setAutopilot((prev) => !prev)}
            className={`px-5 py-3.5 text-xs font-bold font-mono tracking-wider rounded-xl border transition-all cursor-pointer shadow-2xl flex items-center gap-2 transform active:scale-95 ${
              autopilot
                ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.8)] animate-pulse'
                : stats.moonDist < 2500
                ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-bounce'
                : 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 border-purple-300/40 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
            }`}
          >
            <span>{autopilot ? '🤖' : stats.moonDist < 2500 ? '🌕' : '🎯'}</span>
            <span>
              {autopilot
                ? stats.moonDist < 300
                  ? '🌕 SOFT TOUCHDOWN IN PROGRESS...'
                  : '🤖 AUTOPILOT ON: FLYING TO MOON [Press T to Disengage]'
                : stats.moonDist < 2500
                ? '🌕 INITIATE SOFT MOON LANDING [Press T]'
                : 'ACTIVATE AUTOPILOT [Press T]'}
            </span>
          </button>
        )}

        {!isFlying ? (
          <button
            onClick={handleLaunch}
            className="px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 transform hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🚀</span>
            <span>LAUNCH ROCKET [Press F]</span>
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs tracking-wider rounded-xl border border-white/20 shadow-lg cursor-pointer transition-all flex items-center gap-2"
          >
            <span>🔄</span>
            <span>RESET TO EARTH [Press R]</span>
          </button>
        )}
      </div>

      {/* ================= 3D WEBGL CANVAS ================= */}
      <Canvas
        shadows
        camera={{
          position: [14, 18, 22], // Close-up 3rd-person view
          fov: 45,
          near: 0.5,
          far: 75000,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
      >
        {/* Natural Sun & Daylight Lighting (On Earth) */}
        {!isInSpace && (
          <>
            <ambientLight intensity={0.75} color="#f4faff" />
            <directionalLight
              position={[200, 240, 150]}
              intensity={2.6}
              color="#fffdf6"
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-near={10}
              shadow-camera-far={400}
              shadow-camera-left={-80}
              shadow-camera-right={80}
              shadow-camera-top={80}
              shadow-camera-bottom={-80}
              shadow-bias={-0.0001}
            />
            <hemisphereLight args={['#b8e3fd', '#a6dc6e', 0.65]} />
          </>
        )}

        {/* Deep Space Lighting (Stark sunlight in vacuum) */}
        {isInSpace && (
          <ambientLight intensity={0.25} color="#cbd5e1" />
        )}

        {/* Smooth 3rd-Person Orbit Camera */}
        <ThirdPersonCameraController
          isFlying={isFlying}
          rocketPos={posRef.current}
        />

        {/* 3D Scene Components */}
        <Suspense fallback={<Loader />}>
          {/* Earth Landscape & Cosmodrome Facilities */}
          <RealisticLandscape altitude={stats.altitude} />

          {/* Buran-Energia Launchpad on Earth */}
          <BuranLaunchpad />

          {/* Deep Space Stars, Planet Earth Globe, 3D Moon & Distant Sun */}
          <SpaceEnvironment altitude={stats.altitude} rocketPos={posRef.current} />

          {/* Lunar Landing Flag & Base Plaque Marker */}
          <LunarLandingSiteMarker visible={isLanded} />

          {/* Active Rocket with Multi-Engine Flames, RCS & Gimbal */}
          <ActiveRocketMesh
            isFlying={isFlying}
            isLanded={isLanded}
            throttle={throttle}
            rocketPos={posRef.current}
            rocketQuat={quatRef.current}
            rcsActive={rcsActiveRef.current}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
