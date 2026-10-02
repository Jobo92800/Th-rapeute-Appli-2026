/*
  La restitution du BioPortrait.

  Ce que ces contrôles tiennent : ce qu'une cliente LIT sur le document
  qu'elle emporte. Un texte sous la mauvaise réponse, un soin proposé deux
  fois en face de deux points différents, une page qui désigne un « point à
  faire évoluer » alors que rien n'alerte — tout cela se voit, et se voit
  chez elle, trois jours plus tard, sans personne pour l'expliquer.

  Les textes sont lus dans le fichier qui génère la migration, pas recopiés :
  un banc qui contrôle sa propre copie ne contrôle rien.
*/
import { readFileSync } from 'node:fs';
import { section, verifie, egal } from './harnais.mts';
import { baremeLivre } from './prescription.mts';
import type { Bareme, Reponses } from '../src/domain/bioportrait.ts';
import {
  accorder,
  correspondances,
  libelleSeances,
  lireLaComposition,
  miseEnPage,
  pointDeVigilance,
  prioritesDuBilan,
  socle,
  soinsPreconises,
  soinsVendus,
} from '../src/domain/restitution.ts';

/** Le barème livré, enrichi du contenu que la 076 pose en base. */
function baremeComplet(): Bareme {
  const bareme = baremeLivre();
  const contenu = JSON.parse(
    readFileSync('supabase/contenu/restitution-bioportrait.json', 'utf8'),
  ) as {
    AXES: Record<string, Record<string, unknown>>;
    LECTURE: Record<string, Array<[string, number, boolean, string]>>;
    RESTITUTION: Bareme['RESTITUTION'];
  };

  for (const [code, champs] of Object.entries(contenu.AXES)) {
    Object.assign(bareme.AX[code as keyof typeof bareme.AX], champs);
  }
  for (const etape of bareme.STEPS) {
    const lu = etape.t ? contenu.LECTURE[etape.t] : undefined;
    if (lu) etape.lecture = lu.map(([s, n, a, t]) => ({ s, n, a, t }));
  }
  bareme.RESTITUTION = contenu.RESTITUTION;
  return bareme;
}

/** Les rangs des cinq questions d'analyse dans le questionnaire. */
function rangsDAnalyse(bareme: Bareme): number[] {
  const rangs: number[] = [];
  bareme.STEPS.forEach((e, i) => {
    if (e.phase === 'analyse' && e.type === 'radio') rangs.push(i);
  });
  return rangs;
}

/** Des réponses d'analyse : un index de réponse par mesure, dans l'ordre. */
function inbody(bareme: Bareme, choix: number[]): Reponses {
  const r: Reponses = {};
  rangsDAnalyse(bareme).forEach((rang, i) => {
    if (choix[i] != null) r[rang] = choix[i];
  });
  return r;
}

const vendu = (cle: string, seances: number) => ({ cle, seances });

