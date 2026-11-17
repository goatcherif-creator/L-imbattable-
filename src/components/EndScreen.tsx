import { ArrowRight, BookOpen, Play, RotateCcw, Trophy } from 'lucide-react';
import { GameHudSnapshot } from '../game/types';
import { BOSSES, WORLDS, getWorldById } from '../game/data';

interface EndScreenProps {
  hud: GameHudSnapshot;
  onResume: () => void;
  onRestartWorld: () => void;
  onNextWorld: () => void;
  onOpenSkills: () => void;
}

export function EndScreen({
  hud,
  onResume,
  onRestartWorld,
  onNextWorld,
  onOpenSkills,
}: EndScreenProps) {
  if (hud.phase === 'playing') return null;

  const world = getWorldById(hud.worldId);
  const boss = BOSSES[world.bossId];
  const hasNext = WORLDS.findIndex((w) => w.id === hud.worldId) < WORLDS.length - 1;

  return (
    <div className="fixed inset-0 z-25 bg-black/78 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0e131d] border border-slate-600/70 rounded-lg p-6 text-center shadow-2xl space-y-5">
        {hud.phase === 'paused' && (
          <>
            <h2 className="font-display text-2xl font-bold text-slate-100">
              Jeu en Pause
            </h2>
            <p className="text-xs text-slate-400">
              {world.name} · Vague {hud.waveIndex + 1}/{hud.totalWaves}
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                <span>Reprendre le combat</span>
              </button>
              <button
                type="button"
                onClick={onOpenSkills}
                className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-slate-100 text-sm font-medium flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Facultés ({hud.skillPoints} pt)</span>
              </button>
              <button
                type="button"
                onClick={onRestartWorld}
                className="w-full py-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recommencer ce monde</span>
              </button>
            </div>
          </>
        )}

        {hud.phase === 'world_cleared' && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-950/80 border border-amber-400/70 flex items-center justify-center text-amber-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-amber-200">
                Monde Conquis !
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Vous avez vaincu {boss.name}, {boss.title}, dans {world.name}.
              </p>
            </div>
            <div className="text-xs font-mono-num text-slate-400">
              Niveau {hud.level} · {hud.kills} ennemis vaincus · {hud.skillPoints} pt de faculté
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              {hasNext && (
                <button
                  type="button"
                  onClick={onNextWorld}
                  className="w-full py-2.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <span>Monde Suivant</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSkills}
                className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-slate-100 text-sm font-medium flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Améliorer mes Facultés</span>
              </button>
            </div>
          </>
        )}

        {hud.phase === 'victory_all' && (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-950/80 border border-amber-400 flex items-center justify-center text-amber-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-amber-200">
                Vous êtes L’Imbattable
              </h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Les quatre mondes sont libérés et tous les boss uniques ont succombé sous votre lame.
              </p>
            </div>
            <div className="text-xs font-mono-num text-slate-300">
              Niveau {hud.level} · {hud.kills} ennemis vaincus
            </div>
            <button
              type="button"
              onClick={onRestartWorld}
              className="w-full py-2.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Rejouer le Trône Astral</span>
            </button>
          </>
        )}

        {hud.phase === 'defeat' && (
          <>
            <h2 className="font-display text-2xl font-bold text-rose-400">
              Chevalier Tombé
            </h2>
            <p className="text-xs text-slate-300">
              Vos facultés et votre niveau sont conservés. Relevez-vous et reprenez l’assaut.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={onRestartWorld}
                className="w-full py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Réessayer {world.name}</span>
              </button>
              <button
                type="button"
                onClick={onOpenSkills}
                className="w-full py-2.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600/60 text-slate-100 text-sm font-medium flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span>Gérer mes Facultés</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
