import { ArrowUpRight, Flame, Shield, Sparkles, Sword, X, Zap } from 'lucide-react';
import { SKILLS, SKILL_ORDER } from '../game/data';
import { SkillId, SkillLevels } from '../game/types';

interface SkillsModalProps {
  skillPoints: number;
  skillLevels: SkillLevels;
  level: number;
  onUpgrade: (skillId: SkillId) => void;
  onClose: () => void;
}

const SKILL_ICONS: Record<SkillId, React.ReactNode> = {
  blade_mastery: <Sword className="w-5 h-5 text-slate-200" />,
  iron_aegis: <Shield className="w-5 h-5 text-slate-300" />,
  seismic_wave: <Zap className="w-5 h-5 text-amber-400" />,
  sacred_crescent: <Sparkles className="w-5 h-5 text-sky-400" />,
  ardent_bastion: <Flame className="w-5 h-5 text-rose-400" />,
};

export function SkillsModal({
  skillPoints,
  skillLevels,
  level,
  onUpgrade,
  onClose,
}: SkillsModalProps) {
  return (
    <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[88vh] bg-[#0e131d] border border-slate-600/60 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/70 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-amber-200">
              Facultés du Chevalier
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-num">
              Niveau {level} · Points de faculté disponibles :{' '}
              <span className={skillPoints > 0 ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                {skillPoints}
              </span>
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

        {/* Skill List */}
        <div className="p-6 overflow-y-auto space-y-4">
          {SKILL_ORDER.map((id) => {
            const def = SKILLS[id];
            const currentLv = skillLevels[id];
            const isMax = currentLv >= def.maxLevel;
            const canUpgrade = skillPoints > 0 && !isMax;

            return (
              <div
                key={id}
                className="p-4 rounded bg-[#131a28] border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-9 h-9 rounded bg-slate-900 border border-slate-600/60 flex items-center justify-center shrink-0">
                      {SKILL_ICONS[id]}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-slate-100">
                          {def.name}
                        </h3>
                        <span className="text-xs font-mono-num text-amber-300">
                          Niv. {currentLv}/{def.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {def.subtitle}
                        {def.hotkey ? ` · Touche ${def.hotkey}` : ''}
                        {def.baseManaCost > 0 ? ` · ${def.baseManaCost} Mana` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {def.description}
                  </p>

                  {/* Current & Next Level Details */}
                  <div className="pt-1 space-y-1 text-xs font-mono-num">
                    <div className="text-emerald-300">
                      Actuel : {def.levelDetails[currentLv - 1]}
                    </div>
                    {!isMax && (
                      <div className="text-slate-400">
                        Suivant : {def.levelDetails[currentLv]}
                      </div>
                    )}
                  </div>
                </div>

                {/* Level Pips + Upgrade Button */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
                  <div className="flex items-center gap-1" aria-label={`Niveau ${currentLv} sur ${def.maxLevel}`}>
                    {Array.from({ length: def.maxLevel }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-3.5 h-2 rounded-xs ${
                          idx < currentLv ? 'bg-amber-400' : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => onUpgrade(id)}
                    className={`px-4 py-2 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      isMax
                        ? 'bg-slate-800 border border-slate-700 text-slate-400 cursor-default'
                        : canUpgrade
                          ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                          : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isMax ? (
                      <span>Niveau Max</span>
                    ) : (
                      <>
                        <span>Améliorer</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
