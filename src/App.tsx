import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { RealisticLandscape } from './RealisticLandscape';
import { SpaceEnvironment, MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';
import { MoonExploration, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE } from './MoonExploration';

// Preload 3D Models
useGLTF.preload('/models/buran_energia_launchpad.glb');
useGLTF.preload('/models/rocket.glb');

export const EARTH_LANDING_SITE = new THREE.Vector3(0, 0.2, 0);
export const EARTH_APPROACH_POINT = new THREE.Vector3(0, 220, 0);
export const MOON_APPROACH_POINT = new THREE.Vector3(MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y + 180, MOON_LANDING_SITE.z);

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
    <group position={[MOON_LANDING_SITE.x + 5.2, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z - 4]}>
      {/* Flagpole */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 5]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      {/* Apollo Mission Flag Banner */}
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
// 4. Universal Third-Person Orbit Camera (Rocket / Astronaut / Rover)
// -------------------------------------------------------------
interface CameraProps {
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  isFlying: boolean;
  rocketPos: THREE.Vector3;
  astronautPos: THREE.Vector3;
  roverPos: THREE.Vector3;
  resetCount: number;
}

function UniversalThirdPersonCamera({
  playerMode,
  isFlying,
  rocketPos,
  astronautPos,
  roverPos,
  resetCount,
}: CameraProps) {
  const controlsRef = useRef<any>(null);
  const prevTargetPos = useRef(new THREE.Vector3(0, 14, 0));
  const { camera } = useThree();

  useEffect(() => {
    if (resetCount > 0) {
      camera.position.set(14, 18, 22);
      prevTargetPos.current.set(0, 14, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 14, 0);
        controlsRef.current.update();
      }
    }
  }, [resetCount, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Determine current target based on playerMode
    const targetPos = new THREE.Vector3();
    if (playerMode === 'ROCKET') {
      targetPos.set(rocketPos.x, rocketPos.y + 10, rocketPos.z);
    } else if (playerMode === 'ASTRONAUT') {
      targetPos.set(astronautPos.x, astronautPos.y + 1.2, astronautPos.z);
    } else if (playerMode === 'ROVER') {
      targetPos.set(roverPos.x, roverPos.y + 1.2, roverPos.z);
    }

    // Shift camera by delta move so mouse chosen viewing angle is 100% preserved
    const deltaMove = new THREE.Vector3().subVectors(targetPos, prevTargetPos.current);
    camera.position.add(deltaMove);

    controls.target.copy(targetPos);
    prevTargetPos.current.copy(targetPos);

    controls.update();
  });

  // Dynamic min/max camera distances per mode
  const minDistance = playerMode === 'ASTRONAUT' ? 2.5 : playerMode === 'ROVER' ? 4.5 : 7;
  const maxDistance = playerMode === 'ASTRONAUT' ? 14 : playerMode === 'ROVER' ? 24 : 65;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 14, 0]}
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      minDistance={minDistance}
      maxDistance={maxDistance}
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
          Initializing Flight & Moon Exploration...
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
// 6. Main Application: Launch -> Space -> Moon Exploration & Rover
// -------------------------------------------------------------
export default function App() {
  const [destination, setDestination] = useState<'MOON' | 'EARTH'>('MOON');
  const [isFlying, setIsFlying] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [throttle, setThrottle] = useState(1.0);
  const [resetCount, setResetCount] = useState(0);

  // Player Exploration Mode: ROCKET -> ASTRONAUT -> ROVER
  const [playerMode, setPlayerMode] = useState<'ROCKET' | 'ASTRONAUT' | 'ROVER'>('ROCKET');

  const [stats, setStats] = useState({
    altitude: 0,
    speed: 0,
    targetDist: 19500,
    destination: 'MOON' as 'MOON' | 'EARTH',
    stage: 'STANDBY ON EARTH PAD',
  });

  const [hudState, setHudState] = useState({
    canEnterRover: false,
    canEnterRocket: false,
    roverSpeed: 0,
  });

  // Entity Position & Vector Refs
  const posRef = useRef(new THREE.Vector3(0, 0.2, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const quatRef = useRef(new THREE.Quaternion());
  const rcsActiveRef = useRef<{ pitch: number; yaw: number }>({ pitch: 0, yaw: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Astronaut & Rover Position Refs on Moon
  const astronautPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8));
  const roverPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5));

  const handleLaunch = () => {
    setIsFlying(true);
    setIsLanded(false);
    setPlayerMode('ROCKET');
    // Liftoff vertical impulse away from landing pad surface
    velRef.current.set(0, 35, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
  };

  const handleReset = () => {
    setIsFlying(false);
    setIsLanded(false);
    setAutopilot(false);
    setDestination('MOON');
    setPlayerMode('ROCKET');
    setThrottle(1.0);
    posRef.current.set(0, 0.2, 0);
    velRef.current.set(0, 0, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
    rcsActiveRef.current = { pitch: 0, yaw: 0 };
    astronautPosRef.current.set(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8);
    roverPosRef.current.set(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5);
    setResetCount((c) => c + 1);
    setStats({
      altitude: 0,
      speed: 0,
      targetDist: 19500,
      destination: 'MOON',
      stage: 'STANDBY ON EARTH PAD',
    });
  };

  // Interaction: Enter/Exit Rocket and Rover via [ E ]
  const handleInteraction = () => {
    const isAtMoon = posRef.current.distanceTo(MOON_LANDING_SITE) < 30;
    if (!isAtMoon && isLanded) return;

    if (playerMode === 'ROCKET') {
      // Exit rocket to astronaut on Moon
      setPlayerMode('ASTRONAUT');
    } else if (playerMode === 'ASTRONAUT') {
      if (hudState.canEnterRover) {
        // Enter Rover
        setPlayerMode('ROVER');
      } else if (hudState.canEnterRocket) {
        // Board Rocket
        setPlayerMode('ROCKET');
      }
    } else if (playerMode === 'ROVER') {
      // Exit Rover back to astronaut on foot
      setPlayerMode('ASTRONAUT');
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // E for Interaction (Exit Rocket, Enter Rover, Board Rocket)
      if (e.code === 'KeyE') {
        handleInteraction();
      }

      // F or Space to Launch (when in Rocket mode and not flying)
      if (playerMode === 'ROCKET' && (e.code === 'KeyF' || (e.code === 'Space' && !isFlying))) {
        handleLaunch();
      }
      // R to Reset to Earth
      if (e.code === 'KeyR') {
        handleReset();
      }
      // T to Toggle Autopilot
      if (playerMode === 'ROCKET' && e.code === 'KeyT') {
        setAutopilot((prev) => !prev);
      }
      // Shift / Ctrl for Throttle
      if (playerMode === 'ROCKET') {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          setThrottle((prev) => Math.min(1.0, prev + 0.15));
        }
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
          setThrottle((prev) => Math.max(0.1, prev - 0.15));
        }
        // Manual steering disengages autopilot
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          if (autopilot) setAutopilot(false);
        }
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
  }, [isFlying, isLanded, playerMode, autopilot, hudState, destination]);

  // Main Rocket Flight Physics & Autopilot Engine Loop
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

        const isTargetMoon = destination === 'MOON';
        const targetPad = isTargetMoon ? MOON_LANDING_SITE : EARTH_LANDING_SITE;
        const approachPoint = isTargetMoon ? MOON_APPROACH_POINT : EARTH_APPROACH_POINT;
        const altitudeAbovePad = isTargetMoon
          ? currentPos.y - MOON_LANDING_SITE.y
          : currentPos.y - EARTH_LANDING_SITE.y;
        const horizontalDistToPad = Math.hypot(
          currentPos.x - targetPad.x,
          currentPos.z - targetPad.z
        );

        // -------------------------------------------------------
        // A. AUTOPILOT MODE (Smooth Interplanetary Guidance & Soft Landing)
        // -------------------------------------------------------
        if (autopilot) {
          // 1. TOUCHDOWN CONFIRMED (within 0.5m of pad and horizontal distance <= 8.0m)
          if (altitudeAbovePad <= 0.5 && horizontalDistToPad <= 8.0) {
            currentPos.copy(targetPad);
            velRef.current.set(0, 0, 0);
            rotRef.current.set(0, 0, 0, 'YXZ');
            quatRef.current.set(0, 0, 0, 1);
            setIsLanded(true);
            setIsFlying(false);
            setAutopilot(false);
            setDestination(isTargetMoon ? 'EARTH' : 'MOON');
          }
          // 2. POWERED VERTICAL DESCENT (when within 220m of pad and hovering above it)
          else if (horizontalDistToPad < 65 && altitudeAbovePad < 220) {
            const uprightQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(0, 1, 0)
            );
            quatRef.current.slerp(uprightQuat, delta * 4.5);

            // Center horizontally onto landing pad
            currentPos.x = THREE.MathUtils.lerp(currentPos.x, targetPad.x, delta * 3.0);
            currentPos.z = THREE.MathUtils.lerp(currentPos.z, targetPad.z, delta * 3.0);

            // Smooth gentle vertical descent velocity (slows to 1.6 m/s near touchdown)
            const descentSpeed = Math.max(1.6, Math.min(30, altitudeAbovePad * 0.38));
            currentPos.y -= descentSpeed * delta;
            velRef.current.set(0, -descentSpeed, 0);
          }
          // 3. TRANSIT & APPROACH TO WAYPOINT (airspace directly above landing pad)
          else {
            const toWaypoint = new THREE.Vector3().subVectors(approachPoint, currentPos);
            const distToWaypoint = toWaypoint.length();
            const targetHeading = toWaypoint.clone().normalize();

            const targetQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              targetHeading
            );
            quatRef.current.slerp(targetQuat, delta * 3.5);

            const forwardDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);

            const cruiseSpeed = distToWaypoint > 2500 ? 1400 : Math.max(65, distToWaypoint * 0.55);
            velRef.current.lerp(forwardDir.multiplyScalar(cruiseSpeed), delta * 2.8);

            currentPos.addScaledVector(velRef.current, delta);
          }
        }
        // -------------------------------------------------------
        // B. MANUAL FLIGHT MODE (Direct Player Control)
        // -------------------------------------------------------
        else if (playerMode === 'ROCKET') {
          const turnSpeed = isSpace ? 1.6 : 1.2;

          if (keys['KeyW'] || keys['ArrowDown']) {
            rotRef.current.x -= turnSpeed * delta;
            rcsPitch = -1;
          }
          if (keys['KeyS'] || keys['ArrowUp']) {
            rotRef.current.x += turnSpeed * delta;
            rcsPitch = 1;
          }
          if (keys['KeyA'] || keys['ArrowLeft']) {
            rotRef.current.y += turnSpeed * delta;
            rcsYaw = -1;
          }
          if (keys['KeyD'] || keys['ArrowRight']) {
            rotRef.current.y -= turnSpeed * delta;
            rcsYaw = 1;
          }
          if (keys['KeyQ']) rotRef.current.z += turnSpeed * delta;
          if (keys['KeyE']) rotRef.current.z -= turnSpeed * delta;

          quatRef.current.setFromEuler(rotRef.current);

          const forwardDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);
          const spaceBoost = THREE.MathUtils.clamp((currentAlt - 2000) / 4000, 0, 1);
          const accel = (38 + spaceBoost * 85) * throttle;

          velRef.current.addScaledVector(forwardDir, accel * delta);

          // Gravity pull near Earth
          if (currentAlt < 2500 && Math.hypot(currentPos.x, currentPos.z) < 3000) {
            velRef.current.y -= 9.8 * (1 - currentAlt / 2500) * delta;
          }

          currentPos.addScaledVector(velRef.current, delta);

          // Prevent clipping into planets
          if (destination === 'EARTH' && currentPos.y < 0.2 && Math.hypot(currentPos.x, currentPos.z) < 150) {
            currentPos.y = 0.2;
          }

          // Manual Landing Checks
          if (isTargetMoon) {
            const distToSite = currentPos.distanceTo(MOON_LANDING_SITE);
            const distFromMoonCenter = currentPos.distanceTo(MOON_POSITION);

            if (distToSite < 24 || (distFromMoonCenter <= MOON_RADIUS + 2.0 && currentAlt > 10000)) {
              currentPos.copy(MOON_LANDING_SITE);
              velRef.current.set(0, 0, 0);
              rotRef.current.set(0, 0, 0, 'YXZ');
              quatRef.current.set(0, 0, 0, 1);
              setIsLanded(true);
              setIsFlying(false);
              setDestination('EARTH');
            }
          } else {
            // Destination is Earth
            const distToEarthPad = Math.hypot(currentPos.x - EARTH_LANDING_SITE.x, currentPos.z - EARTH_LANDING_SITE.z);
            if (currentPos.y <= 0.6 && distToEarthPad < 25) {
              currentPos.copy(EARTH_LANDING_SITE);
              velRef.current.set(0, 0, 0);
              rotRef.current.set(0, 0, 0, 'YXZ');
              quatRef.current.set(0, 0, 0, 1);
              setIsLanded(true);
              setIsFlying(false);
              setDestination('MOON');
            }
          }
        }

        rcsActiveRef.current = { pitch: rcsPitch, yaw: rcsYaw };

        // Telemetry Update
        const moonDist = Math.max(0, Math.round(currentPos.distanceTo(MOON_POSITION) - MOON_RADIUS));
        const earthDist = Math.round(currentPos.distanceTo(EARTH_LANDING_SITE));
        const speedKmH = Math.round(velRef.current.length() * 3.6);
        const targetDist = isTargetMoon ? moonDist : earthDist;

        let stage = '';
        if (isTargetMoon) {
          if (!isFlying && !isLanded) stage = 'STANDBY ON EARTH PAD';
          else if (currentAlt < 1200) stage = 'STAGE 1: ATMOSPHERIC ASCENT';
          else if (currentAlt >= 1200 && currentAlt < 4000) stage = 'STAGE 2: STRATOSPHERE TRANSITION';
          else if (currentAlt >= 4000 && currentAlt < 10000) stage = 'STAGE 3: TRANSLUNAR INJECTION (TLI)';
          else if (currentAlt >= 10000 && moonDist > 3000) stage = 'STAGE 4: CISLUNAR DEEP SPACE CRUISE';
          else if (moonDist <= 3000 && moonDist > 500) stage = 'STAGE 5: LUNAR APPROACH & RETRO-BURN';
          else if (moonDist <= 500 && !isLanded) stage = 'STAGE 6: FINAL TOUCHDOWN ON MOON PAD';
          else if (isLanded) stage = '🌕 MISSION COMPLETE: TOUCHDOWN ON MOON!';
        } else {
          if (!isFlying && isLanded) stage = 'LUNAR BASE: ASCENT MODULE READY FOR EARTH LAUNCH';
          else if (moonDist < 800) stage = 'RETURN STAGE 1: LUNAR LIFTOFF & ASCENT';
          else if (moonDist >= 800 && moonDist < 3500) stage = 'RETURN STAGE 2: TRANS-EARTH INJECTION (TEI)';
          else if (moonDist >= 3500 && targetDist > 3500) stage = 'RETURN STAGE 3: DEEP SPACE TRANSIT TO EARTH';
          else if (targetDist <= 3500 && targetDist > 500) stage = 'RETURN STAGE 4: EARTH ATMOSPHERE RE-ENTRY';
          else if (targetDist <= 500 && !isLanded) stage = 'RETURN STAGE 5: POWERED RETRO-BURN DESCENT';
          else if (isLanded) stage = '🌍 MISSION COMPLETE: SAFE RETURN TO EARTH!';
        }

        setStats({
          altitude: Math.round(currentAlt),
          speed: !isFlying && isLanded ? 0 : speedKmH,
          targetDist,
          destination,
          stage,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isFlying, isLanded, autopilot, throttle, playerMode, destination]);

  // Helper for on-screen D-pad buttons
  const handleDpadPress = (code: string) => {
    keysRef.current[code] = true;
    if (autopilot) setAutopilot(false);
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
                playerMode === 'ASTRONAUT'
                  ? 'bg-blue-950/80 text-blue-300 border-blue-400'
                  : playerMode === 'ROVER'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-400'
                  : autopilot
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-400 animate-pulse'
                  : 'bg-cyan-950/80 text-cyan-300 border-cyan-400'
              }`}
            >
              {playerMode === 'ASTRONAUT'
                ? '🧑‍🚀 ASTRONAUT EVA ON MOON'
                : playerMode === 'ROVER'
                ? '🏎️ DRIVING LUNAR ROVER'
                : autopilot
                ? '🤖 AUTOPILOT ACTIVE'
                : '🚀 ROCKET FLIGHT'}
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
                ? 'text-emerald-400'
                : isFlying
                ? 'text-cyan-300'
                : 'text-gray-300'
            }`}
          >
            {stats.stage}
          </div>
        </div>
      </div>

      {/* ================= FLIGHT & EVA TELEMETRY HUD ================= */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        <div className="bg-black/80 backdrop-blur-md px-5 py-3 rounded-xl border border-cyan-500/40 text-white font-mono flex items-center gap-6 shadow-2xl">
          {playerMode === 'ROVER' ? (
            <>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Rover Speed</div>
                <div className="text-lg font-bold text-amber-300">{hudState.roverSpeed} km/h</div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Battery Pack</div>
                <div className="text-lg font-bold text-emerald-300">98% (4x4 AWD)</div>
              </div>
            </>
          ) : playerMode === 'ASTRONAUT' ? (
            <>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Suit Oxygen</div>
                <div className="text-lg font-bold text-cyan-300">100% NOMINAL</div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Lunar Gravity</div>
                <div className="text-lg font-bold text-purple-300">0.166 G (1.62 m/s²)</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Altitude</div>
                <div className="text-lg font-bold text-cyan-300">
                  {stats.altitude >= 10000
                    ? `${(stats.altitude / 1000).toFixed(1)} km`
                    : `${stats.altitude.toLocaleString()} m`}
                </div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Velocity</div>
                <div className="text-lg font-bold text-amber-300">
                  {stats.speed.toLocaleString()} km/h
                </div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {destination === 'MOON' ? 'Distance to Moon' : 'Distance to Earth'}
                </div>
                <div
                  className={`text-lg font-bold ${
                    isLanded ? 'text-emerald-400' : 'text-purple-300'
                  }`}
                >
                  {isLanded ? '0 m (TOUCHDOWN)' : `${stats.targetDist.toLocaleString()} m`}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Throttle Bar Gauge (When flying in rocket) */}
        {playerMode === 'ROCKET' && isFlying && !isLanded && (
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

      {/* ================= TOUCHDOWN & INTERACTION PROMPT ================= */}
      {isLanded && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {playerMode === 'ROCKET' ? (
            destination === 'EARTH' ? (
              <div className="bg-slate-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-emerald-400 text-center shadow-[0_0_35px_rgba(16,185,129,0.7)] flex flex-col items-center gap-2.5">
                <div className="text-emerald-400 font-extrabold text-sm tracking-wider uppercase flex items-center gap-2">
                  <span>🌕</span>
                  <span>ROCKET BOARDED ON MOON — TARGET: EARTH</span>
                </div>
                <div className="text-xs text-emerald-200 font-mono">
                  Launch off Moon surface to begin return voyage back to Earth!
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={handleLaunch}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 animate-bounce cursor-pointer flex items-center gap-2"
                  >
                    <span>🚀</span>
                    <span>LAUNCH TO EARTH [Press F]</span>
                  </button>
                  <button
                    onClick={handleInteraction}
                    className="px-5 py-3 bg-cyan-700/80 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl border border-cyan-400 shadow-md cursor-pointer"
                  >
                    🧑‍🚀 STEP OUT ONTO MOON [Press E]
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-cyan-400 text-center shadow-[0_0_35px_rgba(6,182,212,0.7)] flex flex-col items-center gap-2.5">
                <div className="text-cyan-400 font-extrabold text-sm tracking-wider uppercase flex items-center gap-2">
                  <span>🌍</span>
                  <span>SAFE TOUCHDOWN ON EARTH COSMODROME!</span>
                </div>
                <div className="text-xs text-gray-300 font-mono">
                  Mission to the Moon and return to Earth complete. Ready to relaunch!
                </div>
                <button
                  onClick={handleLaunch}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 cursor-pointer flex items-center gap-2"
                >
                  <span>🚀</span>
                  <span>RELAUNCH TO MOON [Press F]</span>
                </button>
              </div>
            )
          ) : playerMode === 'ASTRONAUT' && hudState.canEnterRover ? (
            <button
              onClick={handleInteraction}
              className="bg-amber-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-amber-400 text-amber-300 font-bold font-mono text-sm shadow-[0_0_35px_rgba(245,158,11,0.7)] animate-bounce cursor-pointer flex items-center gap-2"
            >
              <span>🏎️</span>
              <span>PRESS [ E ] TO DRIVE LUNAR ROVER</span>
            </button>
          ) : playerMode === 'ASTRONAUT' && hudState.canEnterRocket ? (
            <button
              onClick={handleInteraction}
              className="bg-cyan-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-cyan-400 text-cyan-300 font-bold font-mono text-sm shadow-[0_0_35px_rgba(6,182,212,0.7)] animate-bounce cursor-pointer flex items-center gap-2"
            >
              <span>🚀</span>
              <span>PRESS [ E ] TO BOARD SPACESHIP ROCKET</span>
            </button>
          ) : null}
        </div>
      )}

      {/* ================= BOTTOM LEFT: D-PAD & CONTROLS GUIDE ================= */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2.5">
        {/* On-Screen D-Pad */}
        {((isFlying && !isLanded) || (isLanded && playerMode !== 'ROCKET')) && (
          <div className="bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-1.5 select-none">
            <div className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-0.5">
              {playerMode === 'ASTRONAUT'
                ? 'Moonwalk Controls'
                : playerMode === 'ROVER'
                ? 'Rover Steering'
                : 'Rocket Flight'}
            </div>
            <button
              onMouseDown={() => handleDpadPress('KeyW')}
              onMouseUp={() => handleDpadRelease('KeyW')}
              onTouchStart={() => handleDpadPress('KeyW')}
              onTouchEnd={() => handleDpadRelease('KeyW')}
              className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
            >
              ▲
            </button>
            <div className="flex items-center gap-1.5">
              <button
                onMouseDown={() => handleDpadPress('KeyA')}
                onMouseUp={() => handleDpadRelease('KeyA')}
                onTouchStart={() => handleDpadPress('KeyA')}
                onTouchEnd={() => handleDpadRelease('KeyA')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
              >
                ◀
              </button>
              <button
                onMouseDown={() => handleDpadPress('KeyS')}
                onMouseUp={() => handleDpadRelease('KeyS')}
                onTouchStart={() => handleDpadPress('KeyS')}
                onTouchEnd={() => handleDpadRelease('KeyS')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
              >
                ▼
              </button>
              <button
                onMouseDown={() => handleDpadPress('KeyD')}
                onMouseUp={() => handleDpadRelease('KeyD')}
                onTouchStart={() => handleDpadPress('KeyD')}
                onTouchEnd={() => handleDpadRelease('KeyD')}
                className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow transition-all cursor-pointer flex items-center justify-center"
              >
                ▶
              </button>
            </div>
          </div>
        )}

        {/* Clean Controls Guide Badge */}
        <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs text-gray-200 flex flex-col gap-1 shadow-xl">
          <div className="font-semibold text-cyan-300">
            {playerMode === 'ASTRONAUT'
              ? 'Astronaut EVA Controls:'
              : playerMode === 'ROVER'
              ? 'Rover Driving Controls:'
              : 'Flight Controls:'}
          </div>
          {playerMode === 'ASTRONAUT' ? (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W / A / S / D ]</strong>: Walk & Turn on Moon</div>
              <div>• <strong>[ Space ]</strong>: Low-Gravity Lunar Hop Jump</div>
              <div>• <strong>[ E ]</strong>: Enter Rover or Board Rocket</div>
              <div>• <strong>[ Left Click + Drag ]</strong>: 360° Mouse Look</div>
            </div>
          ) : playerMode === 'ROVER' ? (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W ]</strong>: Drive Forward (Accelerate)</div>
              <div>• <strong>[ S ]</strong>: Reverse / Brake</div>
              <div>• <strong>[ A / D ]</strong>: Steer Wheels Left / Right</div>
              <div>• <strong>[ E ]</strong>: Exit Rover back to Foot</div>
              <div>• <strong>[ Left Click + Drag ]</strong>: 360° Mouse Look</div>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W / A / S / D ]</strong>: Manual Pitch & Steer Rocket</div>
              <div>• <strong>[ T ]</strong>: Auto-Pilot (Fly & Land on {destination === 'MOON' ? 'Moon' : 'Earth'})</div>
              <div>• <strong>[ F ]</strong>: Launch Rocket ({destination === 'MOON' ? 'To Moon' : 'To Earth'})</div>
              <div>• <strong>[ Left Click + Drag ]</strong>: 360° Free Camera Orbit</div>
              <div>• <strong>[ Scroll Wheel ]</strong>: Zoom In / Out</div>
            </div>
          )}
        </div>
      </div>

      {/* ================= BOTTOM RIGHT: ACTION BUTTONS ================= */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
        {/* Rover Exit button */}
        {playerMode === 'ROVER' && (
          <button
            onClick={handleInteraction}
            className="px-5 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-xs tracking-wider rounded-xl border border-amber-300 shadow-xl cursor-pointer"
          >
            🚪 EXIT ROVER [Press E]
          </button>
        )}

        {/* Autopilot Button (when flying rocket) */}
        {playerMode === 'ROCKET' && isFlying && !isLanded && (
          <button
            onClick={() => setAutopilot((prev) => !prev)}
            className={`px-5 py-3.5 text-xs font-bold font-mono tracking-wider rounded-xl border transition-all cursor-pointer shadow-2xl flex items-center gap-2 transform active:scale-95 ${
              autopilot
                ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.8)] animate-pulse'
                : stats.targetDist < 2500
                ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-bounce'
                : 'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 border-purple-300/40 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
            }`}
          >
            <span>{autopilot ? '🤖' : stats.targetDist < 2500 ? (destination === 'MOON' ? '🌕' : '🌍') : '🎯'}</span>
            <span>
              {autopilot
                ? stats.targetDist < 300
                  ? `SOFT TOUCHDOWN IN PROGRESS ON ${destination}...`
                  : `🤖 AUTOPILOT ON: RETURNING TO ${destination} [Press T to Disengage]`
                : stats.targetDist < 2500
                ? `INITIATE SOFT ${destination} LANDING [Press T]`
                : `ACTIVATE AUTOPILOT TO ${destination} [Press T]`}
            </span>
          </button>
        )}

        {/* Launch / Reset Buttons */}
        {!isFlying ? (
          <button
            onClick={handleLaunch}
            className="px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 transform hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <span>🚀</span>
            <span>{destination === 'EARTH' ? 'LAUNCH TO EARTH [Press F]' : 'LAUNCH TO MOON [Press F]'}</span>
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
          position: [14, 18, 22],
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

        {/* Deep Space Ambient Lighting */}
        {isInSpace && (
          <ambientLight intensity={0.3} color="#cbd5e1" />
        )}

        {/* Universal Third-Person Orbit Camera (Rocket / Astronaut / Rover) */}
        <UniversalThirdPersonCamera
          playerMode={playerMode}
          isFlying={isFlying}
          rocketPos={posRef.current}
          astronautPos={astronautPosRef.current}
          roverPos={roverPosRef.current}
          resetCount={resetCount}
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
          <LunarLandingSiteMarker visible={true} />

          {/* Active Rocket with Multi-Engine Flames, RCS & Gimbal */}
          <ActiveRocketMesh
            isFlying={isFlying}
            isLanded={isLanded}
            throttle={throttle}
            rocketPos={posRef.current}
            rocketQuat={quatRef.current}
            rcsActive={rcsActiveRef.current}
          />

          {/* Moon Surface Exploration: Expansive Terrain, Boulders, Astronaut & Lunar Rover */}
          <MoonExploration
            isLanded={isLanded && posRef.current.distanceTo(MOON_LANDING_SITE) < 35}
            playerMode={playerMode}
            onPlayerModeChange={setPlayerMode}
            onUpdateHUD={setHudState}
            astronautPosRef={astronautPosRef}
            roverPosRef={roverPosRef}
            keysRef={keysRef}
            rocketOnMoon={isLanded && posRef.current.distanceTo(MOON_LANDING_SITE) < 25}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
