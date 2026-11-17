import React, { useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Compass,
  Crosshair,
  Eye,
  Flame,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Shield,
  Sparkles,
  Sword,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { DamagePopup, EngineActions, GameHudSnapshot } from '../game/types';
import { SKILLS, getWorldById } from '../game/data';

interface HudOverlayProps {
  hud: GameHudSnapshot;
  popups: DamagePopup[];
  actions: EngineActions;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSkills: () => void;
  onOpenWorlds: () => void;
}

const COMPASS_LABELS: Array<{ deg: number; label: string }> = [
  { deg: 0, label: 'N' },
  { deg: 45, label: 'NE' },
  { deg: 90, label: 'E' },
  { deg: 135, label: 'SE' },
  { deg: 180, label: 'S' },
  { deg: 225, label: 'SO' },
  { deg: 270, label: 'O' },
  { deg: 315, label: 'NO' },
];

export function HudOverlay({
  hud,
  popups,
  actions,
  muted,
  onToggleMute,
  onOpenSkills,
  onOpenWorlds,
}: HudOverlayProps) {
  const world = getWorldById(hud.worldId);
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const manaPct = Math.max(0, Math.min(100, (hud.mana / hud.maxMana) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / hud.xpToNext) * 100));

  const dpadRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const updateDpadFromPointer = (clientX: number, clientY: number) => {
    const el = dpadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    setKnobOffset({ x: dx, y: dy });
    actions.setMoveVector(dx / maxR, dy / maxR);
  };

  const handleDpadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    updateDpadFromPointer(e.clientX, e.clientY);
  };

  const handleDpadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateDpadFromPointer(e.clientX, e.clientY);
  };

  const handleDpadUp = () => {
    draggingRef.current = false;
    setKnobOffset({ x: 0, y: 0 });
    actions.setMoveVector(0, 0);
  };

  const renderSkillButton = (
    skillId: 'seismic_wave' | 'sacred_crescent' | 'ardent_bastion',
    icon: React.ReactNode,
    keyHint: string,
  ) => {
    const cd = hud.cooldowns[skillId];
    const maxCd = hud.maxCooldowns[skillId];
    const lv = hud.skillLevels[skillId];
    const manaCost =
      skillId === 'seismic_wave' && lv >= 3
        ? Math.max(14, SKILLS[skillId].baseManaCost - 4)
        : SKILLS[skillId].baseManaCost;
    const noMana = hud.mana < manaCost;
    const onCd = cd > 0.05;
    const pct = onCd ? Math.min(100, (cd / maxCd) * 100) : 0;

    return (
      <button
        type="button"
        onClick={() => actions.triggerSkill(skillId)}
        title={`${SKILLS[skillId].name} (Niv. ${lv}) · ${manaCost} Mana`}
        className={`relative w-12 h-12 rounded-full border flex items-center justify-center transition-transform active:scale-95 ${
          onCd || noMana
            ? 'bg-[#0b0f18]/90 border-slate-700/70 text-slate-500'
            : 'bg-[#121826]/92 border-cyan-400/75 text-slate-100 hover:border-amber-400'
        }`}
      >
        {onCd && (
          <div
            className="absolute inset-0 rounded-full bg-black/70 pointer-events-none"
            style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
          />
        )}
        <span className="relative z-10">{icon}</span>
        {onCd ? (
          <span className="absolute inset-0 z-20 flex items-center justify-center text-xs font-mono-num font-semibold text-amber-300">
            {cd.toFixed(1)}
          </span>
        ) : (
          <span className="absolute -bottom-1 right-0 z-20 px-1 rounded bg-[#090c14] border border-slate-600/60 text-[10px] font-mono-num text-slate-300">
            {keyHint}
          </span>
        )}
        <span className="absolute -top-1 left-0 z-20 px-1 rounded bg-[#090c14] border border-slate-600/60 text-[10px] font-mono-num text-cyan-300">
          N{lv}
        </span>
      </button>
    );
  };

  const headingInt = Math.round(hud.headingDeg);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {/* Subtle High-Speed Edge Streaks during Slide / Zipline / Glide */}
      {hud.speedIntensity > 0.2 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: hud.speedIntensity * 0.55,
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(34, 211, 238, 0.16) 82%, rgba(15, 23, 42, 0.52) 100%)',
          }}
        />
      )}

      {/* Golden Runic Sniper Scope Overlay when Holding Right-Click / Aim */}
      {hud.isAiming && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, transparent 155px, rgba(4, 7, 14, 0.78) 172px)',
            }}
          />
          <div className="relative w-76 h-76 rounded-full border-[5px] border-amber-400/90 shadow-[0_0_28px_rgba(245,158,11,0.45)] flex items-center justify-center">
            <div className="w-68 h-68 rounded-full border border-cyan-300/60 flex items-center justify-center">
              <div className="absolute inset-x-0 h-[1px] bg-cyan-300/50" />
              <div className="absolute inset-y-0 w-[1px] bg-cyan-300/50" />
              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            </div>
            <span className="absolute -bottom-7 px-2.5 py-0.5 rounded bg-[#0a0f18]/90 border border-amber-400/50 text-[11px] font-mono-num text-amber-300">
              VISÉE RUNIQUE · CLIC G TIR PRÉCIS
            </span>
          </div>
        </div>
      )}

      {/* Center Tactical Crosshair (when not aiming) */}
      {!hud.isAiming && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-5 h-5 flex items-center justify-center opacity-85">
            <span className="absolute top-0 w-[1.5px] h-1.5 bg-cyan-300" />
            <span className="absolute bottom-0 w-[1.5px] h-1.5 bg-cyan-300" />
            <span className="absolute left-0 h-[1.5px] w-1.5 bg-cyan-300" />
            <span className="absolute right-0 h-[1.5px] w-1.5 bg-cyan-300" />
            <span className="w-1 h-1 rounded-full bg-white" />
          </div>
        </div>
      )}

      {/* Projected 3D Damage Popups */}
      {popups.map((p) => {
        const toneClass =
          p.tone === 'headshot'
            ? 'text-rose-400 text-xl font-extrabold tracking-wider'
            : p.tone === 'crit'
              ? 'text-amber-300 text-lg font-bold'
              : p.tone === 'parry'
                ? 'text-yellow-300 text-base font-bold tracking-wide'
                : p.tone === 'skill'
                  ? 'text-cyan-300 text-base font-bold'
                  : p.tone === 'heal'
                    ? 'text-emerald-300 text-sm font-semibold'
                    : p.tone === 'playerHit'
                      ? 'text-rose-400 text-base font-bold'
                      : 'text-slate-100 text-sm font-semibold';
        return (
          <div
            key={p.id}
            style={{ left: `${p.screenX}px`, top: `${p.screenY}px` }}
            className={`absolute font-mono-num drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-float-damage ${toneClass}`}
          >
            {p.text}
          </div>
        );
      })}

      {/* TOP-LEFT: Knight Portrait Medallion + HP / Mana / Stamina Bars */}
      <div className="absolute top-3 left-3 flex items-start gap-2.5 pointer-events-auto">
        <div className="relative w-14 h-14 shrink-0 rounded-full bg-gradient-to-b from-slate-700 to-slate-900 border-2 border-cyan-400/80 shadow-[0_6px_18px_rgba(0,0,0,0.65)] flex items-center justify-center">
          <svg viewBox="0 0 64 64" className="w-10 h-10" aria-hidden="true">
            <path
              d="M32 8 C19 8 14 19 14 31 L16 50 L32 56 L48 50 L50 31 C50 19 45 8 32 8 Z"
              fill="#64748b"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <path d="M32 8 L32 56" stroke="#334155" strokeWidth="2.2" />
            <path d="M18 27 L30 29 L30 33 L18 31 Z" fill="#22d3ee" />
            <path d="M46 27 L34 29 L34 33 L46 31 Z" fill="#22d3ee" />
          </svg>
          <span className="absolute -bottom-1.5 px-1.5 py-0.5 rounded bg-[#0c101a] border border-amber-500/70 text-[10px] font-mono-num font-semibold text-amber-300">
            Niv.{hud.level}
          </span>
        </div>

        <div className="w-52 sm:w-60 pt-0.5 space-y-1">
          <div className="relative h-4 bg-[#0a0d14]/92 border border-slate-500/60 rounded-sm overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-700 via-rose-600 to-rose-400 transition-[width] duration-150"
              style={{ width: `${hpPct}%` }}
            />
            <div className="absolute inset-0 px-2 flex items-center justify-between text-[11px] font-mono-num font-semibold text-white">
              <span>PV</span>
              <span>
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
          </div>

          <div className="relative h-3 bg-[#0a0d14]/92 border border-slate-500/60 rounded-sm overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-700 via-sky-500 to-cyan-300 transition-[width] duration-150"
              style={{ width: `${manaPct}%` }}
            />
            <div className="absolute inset-0 px-2 flex items-center justify-between text-[10px] font-mono-num text-sky-50">
              <span>Mana</span>
              <span>
                {hud.mana}/{hud.maxMana}
              </span>
            </div>
          </div>

          <div className="relative h-2 w-4/5 bg-[#0a0d14]/92 border border-slate-600/50 rounded-sm overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-slate-400 to-amber-300 transition-[width] duration-100"
              style={{ width: `${stamPct}%` }}
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white drop-shadow font-mono-num">
            <span>XP {Math.round(xpPct)}%</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{hud.kills} élim.</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{hud.cameraMode === 'first' ? '1re Pers.' : '3e Pers.'}</span>
          </div>
        </div>
      </div>

      {/* TOP-CENTER: Bloodstrike-style Degree Compass Strip + World/Boss Bar */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-[min(480px,54vw)]">
        {/* Compass Strip */}
        <div className="relative w-full max-w-sm h-7 bg-[#090d16]/82 border border-slate-500/50 rounded overflow-hidden flex items-center justify-center">
          <div className="flex items-center gap-4 text-[11px] font-mono-num text-slate-300">
            {COMPASS_LABELS.map((c) => {
              let diff = c.deg - headingInt;
              while (diff > 180) diff -= 360;
              while (diff < -180) diff += 360;
              if (Math.abs(diff) > 85) return null;
              return (
                <span
                  key={c.deg}
                  style={{ transform: `translateX(${diff * 1.4}px)` }}
                  className={`absolute font-bold ${
                    c.label === 'N' ? 'text-amber-300' : 'text-slate-200'
                  }`}
                >
                  {c.label}
                </span>
              );
            })}
          </div>
          <div className="relative z-10 px-2 py-0.5 rounded bg-[#0c1220] border border-cyan-400/60 text-[11px] font-mono-num font-bold text-cyan-200">
            {headingInt}°
          </div>
        </div>

        {/* World & Wave Info */}
        <div className="px-3 py-1 bg-[#090d16]/84 border border-slate-600/55 rounded flex items-center gap-2 text-xs text-slate-100 whitespace-nowrap">
          <span className="font-display font-semibold text-amber-200">
            {hud.worldName}
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="font-mono-num">
            Vague {hud.waveIndex + 1}/{hud.totalWaves}
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="font-mono-num text-cyan-200">
            {hud.enemiesRemaining} {hud.enemiesRemaining > 1 ? 'ennemis' : 'ennemi'}
          </span>
        </div>

        {/* Kinetic HEADSHOT / KILL CONFIRMED Callout */}
        {hud.killBanner && (
          <div
            className={`px-5 py-1.5 rounded border text-center shadow-lg ${
              hud.killBanner.tone === 'headshot'
                ? 'bg-rose-950/90 border-rose-400 text-rose-100'
                : 'bg-[#0b1120]/90 border-cyan-400/80 text-cyan-100'
            }`}
          >
            <div className="font-display text-sm font-extrabold tracking-widest">
              {hud.killBanner.title}
            </div>
            <div className="text-[11px] font-mono-num text-slate-200">
              {hud.killBanner.subtitle}
            </div>
          </div>
        )}

        {/* Boss Bar */}
        {hud.activeBoss && (
          <div className="w-full bg-[#0a0d15]/92 border border-amber-500/55 rounded px-3.5 py-2 shadow-lg">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <div className="truncate">
                <span className="font-display text-sm font-bold text-amber-200">
                  {hud.activeBoss.name}
                </span>
                <span className="text-xs text-slate-300 ml-2">
                  {hud.activeBoss.title}
                </span>
              </div>
              <span className="text-xs font-mono-num text-slate-200 shrink-0">
                {hud.activeBoss.hp} / {hud.activeBoss.maxHp}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-900 border border-slate-700/70 rounded-xs overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ${
                  hud.activeBoss.enraged
                    ? 'bg-gradient-to-r from-red-700 via-orange-500 to-amber-400'
                    : 'bg-gradient-to-r from-rose-800 via-red-600 to-amber-500'
                }`}
                style={{
                  width: `${Math.max(0, (hud.activeBoss.hp / hud.activeBoss.maxHp) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TOP-RIGHT: Utility Buttons + Square Tactical Minimap (matching Bloodstrike clip) */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSkills}
            className={`px-2.5 py-1.5 rounded border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              hud.skillPoints > 0
                ? 'bg-amber-950/92 border-amber-400 text-amber-200 hover:bg-amber-900/90'
                : 'bg-[#0e131e]/92 border-slate-600/60 text-slate-200 hover:border-slate-400'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Facultés</span>
            {hud.skillPoints > 0 && (
              <span className="font-mono-num text-amber-300 font-bold">
                (+{hud.skillPoints})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenWorlds}
            className="px-2.5 py-1.5 rounded bg-[#0e131e]/92 border border-slate-600/60 text-xs font-medium text-slate-200 hover:border-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Mondes</span>
          </button>

          <button
            type="button"
            onClick={() => actions.toggleCameraMode()}
            title="Changer de caméra (V)"
            className="p-1.5 rounded bg-[#0e131e]/92 border border-slate-600/60 text-cyan-300 hover:border-cyan-400"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="p-1.5 rounded bg-[#0e131e]/92 border border-slate-600/60 text-slate-200 hover:border-slate-400"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => actions.setPaused(hud.phase !== 'paused')}
            aria-label={hud.phase === 'paused' ? 'Reprendre' : 'Pause'}
            className="p-1.5 rounded bg-[#0e131e]/92 border border-slate-600/60 text-slate-200 hover:border-slate-400"
          >
            {hud.phase === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>

        {/* Square Tactical Radar Minimap */}
        <div className="relative w-28 h-28 rounded bg-[#0a0f18]/90 border-2 border-slate-400/70 shadow-[0_6px_20px_rgba(0,0,0,0.75)] overflow-hidden">
          <svg viewBox="-38 -38 76 76" className="w-full h-full">
            <circle
              cx="0"
              cy="0"
              r={world.arenaRadius}
              fill="rgba(30, 41, 59, 0.3)"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="0.9"
            />
            {hud.minimapBlips.map((b) => {
              if (b.kind === 'zipline') {
                return (
                  <rect
                    key={b.id}
                    x={b.x - 1.5}
                    y={b.z - 1.5}
                    width="3"
                    height="3"
                    fill="#f59e0b"
                  />
                );
              }
              if (b.kind === 'orb') {
                return <circle key={b.id} cx={b.x} cy={b.z} r="1.4" fill="#22d3ee" />;
              }
              if (b.kind === 'boss') {
                return (
                  <circle
                    key={b.id}
                    cx={b.x}
                    cy={b.z}
                    r="3.2"
                    fill="#f59e0b"
                    stroke="#fff"
                    strokeWidth="0.8"
                  />
                );
              }
              return <circle key={b.id} cx={b.x} cy={b.z} r="2.0" fill="#ef4444" />;
            })}

            <g
              transform={`translate(${hud.playerPos.x}, ${hud.playerPos.z}) rotate(${(-hud.playerPos.yaw * 180) / Math.PI})`}
            >
              <polygon points="0,0 -10,-18 10,-18" fill="rgba(56, 189, 248, 0.25)" />
              <polygon
                points="0,-3.4 2.4,2.4 0,1.2 -2.4,2.4"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="0.6"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Wave / Boss Banner */}
      {hud.bannerText && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 text-center pointer-events-none px-6 py-2 bg-[#090c14]/90 border border-amber-400/50 rounded">
          <div className="font-display text-lg font-bold text-amber-200 tracking-wide">
            {hud.bannerText}
          </div>
          {hud.bannerSubtext && (
            <div className="text-xs text-slate-300 mt-0.5">{hud.bannerSubtext}</div>
          )}
        </div>
      )}

      {/* Contextual Zipline / Glider Prompt */}
      {(hud.nearZipline || hud.isZiplining || hud.isGliding) && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={() => actions.triggerZipline()}
            className="px-4 py-1.5 rounded bg-[#0c121e]/92 border border-amber-400/80 text-xs font-mono-num font-semibold text-amber-200 shadow-lg"
          >
            {hud.isZiplining
              ? '[F / Espace] Sauter & Planer'
              : hud.isGliding
                ? '[Espace] Fermer le Planeur · [Clic G] Plonger'
                : '[F] Tyrolienne Verticale'}
          </button>
        </div>
      )}

      {/* Parade Parfaite Toast */}
      {hud.parryFlash && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded bg-amber-950/92 border border-amber-400 text-xs font-display font-bold text-amber-200 tracking-wider">
          PARADE PARFAITE
        </div>
      )}

      {/* BOTTOM-LEFT: Virtual D-Pad & Look Turn */}
      <div className="absolute bottom-4 left-4 flex items-end gap-3 pointer-events-auto">
        <div
          ref={dpadRef}
          onPointerDown={handleDpadDown}
          onPointerMove={handleDpadMove}
          onPointerUp={handleDpadUp}
          onPointerCancel={handleDpadUp}
          className="relative w-26 h-26 rounded-full bg-[#0a0f19]/85 border-2 border-slate-400/65 shadow-lg touch-none flex items-center justify-center cursor-grab active:cursor-grabbing"
          aria-label="Croix directionnelle de déplacement"
        >
          <span className="absolute top-1.5 text-[10px] text-slate-300">▲</span>
          <span className="absolute bottom-1.5 text-[10px] text-slate-300">▼</span>
          <span className="absolute left-2 text-[10px] text-slate-300">◀</span>
          <span className="absolute right-2 text-[10px] text-slate-300">▶</span>

          <div
            className="w-10 h-10 rounded-full bg-slate-700/90 border border-cyan-300/70 shadow-inner"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>

        <div className="hidden sm:flex flex-col gap-1.5 pb-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => actions.lookDelta(0.45, 0)}
              title="Pivoter à gauche"
              className="p-2 rounded-full bg-[#0c101a]/88 border border-slate-600/60 text-slate-200 hover:border-cyan-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => actions.lookDelta(-0.45, 0)}
              title="Pivoter à droite"
              className="p-2 rounded-full bg-[#0c101a]/88 border border-slate-600/60 text-slate-200 hover:border-cyan-400"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[11px] text-slate-200 drop-shadow font-mono-num">
            WASD/ZQSD · Espace Saut · Shift Glissade · F Tyrolienne · V Caméra
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT: Action Cluster (Facultés + Jump/Slide/Aim + Primary Attack) */}
      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* 3 Active Faculté Buttons */}
        <div className="flex items-center gap-2">
          {renderSkillButton('seismic_wave', <Zap className="w-5 h-5 text-amber-400" />, '1/E')}
          {renderSkillButton('sacred_crescent', <Sparkles className="w-5 h-5 text-cyan-400" />, '2/R')}
          {renderSkillButton('ardent_bastion', <Flame className="w-5 h-5 text-rose-400" />, '3/T')}
        </div>

        {/* Parkour & Combat Cluster */}
        <div className="flex items-end gap-2.5">
          {/* Slide */}
          <button
            type="button"
            onClick={() => actions.triggerSlide()}
            title="Glissade rapide (Shift / C)"
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${
              hud.isSliding
                ? 'bg-cyan-900/90 border-cyan-300 text-white'
                : 'bg-[#121826]/92 border-slate-400/75 text-slate-100 hover:border-cyan-400'
            }`}
          >
            <Wind className="w-5 h-5" />
          </button>

          {/* Jump / Glide */}
          <button
            type="button"
            onClick={() => actions.triggerJump()}
            title="Saut / Planeur (Espace)"
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${
              hud.isGliding
                ? 'bg-amber-900/90 border-amber-300 text-white'
                : 'bg-[#121826]/92 border-slate-400/75 text-slate-100 hover:border-amber-400'
            }`}
          >
            <ArrowUp className="w-5 h-5" />
          </button>

          {/* Runic Aim + Shield Block */}
          <button
            type="button"
            onPointerDown={() => actions.setAiming(true)}
            onPointerUp={() => actions.setAiming(false)}
            onPointerLeave={() => actions.setAiming(false)}
            title="Visée Runique & Bouclier (Maintenir Clic Droit / L)"
            className={`w-15 h-15 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${
              hud.isAiming
                ? 'bg-amber-900/90 border-amber-300 text-white'
                : 'bg-[#121826]/92 border-slate-400/80 text-slate-100 hover:border-cyan-300'
            }`}
          >
            {hud.isAiming ? <Crosshair className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
          </button>

          {/* Primary Attack / Precision Shot */}
          <button
            type="button"
            onClick={() => actions.triggerAttack()}
            title="Attaque Épée / Tir Précis (Clic Gauche)"
            className="w-18 h-18 rounded-full bg-gradient-to-b from-cyan-700/95 to-slate-900/95 border-2 border-cyan-300/90 text-white shadow-[0_6px_22px_rgba(0,0,0,0.8)] flex items-center justify-center transition-transform hover:border-amber-300 active:scale-92"
          >
            <Sword className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
