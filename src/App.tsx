import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HudOverlay } from './components/HudOverlay';
import { SkillsModal } from './components/SkillsModal';
import { WorldsModal } from './components/WorldsModal';
import { TitleScreen } from './components/TitleScreen';
import { EndScreen } from './components/EndScreen';
import { INITIAL_SKILL_LEVELS, WORLDS } from './game/data';
import { soundEngine } from './game/audio';
import { DamagePopup, EngineActions, GameHudSnapshot } from './game/types';

const INITIAL_HUD: GameHudSnapshot = {
  hp: 180,
  maxHp: 180,
  mana: 100,
  maxMana: 100,
  stamina: 100,
  maxStamina: 100,
  level: 1,
  xp: 0,
  xpToNext: 100,
  skillPoints: 1,
  skillLevels: { ...INITIAL_SKILL_LEVELS },
  kills: 0,
  comboStep: 0,
  isBlocking: false,
  isAiming: false,
  isSliding: false,
  isGliding: false,
  isZiplining: false,
  nearZipline: false,
  cameraMode: 'first',
  headingDeg: 0,
  speedIntensity: 0,
  parryFlash: false,
  bastionActiveTimer: 0,
  cooldowns: {
    seismic_wave: 0,
    sacred_crescent: 0,
    ardent_bastion: 0,
    dodge: 0,
  },
  maxCooldowns: {
    seismic_wave: 5.0,
    sacred_crescent: 4.0,
    ardent_bastion: 11,
    dodge: 0.65,
  },
  worldId: WORLDS[0].id,
  worldName: WORLDS[0].name,
  waveIndex: 0,
  totalWaves: WORLDS[0].waves.length,
  enemiesRemaining: 5,
  activeBoss: null,
  playerPos: { x: 0, y: 0, z: 14, yaw: 0 },
  minimapBlips: [],
  bannerText: null,
  bannerSubtext: null,
  killBanner: null,
  phase: 'paused',
  unlockedWorlds: ['moonlit_courtyard'],
  defeatedBosses: [],
};

export default function App() {
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<GameHudSnapshot>(INITIAL_HUD);
  const [popups, setPopups] = useState<DamagePopup[]>([]);
  const [showSkills, setShowSkills] = useState(false);
  const [showWorlds, setShowWorlds] = useState(false);
  const [muted, setMuted] = useState(false);

  const actionsRef = useRef<EngineActions | null>(null);

  const handleEngineReady = useCallback((actions: EngineActions) => {
    actionsRef.current = actions;
    actions.setPaused(true);
  }, []);

  const handleHudUpdate = useCallback((snap: GameHudSnapshot) => {
    setHud(snap);
  }, []);

  const handleDamagePopup = useCallback((popup: DamagePopup) => {
    setPopups((prev) => [...prev.slice(-14), popup]);
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== popup.id));
    }, 850);
  }, []);

  const handleStart = () => {
    setStarted(true);
    actionsRef.current?.setPaused(false);
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const openSkillsModal = () => {
    setShowWorlds(false);
    setShowSkills(true);
    actionsRef.current?.setPaused(true);
  };

  const closeSkillsModal = () => {
    setShowSkills(false);
    if (started && hud.phase === 'paused') {
      actionsRef.current?.setPaused(false);
    }
  };

  const openWorldsModal = () => {
    setShowSkills(false);
    setShowWorlds(true);
    actionsRef.current?.setPaused(true);
  };

  const closeWorldsModal = () => {
    setShowWorlds(false);
    if (started && hud.phase === 'paused') {
      actionsRef.current?.setPaused(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === 'Tab') {
        e.preventDefault();
        if (showSkills) {
          closeSkillsModal();
        } else {
          openSkillsModal();
        }
      } else if (e.code === 'Escape') {
        if (showSkills) closeSkillsModal();
        else if (showWorlds) closeWorldsModal();
        else if (hud.phase === 'playing') actionsRef.current?.setPaused(true);
        else if (hud.phase === 'paused') actionsRef.current?.setPaused(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const safeActions: EngineActions = actionsRef.current ?? {
    setMoveVector: () => {},
    triggerAttack: () => {},
    setAiming: () => {},
    triggerJump: () => {},
    triggerSlide: () => {},
    triggerZipline: () => {},
    toggleCameraMode: () => {},
    triggerSkill: () => {},
    upgradeSkill: () => {},
    selectWorld: () => {},
    restartWorld: () => {},
    advanceNextWorld: () => {},
    setPaused: () => {},
    lookDelta: () => {},
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080a0f]">
      <GameCanvas
        onEngineReady={handleEngineReady}
        onHudUpdate={handleHudUpdate}
        onDamagePopup={handleDamagePopup}
      />

      {started && (
        <HudOverlay
          hud={hud}
          popups={popups}
          actions={safeActions}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenSkills={openSkillsModal}
          onOpenWorlds={openWorldsModal}
        />
      )}

      {!started && <TitleScreen onStart={handleStart} />}

      {started && !showSkills && !showWorlds && (
        <EndScreen
          hud={hud}
          onResume={() => actionsRef.current?.setPaused(false)}
          onRestartWorld={() => actionsRef.current?.restartWorld()}
          onNextWorld={() => actionsRef.current?.advanceNextWorld()}
          onOpenSkills={openSkillsModal}
        />
      )}

      {showSkills && (
        <SkillsModal
          skillPoints={hud.skillPoints}
          skillLevels={hud.skillLevels}
          level={hud.level}
          onUpgrade={(id) => actionsRef.current?.upgradeSkill(id)}
          onClose={closeSkillsModal}
        />
      )}

      {showWorlds && (
        <WorldsModal
          currentWorldId={hud.worldId}
          unlockedWorlds={hud.unlockedWorlds}
          defeatedBosses={hud.defeatedBosses}
          onSelectWorld={(id) => actionsRef.current?.selectWorld(id)}
          onClose={closeWorldsModal}
        />
      )}
    </main>
  );
}
