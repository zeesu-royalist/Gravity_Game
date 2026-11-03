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
import { playAstronautDeathSound } from './MarsAlienSwarm';
import { EarthExploration, EARTH_CAR_DEFAULT_POS, EARTH_ASTRONAUT_DEFAULT_POS } from './EarthExploration';
import { BuranLaunchpad, ActiveRocketMesh, LunarLandingSiteMarker } from './Rocket';
import { AsteroidBelt } from './AsteroidBelt';

const EARTH_LANDING_SITE = new THREE.Vector3(0, 0.2, 0);
const MOON_APPROACH = new THREE.Vector3(MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y + 180, MOON_LANDING_SITE.z);
const MARS_APPROACH = new THREE.Vector3(MARS_LANDING_SITE.x, MARS_TOUCHDOWN_Y + 240, MARS_LANDING_SITE.z);

const PLANET_DESTS = [
  { id: 'EARTH' as const, icon: '🌍', name: 'EARTH', base: 'Buran Pad', g: '1.0G', v: 'Stormchaser' },
  { id: 'MOON' as const, icon: '🌕', name: 'MOON', base: 'Luna Alpha', g: '0.17G', v: 'Lunar 4x4' },
  { id: 'MARS' as const, icon: '🔴', name: 'MARS', base: 'Ares Base', g: '0.38G', v: 'Martian 4x4' },
];

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
  dest: 'MOON' | 'MARS' | 'EARTH', alt: number, dist: number, targetDist: number, isFlying: boolean, isLanded: boolean, world: 'EARTH' | 'MOON' | 'MARS'
): string {
  if (isLanded) return world === 'MARS' ? '🔴 MISSION COMPLETE: TOUCHDOWN ON MARS!' : world === 'MOON' ? '🌕 MISSION COMPLETE: TOUCHDOWN ON MOON!' : '🌍 MISSION COMPLETE: SAFE RETURN TO EARTH!';
  if (!isFlying) return `${world === 'MARS' ? 'ARES BASE' : world === 'MOON' ? 'LUNAR BASE' : 'EARTH PAD'}: READY FOR LAUNCH`;
  if (dest === 'MARS') {
    if (world === 'EARTH' && alt < 1200) return 'STAGE 1: ATMOSPHERIC ASCENT';
    if (world === 'EARTH' && alt < 5000) return 'STAGE 2: STRATOSPHERE TRANSITION';
    if (world === 'EARTH' && alt < 12000) return 'STAGE 3: TRANS-MARS INJECTION (TMI)';
    return dist > 4000 ? 'STAGE 4: INTERPLANETARY MARS CRUISE' : dist > 600 ? 'STAGE 5: MARTIAN APPROACH & RETRO-BURN' : 'STAGE 6: TOUCHDOWN ON ARES BASE PAD';
  }
  if (dest === 'MOON') {
    if (world === 'EARTH' && alt < 1200) return 'STAGE 1: ATMOSPHERIC ASCENT';
    if (world === 'EARTH' && alt < 4000) return 'STAGE 2: STRATOSPHERE TRANSITION';
    if (world === 'EARTH' && alt < 10000) return 'STAGE 3: TRANSLUNAR INJECTION (TLI)';
    return dist > 3000 ? 'STAGE 4: CISLUNAR CRUISE' : dist > 500 ? 'STAGE 5: LUNAR APPROACH & RETRO-BURN' : 'STAGE 6: TOUCHDOWN ON MOON PAD';
  }
  return dist < 800 ? 'RETURN STAGE 1: PLANETARY ASCENT' : dist < 3500 ? 'RETURN STAGE 2: TRANS-EARTH INJECTION' : targetDist > 3500 ? 'RETURN STAGE 3: DEEP SPACE TRANSIT' : targetDist > 500 ? 'RETURN STAGE 4: EARTH RE-ENTRY' : 'RETURN STAGE 5: RETRO-BURN DESCENT';
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

function PolygonArrowUp() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-9 sm:h-9" fill="none">
      <polygon
        points="12,3 4,12 9,12 9,21 15,21 15,12 20,12"
        fill="rgba(255, 255, 255, 0.08)"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PolygonArrowDown() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-9 sm:h-9" fill="none">
      <polygon
        points="12,21 4,12 9,12 9,3 15,3 15,12 20,12"
        fill="rgba(255, 255, 255, 0.08)"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PolygonArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-9 sm:h-9" fill="none">
      <polygon
        points="3,12 12,4 12,9 21,9 21,15 12,15 12,20"
        fill="rgba(255, 255, 255, 0.08)"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PolygonArrowRight() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-9 sm:h-9" fill="none">
      <polygon
        points="21,12 12,4 12,9 3,9 3,15 12,15 12,20"
        fill="rgba(255, 255, 255, 0.08)"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [destination, setDestination] = useState<'MOON' | 'MARS' | 'EARTH'>('MOON');
  const [showDestModal, setShowDestModal] = useState(false);
  const [showActionsInfo, setShowActionsInfo] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [throttle, setThrottle] = useState(1.0);
  const [resetCount, setResetCount] = useState(0);
  const [playerMode, setPlayerMode] = useState<'ROCKET' | 'ASTRONAUT' | 'ROVER'>('ROCKET');
  const [astronautHealth, setAstronautHealth] = useState(100);
  const [isDead, setIsDead] = useState(false);
  const isDeadRef = useRef(false);
  const deadTimeoutRef = useRef<any>(null);
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
  const shootingHoldRef = useRef(false);
  const shootTimerRef = useRef<any>(null);
  const lastActionTime = useRef(0);

  const earthAstroPosRef = useRef(EARTH_ASTRONAUT_DEFAULT_POS.clone());
  const earthCarPosRef = useRef(EARTH_CAR_DEFAULT_POS.clone());
  const moonAstroPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8));
  const moonRoverPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5));
  const marsAstroPosRef = useRef(new THREE.Vector3(MARS_LANDING_SITE.x + 3.8, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 1.8));
  const marsRoverPosRef = useRef(new THREE.Vector3(MARS_LANDING_SITE.x + 11.0, MARS_TOUCHDOWN_Y, MARS_LANDING_SITE.z + 5.5));

  const [currentWorld, setCurrentWorld] = useState<'EARTH' | 'MOON' | 'MARS'>('EARTH');
  const isAtMoon = currentWorld === 'MOON';
  const isAtMars = currentWorld === 'MARS';
  const launchOriginRef = useRef<'EARTH' | 'MOON' | 'MARS'>('EARTH');
  const destinationRef = useRef(destination);
  destinationRef.current = destination;
  const throttleRef = useRef(throttle);
  throttleRef.current = throttle;
  const lastStatUpdate = useRef(0);

  const executeLaunch = (chosenDest?: 'MOON' | 'MARS' | 'EARTH') => {
    if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setIsExploding(false);
    setAsteroidAlert(null);
    if (chosenDest) {
      setDestination(chosenDest);
      destinationRef.current = chosenDest;
    }
    launchOriginRef.current = currentWorld;
    setShowDestModal(false);
    setIsFlying(true);
    isFlyingRef.current = true;
    setIsLanded(false);
    isLandedRef.current = false;
    setPlayerMode('ROCKET');
    playerModeRef.current = 'ROCKET';
    velRef.current.set(0, 40, 0);
    rotRef.current.set(0, 0, 0, 'YXZ');
    quatRef.current.set(0, 0, 0, 1);
  };

  const handleLaunch = () => {
    if (!isFlying && playerMode === 'ROCKET') {
      setShowDestModal(true);
    }
  };

  const handleReset = useCallback(() => {
    if (blastTimeoutRef.current) clearTimeout(blastTimeoutRef.current);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    if (deadTimeoutRef.current) clearTimeout(deadTimeoutRef.current);
    setIsDead(false);
    isDeadRef.current = false;
    setAstronautHealth(100);
    setIsExploding(false);
    setAsteroidAlert(null);
    setIsFlying(false);
    isFlyingRef.current = false;
    setIsLanded(false);
    isLandedRef.current = false;
    setAutopilot(false);
    autopilotRef.current = false;
    setDestination('MOON');
    destinationRef.current = 'MOON';
    setCurrentWorld('EARTH');
    launchOriginRef.current = 'EARTH';
    setShowDestModal(false);
    setPlayerMode('ROCKET');
    playerModeRef.current = 'ROCKET';
    setThrottle(1.0);
    throttleRef.current = 1.0;
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

  const handleAstronautDamage = useCallback((damage: number) => {
    if (isDeadRef.current) return;
    setAstronautHealth((prev) => {
      const next = Math.max(0, prev - damage);
      if (next <= 0 && !isDeadRef.current) {
        isDeadRef.current = true;
        setIsDead(true);
        playAstronautDeathSound();
        if (deadTimeoutRef.current) clearTimeout(deadTimeoutRef.current);
        deadTimeoutRef.current = setTimeout(() => {
          handleReset();
        }, 2200);
      }
      return next;
    });
  }, [handleReset]);

  const handleAsteroidBlast = useCallback((_astPos: THREE.Vector3, radius: number) => {
    setIsExploding(true);
    setAutopilot(false);
    velRef.current.set(0, 0, 0);

    setAsteroidAlert({
      type: 'BLAST',
      message: `Impact (${Math.round(radius)}m) • Emergency reset`,
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
      message: 'Shield absorbed collision • 100% nominal',
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
      if (hudStateRef.current.canEnterRover) {
        setPlayerMode('ROVER');
        setAstronautHealth(100);
      } else if (hudStateRef.current.canEnterRocket) {
        setPlayerMode('ROCKET');
        setAstronautHealth(100);
      }
    } else if (playerModeRef.current === 'ROVER') {
      setPlayerMode('ASTRONAUT');
    }
  };

  useEffect(() => {
    if (playerMode === 'ROVER' || playerMode === 'ROCKET') {
      setAstronautHealth(100);
    }
  }, [playerMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'Escape') {
        setShowDestModal(false);
        setShowActionsInfo(false);
        return;
      }
      if (e.code === 'KeyR') { handleReset(); return; }
      if (isExplodingRef.current || isDeadRef.current) return;
      if (e.code === 'KeyE') handleInteraction();
      if (playerModeRef.current === 'ROCKET' && (e.code === 'KeyF' || (e.code === 'Space' && !isFlyingRef.current))) handleLaunch();
      if (playerModeRef.current === 'ROCKET' && e.code === 'KeyT') {
        const nearLimit = destinationRef.current === 'MARS' ? 9000 : 7000;
        const currentDist = destinationRef.current === 'MARS'
          ? Math.max(0, posRef.current.distanceTo(MARS_POSITION) - MARS_RADIUS)
          : destinationRef.current === 'MOON'
            ? Math.max(0, posRef.current.distanceTo(MOON_POSITION) - MOON_RADIUS)
            : posRef.current.distanceTo(EARTH_LANDING_SITE);
        if (autopilotRef.current || (isFlyingRef.current && currentDist <= nearLimit)) {
          setAutopilot((p) => !p);
        }
      }
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
      shootingHoldRef.current = false;
      if (shootTimerRef.current) {
        clearTimeout(shootTimerRef.current);
        shootTimerRef.current = null;
      }
    };
    const onPointerUp = () => {
      if (!shootingHoldRef.current && !shootTimerRef.current) {
        keysRef.current['KeyQ'] = false;
      }
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
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (isFlyingRef.current && !isLandedRef.current && !isExplodingRef.current) {
        const keys = keysRef.current, pos = posRef.current, vel = velRef.current;
        const dest = destinationRef.current;
        const isMars = dest === 'MARS';
        const isMoon = dest === 'MOON';
        const targetPad = isMars ? MARS_LANDING_SITE : isMoon ? MOON_LANDING_SITE : EARTH_LANDING_SITE;
        const altAbovePad = pos.y - targetPad.y;
        const hDistToPad = Math.hypot(pos.x - targetPad.x, pos.z - targetPad.z);

        const landRocket = (pad: THREE.Vector3, landedWorld: 'MOON' | 'MARS' | 'EARTH') => {
          pos.copy(pad);
          vel.set(0, 0, 0);
          rotRef.current.set(0, 0, 0, 'YXZ');
          quatRef.current.set(0, 0, 0, 1);
          setIsLanded(true);
          isLandedRef.current = true;
          setIsFlying(false);
          isFlyingRef.current = false;
          setAutopilot(false);
          autopilotRef.current = false;
          setDestination(landedWorld);
          destinationRef.current = landedWorld;
          setCurrentWorld(landedWorld);
          launchOriginRef.current = landedWorld;
        };

        let rcsPitch = 0, rcsYaw = 0;

        // Safe departure clearance: prevents ground clamp snapping / collision fight on planetary launch
        const originWorld = launchOriginRef.current;
        const originPad = originWorld === 'MARS' ? MARS_LANDING_SITE : originWorld === 'MOON' ? MOON_LANDING_SITE : EARTH_LANDING_SITE;
        const isDeparting = pos.distanceTo(originPad) < 280;

        if (autopilotRef.current) {
          if (isDeparting) {
            const depWaypoint = new THREE.Vector3(originPad.x, originPad.y + 400, originPad.z);
            const toDep = depWaypoint.clone().sub(pos).normalize();
            quatRef.current.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toDep), delta * 4.0);
            vel.lerp(new THREE.Vector3(0, 180, 0), delta * 3.0);
            pos.addScaledVector(vel, delta);
          } else if (altAbovePad <= 0.8 && hDistToPad <= 24.0) {
            landRocket(targetPad, isMars ? 'MARS' : isMoon ? 'MOON' : 'EARTH');
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
        } else if (playerModeRef.current === 'ROCKET') {
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
          vel.addScaledVector(fwd, (38 + boost * 85) * throttleRef.current * delta);

          if (pos.y > 0.2 && pos.y < 2500 && Math.hypot(pos.x, pos.z) < 3000) vel.y -= 9.8 * (1 - pos.y / 2500) * delta;
          pos.addScaledVector(vel, delta);

          if (isMars) {
            if (pos.distanceTo(MARS_LANDING_SITE) < 32 || (pos.distanceTo(MARS_POSITION) <= MARS_RADIUS + 3 && pos.y > 10000)) landRocket(MARS_LANDING_SITE, 'MARS');
          } else if (isMoon) {
            if (pos.distanceTo(MOON_LANDING_SITE) < 28 || (pos.distanceTo(MOON_POSITION) <= MOON_RADIUS + 2 && pos.y > 10000)) landRocket(MOON_LANDING_SITE, 'MOON');
          } else {
            if (pos.y <= 1.2 && Math.hypot(pos.x, pos.z) < 32) landRocket(EARTH_LANDING_SITE, 'EARTH');
          }
        }

        // Hard ground clamp (safe departure without snapping or glitching)
        if (pos.y < 0.2 && Math.hypot(pos.x, pos.z) < 3000) { pos.y = 0.2; if (vel.y < 0) vel.y = 0; }
        if (originWorld !== 'MOON' || !isDeparting) {
          if (pos.distanceTo(MOON_POSITION) < MOON_RADIUS + 30 && pos.y < MOON_TOUCHDOWN_Y) { pos.y = MOON_TOUCHDOWN_Y; if (vel.y < 0) vel.y = 0; }
        }
        if (originWorld !== 'MARS' || !isDeparting) {
          if (pos.distanceTo(MARS_POSITION) < MARS_RADIUS + 30 && pos.y < MARS_TOUCHDOWN_Y) { pos.y = MARS_TOUCHDOWN_Y; if (vel.y < 0) vel.y = 0; }
        }

        rcsActiveRef.current = { pitch: rcsPitch, yaw: rcsYaw };
        const destDist = isMars
          ? Math.max(0, Math.round(pos.distanceTo(MARS_POSITION) - MARS_RADIUS))
          : isMoon
            ? Math.max(0, Math.round(pos.distanceTo(MOON_POSITION) - MOON_RADIUS))
            : Math.round(pos.distanceTo(EARTH_LANDING_SITE));
        const targetDist = destDist;

        if (now - lastStatUpdate.current > 60) {
          lastStatUpdate.current = now;
          setStats({
            altitude: Math.max(0, Math.round(pos.y)),
            speed: Math.round(vel.length() * 3.6),
            targetDist,
            destination: dest,
            stage: getMissionStage(dest, pos.y, destDist, targetDist, true, false, originWorld),
          });
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isFlying, isLanded, resetCount]);

  const handleDpad = (code: string, pressed: boolean) => {
    if (isDeadRef.current) return;
    keysRef.current[code] = pressed;
    if (pressed && autopilot) setAutopilot(false);
  };

  // Mobile & Touch Input Engine: Instant One-Touch Response + Duplicate Event Deduplication
  const triggerAction = (fn: () => void) => {
    if (isDeadRef.current) return;
    const now = performance.now();
    if (now - lastActionTime.current < 200) return;
    lastActionTime.current = now;
    fn();
  };

  const actionProps = (fn: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      triggerAction(fn);
    },
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      triggerAction(fn);
    },
  });

  const dpadProps = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      handleDpad(code, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      handleDpad(code, false);
    },
    onPointerCancel: () => handleDpad(code, false),
  });

  const fireGun = (pressed: boolean) => {
    if (isDeadRef.current) return;
    shootingHoldRef.current = pressed;
    if (pressed) {
      keysRef.current['KeyQ'] = true;
      if (shootTimerRef.current) clearTimeout(shootTimerRef.current);
      // 180ms pulse guarantees single tap registers a plasma shot in 3D loop
      shootTimerRef.current = setTimeout(() => {
        if (!shootingHoldRef.current) keysRef.current['KeyQ'] = false;
        shootTimerRef.current = null;
      }, 180);
    } else {
      if (!shootTimerRef.current) keysRef.current['KeyQ'] = false;
    }
  };

  const qProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      fireGun(true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      fireGun(false);
    },
    onPointerCancel: () => fireGun(false),
  };

  const isInSpace = stats.altitude > 3500;
  // Autopilot button is visible when rocket approaches Moon, Mars, or Earth from moderate distance (or while autopilot is engaged)
  const isNearPlanet = isFlying && playerMode === 'ROCKET' && (
    stats.targetDist <= (stats.destination === 'MARS' ? 9000 : 7000)
  );
  const showAutopilotBtn = isNearPlanet || autopilot;

  return (
    <div className={`relative w-full h-full overflow-hidden select-none font-sans transition-colors duration-1000 ${isInSpace ? 'bg-[#000003]' : 'bg-[#87ceeb]'}`}>
      {/* Xenomorph Attack & Danger Screen Vignette */}
      {isAtMars && (hudState.alienThreat?.isAttacking || (playerMode === 'ASTRONAUT' && astronautHealth < 35)) && (
        <div className="pointer-events-none fixed inset-0 z-20 shadow-[inset_0_0_120px_rgba(239,68,68,0.5)] border-4 border-red-500/40 transition-opacity duration-300" />
      )}

      {/* Astronaut Death Screen Overlay */}
      {isDead && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md select-none animate-in fade-in duration-300 px-4">
          <div className="text-red-500 text-3xl sm:text-5xl font-black tracking-widest uppercase mb-2 animate-pulse text-center">
            YOU DIED
          </div>
          <div className="text-slate-300 text-xs sm:text-sm font-mono text-center max-w-sm mb-4">
            Astronaut vital signs lost on Mars. Critical life support system failure.
          </div>
          <div className="text-cyan-400 text-[10px] sm:text-xs font-mono tracking-widest uppercase bg-cyan-950/70 border border-cyan-500/40 px-3 py-1.5 rounded-full animate-bounce">
            Evacuating to Earth Cosmodrome...
          </div>
        </div>
      )}

      {/* Catastrophic Asteroid Blast Screen Vignette */}
      {isExploding && (
        <div className="pointer-events-none fixed inset-0 z-30 shadow-[inset_0_0_160px_rgba(255,0,0,0.9)] bg-red-600/20 border-8 border-red-500 animate-pulse" />
      )}

      {/* Asteroid Alert Banner (Blast or Deflection) - Minimal & Mobile-Responsive */}
      {asteroidAlert && (
        <div className="pointer-events-none fixed top-12 sm:top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150 px-2 w-auto max-w-[280px] sm:max-w-md">
          <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border backdrop-blur-md shadow-xl text-center ${asteroidAlert.type === 'BLAST'
            ? 'bg-red-950/90 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.5)] text-red-100'
            : 'bg-emerald-950/90 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.5)] text-emerald-100'
            }`}>
            <div className={`text-[10px] sm:text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 ${asteroidAlert.type === 'BLAST' ? 'text-red-400 animate-pulse' : 'text-emerald-300'
              }`}>
              <span>{asteroidAlert.type === 'BLAST' ? '💥' : '🛡️'}</span>
              <span>{asteroidAlert.type === 'BLAST' ? 'CRITICAL IMPACT' : 'ASTEROID DEFLECTED'}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] font-mono text-slate-200 mt-0.5">
              {asteroidAlert.message}
            </div>
          </div>
        </div>
      )}

      {/* 1. TOP-LEFT: Z-SPACE & Mission Info (Matching Mockup 100%) */}
      <div className="absolute top-3 sm:top-6 left-3 sm:left-6 z-20 flex flex-col gap-1 select-none pointer-events-auto">
        <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-wider text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          Z-SPACE
        </h1>
        <div className="text-[10px] sm:text-xs text-gray-200 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] leading-relaxed max-w-[200px] sm:max-w-xs">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-gray-200">Created by</span>
            <a
              href="https://zeesu-royalist.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-100 hover:text-white no-underline transition-colors pointer-events-auto font-semibold"
              title="Visit Zeesu Royalist"
            >
              Zeesu Royalist
            </a>
          </div>

          <div className="text-[9px] sm:text-[11px] font-mono text-gray-200 mt-0.5 leading-normal">
            Status: {isLanded ? 'Surface Touchdown' : isFlying ? (autopilot ? 'Autopilot Flight' : 'Manual Flight') : 'Ready for Launch'}
          </div>

          <div className="text-[9px] sm:text-xs text-gray-200 mt-0.5 leading-normal">
            Target: {destination === 'MARS' ? 'Mars Cosmodrome' : destination === 'MOON' ? 'Luna Base Alpha' : 'Earth Cosmodrome'}
          </div>
        </div>
      </div>

      {/* 2. TOP-RIGHT: Telemetry Stack (Matching Mockup 100%) */}
      <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-20 flex flex-col items-end gap-1.5 sm:gap-2 text-right select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] pointer-events-auto">
        <div>
          <div className="text-[10px] sm:text-sm text-slate-300 font-medium">Altitude</div>
          <div className="text-base sm:text-2xl font-bold text-slate-100 font-mono">
            {stats.altitude >= 10000 ? `${(stats.altitude / 1000).toFixed(1)} km` : `${stats.altitude.toLocaleString()}`}
          </div>
        </div>
        <div>
          <div className="text-[10px] sm:text-sm text-slate-300 font-medium">Velocity</div>
          <div className="text-base sm:text-2xl font-bold text-slate-100 font-mono">
            {stats.speed.toLocaleString()} <span className="text-[10px] sm:text-sm font-normal text-slate-400">km/h</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] sm:text-sm text-slate-300 font-medium">
            {destination === 'MARS' ? 'Distance to mars' : destination === 'MOON' ? 'Distance to moon' : 'Distance to earth'}
          </div>
          <div className="text-base sm:text-2xl font-bold text-slate-100 font-mono">
            {isLanded ? '0 (TOUCHDOWN)' : `${stats.targetDist.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Destination Selection Modal */}
      {showDestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 select-none">
          <div className="w-full max-w-[280px] sm:max-w-sm bg-[#050813]/95 border border-cyan-500/30 rounded-xl p-2.5 sm:p-3.5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[9.5px] sm:text-xs font-mono text-cyan-400 font-bold">
              <span>SELECT DESTINATION • {currentWorld}</span>
              <button onClick={() => setShowDestModal(false)} className="text-slate-400 hover:text-white cursor-pointer text-xs px-1">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
              {PLANET_DESTS.filter((d) => d.id !== currentWorld).map((d) => (
                <button
                  key={d.id}
                  onClick={() => executeLaunch(d.id)}
                  className="group flex flex-col justify-between p-2 sm:p-2.5 rounded-lg border border-slate-700/80 hover:border-cyan-400 bg-slate-900/60 hover:bg-slate-900 transition-all text-left cursor-pointer active:scale-95"
                >
                  <div>
                    <div className="text-base sm:text-2xl">{d.icon}</div>
                    <div className="text-[10px] sm:text-xs font-bold text-white mt-0.5">{d.name}</div>
                    <div className="text-[7.5px] sm:text-[9px] text-slate-400 font-mono mb-1">{d.base}</div>
                    <div className="text-[7px] sm:text-[8.5px] font-mono text-slate-400 space-y-0.5 border-t border-white/10 pt-1 mb-2">
                      <div className="flex justify-between"><span>GRAV:</span><span className="text-emerald-400">{d.g}</span></div>
                      <div className="flex justify-between"><span>ASSET:</span><span className="text-amber-300">{d.v}</span></div>
                    </div>
                  </div>
                  <div className="w-full py-1 rounded border border-cyan-500/40 bg-cyan-950/70 group-hover:bg-cyan-500 group-hover:text-black text-cyan-300 text-center font-mono font-bold text-[8px] sm:text-[10px] uppercase transition">
                    Launch →
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] sm:text-[9px] text-slate-500 font-mono">
              <span>ZEESU-1 NAV</span>
              <button onClick={() => setShowDestModal(false)} className="text-slate-400 hover:text-white cursor-pointer underline">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BOTTOM-LEFT: Shoot Weapon, Vertical Navigation Buttons & Flight Controls Info */}
      <div className="absolute bottom-3 sm:bottom-6 left-3 sm:left-6 z-20 flex flex-col items-start gap-2 sm:gap-2.5 select-none pointer-events-auto">
        {/* Vertical Buttons: Shoot (Mars Astronaut only), Up, Down (Locked to the left edge) */}
        <div className="flex flex-col items-start w-fit gap-1.5 sm:gap-2">
          {/* Circle: Shoot Gun (Visible ONLY when Astronaut steps out on Mars, matching Health bar) */}
          {isAtMars && playerMode === 'ASTRONAUT' && (
            <button
              {...qProps}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 sm:border-[2.5px] bg-black/40 hover:bg-black/60 active:scale-95 text-slate-100 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none p-1 leading-none border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-pulse animate-in fade-in zoom-in-75 duration-200"
              aria-label="Shoot Weapon"
              title="Shoot Weapon [Q]"
            >
              <span className="text-[8.5px] sm:text-[10px] font-bold tracking-tight uppercase leading-none">
                SHOOT
              </span>
            </button>
          )}

          {/* Up Button */}
          <button
            {...dpadProps('KeyW')}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-slate-700/80 bg-black/40 hover:bg-black/60 hover:border-cyan-400 active:border-cyan-300 active:bg-cyan-900/40 text-slate-200 hover:text-white backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none active:scale-95"
            aria-label="Up / Forward"
          >
            <PolygonArrowUp />
          </button>

          {/* Down Button */}
          <button
            {...dpadProps('KeyS')}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-slate-700/80 bg-black/40 hover:bg-black/60 hover:border-cyan-400 active:border-cyan-300 active:bg-cyan-900/40 text-slate-200 hover:text-white backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none active:scale-95"
            aria-label="Down / Backward"
          >
            <PolygonArrowDown />
          </button>
        </div>

        {/* Flight Controls Information Text (Matching Mockup 100%) */}
        <div className="text-[10px] sm:text-xs text-slate-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] leading-relaxed whitespace-nowrap">
          <div className="font-semibold text-slate-200 mb-0.5">Flight controls:</div>
          <div className="text-[8.5px] sm:text-[11px] text-slate-300/90 font-mono space-y-0.5 whitespace-nowrap">
            <div>• [ W / S ] : Move Forward / Back</div>
            <div>• [ A / D ] : Steer Left / Right</div>
            <div>• [ Space ] : {isAtMars ? 'Martian Hop' : isAtMoon ? 'Moon Hop' : 'Jump'}</div>
            <div className="hidden sm:block">• [ Drag ] : 360° Orbit View</div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM-RIGHT: Actions Text, Vertical Circular Buttons (F, E, Q + T, R, i) & Horizontal Steering Buttons */}
      <div className="absolute bottom-3 sm:bottom-6 right-3 sm:right-6 z-20 flex flex-col items-end gap-2 sm:gap-3 select-none pointer-events-auto">
        {/* Circular Action Buttons Cluster: i above R, R above F, F, E, Q column in a straight vertical line */}
        <div className="relative flex flex-col items-center">
          {/* Actions Guide Popover (opens to the left of the button cluster) */}
          {showActionsInfo && (
            <div className="absolute right-full mr-2 sm:mr-3 top-0 bg-slate-950/95 backdrop-blur-xl border border-cyan-400/60 rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-150 w-52 sm:w-60 z-40 text-left">
              <div className="flex items-center justify-between mb-1.5 border-b border-white/10 pb-1">
                <span className="text-[10px] sm:text-xs text-cyan-300 font-bold uppercase tracking-wide">
                  For Computer Navigation
                </span>
                <button
                  {...actionProps(() => setShowActionsInfo(false))}
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="text-[9.5px] sm:text-[11px] text-slate-400 font-medium mb-2">
                Use these keys to play:
              </div>

              {/* Action Keycaps List */}
              <div className="space-y-1.5 text-[9.5px] sm:text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <kbd className="w-5 h-5 flex items-center justify-center rounded bg-white/10 border border-white/20 text-cyan-300 font-bold text-[9px] sm:text-[10px] shadow-sm">F</kbd>
                  <span className="text-slate-200">for launch</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="w-5 h-5 flex items-center justify-center rounded bg-white/10 border border-white/20 text-cyan-300 font-bold text-[9px] sm:text-[10px] shadow-sm">E</kbd>
                  <span className="text-slate-200">for enter / exit</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="w-5 h-5 flex items-center justify-center rounded bg-white/10 border border-white/20 text-cyan-300 font-bold text-[9px] sm:text-[10px] shadow-sm">Q</kbd>
                  <span className="text-slate-200">for shoot</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="w-5 h-5 flex items-center justify-center rounded bg-white/10 border border-white/20 text-cyan-300 font-bold text-[9px] sm:text-[10px] shadow-sm">T</kbd>
                  <span className="text-slate-200">for auto pilot (near planet)</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="w-5 h-5 flex items-center justify-center rounded bg-white/10 border border-white/20 text-cyan-300 font-bold text-[9px] sm:text-[10px] shadow-sm">R</kbd>
                  <span className="text-slate-200">for restart</span>
                </div>
              </div>

              {/* Creator Credit Link */}
              <div className="mt-3 pt-2.5 border-t border-white/10 text-center">
                <a
                  href="https://zeesu-royalist.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-mono text-cyan-400 hover:text-cyan-200 transition-colors"
                  title="Portfolio"
                >
                  <span>zeesu-royalist.vercel.app</span>
                  <span className="text-[9px] opacity-75">↗</span>
                </a>
              </div>
            </div>
          )}

          {/* Vertical Minimal Health Indicator (Visible ONLY when Astronaut steps out on Mars) */}
          {isAtMars && playerMode === 'ASTRONAUT' && (
            <div className="flex flex-col items-center translate-x-1.5 mb-1.5 sm:mb-2 select-none pointer-events-none animate-in fade-in duration-200">
              {/* Percentage */}
              <div className={`text-[8.5px] sm:text-[9.5px] font-mono font-bold mb-0.5 leading-none ${astronautHealth >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {astronautHealth}%
              </div>

              {/* Minimal Capsule + HEALTH Letters */}
              <div className="flex items-center justify-center gap-1.5 h-14 sm:h-16">
                {/* Flat Solid Capsule (No gradients, matching button dark glass) */}
                <div className={`w-2.5 sm:w-3 h-full rounded-full border-2 bg-black/40 p-[2px] flex flex-col justify-end overflow-hidden ${astronautHealth >= 50 ? 'border-slate-700/80' : 'border-red-500/80'}`}>
                  <div
                    className={`w-full rounded-full transition-all duration-300 ${astronautHealth >= 50 ? 'bg-emerald-400' : 'bg-red-500'}`}
                    style={{ height: `${astronautHealth}%` }}
                  />
                </div>

                {/* Flat HEALTH Letters with balanced line height */}
                <div className="flex flex-col items-center justify-center text-[6px] sm:text-[7px] font-mono font-bold text-slate-300 uppercase leading-[7.5px] sm:leading-[8.5px] select-none">
                  <span>H</span>
                  <span>E</span>
                  <span>A</span>
                  <span>L</span>
                  <span>T</span>
                  <span>H</span>
                </div>
              </div>
            </div>
          )}

          {/* Small Circle (i): Info Button directly above R in straight vertical alignment */}
          <button
            {...actionProps(() => setShowActionsInfo((p) => !p))}
            className={`w-6 h-6 sm:w-7 sm:h-7 mb-1.5 sm:mb-2 rounded-full border-1.5 sm:border-2 bg-black/50 hover:bg-black/70 active:scale-90 backdrop-blur-md shadow-md flex items-center justify-center cursor-pointer transition-all select-none touch-manipulation font-serif italic font-bold text-[10px] sm:text-xs ${showActionsInfo
              ? 'border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
              : 'border-slate-500/80 text-slate-300 hover:border-cyan-400 hover:text-white'
              }`}
            title="Toggle Controls Guide (i)"
            aria-label="Toggle Controls Info"
          >
            i
          </button>

          {/* Small Circle: Restart Mission directly above Launch */}
          <button
            {...actionProps(handleReset)}
            className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 sm:mb-2 rounded-full border-2 border-slate-700/80 hover:border-red-400 bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all touch-none select-none shadow-[0_4px_16px_rgba(0,0,0,0.6)] p-0.5 leading-none"
            title="Restart Mission [R]"
            aria-label="Restart Mission"
          >
            <span className="text-[6.5px] sm:text-[8px] font-bold tracking-tight uppercase leading-none text-slate-200 hover:text-red-300">
              RE
            </span>
            <span className="text-[6px] sm:text-[7.5px] font-bold tracking-tight uppercase leading-none mt-0.5 text-slate-200 hover:text-red-300">
              START
            </span>
          </button>

          {/* Main Action Buttons Column: Launch, Enter Exit, Shoot */}
          <div className="flex flex-col items-center gap-1.5 sm:gap-2">
            {/* Circle: Launch */}
            <button
              {...actionProps(handleLaunch)}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 sm:border-[2.5px] bg-black/40 hover:bg-black/60 active:scale-95 text-slate-100 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none p-1 leading-none ${!isFlying && playerMode === 'ROCKET'
                ? 'border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-pulse'
                : 'border-slate-700/80 hover:border-cyan-400'
                }`}
              aria-label="Launch Rocket"
              title="Launch Rocket [F]"
            >
              <span className="text-[8.5px] sm:text-[10px] font-bold tracking-tight uppercase leading-none">
                LAUNCH
              </span>
            </button>

            {/* Circle: Enter / Exit Vehicle */}
            <button
              {...actionProps(handleInteraction)}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 sm:border-[2.5px] bg-black/40 hover:bg-black/60 active:scale-95 text-slate-100 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center cursor-pointer transition-all touch-none select-none p-1 leading-none ${hudState.canEnterRover || hudState.canEnterRocket || (isLanded && playerMode === 'ROCKET')
                ? 'border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.6)] animate-pulse'
                : 'border-slate-700/80 hover:border-cyan-400'
                }`}
              aria-label="Enter or Exit vehicle"
              title="Enter or Exit vehicle [E]"
            >
              <span className="text-[8px] sm:text-[9.5px] font-bold tracking-tight uppercase leading-none">
                ENTER
              </span>
              <span className="text-[7px] sm:text-[8.5px] font-bold tracking-tight uppercase leading-none mt-0.5 opacity-90">
                EXIT
              </span>
            </button>
          </div>

          {/* Small Circle: Autopilot positioned to the left of the action buttons (Visible when near Moon, Mars, or Earth) */}
          {showAutopilotBtn && (
            <button
              {...actionProps(() => setAutopilot((p) => !p))}
              className={`absolute right-full mr-2.5 sm:mr-3 bottom-[35px] sm:bottom-[40px] w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 bg-black/40 hover:bg-black/60 active:scale-95 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all touch-none select-none shadow-[0_4px_16px_rgba(0,0,0,0.6)] p-0.5 leading-none animate-in fade-in zoom-in-75 duration-300 ${autopilot
                ? 'border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.6)] animate-pulse'
                : 'border-slate-700/80 text-slate-300 hover:border-cyan-400'
                }`}
              title="Autopilot Cruise [T]"
              aria-label="T for Autopilot Cruise"
            >
              <span className="text-[6.5px] sm:text-[8px] font-bold tracking-tight uppercase leading-none">AUTO</span>
              <span className="text-[5.5px] sm:text-[7px] font-bold tracking-tight uppercase leading-none mt-0.5 opacity-90">PILOT</span>
            </button>
          )}
        </div>

        {/* Horizontal Navigation Buttons: Left / Right (side-by-side) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Left Button */}
          <button
            {...dpadProps('KeyA')}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-slate-700/80 bg-black/40 hover:bg-black/60 hover:border-cyan-400 active:border-cyan-300 active:bg-cyan-900/40 text-slate-200 hover:text-white backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none active:scale-95"
            aria-label="Steer Left"
          >
            <PolygonArrowLeft />
          </button>

          {/* Right Button */}
          <button
            {...dpadProps('KeyD')}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl border-2 sm:border-[2.5px] border-slate-700/80 bg-black/40 hover:bg-black/60 hover:border-cyan-400 active:border-cyan-300 active:bg-cyan-900/40 text-slate-200 hover:text-white backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex items-center justify-center cursor-pointer transition-all touch-none select-none active:scale-95"
            aria-label="Steer Right"
          >
            <PolygonArrowRight />
          </button>
        </div>
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
            onAstronautHit={handleAstronautDamage}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
