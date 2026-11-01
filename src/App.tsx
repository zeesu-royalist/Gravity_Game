import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { RealisticLandscape } from './RealisticLandscape';
import { SpaceEnvironment, MOON_POSITION, MOON_RADIUS } from './SpaceEnvironment';
import { MoonExploration, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE } from './MoonExploration';
import { BuranLaunchpad, ActiveRocketMesh, LunarLandingSiteMarker } from './Rocket';

const EARTH_LANDING_SITE = new THREE.Vector3(0, 0.2, 0);
const EARTH_APPROACH_POINT = new THREE.Vector3(0, 220, 0);
const MOON_APPROACH_POINT = new THREE.Vector3(MOON_LANDING_SITE.x, MOON_TOUCHDOWN_Y + 180, MOON_LANDING_SITE.z);

// Universal Third-Person Camera (Rocket / Astronaut / Rover)
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
    const controls = controlsRef.current;
    if (!controls) return;
    const target = playerMode === 'ROCKET'
      ? new THREE.Vector3(rocketPos.x, rocketPos.y + 13.5, rocketPos.z)
      : playerMode === 'ASTRONAUT'
      ? new THREE.Vector3(astronautPos.x, astronautPos.y + 1.2, astronautPos.z)
      : new THREE.Vector3(roverPos.x, roverPos.y + 1.2, roverPos.z);

    camera.position.add(new THREE.Vector3().subVectors(target, prevTarget.current));
    controls.target.copy(target);
    prevTarget.current.copy(target);
    controls.update();
  });

  const minDist = playerMode === 'ASTRONAUT' ? 2.5 : playerMode === 'ROVER' ? 4.5 : 7;
  const maxDist = playerMode === 'ASTRONAUT' ? 16 : playerMode === 'ROVER' ? 26 : 75;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 13.7, 0]}
      enablePan={false}
      minDistance={minDist}
      maxDistance={maxDist}
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={1.2}
    />
  );
}

// Mission Stage String Helper
function getMissionStage(isMoon: boolean, alt: number, moonDist: number, targetDist: number, isFlying: boolean, isLanded: boolean): string {
  if (isMoon) {
    if (!isFlying && !isLanded) return 'STANDBY ON EARTH PAD';
    if (isLanded) return '🌕 MISSION COMPLETE: TOUCHDOWN ON MOON!';
    if (alt < 1200) return 'STAGE 1: ATMOSPHERIC ASCENT';
    if (alt < 4000) return 'STAGE 2: STRATOSPHERE TRANSITION';
    if (alt < 10000) return 'STAGE 3: TRANSLUNAR INJECTION (TLI)';
    if (moonDist > 3000) return 'STAGE 4: CISLUNAR DEEP SPACE CRUISE';
    if (moonDist > 500) return 'STAGE 5: LUNAR APPROACH & RETRO-BURN';
    return 'STAGE 6: FINAL TOUCHDOWN ON MOON PAD';
  }
  if (!isFlying && isLanded) return 'LUNAR BASE: ASCENT MODULE READY FOR EARTH LAUNCH';
  if (isLanded) return '🌍 MISSION COMPLETE: SAFE RETURN TO EARTH!';
  if (moonDist < 800) return 'RETURN STAGE 1: LUNAR LIFTOFF & ASCENT';
  if (moonDist < 3500) return 'RETURN STAGE 2: TRANS-EARTH INJECTION (TEI)';
  if (targetDist > 3500) return 'RETURN STAGE 3: DEEP SPACE TRANSIT TO EARTH';
  if (targetDist > 500) return 'RETURN STAGE 4: EARTH ATMOSPHERE RE-ENTRY';
  return 'RETURN STAGE 5: POWERED RETRO-BURN DESCENT';
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="bg-black/85 text-white px-6 py-4 rounded-xl border border-cyan-500/40 text-center font-sans shadow-2xl backdrop-blur-md">
        <div className="text-sm font-semibold tracking-wide text-cyan-400 mb-2">Initializing Z-SPACE Mission...</div>
        <div className="w-52 bg-gray-800 rounded-full h-2.5 overflow-hidden border border-gray-700">
          <div className="bg-cyan-400 h-full transition-all duration-200" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-2 font-mono">{Math.round(progress)}%</div>
      </div>
    </Html>
  );
}

