import { useEffect, useRef } from 'react';
import { KnightCombatEngine } from '../game/engine';
import { DamagePopup, EngineActions, GameHudSnapshot } from '../game/types';

interface GameCanvasProps {
  onEngineReady: (actions: EngineActions) => void;
  onHudUpdate: (snap: GameHudSnapshot) => void;
  onDamagePopup: (popup: DamagePopup) => void;
}

export function GameCanvas({
  onEngineReady,
  onHudUpdate,
  onDamagePopup,
}: GameCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onEngineReady, onHudUpdate, onDamagePopup });
  callbacksRef.current = { onEngineReady, onHudUpdate, onDamagePopup };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new KnightCombatEngine(
      container,
      (snap) => callbacksRef.current.onHudUpdate(snap),
      (popup) => callbacksRef.current.onDamagePopup(popup),
    );

    callbacksRef.current.onEngineReady(engine.getActions());

    return () => {
      engine.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full bg-[#080a0f]"
      aria-label="Arène de combat 3D"
    />
  );
}