export function controlerRestitution() {
  const bareme = baremeComplet();

  // -------------------------------------------------------------------------
  section('Le contenu de la restitution est bien en place');

  verifie('les dix axes ont de quoi écrire deux pages',
    (['P1', 'P2', 'P3', 'P4', 'P5', 'T1', 'T2', 'T3', 'T4', 'T5'] as const).every((c) => {
      const a = bareme.AX[c];
      return Boolean(a.resume && a.manif?.length === 3 && a.meca && a.sig);
    }));
  verifie('les cinq profils disent ce qu’elle vit et sa priorité',
    (['P1', 'P2', 'P3', 'P4', 'P5'] as const).every((c) => Boolean(bareme.AX[c].vecu && bareme.AX[c].prio)));
  verifie('les cinq terrains disent ce qu’il faut en faire',
    (['T1', 'T2', 'T3', 'T4', 'T5'] as const).every((c) => Boolean(bareme.AX[c].agir)));

  /*
    La lecture suit les réponses une à une. Si le questionnaire gagne une
    réponse et que la lecture ne suit pas, une phrase se retrouve sous la
    mauvaise — c'est exactement ce que ce contrôle empêche.
  */
  verifie('chaque réponse d’analyse a sa lecture',
    bareme.STEPS.filter((e) => e.phase === 'analyse').every(
      (e) => e.lecture?.length === e.o?.length));

  // -------------------------------------------------------------------------
  section('Le tableau de composition corporelle');

  const toutVaBien = lireLaComposition(bareme, inbody(bareme, [0, 2, 1, 1, 3]));
  egal('cinq lignes, dans l’ordre du questionnaire', toutVaBien.length, 5);
  egal('la première est la graisse viscérale', toutVaBien[0].libelle, 'Graisse viscérale');
  egal('la réponse cochée est reprise', toutVaBien[1].reponse, 'Normale (norme haute)');
  egal('avec sa situation en deux mots', toutVaBien[1].situation, 'Dans la norme');
  egal('et son nombre de pastilles', toutVaBien[1].niveau, 2);
  verifie('rien n’alerte ici', toutVaBien.every((l) => !l.alerte));

  const alerte = lireLaComposition(bareme, inbody(bareme, [1, 1, 2, 1, 1]));
  verifie('une masse musculaire basse alerte', alerte[1].alerte);
  verifie('un métabolisme lent aussi', alerte[2].alerte);

  const sansReponse = lireLaComposition(bareme, inbody(bareme, [0, 1]));
  egal('une mesure sans réponse ne fait pas de ligne vide', sansReponse.length, 2);

  // -------------------------------------------------------------------------
  section('Le point de vigilance');

  egal('c’est la première mesure en alerte',
    pointDeVigilance(alerte)?.libelle, 'Masse musculaire');
  egal('aucune alerte, aucun point', pointDeVigilance(toutVaBien), null);

  /*
    Le défaut corrigé. L'implémentation d'origine retenait « Graisse
    viscérale » quand rien n'alertait, alors que sa propre ligne disait
    « rien d'alarmant de ce côté ». La page se contredisait toute seule.
  */
  verifie('et surtout pas la première ligne du tableau',
    pointDeVigilance(toutVaBien)?.libelle !== 'Graisse viscérale');

  // -------------------------------------------------------------------------
  section('Les soins qui entrent dans la restitution');

  egal('ils gardent l’ordre du devis',
    soinsVendus([
      { technologie: 'presso', seances: 12 },
      { technologie: 'luxo', seances: 20 },
    ]).map((s) => s.cle), ['PRESSO', 'LUXO']);

  egal('le Dôme n’a rien à voir avec le BioPortrait',
    soinsVendus([
      { technologie: 'luxo', seances: 15 },
      { technologie: 'dome', seances: 10 },
    ]).map((s) => s.cle), ['LUXO']);

  egal('un soin à zéro séance n’est pas vendu',
    soinsVendus([{ technologie: 'relax', seances: 0 }]).length, 0);

  egal('le nombre de séances s’écrit au singulier quand il le faut',
    [libelleSeances(1), libelleSeances(12)], ['1 séance', '12 séances']);

  // -------------------------------------------------------------------------
  section('Ce que nous mettons en face de chaque point');

  const ctx = {
    bareme,
    profil: 'P4' as const,          // En Veille
    terrain: 'T5' as const,         // Digestif
    vigilance: pointDeVigilance(alerte),
    vendus: [vendu('RELAX', 5), vendu('ISHAPE', 12)],
  };
  const corr = correspondances(ctx);

  egal('trois lignes quand un point alerte', corr.length, 3);
  egal('le terrain d’abord', corr[0].libelle, 'Terrain Digestif');
  egal('puis le profil', corr[1].libelle, 'Profil En Veille');
  egal('puis le point à faire évoluer', corr[2].libelle, 'Masse musculaire');
  verifie('jamais deux fois le même soin',
    new Set(corr.map((c) => c.cle)).size === corr.length);
  verifie('et jamais une case vide', corr.every((c) => c.texte.trim().length > 0));
  egal('un soin vendu annonce ses séances', corr.find((c) => c.cle === 'ISHAPE')?.detail, '12 séances');

  const sansAlerte = correspondances({ ...ctx, vigilance: null });
  egal('deux lignes quand rien n’alerte', sansAlerte.length, 2);

  // -------------------------------------------------------------------------
  section('Pourquoi chaque soin est dans sa cure');

  const cartes = soinsPreconises(ctx);
  egal('une carte par soin vendu', cartes.length, 2);
  verifie('chacune dit pourquoi', cartes.every((c) => Boolean(c.raisonTexte)));
  verifie('et jamais deux fois le même point de l’analyse',
    new Set(cartes.map((c) => c.raisonLibelle).filter(Boolean)).size ===
      cartes.filter((c) => c.raisonLibelle).length);

  /*
    L'état repart de zéro à chaque cliente. S'il survivait, la deuxième
    restitution de la journée perdrait ses mentions d'axe sans que rien ne le
    signale.
  */
  egal('deux appels de suite donnent le même résultat',
    JSON.stringify(soinsPreconises(ctx)), JSON.stringify(cartes));

  egal('le socle est le même pour toutes', socle(bareme).map((s) => s.cle),
    ['NUTRITION', 'SUIVI', 'ANALYSES', 'PARCOURS', 'DECLIC', 'BIOPORTRAIT']);

  // -------------------------------------------------------------------------
  section('Les priorités et la mise en page');

  const prio = prioritesDuBilan(ctx);
  egal('trois priorités', prio.length, 3);
  verifie('la première commence par une majuscule', /^[A-ZÀ-Ý]/.test(prio[0]));
  verifie('et aucune ne finit par un point', prio.every((p) => !p.endsWith('.')));
  egal('deux priorités quand rien n’alerte',
    prioritesDuBilan({ ...ctx, vigilance: null }).length, 2);

  egal('un ou deux soins : pleine largeur', miseEnPage(2), 'pleine-largeur');
  egal('trois ou quatre : deux colonnes', miseEnPage(4), '2-colonnes');
  egal('cinq et plus : trois colonnes', miseEnPage(5), '3-colonnes');

  // -------------------------------------------------------------------------
  section('L’accord en genre');

  const allonge = bareme.RESTITUTION?.SOINS.LUXO.court ?? '';
  verifie('le barème porte la marque', allonge.includes('{e}'));
  verifie('une femme est allongée', accorder(allonge, 'Mme').includes('allongée'));
  verifie('un homme est allongé', /allongé[^e]/.test(accorder(allonge, 'M.')));
  verifie('et il ne reste jamais d’accolade', !accorder(allonge, 'M.').includes('{'));

  // -------------------------------------------------------------------------
  /*
    Les trois invariants du paquet, sur TOUS les croisements : vingt-cinq
    profils × terrains, six configurations de cure, avec et sans alerte.
    C'est ce passage qui attrape les combinaisons que personne n'essaie à la
    main — celle où le seul soin vendu est aussi celui que les trois axes
    appellent.
  */
  section('Les invariants, sur tous les croisements');

  const PROFILS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
  const TERRAINS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
  const CURES: Array<Array<{ cle: string; seances: number }>> = [
    [],
    [vendu('LUXO', 20)],
    [vendu('RELAX', 5)],
    [vendu('PRESSO', 12)],
    [vendu('LUXO', 15), vendu('ISHAPE', 12)],
    [vendu('LUXO', 20), vendu('RELAX', 10), vendu('ISHAPE', 15), vendu('PRESSO', 12)],
  ];

  let cas = 0;
  const fautes: string[] = [];
  for (const profil of PROFILS) {
    for (const terrain of TERRAINS) {
      for (const vendus of CURES) {
        for (const v of [pointDeVigilance(alerte), null]) {
          cas += 1;
          const c = correspondances({ bareme, profil, terrain, vigilance: v, vendus });
          const quoi = `${profil}×${terrain}, ${vendus.length} soin(s), ${v ? 'alerte' : 'sans alerte'}`;

          if (new Set(c.map((x) => x.cle)).size !== c.length) fautes.push(`${quoi} : un soin répété`);
          if (c.some((x) => !x.texte.trim())) fautes.push(`${quoi} : un texte vide`);
          /*
            Deux ou trois lignes, jamais quatre ni une seule — et jamais plus
            que de soins distincts à proposer. Sans soin en cabine il n'y a
            que le guide et le suivi : deux lignes, même si un point alerte.
            Le cas est théorique (Jonathan : « on ne propose pas de cure sans
            soin »), mais l'invariant doit tenir quand même.
          */
          const attendues = Math.min(v ? 3 : 2, vendus.length + 2);
          if (c.length !== attendues) fautes.push(`${quoi} : ${c.length} ligne(s)`);
          if (c.some((x) => !x.prestation.trim() || !x.detail.trim())) {
            fautes.push(`${quoi} : une prestation sans nom ou sans détail`);
          }
          if (soinsPreconises({ bareme, profil, terrain, vigilance: v, vendus }).length !== vendus.length) {
            fautes.push(`${quoi} : il manque une carte`);
          }
        }
      }
    }
  }

  egal(`${cas} croisements, aucun soin répété ni texte vide`, fautes.slice(0, 5), []);
}
