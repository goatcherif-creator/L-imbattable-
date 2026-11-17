import { Check, Lock, Swords, X } from 'lucide-react';
import { BOSSES, ENEMY_ARCHETYPES, WORLDS } from '../game/data';
import { BossId, WorldId } from '../game/types';

interface WorldsModalProps {
  currentWorldId: WorldId;
  unlockedWorlds: WorldId[];
  defeatedBosses: BossId[];
  onSelectWorld: (worldId: WorldId) => void;
  onClose: () => void;
}

export function WorldsModal({
  currentWorldId,
  unlockedWorlds,
  defeatedBosses,
  onSelectWorld,
  onClose,
}: WorldsModalProps) {
  return (
    <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#0e131d] border border-slate-600/60 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-amber-200">
              Mondes & Boss Uniques
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Vainquez le boss de chaque monde pour débloquer l’étape suivante de la croisade.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 border border-slate-600/60 text-xs font-medium text-slate-200 hover:bg-slate-700 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Fermer</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORLDS.map((w) => {
            const unlocked = unlockedWorlds.includes(w.id);
            const isCurrent = currentWorldId === w.id;
            const boss = BOSSES[w.bossId];
            const bossCleared = defeatedBosses.includes(w.bossId);

            // Unique enemy names in this world
            const enemyNames = Array.from(
              new Set(
                w.waves.flatMap((wave) =>
                  wave.enemies.map((e) => ENEMY_ARCHETYPES[e.archetype].name),
                ),
              ),
            );

            return (
              <div
                key={w.id}
                className={`p-5 rounded border flex flex-col justify-between gap-4 ${
                  isCurrent
                    ? 'bg-[#171f30] border-amber-400/70'
                    : unlocked
                      ? 'bg-[#131a28] border-slate-700/70'
                      : 'bg-[#0b0f17] border-slate-800/70 opacity-75'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono-num text-amber-300">
                      {w.subtitle}
                    </span>
                    {bossCleared && (
                      <span className="text-xs text-emerald-300 flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Boss vaincu
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-100">
                    {w.name}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {w.description}
                  </p>

                  <div className="pt-1 space-y-1 text-xs">
                    <div className="text-slate-400">
                      Adversaires : <span className="text-slate-200">{enemyNames.join(' · ')}</span>
                    </div>
                    <div className="text-amber-200/90">
                      Boss Unique : <span className="font-semibold">{boss.name}, {boss.title}</span> ({boss.signatureAbilityName})
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs font-mono-num text-slate-400">
                    {w.waves.length} vagues · {boss.maxHp} PV Boss
                  </span>
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectWorld(w.id);
                        onClose();
                      }}
                      className={`px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                          : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Recommencer' : 'Voyager'}</span>
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-slate-500 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Verrouillé</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
