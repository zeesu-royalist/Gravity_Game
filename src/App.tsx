import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useProgress, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

useGLTF.preload('/models/gastaroid_queen.glb');
useGLTF.preload('/models/lunar_rover.glb');
useGLTF.preload('/models/moon_rover.glb');
import { RealisticLandscape } from './RealisticLandscape';
import { SpaceEnvironment, MOON_POSITION, MOON_RADIUS, MARS_POSITION, MARS_RADIUS } from './SpaceEnvironment';
import { MoonExploration, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE } from './MoonExploration';
import { MarsExploration, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE } from './MarsExploration';
import { EarthExploration, EARTH_CAR_DEFAULT_POS, EARTH_ASTRONAUT_DEFAULT_POS } from './EarthExploration';
import { BuranLaunchpad, ActiveRocketMesh, LunarLandingSiteMarker } from './Rocket';
import { AsteroidBelt } from './AsteroidBelt';

const EARTH_LANDING_SITE = new THREE.Vector3(0, 0.2, 0);
const MOON_APPROACH = new THREE.Vector3(MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y + 180, MOON_LANDING_SITE.z);
const MARS_APPROACH = new THREE.Vector3(MARS_LANDING_SITE.x, MARS_TOUCHDOWN_Y + 240, MARS_LANDING_SITE.z);

function UniversalThirdPersonCamera({
  playerMode, rocketPos, astronautPos, roverPos, resetCount,
}: {
  playerMode: 'ROCKET' | 'ASTRONAUT' | 'ROVER';
  rocketPos: THREE.Vector3;
  astronautPos: THREE.Vector3;
  roverPos: THREE.Vector3;
  resetCount: number;
}) {
  const controlsRef = useRef<any>(null);
  const prevTarget = useRef(new THREE.Vector3(0, 13.7, 0));
  const { camera } = useThree();

  useEffect(() => {
    if (resetCount > 0) {
      camera.position.set(0, 16, 62);
      prevTarget.current.set(0, 13.7, 0);
      controlsRef.current?.target.set(0, 13.7, 0);
      controlsRef.current?.update();
    }
  }, [resetCount, camera]);

  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const target = playerMode === 'ROCKET'
      ? new THREE.Vector3(rocketPos.x, Math.max(0.2, rocketPos.y) + 13.5, rocketPos.z)
      : (playerMode === 'ASTRONAUT' ? astronautPos : roverPos).clone().add(new THREE.Vector3(0, 1.2, 0));

    camera.position.add(target.clone().sub(prevTarget.current));
    if (rocketPos.y < 200 && camera.position.y < 1.0) camera.position.y = 1.0;
    ctrl.target.copy(target);
    prevTarget.current.copy(target);
    ctrl.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 13.7, 0]}
      enablePan={false}
      minDistance={playerMode === 'ASTRONAUT' ? 2.5 : playerMode === 'ROVER' ? 4.5 : 7}
      maxDistance={playerMode === 'ASTRONAUT' ? 16 : playerMode === 'ROVER' ? 26 : 75}
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={1.2}
    />
  );
}

function getMissionStage(
  dest: 'MOON' | 'MARS' | 'EARTH',
  alt: number,
  dist: number,
  targetDist: number,
  isFlying: boolean,
  isLanded: boolean,
  world: 'EARTH' | 'MOON' | 'MARS'
): string {
  if (dest === 'MARS') {
    if (!isFlying && !isLanded) return 'STANDBY ON EARTH PAD';
    if (isLanded) return '🔴 MISSION COMPLETE: TOUCHDOWN ON MARS (ARES BASE)!';
    if (alt < 1200) return 'STAGE 1: ATMOSPHERIC ASCENT';
    if (alt < 5000) return 'STAGE 2: STRATOSPHERE TRANSITION';
    if (alt < 12000) return 'STAGE 3: TRANS-MARS INJECTION (TMI)';
    return dist > 4000 ? 'STAGE 4: INTERPLANETARY MARS CRUISE' : dist > 600 ? 'STAGE 5: MARTIAN APPROACH & RETRO-BURN' : 'STAGE 6: TOUCHDOWN ON ARES BASE PAD';
  }
  if (dest === 'MOON') {
    if (!isFlying && !isLanded) return 'STANDBY ON EARTH PAD';
    if (isLanded) return '🌕 MISSION COMPLETE: TOUCHDOWN ON MOON!';
    if (alt < 1200) return 'STAGE 1: ATMOSPHERIC ASCENT';
    if (alt < 4000) return 'STAGE 2: STRATOSPHERE TRANSITION';
    if (alt < 10000) return 'STAGE 3: TRANSLUNAR INJECTION (TLI)';
    return dist > 3000 ? 'STAGE 4: CISLUNAR CRUISE' : dist > 500 ? 'STAGE 5: LUNAR APPROACH & RETRO-BURN' : 'STAGE 6: TOUCHDOWN ON MOON PAD';
  }
  if (!isFlying && isLanded) return `${world === 'MARS' ? 'ARES BASE' : 'LUNAR BASE'}: READY FOR EARTH RETURN`;
  if (isLanded) return '🌍 MISSION COMPLETE: SAFE RETURN TO EARTH!';
  if (dist < 800) return 'RETURN STAGE 1: PLANETARY ASCENT';
  if (dist < 3500) return 'RETURN STAGE 2: TRANS-EARTH INJECTION';
  return targetDist > 3500 ? 'RETURN STAGE 3: DEEP SPACE TRANSIT' : targetDist > 500 ? 'RETURN STAGE 4: EARTH RE-ENTRY' : 'RETURN STAGE 5: RETRO-BURN DESCENT';
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="bg-black/85 text-white px-6 py-4 rounded-xl border border-cyan-500/40 text-center font-sans shadow-2xl backdrop-blur-md">
        <div className="text-sm font-semibold text-cyan-400 mb-2">Initializing Z-SPACE Mission...</div>
        <div className="w-52 bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
          <div className="bg-cyan-400 h-full transition-all duration-200" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-2 font-mono">{Math.round(progress)}%</div>
      </div>
    </Html>
  );
}

