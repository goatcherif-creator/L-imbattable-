import { Compass, Sparkles, Wind } from 'lucide-react';
import { WORLDS } from '../game/data';

interface TitleScreenProps {
  onStart: () => void;
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#080a0f] overflow-y-auto">
      <img
        src="/assets/aistudio/file_00000000d698820e9332b026f639565e_b140b13e.png"
        alt="Le chevalier de L'Imbattable face aux assaillants"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-[#080a0f]/75 to-[#080a0f]/45" />

      <div className="relative z-10 w-full max-w-4xl px-6 py-10 flex flex-col items-center text-center">
        <p className="text-xs font-mono-num tracking-widest text-cyan-300 mb-3">
          Action RPG 3D Haute Vélocité · 4 Mondes · 5 Facultés
        </p>

        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-wide text-slate-100 drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] text-balance">
          L’Imbattable
        </h1>

        <p className="mt-4 max-w-2xl text-sm sm:text-base text-slate-200 leading-relaxed">
          Sprintez, glissez, grimpez aux tyroliennes et planez au-dessus des arènes à ciel ouvert. Enchaînez coups d’épée éthérique et tirs de précision en Visée Runique pour terrasser les vagues progressives et le boss unique de chaque monde.
        </p>

        <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-4 rounded bg-[#0d121d]/90 border border-cyan-500/40">
            <div className="flex items-center gap-2 text-cyan-300 font-display text-sm font-bold">
              <Wind className="w-4 h-4" />
              <span>Parkour & Tyroliennes</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Glissades rapides, double-saut, planeur aérien et tyroliennes verticales avec bascule dynamique 1re/3e personne.
            </p>
          </div>

          <div className="p-4 rounded bg-[#0d121d]/90 border border-amber-500/40">
            <div className="flex items-center gap-2 text-amber-300 font-display text-sm font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Facultés & Visée Runique</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              5 facultés évolutives (Niv. 1 à 5) + Visée Runique pour des Headshots dévastateurs et des Parades Parfaites.
            </p>
          </div>

          <div className="p-4 rounded bg-[#0d121d]/90 border border-rose-500/40">
            <div className="flex items-center gap-2 text-rose-300 font-display text-sm font-bold">
              <Compass className="w-4 h-4" />
              <span>{WORLDS.length} Mondes & Boss Uniques</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
              Arènes multi-niveaux sous ciel éclatant, 12 types d’adversaires progressifs et 4 boss uniques.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 px-8 py-3.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-base font-bold tracking-wide shadow-[0_10px_30px_rgba(245,158,11,0.4)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Entrer dans l’Arène
        </button>

        <p className="mt-5 text-xs text-slate-300 font-mono-num">
          WASD/ZQSD : Bouger · Souris : Regarder · Clic G : Épée/Tir · Clic D : Visée/Bouclier · Espace : Saut/Planeur · Shift/C : Glissade · F : Tyrolienne · V : Caméra
        </p>
      </div>
    </div>
  );
}
