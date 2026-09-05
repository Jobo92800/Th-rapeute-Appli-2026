import { Headphones, Lock, Play } from 'lucide-react';

/*
  L'application « Mon Parcours », redessinée.

  Pas une capture d'écran : une capture réduite à la largeur d'une vignette
  ne montre rien, on y devine du gris sur du blanc. Ici tout est redessiné à
  une taille qui se lit — quitte à ne montrer que trois étapes au lieu de
  treize, et un écran en cours de parcours plutôt qu'à zéro pour cent : une
  cliente doit se voir dedans, pas voir une application vide.

  Elle suit l'identité de l'application réelle : le magenta pour ce qui est
  en cours, le teal pour le fil du parcours, les étapes à venir sous cadenas.
  Si l'application change de tête un jour, ce dessin sera à reprendre —
  c'est le prix à payer, et il est plus faible que celui d'une vignette
  illisible en rendez-vous.
*/
export default function MaquetteParcours() {
  return (
    <div className="mx-auto w-[240px] rounded-[2.2rem] border-[6px] border-ardoise-800 bg-white shadow-xl">
      <div className="space-y-3 rounded-[1.7rem] bg-marine-50/50 px-3 py-3.5">
        {/* L'en-tête */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[7px] font-bold uppercase tracking-[0.18em] text-ardoise-800">
              Mon Parcours
            </div>
            <div className="text-[6.5px] text-ardoise-400">
              by <span className="font-semibold text-marine-600">MAbeauty</span>
              <span className="font-semibold text-rose-500">plus</span>
            </div>
          </div>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-marine-400 to-rose-400 text-[8px] font-bold text-white">
            É
          </span>
        </div>

        <div className="text-[11px] font-bold leading-tight text-ardoise-900">
          Votre parcours MAbeautyplus
        </div>

        {/* L'avancement */}
        <div className="rounded-xl bg-white px-2.5 py-2 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-[7.5px] text-ardoise-600">4 étapes terminées sur 13</span>
            <span className="text-[8px] font-bold text-rose-500">31 %</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-ardoise-200">
            <div className="h-1 w-[31%] rounded-full bg-gradient-to-r from-marine-400 to-rose-400" />
          </div>
        </div>

        {/* L'étape en cours */}
        <div className="rounded-xl border-l-[3px] border-rose-500 bg-white px-2.5 py-2.5 shadow-sm">
          <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] text-rose-500">
            Étape 5
          </div>
          <div className="mt-0.5 text-[9px] font-bold leading-snug text-ardoise-900">
            Le grignotage du soir, et ce qu’il vient calmer
          </div>
          <div className="mt-1 flex items-center gap-1 text-[7px] text-ardoise-400">
            <Headphones className="h-2 w-2" />8 min · vous étiez à 02:14
          </div>
          <div className="mt-2 rounded-full bg-rose-500 py-1.5 text-center text-[8px] font-bold text-white">
            Reprendre mon écoute
          </div>
        </div>

        {/* Le fil des étapes */}
        <div>
          <div className="mb-1.5 text-[8px] font-bold text-ardoise-900">Votre parcours</div>
          <div className="space-y-0">
            <EtapeFil enCours titre="5. Le grignotage du soir" sous="En cours · 18 % écouté" />
            <EtapeFil titre="Votre prochaine étape" sous="Se débloque après l’étape 5" />
            <EtapeFil titre="Étape 7" sous="À venir" dernier />
          </div>
        </div>
      </div>
    </div>
  );
}

function EtapeFil({
  titre,
  sous,
  enCours = false,
  dernier = false,
}: {
  titre: string;
  sous: string;
  enCours?: boolean;
  dernier?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
            enCours ? 'border-rose-400 bg-white text-rose-500' : 'border-ardoise-200 bg-white text-ardoise-300'
          }`}
        >
          {enCours ? <Play className="h-1.5 w-1.5 fill-current" /> : <Lock className="h-1.5 w-1.5" />}
        </span>
        {!dernier && <span className="w-px flex-1 bg-marine-300" />}
      </div>
      <div className="pb-2">
        <div
          className={`text-[7.5px] font-semibold leading-tight ${
            enCours ? 'text-rose-500' : 'text-ardoise-400'
          }`}
        >
          {titre}
        </div>
        <div className="text-[6.5px] text-ardoise-400">{sous}</div>
      </div>
    </div>
  );
}