export default function App() {
  const [destination, setDestination] = useState<'MOON' | 'EARTH'>('MOON');
  const [isFlying, setIsFlying] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [throttle, setThrottle] = useState(1.0);
  const [resetCount, setResetCount] = useState(0);
  const [playerMode, setPlayerMode] = useState<'ROCKET' | 'ASTRONAUT' | 'ROVER'>('ROCKET');

  const [stats, setStats] = useState({
    altitude: 0,
    speed: 0,
    targetDist: 19500,
    destination: 'MOON' as 'MOON' | 'EARTH',
    stage: 'STANDBY ON EARTH PAD',
  });

  const [hudState, setHudState] = useState({ canEnterRover: false, canEnterRocket: false, roverSpeed: 0 });

  const posRef = useRef(new THREE.Vector3(0, 0.2, 0));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const rotRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const quatRef = useRef(new THREE.Quaternion());
  const rcsActiveRef = useRef<{ pitch: number; yaw: number }>({ pitch: 0, yaw: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  const astronautPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 3.8, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 1.8));
  const roverPosRef = useRef(new THREE.Vector3(MOON_LANDING_SITE.x + 11.0, MOON_TOUCHDOWN_Y, MOON_LANDING_SITE.z + 5.5));

  const handleLaunch = () => {
    setIsFlying(true);
    setIsLanded(false);
    setPlayerMode('ROCKET');
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
    setStats({ altitude: 0, speed: 0, targetDist: 19500, destination: 'MOON', stage: 'STANDBY ON EARTH PAD' });
  };

  const handleInteraction = () => {
    if (posRef.current.distanceTo(MOON_LANDING_SITE) >= 30 && isLanded) return;
    if (playerMode === 'ROCKET') setPlayerMode('ASTRONAUT');
    else if (playerMode === 'ASTRONAUT') {
      if (hudState.canEnterRover) setPlayerMode('ROVER');
      else if (hudState.canEnterRocket) setPlayerMode('ROCKET');
    } else if (playerMode === 'ROVER') setPlayerMode('ASTRONAUT');
  };

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'KeyE') handleInteraction();
      if (playerMode === 'ROCKET' && (e.code === 'KeyF' || (e.code === 'Space' && !isFlying))) handleLaunch();
      if (e.code === 'KeyR') handleReset();
      if (playerMode === 'ROCKET' && e.code === 'KeyT') setAutopilot((p) => !p);
      if (playerMode === 'ROCKET') {
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setThrottle((p) => Math.min(1.0, p + 0.15));
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') setThrottle((p) => Math.max(0.1, p - 0.15));
        if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && autopilot) {
          setAutopilot(false);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isFlying, isLanded, playerMode, autopilot, hudState, destination]);

  // Rocket Flight & Autopilot Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (isFlying && !isLanded) {
        const keys = keysRef.current;
        const pos = posRef.current;
        const vel = velRef.current;
        const isMoon = destination === 'MOON';
        const targetPad = isMoon ? MOON_LANDING_SITE : EARTH_LANDING_SITE;
        const approachPoint = isMoon ? MOON_APPROACH_POINT : EARTH_APPROACH_POINT;
        const altAbovePad = isMoon ? pos.y - MOON_LANDING_SITE.y : pos.y - EARTH_LANDING_SITE.y;
        const hDistToPad = Math.hypot(pos.x - targetPad.x, pos.z - targetPad.z);

        const landRocket = (pad: THREE.Vector3, nextDest: 'MOON' | 'EARTH') => {
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
          if (altAbovePad <= 0.5 && hDistToPad <= 8.0) {
            landRocket(targetPad, isMoon ? 'EARTH' : 'MOON');
          } else if (hDistToPad < 65 && altAbovePad < 220) {
            quatRef.current.slerp(new THREE.Quaternion(), delta * 4.5);
            pos.x = THREE.MathUtils.lerp(pos.x, targetPad.x, delta * 3.0);
            pos.z = THREE.MathUtils.lerp(pos.z, targetPad.z, delta * 3.0);
            const descentSpeed = Math.max(1.6, Math.min(30, altAbovePad * 0.38));
            pos.y -= descentSpeed * delta;
            vel.set(0, -descentSpeed, 0);
          } else {
            const toWaypoint = new THREE.Vector3().subVectors(approachPoint, pos);
            const dist = toWaypoint.length();
            const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toWaypoint.clone().normalize());
            quatRef.current.slerp(targetQuat, delta * 3.5);

            const fwd = new THREE.Vector3(0, 1, 0).applyQuaternion(quatRef.current);
            const speed = dist > 2500 ? 1400 : Math.max(65, dist * 0.55);
            vel.lerp(fwd.multiplyScalar(speed), delta * 2.8);
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

          if (pos.y < 2500 && Math.hypot(pos.x, pos.z) < 3000) {
            vel.y -= 9.8 * (1 - pos.y / 2500) * delta;
          }
          pos.addScaledVector(vel, delta);

          if (destination === 'EARTH' && pos.y < 0.2 && Math.hypot(pos.x, pos.z) < 150) pos.y = 0.2;

          if (isMoon) {
            if (pos.distanceTo(MOON_LANDING_SITE) < 24 || (pos.distanceTo(MOON_POSITION) <= MOON_RADIUS + 2 && pos.y > 10000)) {
              landRocket(MOON_LANDING_SITE, 'EARTH');
            }
          } else if (pos.y <= 0.6 && Math.hypot(pos.x - EARTH_LANDING_SITE.x, pos.z - EARTH_LANDING_SITE.z) < 25) {
            landRocket(EARTH_LANDING_SITE, 'MOON');
          }
        }

        rcsActiveRef.current = { pitch: rcsPitch, yaw: rcsYaw };

        const moonDist = Math.max(0, Math.round(pos.distanceTo(MOON_POSITION) - MOON_RADIUS));
        const earthDist = Math.round(pos.distanceTo(EARTH_LANDING_SITE));
        const targetDist = isMoon ? moonDist : earthDist;

        setStats({
          altitude: Math.round(pos.y),
          speed: !isFlying && isLanded ? 0 : Math.round(vel.length() * 3.6),
          targetDist,
          destination,
          stage: getMissionStage(isMoon, pos.y, moonDist, targetDist, isFlying, isLanded),
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isFlying, isLanded, autopilot, throttle, playerMode, destination]);

  const handleDpadPress = (code: string) => {
    keysRef.current[code] = true;
    if (autopilot) setAutopilot(false);
  };
  const handleDpadRelease = (code: string) => { keysRef.current[code] = false; };

  const isInSpace = stats.altitude > 3500;

  const DpadBtn = ({ code, icon }: { code: string; icon: string }) => (
    <button
      onMouseDown={() => handleDpadPress(code)}
      onMouseUp={() => handleDpadRelease(code)}
      onTouchStart={() => handleDpadPress(code)}
      onTouchEnd={() => handleDpadRelease(code)}
      className="w-10 h-9 bg-slate-800/90 active:bg-cyan-600 hover:bg-slate-700 text-white font-bold rounded-lg border border-white/20 text-xs shadow cursor-pointer flex items-center justify-center transition-all"
    >
      {icon}
    </button>
  );

  return (
    <div className={`relative w-full h-full overflow-hidden select-none font-sans transition-colors duration-1000 ${isInSpace ? 'bg-[#000003]' : 'bg-[#87ceeb]'}`}>
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
              {playerMode === 'ASTRONAUT' ? '🧑‍🚀 ASTRONAUT EVA ON MOON' :
               playerMode === 'ROVER' ? '🏎️ DRIVING LUNAR ROVER' :
               autopilot ? '🤖 AUTOPILOT ACTIVE' : '🚀 ROCKET FLIGHT'}
            </span>
          </div>
          <p className="text-xs text-amber-300 font-medium tracking-wide">Commander ZEESU's Flagship</p>
        </div>
        <div className="h-8 w-[1px] bg-white/20" />
        <div className="text-xs font-mono">
          <div className="text-gray-400 text-[10px]">MISSION STATUS:</div>
          <div className={`font-bold ${isLanded ? 'text-emerald-400' : isFlying ? 'text-cyan-300' : 'text-gray-300'}`}>
            {stats.stage}
          </div>
        </div>
      </div>

      {/* Telemetry HUD */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
        <div className="bg-black/80 backdrop-blur-md px-5 py-3 rounded-xl border border-cyan-500/40 text-white font-mono flex items-center gap-6 shadow-2xl">
          {playerMode === 'ROVER' ? (
            <>
              <div><div className="text-[10px] text-gray-400 uppercase">Rover Speed</div><div className="text-lg font-bold text-amber-300">{hudState.roverSpeed} km/h</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">Battery Pack</div><div className="text-lg font-bold text-emerald-300">98% (4x4 AWD)</div></div>
            </>
          ) : playerMode === 'ASTRONAUT' ? (
            <>
              <div><div className="text-[10px] text-gray-400 uppercase">Suit Oxygen</div><div className="text-lg font-bold text-cyan-300">100% NOMINAL</div></div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div><div className="text-[10px] text-gray-400 uppercase">Lunar Gravity</div><div className="text-lg font-bold text-purple-300">0.166 G (1.62 m/s²)</div></div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Altitude</div>
                <div className="text-lg font-bold text-cyan-300">
                  {stats.altitude >= 10000 ? `${(stats.altitude / 1000).toFixed(1)} km` : `${stats.altitude.toLocaleString()} m`}
                </div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase">Velocity</div>
                <div className="text-lg font-bold text-amber-300">{stats.speed.toLocaleString()} km/h</div>
              </div>
              <div className="h-8 w-[1px] bg-white/20" />
              <div>
                <div className="text-[10px] text-gray-400 uppercase">{destination === 'MOON' ? 'Distance to Moon' : 'Distance to Earth'}</div>
                <div className={`text-lg font-bold ${isLanded ? 'text-emerald-400' : 'text-purple-300'}`}>
                  {isLanded ? '0 m (TOUCHDOWN)' : `${stats.targetDist.toLocaleString()} m`}
                </div>
              </div>
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

      {/* Touchdown & Boarding Prompts */}
      {isLanded && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {playerMode === 'ROCKET' ? (
            destination === 'EARTH' ? (
              <div className="bg-slate-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-emerald-400 text-center shadow-[0_0_35px_rgba(16,185,129,0.7)] flex flex-col items-center gap-2.5">
                <div className="text-emerald-400 font-extrabold text-sm tracking-wider uppercase flex items-center gap-2">
                  <span>🌕</span><span>ROCKET BOARDED ON MOON — TARGET: EARTH</span>
                </div>
                <div className="text-xs text-emerald-200 font-mono">Launch off Moon surface to begin return voyage back to Earth!</div>
                <div className="flex items-center gap-3 mt-1">
                  <button onClick={handleLaunch} className="px-6 py-3 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 animate-bounce cursor-pointer flex items-center gap-2">
                    <span>🚀</span><span>LAUNCH TO EARTH [Press F]</span>
                  </button>
                  <button onClick={handleInteraction} className="px-5 py-3 bg-cyan-700/80 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl border border-cyan-400 shadow-md cursor-pointer">
                    🧑‍🚀 STEP OUT ONTO MOON [Press E]
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border-2 border-cyan-400 text-center shadow-[0_0_35px_rgba(6,182,212,0.7)] flex flex-col items-center gap-2.5">
                <div className="text-cyan-400 font-extrabold text-sm tracking-wider uppercase flex items-center gap-2">
                  <span>🌍</span><span>SAFE TOUCHDOWN ON EARTH COSMODROME!</span>
                </div>
                <div className="text-xs text-gray-300 font-mono">Mission to the Moon and return to Earth complete. Ready to relaunch!</div>
                <button onClick={handleLaunch} className="px-6 py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 cursor-pointer flex items-center gap-2">
                  <span>🚀</span><span>RELAUNCH TO MOON [Press F]</span>
                </button>
              </div>
            )
          ) : playerMode === 'ASTRONAUT' && hudState.canEnterRover ? (
            <button onClick={handleInteraction} className="bg-amber-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-amber-400 text-amber-300 font-bold font-mono text-sm shadow-[0_0_35px_rgba(245,158,11,0.7)] animate-bounce cursor-pointer flex items-center gap-2">
              <span>🏎️</span><span>PRESS [ E ] TO DRIVE LUNAR ROVER</span>
            </button>
          ) : playerMode === 'ASTRONAUT' && hudState.canEnterRocket ? (
            <button onClick={handleInteraction} className="bg-cyan-950/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-cyan-400 text-cyan-300 font-bold font-mono text-sm shadow-[0_0_35px_rgba(6,182,212,0.7)] animate-bounce cursor-pointer flex items-center gap-2">
              <span>🚀</span><span>PRESS [ E ] TO BOARD SPACESHIP ROCKET</span>
            </button>
          ) : null}
        </div>
      )}

      {/* D-Pad & Controls Guide */}
      <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2.5">
        {((isFlying && !isLanded) || (isLanded && playerMode !== 'ROCKET')) && (
          <div className="bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-1.5 select-none">
            <div className="text-[10px] font-mono text-cyan-300 font-bold uppercase tracking-wider mb-0.5">
              {playerMode === 'ASTRONAUT' ? 'Moonwalk' : playerMode === 'ROVER' ? 'Rover' : 'Rocket'}
            </div>
            <DpadBtn code="KeyW" icon="▲" />
            <div className="flex items-center gap-1.5">
              <DpadBtn code="KeyA" icon="◀" />
              <DpadBtn code="KeyS" icon="▼" />
              <DpadBtn code="KeyD" icon="▶" />
            </div>
          </div>
        )}

        <div className="bg-black/75 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs text-gray-200 flex flex-col gap-1 shadow-xl">
          <div className="font-semibold text-cyan-300">
            {playerMode === 'ASTRONAUT' ? 'Astronaut EVA Controls:' : playerMode === 'ROVER' ? 'Rover Controls:' : 'Flight Controls:'}
          </div>
          {playerMode === 'ASTRONAUT' ? (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W / A / S / D ]</strong>: Walk & Turn on Moon</div>
              <div>• <strong>[ Space ]</strong>: Low-Gravity Lunar Hop Jump</div>
              <div>• <strong>[ E ]</strong>: Enter Rover or Board Rocket</div>
              <div>• <strong>[ Drag ]</strong>: 360° Mouse Look</div>
            </div>
          ) : playerMode === 'ROVER' ? (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W / S ]</strong>: Drive / Brake</div>
              <div>• <strong>[ A / D ]</strong>: Steer Left / Right</div>
              <div>• <strong>[ E ]</strong>: Exit Rover</div>
              <div>• <strong>[ Drag ]</strong>: 360° Mouse Look</div>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-gray-300 flex flex-col gap-0.5">
              <div>• <strong>[ W / A / S / D ]</strong>: Pitch & Steer Rocket</div>
              <div>• <strong>[ T ]</strong>: Auto-Pilot (Fly & Land on {destination === 'MOON' ? 'Moon' : 'Earth'})</div>
              <div>• <strong>[ F ]</strong>: Launch Rocket ({destination === 'MOON' ? 'To Moon' : 'To Earth'})</div>
              <div>• <strong>[ Drag / Wheel ]</strong>: 360° Orbit & Zoom</div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3">
        {playerMode === 'ROVER' && (
          <button onClick={handleInteraction} className="px-5 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold font-mono text-xs tracking-wider rounded-xl border border-amber-300 shadow-xl cursor-pointer">
            🚪 EXIT ROVER [Press E]
          </button>
        )}

        {playerMode === 'ROCKET' && isFlying && !isLanded && (
          <button
            onClick={() => setAutopilot((p) => !p)}
            className={`px-5 py-3.5 text-xs font-bold font-mono tracking-wider rounded-xl border transition-all cursor-pointer shadow-2xl flex items-center gap-2 transform active:scale-95 ${
              autopilot ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.8)] animate-pulse' :
              stats.targetDist < 2500 ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 border-amber-300 text-white shadow-[0_0_25px_rgba(245,158,11,0.7)] animate-bounce' :
              'bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 border-purple-300/40 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
            }`}
          >
            <span>{autopilot ? '🤖' : stats.targetDist < 2500 ? (destination === 'MOON' ? '🌕' : '🌍') : '🎯'}</span>
            <span>
              {autopilot
                ? stats.targetDist < 300 ? `SOFT TOUCHDOWN IN PROGRESS ON ${destination}...` : `🤖 AUTOPILOT ON: RETURNING TO ${destination} [Press T]`
                : stats.targetDist < 2500 ? `INITIATE SOFT ${destination} LANDING [Press T]` : `ACTIVATE AUTOPILOT TO ${destination} [Press T]`}
            </span>
          </button>
        )}

        {!isFlying ? (
          <button onClick={handleLaunch} className="px-6 py-3.5 bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm tracking-wider rounded-xl shadow-[0_0_25px_rgba(255,0,85,0.6)] border border-red-300/40 transform hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2">
            <span>🚀</span><span>{destination === 'EARTH' ? 'LAUNCH TO EARTH [Press F]' : 'LAUNCH TO MOON [Press F]'}</span>
          </button>
        ) : (
          <button onClick={handleReset} className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-xs tracking-wider rounded-xl border border-white/20 shadow-lg cursor-pointer transition-all flex items-center gap-2">
            <span>🔄</span><span>RESET TO EARTH [Press R]</span>
          </button>
        )}
      </div>

      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 16, 62], fov: 45, near: 0.5, far: 75000 }}
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
          astronautPos={astronautPosRef.current}
          roverPos={roverPosRef.current}
          resetCount={resetCount}
        />

        <Suspense fallback={<Loader />}>
          <RealisticLandscape altitude={stats.altitude} />
          <BuranLaunchpad />
          <SpaceEnvironment altitude={stats.altitude} rocketPos={posRef.current} />
          <LunarLandingSiteMarker />
          <ActiveRocketMesh
            isFlying={isFlying}
            isLanded={isLanded}
            throttle={throttle}
            rocketPos={posRef.current}
            rocketQuat={quatRef.current}
            rcsActive={rcsActiveRef.current}
          />
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