export default function App() {
  const [destination, setDestination] = useState<'MOON' | 'MARS' | 'EARTH'>('MOON');
  const [showDestModal, setShowDestModal] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [throttle, setThrottle] = useState(1.0);
  const [resetCount, setResetCount] = useState(0);
  const [playerMode, setPlayerMode] = useState<'ROCKET' | 'ASTRONAUT' | 'ROVER'>('ROCKET');
  const [isExploding, setIsExploding] = useState(false);
  const [asteroidAlert, setAsteroidAlert] = useState<{ message: string; type: 'BLAST' | 'DEFLECTION' } | null>(null);
  const blastTimeoutRef = useRef<any>(null);
  const alertTimeoutRef = useRef<any>(null);

  const [stats, setStats] = useState({ altitude: 0, speed: 0, targetDist: 19500, destination: 'MOON' as 'MOON' | 'MARS' | 'EARTH', stage: 'STANDBY ON EARTH PAD' });
  const [hudState, setHudState] = useState<{
    canEnterRover: boolean;
    canEnterRocket: boolean;
    roverSpeed: number;
    alienThreat?: {
      count: number;
      nearestDist: number;
      isAttacking: boolean;
      isFleeing?: boolean;
      kills?: number;
      allDead?: boolean;
      hitConfirmed?: boolean;
    };
  }>({ canEnterRover: false, canEnterRocket: false, roverSpeed: 0 });

  // Stable HUD updater with hysteresis and equality check (prevents re-render churn & flickering)
  const handleUpdateHUD = useCallback((data: {
    canEnterRover?: boolean;
    canEnterRocket?: boolean;
    roverSpeed?: number;
    alienThreat?: {
      count: number;
      nearestDist: number;
      isAttacking: boolean;
      isFleeing?: boolean;
      kills?: number;
      allDead?: boolean;
      hitConfirmed?: boolean;
    };
  }) => {
    setHudState((prev) => {
      const canEnterRover = data.canEnterRover ?? prev.canEnterRover;
      const canEnterRocket = data.canEnterRocket ?? prev.canEnterRocket;
      const roverSpeed = data.roverSpeed ?? prev.roverSpeed;
      const alienThreat = data.alienThreat !== undefined ? data.alienThreat : prev.alienThreat;

      if (
        prev.canEnterRover === canEnterRover &&
        prev.canEnterRocket === canEnterRocket &&
        prev.roverSpeed === roverSpeed &&
        prev.alienThreat?.isAttacking === alienThreat?.isAttacking &&
        prev.alienThreat?.isFleeing === alienThreat?.isFleeing &&
        prev.alienThreat?.count === alienThreat?.count &&
        prev.alienThreat?.nearestDist === alienThreat?.nearestDist &&
        prev.alienThreat?.kills === alienThreat?.kills &&
        prev.alienThreat?.allDead === alienThreat?.allDead &&
        prev.alienThreat?.hitConfirmed === alienThreat?.hitConfirmed
      ) {
        return prev;
      }
      return { canEnterRover, canEnterRocket, roverSpeed, alienThreat };
    });
  }, []);

  const posRef = useRef(new THREE.Vector3(0, 0.2, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const quatRef = useRef(new THREE.Quaternion());
  const rcsActiveRef = useRef({ pitch: 0, yaw: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const earthAstroPosRef = useRef(EARTH_ASTRONAUT_DEFAULT_POS.clone());
  const earthCarPosRef = useRef(EARTH_CAR_DEFAULT_POS.clone());
  const moonAstroPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8));
  const moonRoverPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5));
  const marsAstroPosRef = useRef(new THREE.Vector3(MARS_LANDING_SITE.x + 3.8, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 1.8));
  const marsRoverPosRef = useRef(new THREE.Vector3(MARS_LANDING_SITE.x + 11.0, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 5.5));

  const isAtMoon = posRef.current.distanceTo(MOON_LANDING_SITE) < 40;
  const isAtMars = posRef.current.distanceTo(MARS_LANDING_SITE) < 40;
  const currentWorld: 'EARTH' | 'MOON' | 'MARS' = isAtMars ? 'MARS' : isAtMoon ? 'MOON' : 'EARTH';

  const executeLaunch = (chosenDest?: 'MOON' | 'MARS') => {
    if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setIsExploding(false);
    setAsteroidAlert(null);
    if (chosenDest) setDestination(chosenDest);
    setShowDestModal(false);
    setIsFlying(true);
    setIsLanded(false);
    setPlayerMode('ROCKET');
    velRef.current.set(0, 35, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
  };

  const handleLaunch = () => {
    if (!isFlying && currentWorld === 'EARTH') {
      setShowDestModal(true);
    } else {
      executeLaunch();
    }
  };

  const handleReset = useCallback(() => {
    if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setIsExploding(false);
    setAsteroidAlert(null);
    setIsFlying(false);
    setIsLanded(false);
    setAutopilot(false);
    setDestination('MOON');
    setShowDestModal(false);
    setPlayerMode('ROCKET');
    setThrottle(1.0);
    posRef.current.set(0, 0.2, 0);
    velRef.current.set(0, 0, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
    rcsActiveRef.current = { pitch: 0, yaw: 0 };
    earthAstroPosRef.current.copy(EARTH_ASTRONAUT_DEFAULT_POS);
    earthCarPosRef.current.copy(EARTH_CAR_DEFAULT_POS);
    moonAstroPosRef.current.set(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8);
    moonRoverPosRef.current.set(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5);
    marsAstroPosRef.current.set(MARS_LANDING_SITE.x + 3.8, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 1.8);
    marsRoverPosRef.current.set(MARS_LANDING_SITE.x + 11.0, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 5.5);
    setResetCount((c) => c + 1);
    setStats({ altitude: 0, speed: 0, targetDist: 19500, destination: 'MOON', stage: 'STANDBY ON EARTH PAD' });
  }, []);

  const handleAsteroidBlast = useCallback((_astPos: THREE.Vector3, radius: number) => {
    setIsExploding(true);
    setAutopilot(false);
    velRef.current.set(0, 0, 0);

    setAsteroidAlert({
      type: 'BLAST',
      message: `CRITICAL IMPACT WITH DEEP-SPACE ASTEROID (${Math.round(radius)}m)!\n25% LETHAL BLAST PROBABILITY TRIGGERED — SHIP DESTROYED!\nINITIATING EMERGENCY RESET PROTOCOL BACK TO EARTH...`,
    });

    if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current);
    blastTimeoutRef.current = setTimeout(() => {
      handleReset();
    }, 2800);
  }, [handleReset]);

  const handleAsteroidDeflection = useCallback((astPos: THREE.Vector3) => {
    // Subtle lateral deflection push away from asteroid
    const nudge = posRef.current.clone().sub(astPos).normalize().multiplyScalar(40);
    velRef.current.add(nudge);

    setAsteroidAlert({
      type: 'DEFLECTION',
      message: `ASTEROID GRAVITATIONAL COLLISION DEFLECTED!\n75% PROBABILITY TRIGGERED: SHIELD ABSORPTION 100% NOMINAL!\nCONTINUING MARS EXPEDITION SAFELY.`,
    });

    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => {
      setAsteroidAlert((prev) => (prev?.type === 'DEFLECTION' ? null : prev));
    }, 2500);
  }, []);

  const isFlyingRef = useRef(isFlying);
  isFlyingRef.current = isFlying;
  const isLandedRef = useRef(isLanded);
  isLandedRef.current = isLanded;
  const isExplodingRef = useRef(isExploding);
  isExplodingRef.current = isExploding;
  const playerModeRef = useRef(playerMode);
  playerModeRef.current = playerMode;
  const autopilotRef = useRef(autopilot);
  autopilotRef.current = autopilot;
  const hudStateRef = useRef(hudState);
  hudStateRef.current = hudState;

  const handleInteraction = () => {
    if (isFlyingRef.current || isExplodingRef.current) return;
    if (playerModeRef.current === 'ROCKET') setPlayerMode('ASTRONAUT');
    else if (playerModeRef.current === 'ASTRONAUT') {
      if (hudStateRef.current.canEnterRover) setPlayerMode('ROVER');
      else if (hudStateRef.current.canEnterRocket) setPlayerMode('ROCKET');
    } else if (playerModeRef.current === 'ROVER') {
      setPlayerMode('ASTRONAUT');
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'KeyR') { handleReset(); return; }
      if (isExplodingRef.current) return;
      if (e.code === 'KeyE') handleInteraction();
      if (playerModeRef.current === 'ROCKET' && (e.code === 'KeyF' || (e.code === 'Space' && !isFlyingRef.current))) handleLaunch();
      if (playerModeRef.current === 'ROCKET' && e.code === 'KeyT') setAutopilot((p) => !p);
      if (playerModeRef.current === 'ROCKET') {
        if (e.code.startsWith('Shift')) setThrottle((p) => Math.min(1.0, p + 0.15));
        if (e.code.startsWith('Control')) setThrottle((p) => Math.max(0.1, p - 0.15));
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && autopilotRef.current) {
          setAutopilot(false);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    const onBlur = () => {
      keysRef.current = {};
    };
    const onPointerUp = () => {
      keysRef.current['KeyQ'] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Flight Physics & Autopilot Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (isFlying && !isLanded && !isExplodingRef.current) {
        const keys = keysRef.current, pos = posRef.current, vel = velRef.current;
        const isMars = destination === 'MARS';
        const isMoon = destination === 'MOON';
        const targetPad = isMars ? MARS_LANDING_SITE : isMoon ? MOON_LANDING_SITE : EARTH_LANDING_SITE;
        const altAbovePad = pos.y - targetPad.y;
        const hDistToPad = Math.hypot(pos.x - targetPad.x, pos.z - targetPad.z);

        const landRocket = (pad: THREE.Vector3, nextDest: 'MOON' | 'MARS' | 'EARTH') => {
          pos.copy(pad);
          vel.set(0, 0, 0);
          rotRef.current.set(0, 0, 0, 'YXZ');
          quatRef.current.set(0, 0, 0, 1);
          setIsLanded(true);
          setIsFlying(false);
          setAutopilot(false);
          setDestination(nextDest);
        };

        let rcsPitch = 0, rcsYaw = 0;

        if (autopilot) {
          if (altAbovePad <= 0.8 && hDistToPad <= 24.0) {
            landRocket(targetPad, isMars || isMoon ? 'EARTH' : 'MOON');
          } else if (altAbovePad < 250 && hDistToPad < 140) {
            quatRef.current.slerp(new THREE.Quaternion(), delta * 4.5);
            pos.x = THREE.MathUtils.lerp(pos.x, targetPad.x, delta * 3.5);
            pos.z = THREE.MathUtils.lerp(pos.z, targetPad.z, delta * 3.5);
            const descentSpeed = Math.max(1.5, Math.min(26, altAbovePad * 0.35));
            pos.y = Math.max(targetPad.y, pos.y - descentSpeed * delta);
            vel.set(0, -descentSpeed, 0);
          } else {
            const waypoint = isMars ? MARS_APPROACH : isMoon ? MOON_APPROACH : (pos.y > 800 ? new THREE.Vector3(0, 600, 0) : new THREE.Vector3(0, 200, 0));
            const toWaypoint = waypoint.clone().sub(pos);
            const dist = toWaypoint.length();
            quatRef.current.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toWaypoint.normalize()), delta * 3.5);
            const cruiseSpeed = dist > 2500 ? (isMars ? 1600 : 1400) : Math.max(50, dist * 0.45);
            vel.lerp(new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current).multiplyScalar(cruiseSpeed), delta * 2.8);
            pos.addScaledVector(vel, delta);
          }
        } else if (playerMode === 'ROCKET') {
          const turn = pos.y > 3500 ? 1.6 : 1.2;
          if (keys['KeyW'] || keys['ArrowDown']) { rotRef.current.x -= turn * delta; rcsPitch = -1; }
          if (keys['KeyS'] || keys['ArrowUp']) { rotRef.current.x += turn * delta; rcsPitch = 1; }
          if (keys['KeyA'] || keys['ArrowLeft']) { rotRef.current.y += turn * delta; rcsYaw = -1; }
          if (keys['KeyD'] || keys['ArrowRight']) { rotRef.current.y -= turn * delta; rcsYaw = 1; }
          if (keys['KeyQ']) rotRef.current.z += turn * delta;
          if (keys['KeyE']) rotRef.current.z -= turn * delta;

          quatRef.current.setFromEuler(rotRef.current);
          const fwd = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);
          const boost = THREE.MathUtils.clamp((pos.y - 2000) / 4000, 0, 1);
          vel.addScaledVector(fwd, (38 + boost * 85) * throttle * delta);

          if (pos.y > 0.2 && pos.y < 2500 && Math.hypot(pos.x, pos.z) < 3000) vel.y -= 9.8 * (1 - pos.y / 2500) * delta;
          pos.addScaledVector(vel, delta);

          if (isMars) {
            if (pos.distanceTo(MARS_LANDING_SITE) < 32 || (pos.distanceTo(MARS_POSITION) <= MARS_RADIUS + 3 && pos.y > 10000)) landRocket(MARS_LANDING_SITE, 'EARTH');
          } else if (isMoon) {
            if (pos.distanceTo(MOON_LANDING_SITE) < 28 || (pos.distanceTo(MOON_POSITION) <= MOON_RADIUS + 2 && pos.y > 10000)) landRocket(MOON_LANDING_SITE, 'EARTH');
          } else {
            if (pos.y <= 1.2 && Math.hypot(pos.x, pos.z) < 32) landRocket(EARTH_LANDING_SITE, 'MOON');
          }
        }

        // Hard ground clamp
        if ((!isMoon && !isMars || pos.y < 3000) && pos.y < 0.2) { pos.y = 0.2; if (vel.y < 0) vel.y = 0; }
        if (isMoon && pos.distanceTo(MOON_POSITION) < MOON_RADIUS + 30 && pos.y < MOON_TOUCHDOWN_Y) { pos.y = MOON_TOUCHDOWN_Y; if (vel.y < 0) vel.y = 0; }
        if (isMars && pos.distanceTo(MARS_POSITION) < MARS_RADIUS + 30 && pos.y < MARS_TOUCHDOWN_Y) { pos.y = MARS_TOUCHDOWN_Y; if (vel.y < 0) vel.y = 0; }

        rcsActiveRef.current = { pitch: rcsPitch, yaw: rcsYaw };
        const destDist = isMars
          ? Math.max(0, Math.round(pos.distanceTo(MARS_POSITION) - MARS_RADIUS))
          : isMoon
          ? Math.max(0, Math.round(pos.distanceTo(MOON_POSITION) - MOON_RADIUS))
          : Math.round(pos.distanceTo(EARTH_LANDING_SITE));
        const targetDist = destDist;

        setStats({
          altitude: Math.max(0, Math.round(pos.y)),
          speed: !isFlying && isLanded ? 0 : Math.round(vel.length() * 3.6),
          targetDist,
          destination,
          stage: getMissionStage(destination, pos.y, destDist, targetDist, isFlying, isLanded, currentWorld),
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isFlying, isLanded, autopilot, throttle, playerMode, destination, currentWorld]);

  const handleDpad = (code: string, pressed: boolean) => {
    keysRef.current[code] = pressed;
    if (pressed && autopilot) setAutopilot(false);
  };

  const isInSpace = stats.altitude > 3500;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none font-sans transition-colors duration-1000 ${isInSpace ? 'bg-[#000003]' : 'bg-[#87ceeb]'}`}>
      {/* Xenomorph Attack Screen Vignette */}
      {isAtMars && hudState.alienThreat?.isAttacking && (
        <div className="pointer-events-none fixed inset-0 z-20 shadow-[inset_0_0_120px_rgba(239,68,68,0.5)] border-4 border-red-500/40 transition-opacity duration-300" />
      )}

      {/* Catastrophic Asteroid Blast Screen Vignette */}
      {isExploding && (
        <div className="pointer-events-none fixed inset-0 z-30 shadow-[inset_0_0_160px_rgba(255,0,0,0.9)] bg-red-600/20 border-8 border-red-500 animate-pulse" />
      )}

      {/* Asteroid Alert Banner (Blast or Deflection) */}
      {asteroidAlert && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          <div className={`px-6 py-4 rounded-2xl border-2 backdrop-blur-xl shadow-2xl text-center max-w-xl ${
            asteroidAlert.type === 'BLAST'
              ? 'bg-red-950/95 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.8)] text-red-100'
              : 'bg-emerald-950/95 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.7)] text-emerald-100'
          }`}>
            <div className={`text-sm font-black tracking-wider uppercase flex items-center justify-center gap-2 mb-1.5 ${
              asteroidAlert.type === 'BLAST' ? 'text-red-400 animate-pulse' : 'text-emerald-300'
            }`}>
              <span>{asteroidAlert.type === 'BLAST' ? '💥' : '🛡️'}</span>
              <span>{asteroidAlert.type === 'BLAST' ? 'CRITICAL IMPACT — 25% LETHAL BLAST!' : 'COLLISION DEFLECTION — 75% SURVIVED!'}</span>
            </div>
            <div className="text-xs font-mono whitespace-pre-line text-gray-200 font-semibold leading-relaxed">
              {asteroidAlert.message}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-4 left-4 z-10 bg-black/75 backdrop-blur-md px-4 py-3 rounded-xl border border-cyan-500/30 text-white flex items-center gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-wider text-cyan-400">Z-SPACE • ZEESU-1</h1>
            <span className={`px-2 py-0.5 text-[10px] font-mono rounded font-bold border ${
              playerMode === 'ASTRONAUT' ? 'bg-blue-950/80 text-blue-300 border-blue-400' :
              playerMode === 'ROVER' ? 'bg-amber-950/80 text-amber-300 border-amber-400' :
              autopilot ? 'bg-emerald-950/80 text-emerald-300 border-emerald-400 animate-pulse' :
              'bg-cyan-950/80 text-cyan-300 border-cyan-400'
            }`}>
              {playerMode === 'ASTRONAUT' ? (isAtMars ? '🧑‍🚀 ASTRONAUT EVA ON MARS' : isAtMoon ? '🧑‍🚀 ASTRONAUT EVA ON MOON' : '🧑‍🚀 COMMANDER EVA ON EARTH') :
               playerMode === 'ROVER' ? (isAtMars ? '🏎️ DRIVING MARTIAN ROVER' : isAtMoon ? '🏎️ DRIVING LUNAR ROVER' : '🚙 DRIVING LYNX STORMCHASER') :
               autopilot ? '🤖 AUTOPILOT ACTIVE' : '🚀 ROCKET FLIGHT'}
            </span>
          </div>
          <p className="text-xs text-amber-300 font-medium">Commander ZEESU's Flagship</p>
        </div>
        <div className="h-8 w-[1px] bg-white/20" />
        <div className="text-xs font-mono">
          <div className="text-gray-400 text-[10px]">MISSION STATUS:</div>
          <div className={`font-bold ${isLanded ? 'text-emerald-400' : isFlying ? 'text-cyan-300' : 'text-gray-300'}`}>{stats.stage}</div>
        </div>
      </div>

      {/* Telemetry HUD */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        <div className="bg-black/80 backdrop-blur-md px-5 py-3 rounded-xl border border-cyan-500/40 text-white font-mono flex items-center gap-6 shadow-2xl">
          {playerMode === 'ROVER' ? (
            <>
              <div><div className="text-[10px] text-gray-400 uppercase">{isAtMars ? 'Martian Rover' : isAtMoon ? 'Lunar Rover' : 'Car Speed'}</div><div className="text-lg font-bold text-amber-300">{hudState.roverSpeed} km/h</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">Power Core</div><div className="text-lg font-bold text-emerald-300">{isAtMars ? '100% (Martian RTG)' : isAtMoon ? '98% (4x4 AWD)' : '100% (Cosmodrome EV)'}</div></div>
            </>
          ) : playerMode === 'ASTRONAUT' ? (
            <>
              <div><div className="text-[10px] text-gray-400 uppercase">{isAtMars ? 'Mars Life Support' : isAtMoon ? 'Suit Oxygen' : 'Life Support'}</div><div className="text-lg font-bold text-cyan-300">100% NOMINAL</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">Planetary Gravity</div><div className="text-lg font-bold text-purple-300">{isAtMars ? '0.380 G (3.72 m/s²)' : isAtMoon ? '0.166 G (1.62 m/s²)' : '1.0 G (9.80 m/s²)'}</div></div>
            </>
          ) : (
            <>
              <div><div className="text-[10px] text-gray-400 uppercase">Altitude</div><div className="text-lg font-bold text-cyan-300">{stats.altitude >= 10000 ? `${(stats.altitude / 1000).toFixed(1)} km` : `${stats.altitude.toLocaleString()} m`}</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">Velocity</div><div className="text-lg font-bold text-amber-300">{stats.speed.toLocaleString()} km/h</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">{destination === 'MARS' ? 'Distance to Mars' : destination === 'MOON' ? 'Distance to Moon' : 'Distance to Earth'}</div><div className={`text-lg font-bold ${isLanded ? 'text-emerald-400' : 'text-purple-300'}`}>{isLanded ? '0 m (TOUCHDOWN)' : `${stats.targetDist.toLocaleString()} m`}</div></div>
            </>
          )}
        </div>
        {playerMode === 'ROCKET' && isFlying && !isLanded && (
          <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-white font-mono flex items-center justify-between text-xs shadow-lg">
            <span className="text-gray-400 text-[10px]">THROTTLE:</span>
            <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden mx-2 border border-gray-700">
              <div className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-150" style={{ width: `${Math.round(throttle * 100)}%` }} />
            </div>
            <span className="font-bold text-amber-400">{Math.round(throttle * 100)}%</span>
          </div>
        )}
      </div>

      {/* Destination Selection Modal */}
      {showDestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-950/95 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-xl w-full shadow-[0_0_50px_rgba(6,182,212,0.35)] text-white text-center">
            <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold mb-1">
              MISSION CONTROL • EXPEDITION TARGET
            </div>
            <h2 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-amber-200 to-rose-400 mb-2">
              WHERE DO YOU WANT TO GO?
            </h2>
            <p className="text-xs text-gray-300 mb-6">
              Commander ZEESU, select target destination for the ZEESU-1 interplanetary flagship:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Moon Card */}
              <button
                onClick={() => executeLaunch('MOON')}
                className="group relative flex flex-col items-center p-5 rounded-xl border-2 border-slate-700 hover:border-cyan-400 bg-gradient-to-b from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 transition-all transform hover:scale-105 active:scale-95 shadow-lg text-left cursor-pointer"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🌕</div>
                <div className="text-base font-extrabold text-cyan-300 mb-1">THE MOON</div>
                <div className="text-[11px] font-mono text-emerald-400 font-semibold mb-2">Luna Base Alpha</div>
                <div className="text-[10px] font-mono text-gray-400 space-y-0.5 w-full">
                  <div>• Distance: ~19,500 m</div>
                  <div>• Gravity: 0.166 G (Floater)</div>
                  <div>• Vehicle: Lunar Rover 4x4</div>
                  <div>• Surface: Basalt Maria & Craters</div>
                </div>
                <div className="mt-4 w-full py-2 bg-cyan-600/80 group-hover:bg-cyan-500 rounded-lg text-center font-bold text-xs tracking-wider uppercase text-white shadow">
                  Launch to Moon →
                </div>
              </button>

              {/* Mars Card */}
              <button
                onClick={() => executeLaunch('MARS')}
                className="group relative flex flex-col items-center p-5 rounded-xl border-2 border-slate-700 hover:border-rose-500 bg-gradient-to-b from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 transition-all transform hover:scale-105 active:scale-95 shadow-lg text-left cursor-pointer"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🔴</div>
                <div className="text-base font-extrabold text-rose-400 mb-1">PLANET MARS</div>
                <div className="text-[11px] font-mono text-amber-400 font-semibold mb-2">Ares Base Alpha</div>
                <div className="text-[10px] font-mono text-gray-400 space-y-0.5 w-full">
                  <div>• Distance: ~32,060 m</div>
                  <div>• Gravity: 0.380 G (Authentic)</div>
                  <div>• Vehicle: Martian Heavy 4x4</div>
                  <div>• Surface: Iron Oxide Regolith</div>
                </div>
                <div className="mt-4 w-full py-2 bg-gradient-to-r from-red-600 to-amber-600 group-hover:from-red-500 group-hover:to-amber-500 rounded-lg text-center font-bold text-xs tracking-wider uppercase text-white shadow">
                  Launch to Mars →
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowDestModal(false)}
              className="mt-5 text-xs text-gray-400 hover:text-white transition cursor-pointer font-mono underline"
            >
              Cancel Standby
            </button>
          </div>
        </div>
      )}

      {/* Touchdown & Boarding Prompts */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {playerMode === 'ROCKET' && isLanded && (
          <div className={`bg-slate-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border-2 text-center shadow-2xl flex flex-col items-center gap-2.5 ${destination === 'EARTH' ? 'border-emerald-400' : 'border-cyan-400'}`}>
            <div className={`font-extrabold text-sm tracking-wider uppercase flex items-center gap-2 ${destination === 'EARTH' ? 'text-emerald-400' : 'text-cyan-400'}`}>
              <span>{isAtMars ? '🔴' : isAtMoon ? '🌕' : '🌍'}</span>
              <span>
                {isAtMars ? 'ROCKET BOARDED ON MARS — TARGET: EARTH' :
                 isAtMoon ? 'ROCKET BOARDED ON MOON — TARGET: EARTH' :
                 'SAFE TOUCHDOWN ON EARTH COSMODROME!'}
              </span>
            </div>
            <div className="text-xs text-gray-300 font-mono">
              {isAtMars ? 'Launch off Mars surface to begin return voyage back to Earth!' :
               isAtMoon ? 'Launch off Moon surface to begin return voyage back to Earth!' :
               'Interplanetary return complete. Ready to explore Cosmodrome or relaunch!'}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button onClick={handleLaunch} className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs tracking-wider rounded-xl shadow-lg border border-red-300/40 animate-bounce cursor-pointer flex items-center gap-2">
                <span>🚀</span><span>{destination === 'EARTH' ? 'LAUNCH TO EARTH [Press F]' : 'RELAUNCH [Press F]'}</span>
              </button>
              <button onClick={handleInteraction} className="px-5 py-3 bg-cyan-700/80 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl border border-cyan-400 shadow-md cursor-pointer flex items-center gap-1.5">
                <span>🧑‍🚀</span><span>STEP OUT ONTO {currentWorld} [Press E]</span>
              </button>
            </div>
          </div>
        )}

        {playerMode === 'ASTRONAUT' && hudState.canEnterRover && (
          <button onClick={handleInteraction} className="bg-amber-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-amber-400 text-amber-300 font-bold font-mono text-sm shadow-2xl animate-bounce cursor-pointer flex items-center gap-2">
            <span>🚙</span><span>PRESS [ E ] TO DRIVE {isAtMars ? 'MARTIAN ROVER' : isAtMoon ? 'LUNAR ROVER' : 'LYNX STORMCHASER'}</span>
          </button>
        )}
        {playerMode === 'ASTRONAUT' && hudState.canEnterRocket && (
          <button onClick={handleInteraction} className="bg-cyan-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-cyan-400 text-cyan-300 font-bold font-mono text-sm shadow-2xl animate-bounce cursor-pointer flex items-center gap-2">
            <span>🚀</span><span>PRESS [ E ] TO BOARD SPACESHIP ROCKET</span>
          </button>
        )}
      </div>

      {/* D-Pad & Controls Guide */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2.5">
        {((isFlying && !isLanded) || (!isFlying && playerMode !== 'ROCKET')) && (
          <div className="bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-1.5 select-none">
            <div className="text-[10px] font-mono text-cyan-300 font-bold uppercase mb-0.5">
              {playerMode === 'ASTRONAUT' ? (isAtMars ? 'Marswalk' : isAtMoon ? 'Moonwalk' : 'Walk') : playerMode === 'ROVER' ? 'Rover' : 'Rocket'}
            </div>
            <button onMouseDown={() => handleDpad('KeyW', true)} onMouseUp={() => handleDpad('KeyW', false)} className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow flex items-center justify-center">▲</button>
            <div className="flex items-center gap-1.5">
              <button onMouseDown={() => handleDpad('KeyA', true)} onMouseUp={() => handleDpad('KeyA', false)} className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow flex items-center justify-center">◀</button>
              <button onMouseDown={() => handleDpad('KeyS', true)} onMouseUp={() => handleDpad('KeyS', false)} className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow flex items-center justify-center">▼</button>
              <button onMouseDown={() => handleDpad('KeyD', true)} onMouseUp={() => handleDpad('KeyD', false)} className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow flex items-center justify-center">▶</button>
            </div>
          </div>
        )}

        <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs text-gray-200 flex flex-col gap-1 shadow-xl">
          <div className="font-semibold text-cyan-300">
            {playerMode === 'ASTRONAUT' ? `Commander ${currentWorld} EVA Controls:` : playerMode === 'ROVER' ? `${isAtMars ? 'Martian Rover' : isAtMoon ? 'Lunar Rover' : 'Cosmodrome Car'} Controls:` : 'Flight Controls:'}
          </div>
          <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
            {playerMode === 'ASTRONAUT' ? (
              <>
                <div>• <strong>[ W / A / S / D ]</strong>: Walk & Turn on {currentWorld}</div>
                <div>• <strong>[ Space ]</strong>: {isAtMars ? 'Martian 0.38G Hop' : isAtMoon ? 'Lunar Low-G Hop' : 'Jump'}</div>
                {isAtMars && <div>• <strong>[ Q ]</strong>: <span className="text-cyan-400 font-bold">Fire Plasma Rifle</span></div>}
                <div>• <strong>[ E ]</strong>: Drive {isAtMars ? 'Martian Rover' : isAtMoon ? 'Lunar Rover' : 'Car'} or Board Rocket</div>
                <div>• <strong>[ Drag ]</strong>: 360° Mouse Look</div>
              </>
            ) : playerMode === 'ROVER' ? (
              <>
                <div>• <strong>[ W / S ]</strong>: Drive / Brake</div>
                <div>• <strong>[ A / D ]</strong>: Steer Left / Right</div>
                <div>• <strong>[ E ]</strong>: Exit {isAtMars ? 'Martian Rover' : isAtMoon ? 'Lunar Rover' : 'Car'}</div>
                <div>• <strong>[ Drag ]</strong>: 360° Mouse Look</div>
              </>
            ) : (
              <>
                <div>• <strong>[ W / A / S / D ]</strong>: Pitch & Steer Rocket</div>
                <div>• <strong>[ T ]</strong>: Auto-Pilot (Fly & Land on {destination})</div>
                <div>• <strong>[ F ]</strong>: Launch Rocket ({destination === 'EARTH' ? 'To Earth' : 'Select Destination'})</div>
                <div>• <strong>[ E ]</strong>: Step Out onto {currentWorld}</div>
                <div>• <strong>[ Drag / Wheel ]</strong>: 360° Orbit & Zoom</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
        {playerMode === 'ASTRONAUT' && isAtMars && (
          <button
            onMouseDown={() => handleDpad('KeyQ', true)}
            onMouseUp={() => handleDpad('KeyQ', false)}
            onMouseLeave={() => handleDpad('KeyQ', false)}
            onTouchStart={() => handleDpad('KeyQ', true)}
            onTouchEnd={() => handleDpad('KeyQ', false)}
            className="px-5 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white font-bold font-mono text-xs tracking-wider rounded-xl border border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer flex items-center gap-2 select-none"
          >
            <span>🔫</span>
            <span>FIRE PLASMA RIFLE [Hold Q]</span>
          </button>
        )}

        {playerMode === 'ASTRONAUT' && (hudState.canEnterRover || hudState.canEnterRocket) && (
          <button
            onClick={handleInteraction}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs tracking-wider rounded-xl border border-emerald-300 shadow-xl cursor-pointer flex items-center gap-2"
          >
            <span>{hudState.canEnterRover ? '🏎️' : '🚀'}</span>
            <span>{hudState.canEnterRover ? `DRIVE ${isAtMars ? 'MARTIAN ROVER' : isAtMoon ? 'LUNAR ROVER' : 'CAR'} [Press E]` : `BOARD ROCKET [Press E]`}</span>
          </button>
        )}

        {playerMode === 'ROVER' && (
          <button onClick={handleInteraction} className="px-5 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-xs tracking-wider rounded-xl border border-amber-300 shadow-xl cursor-pointer">
            🚪 EXIT {isAtMars ? 'MARTIAN ROVER' : isAtMoon ? 'LUNAR ROVER' : 'STORMCHASER'} [Press E]
          </button>
        )}

        {playerMode === 'ROCKET' && isFlying && !isLanded && (
          <button
            onClick={() => setAutopilot((p) => !p)}
            className={`px-5 py-3.5 text-xs font-bold font-mono tracking-wider rounded-xl border transition-all cursor-pointer shadow-2xl flex items-center gap-2 ${
              autopilot ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.8)] animate-pulse' :
              stats.targetDist < 2500 ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-bounce' :
              'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 border-purple-300/40 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
            }`}
          >
            <span>{autopilot ? '🤖' : stats.targetDist < 2500 ? (destination === 'MARS' ? '🔴' : destination === 'MOON' ? '🌕' : '🌍') : '🎯'}</span>
            <span>
              {autopilot
                ? stats.targetDist < 300 ? `TOUCHDOWN IN PROGRESS ON ${destination}...` : `🤖 AUTOPILOT ON: RETURNING TO ${destination} [Press T]`
                : stats.targetDist < 2500 ? `INITIATE SOFT ${destination} LANDING [Press T]` : `ACTIVATE AUTOPILOT TO ${destination} [Press T]`}
            </span>
          </button>
        )}

        {!isFlying && playerMode === 'ROCKET' && (
          <div className="flex items-center gap-2">
            <button onClick={handleLaunch} className="px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 transform hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
              <span>🚀</span><span>{currentWorld === 'EARTH' ? 'LAUNCH EXPEDITION [Press F]' : 'LAUNCH TO EARTH [Press F]'}</span>
            </button>
            <button onClick={handleInteraction} className="px-5 py-3.5 bg-cyan-700/80 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl border border-cyan-400 shadow-md cursor-pointer flex items-center gap-1.5">
              <span>🧑‍🚀</span><span>STEP OUT ONTO {currentWorld} [Press E]</span>
            </button>
          </div>
        )}

        {isFlying && (
          <button onClick={handleReset} className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs tracking-wider rounded-xl border border-white/20 shadow-lg cursor-pointer transition-all flex items-center gap-2">
            <span>🔄</span><span>RESET TO EARTH [Press R]</span>
          </button>
        )}
      </div>

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 16, 62], fov: 45, near: 0.5, far: 85000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {!isInSpace ? (
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
        ) : (
          <ambientLight intensity={0.3} color="#cbd5e1" />
        )}

        <UniversalThirdPersonCamera
          playerMode={playerMode}
          rocketPos={posRef.current}
          astronautPos={isAtMars ? marsAstroPosRef.current : isAtMoon ? moonAstroPosRef.current : earthAstroPosRef.current}
          roverPos={isAtMars ? marsRoverPosRef.current : isAtMoon ? moonRoverPosRef.current : earthCarPosRef.current}
          resetCount={resetCount}
        />

        <Suspense fallback={<Loader />}>
          <RealisticLandscape altitude={stats.altitude} />
          <BuranLaunchpad />
          <SpaceEnvironment altitude={stats.altitude} rocketPos={posRef.current} />
          <LunarLandingSiteMarker />

          <AsteroidBelt
            altitude={stats.altitude}
            rocketPos={posRef.current}
            isFlying={isFlying}
            isLanded={isLanded}
            destination={destination}
            isExploding={isExploding}
            resetCount={resetCount}
            onBlast={handleAsteroidBlast}
            onDeflection={handleAsteroidDeflection}
          />

          <ActiveRocketMesh
            isFlying={isFlying}
            isLanded={isLanded}
            throttle={throttle}
            rocketPos={posRef.current}
            rocketQuat={quatRef.current}
            rcsActive={rcsActiveRef.current}
            isExploding={isExploding}
          />

          <EarthExploration
            isActive={!isFlying && !isAtMoon && !isAtMars && (stats.altitude < 100 || isLanded || !isFlying)}
            playerMode={playerMode}
            onPlayerModeChange={setPlayerMode}
            onUpdateHUD={handleUpdateHUD}
            astronautPosRef={earthAstroPosRef}
            carPosRef={earthCarPosRef}
            keysRef={keysRef}
            rocketPos={posRef.current}
          />

          <MoonExploration
            isLanded={isLanded && isAtMoon}
            playerMode={playerMode}
            onPlayerModeChange={setPlayerMode}
            onUpdateHUD={handleUpdateHUD}
            astronautPosRef={moonAstroPosRef}
            roverPosRef={moonRoverPosRef}
            keysRef={keysRef}
            rocketOnMoon={isLanded && isAtMoon}
          />

          <MarsExploration
            isLanded={isLanded && isAtMars}
            playerMode={playerMode}
            onPlayerModeChange={setPlayerMode}
            onUpdateHUD={handleUpdateHUD}
            astronautPosRef={marsAstroPosRef}
            roverPosRef={marsRoverPosRef}
            keysRef={keysRef}
            rocketOnMars={isLanded && isAtMars}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
