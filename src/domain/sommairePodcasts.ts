/*
  Le sommaire des podcasts de « Mon Parcours », pour les thérapeutes.

  Un podcast = une semaine. Chaque épisode se termine par un défi à
  appliquer pendant sept jours, et le podcast suivant revient toujours sur
  ce défi — c'est la meilleure porte d'entrée en rendez-vous : « Alors, ce
  défi de la semaine, vous l'avez tenu ? »

  POURQUOI CES TEXTES VIVENT ICI ET PAS DANS MON PARCOURS.

  Mon Parcours ne stocke que le titre de chaque étape : ni résumé, ni défi.
  Et ces textes-ci ne sont pas ceux de la cliente — ils sont écrits pour la
  thérapeute (« point clé à maîtriser en entretien », pages du livre). Ils
  viennent du document « Sommaire des podcasts » de Jonathan (15 septembre
  2026), transcrit ici au plus près. L'avancement de la cliente, lui, se
  lit en direct dans Mon Parcours.

  LA NUMÉROTATION. Le document numérote les podcasts de 0 (l'introduction)
  à 12 ou 24 ; Mon Parcours numérote ses étapes de 1 à 13 ou 24. L'étape N
  de Mon Parcours est le podcast N − 1 — `fichePodcast` fait la conversion,
  et personne d'autre ne doit la refaire.

  Les podcasts 1 à 11 sont identiques dans les deux cures. Seuls le
  podcast 0 (qui annonce la structure de sa cure) et la suite à partir du
  12 diffèrent. Le podcast 24 « Bilan final » figure au document mais n'est
  pas encore en ligne dans Mon Parcours (sa cure 6 mois s'arrête au 23) :
  sa fiche est là, elle s'affichera comme « pas encore en ligne » tant que
  l'étape n'existe pas.
*/

import type { CodeParcours } from './parcoursAudio';

export interface FichePodcast {
  /** Le numéro du document : 0 pour l'introduction. */
  numero: number;
  titre: string;
  resume: string;
  /** Le défi de la semaine, en toutes lettres — ou ce qui en tient lieu pour le podcast 0. */
  defi: string;
  /** Le même en une ligne, pour la barre des étapes et le rappel du défi précédent. */
  defiCourt: string;
  /** Les pages du livre ma beautyplus que la cliente a sous les yeux, quand le document les cite. */
  pages?: string;
  /** Le trophée que l'application remet à la fin de cet épisode, s'il y en a un. */
  trophee?: string;
}

/* ------------------------------------------------------------------------ */
/*  Les fiches                                                               */
/* ------------------------------------------------------------------------ */

const P0_COMMUN =
  "Épisode d'accueil. Pose le cadre : ce n'est pas un régime mais un coaching nutritionnel, et la vitesse compte moins que la direction. Rappelle que l'évolution dépend de l'âge, du métabolisme, de l'activité, du sommeil, des hormones, du stress et de l'histoire de poids. Présente l'application, le rythme hebdomadaire, le journal de bord, le suivi du poids, et surtout le livre ma beautyplus à garder sous la main à chaque écoute. Présente les compléments STARVAC : le Détox (draineur), le Burn (minceur), le SOS (sauveur).";

const P0_DEFI =
  "Pas de défi hebdomadaire. La seule action attendue : la journée détox dès le lendemain — l'épisode explique à quoi elle sert, ce qu'elle contient et pourquoi.";

const PODCAST_0_TROIS_MOIS: FichePodcast = {
  numero: 0,
  titre: 'Bienvenue dans votre transformation',
  resume: `${P0_COMMUN} Version 3 mois : 90 jours, structure en 2 phases — Rééquilibrage (S1-S4) puis Activation & approfondissement (S5-S12).`,
  defi: P0_DEFI,
  defiCourt: 'Journée détox le lendemain',
};

const PODCAST_0_SIX_MOIS: FichePodcast = {
  numero: 0,
  titre: 'Bienvenue dans votre transformation',
  resume: `${P0_COMMUN} Version 6 mois : engagement long terme, structure en 2 phases — Rééquilibrage (S1-S4) puis Micronutrition, stabilisation & autonomie (S5-S24).`,
  defi: P0_DEFI,
  defiCourt: 'Journée détox le lendemain',
};

/** Podcasts 1 à 11, identiques dans les deux cures. */
const TRONC_COMMUN: FichePodcast[] = [
  {
    numero: 1,
    titre: "Phase d'attaque : relancer la machine",
    resume:
      "Journée détox puis semaine sans féculents midi et soir. Importance du petit-déjeuner pour la stabilité glycémique, qui conditionne la gestion des sensations alimentaires jusqu'au soir. Rôle clé des protéines, expliqué par l'image du collier de perles (acides aminés essentiels, acides aminés limitants). Répond à la question fréquente des fruits en perte de poids : faut-il les bannir ? Structuration concrète des repas sans féculents avec exemples et recettes du guide.",
    defi:
      "Boire 2 litres d'eau par jour minimum et suivre la semaine d'attaque à la lettre, sans aucun écart. Le ton est volontairement exigeant : cette semaine sert à obtenir les premiers résultats et donc à installer la motivation.",
    defiCourt: "2 L d'eau + semaine d'attaque sans écart",
    pages: 'p. 20, 23-24, 28-29',
  },
  {
    numero: 2,
    titre: 'Réintégrer avec intelligence',
    resume:
      "Réintroduction des féculents à IG bas le midi (légumineuses en tête). Explique que le glucose est un besoin vital et que certains organes sont glucodépendants, à commencer par le cerveau — d'où le risque de blocage métabolique en cas de privation prolongée. Première approche de la glycémie et des IG, volontairement rapide car le sujet est approfondi en semaine 9. Critères d'introduction d'une collation + test « faim ou déshydratation ? ». Recette du lait d'or et ses vertus.",
    defi:
      'Cuisiner au moins 2 légumineuses différentes (lentilles, pois chiches, haricots…) et tester 1 céréale inhabituelle pour elle : quinoa, sarrasin ou millet. Objectif : diversifier les apports et monter en qualité sur les glucides.',
    defiCourt: '2 légumineuses + 1 céréale inhabituelle',
    pages: 'tableau des portions de glucides p. 57, recette p. 67',
  },
  {
    numero: 3,
    titre: 'Réintégrer les féculents le soir',
    resume:
      "Réintégration des féculents le soir et équilibre sur la journée complète : plus riches le midi, plus légers le soir. Développe le lien entre alimentation et sommeil — tyrosine le matin, tryptophane le soir — et pourquoi les légumineuses ont leur place au dîner. Travail sur la grille « je limite VS je privilégie ».",
    defi:
      "Cuisiner maison tous les soirs de la semaine et tester au moins une nouvelle recette du guide, idéalement la Soupe curry coco et haricots blancs (p. 75). Le raisonnement donné à la cliente : le soir, la fatigue et le manque d'idées sont les deux principaux déclencheurs d'écart.",
    defiCourt: 'Cuisiner maison chaque soir + 1 nouvelle recette',
    pages: 'p. 73-74, recette p. 75',
  },
  {
    numero: 4,
    titre: "L'équilibre atteint, à vie ?",
    resume:
      "Félicitations : la phase de rééquilibrage est terminée. La pyramide alimentaire (p. 85) devient la base de l'équilibre durable. Question centrale posée à la cliente : vous sentez-vous capable de tenir ça à vie ? Si non, pourquoi ? → ouverture sur la personnalisation. Amorce la gestion des écarts et la stabilisation, sans les développer (sujet de la semaine 5).",
    defi:
      "Équilibrer ses journées en conscience : tester la pyramide, écouter et décrypter ses sensations, s'hydrater, bouger — et noter chaque soir ce qu'elle a ressenti dans son corps et dans son mental.",
    defiCourt: 'Équilibrer ses journées en conscience + noter son ressenti',
    pages: 'p. 85',
    trophee: 'Rééquilibrage alimentaire validé',
  },
  {
    numero: 5,
    titre: 'Gérer les écarts sans culpabilité',
    resume:
      "Distingue l'écart plaisir de l'écart destructeur, avec un message clé : ce n'est pas l'écart qui pose problème, c'est ce qu'on fait après. Construit un cadre souple mais structurant, et apprend à remonter à l'origine de l'écart — faim réelle (manque de glucides le matin ou le midi, quantités insuffisantes, qualité médiocre), soif (le cerveau confond faim et soif), ou émotionnel. Pose le plaisir comme indispensable à l'équilibre émotionnel et au maintien long terme, à condition d'être maîtrisé. Point sur l'alcool : calories vides, charge hépatique. Rappel du complément SOS Sauveur.",
    defi:
      "Planifier un vrai repas plaisir — un plat qu'elle aime, un moment qu'elle savoure — sans culpabiliser, et reprendre sa routine le lendemain comme si de rien n'était.",
    defiCourt: 'Planifier un vrai repas plaisir, sans culpabilité',
    pages: 'p. 83 (éviter l’effet yoyo), p. 84 (anticiper les écarts, que faire si je craque), p. 87 (alcool)',
  },
  {
    numero: 6,
    titre: "Les familles d'aliments",
    resume:
      "Rappel de la pyramide vue en semaine 4, puis présentation des familles d'aliments et des nutriments qui justifient leur présence. Message central : aucune famille ne doit être supprimée — dans chacune il y a des choix plus ou moins intéressants, et tout l'enjeu est de savoir vers lesquels se diriger. Aucun aliment n'est complet à lui seul : la diversité fait la densité nutritionnelle et prévient les carences. Critères : qualité, fréquence, quantité. Valorisation des produits bruts, frais, crus, locaux, de saison. Cas particulier des produits sucrés : non indispensables sur le plan du glucose (on le trouve ailleurs) mais utiles au plaisir, donc à la tenue long terme — d'où les alternatives plus saines (sucre de coco, miel de qualité, chocolat noir).",
    defi:
      "Varier au maximum les couleurs dans l'assiette — minimum 5 couleurs différentes par jour. L'intérêt expliqué à la cliente : cela force la diversification sans avoir à compter quoi que ce soit, et rend les repas plus appétissants.",
    defiCourt: "5 couleurs différentes dans l'assiette chaque jour",
  },
  {
    numero: 7,
    titre: 'Les 3 piliers : alimentation, hydratation, sommeil',
    resume:
      "Présenté comme un secret méconnu de la perte de poids (p. 93). Les trois piliers sont vitaux et interdépendants : si l'un est bancal, tout l'équilibre en pâtit. Sommeil médiocre = moral en baisse, motivation en baisse, envies de sucre — le corps va chercher ailleurs l'énergie qu'il n'a pas récupérée. Impact du sommeil sur les hormones de la faim (ghréline, leptine). Hydratation : rôles de l'eau, part de la composition corporelle, et confusion faim/soif. Rappel de la semaine 3 sur tryptophane et tyrosine : dîner adapté = bon sommeil = bon moral = bonnes décisions alimentaires = cercle vertueux.",
    defi:
      "Faire le point chaque soir sur les 3 piliers, en se posant 3 questions honnêtement : Est-ce que j'ai bien mangé aujourd'hui ? Est-ce que j'ai bu suffisamment ? Est-ce que je suis en train de favoriser un bon sommeil ce soir ? Puis ajuster, un jour après l'autre.",
    defiCourt: 'Bilan des 3 piliers chaque soir',
    pages: 'p. 93',
  },
  {
    numero: 8,
    titre: 'Organisation alimentaire : liberté & clarté',
    resume:
      "L'organisation est présentée comme un levier direct de perte de poids et de maintien de la motivation. Planifier la semaine, préparer les menus, organiser les courses = gain de temps, moins de charge mentale, moins de tentation instantanée quand le frigo est vide. Préparation d'avance : cuire les féculents, découper les légumes, faire les vinaigrettes maison. Utilité des surgelés, du stock de secours, de la variété toute l'année. Présentation des outils de l'app : menus, listes de courses, journal.",
    defi:
      "Préparer ses menus pour les 5 prochains jours, noter ses idées de repas, faire une liste de courses et cuisiner au moins 2 repas à l'avance.",
    defiCourt: "Menus sur 5 jours + 2 repas cuisinés à l'avance",
  },
  {
    numero: 9,
    titre: 'Glycémie, indice glycémique & insuline',
    resume:
      "Approfondissement de ce qui avait été effleuré en semaine 2. Explique le glucose, la glycémie, le rôle du pancréas, l'insuline et le glucagon (p. 95). Détaille l'effet des pics glycémiques : hyperglycémie puis hypoglycémie réactionnelle, fatigue du pancréas à long terme, stockage des graisses, faim et pulsions sucrées — « le sucre appelle le sucre ». Point important : IG élevé ne veut pas dire mauvais aliment (la carotte et la courge sont à IG haut et restent recommandées) — ce qui compte est la charge glycémique du repas entier. Ce qui fait monter la glycémie : cuisson et surcuisson, mixage, appauvrissement en fibres (jus sans pulpe), glucides consommés seuls. Ce qui la stabilise : lipides, protéines, fibres, cuisson modérée.",
    defi:
      "Prendre un repas type qu'elle fait souvent et le rééquilibrer selon son IG : ajouter des fibres, remplacer un féculent par une légumineuse, choisir une cuisson plus douce — bref, le rendre plus stable.",
    defiCourt: 'Rééquilibrer un repas habituel selon son IG',
    pages: 'p. 95, tableaux p. 97-99',
  },
  {
    numero: 10,
    titre: "Microbiote & digestion : l'allié oublié",
    resume:
      "Le gros sujet de la cure. Environ 100 000 milliards de bactéries, près de 2 kg, un organe à part entière : nous avons autant besoin d'elles qu'elles de nous. Rôle de la flore sur la digestion, l'humeur, l'immunité, le stockage et l'inflammation de bas grade. Les fibres sont l'aliment des bactéries — ce ne sont pas nous qui les digérons, ce sont elles. Point clé à maîtriser en entretien : apporter des fibres à un microbiote appauvri est abrasif pour les parois intestinales — irritation, douleurs, gaz, ballonnements, gonflements. Les fibres ne sont bénéfiques que si la qualité du microbiote suit. D'où la logique probiotiques (restaurer la flore) puis prébiotiques (la nourrir pour qu'elle se multiplie et colonise). Facteurs délétères : alcool, antibiotiques, stress, sucre.",
    defi:
      'Ajouter chaque jour au moins un aliment probiotique ET un aliment prébiotique — par exemple un kéfir + une soupe de poireaux.',
    defiCourt: '1 probiotique + 1 prébiotique chaque jour',
  },
  {
    numero: 11,
    titre: 'Élimination & surcharge toxique',
    resume:
      "Transit ralenti, rétention d'eau, surcharge hépatique : le corps garde ses déchets, il est encombré, et la perte de poids devient difficile. Sur la rétention d'eau, le raisonnement donné est simple : ce n'est pas un problème en soi, mais une eau qui stagne signe une mauvaise circulation des fluides et une élimination incomplète — donc un terrain défavorable à la perte de poids. Conséquences souvent invisibles : teint terne, fatigue chronique, stagnation du poids. Leviers : hydratation, fibres solubles, activité douce, plantes. Rappel du draineur urinaire et hépatique STARVAC, à prendre chaque jour.",
    defi:
      'Hydratation maximale (2 L/jour) + un légume drainant chaque jour (fenouil, poireau, radis…) + une infusion détox quotidienne.',
    defiCourt: 'Hydratation max + 1 légume drainant par jour',
  },
];

/** Le dernier podcast de la cure 3 mois. */
const FIN_TROIS_MOIS: FichePodcast = {
  numero: 12,
  titre: 'Stabiliser sans régresser',
  resume:
    "Bilan des 3 mois et transition vers l'après. Aborde la stabilisation, la consolidation des acquis et la projection future. Phrase pivot de l'épisode : « Ce que vous tenez dans la durée est plus puissant que ce que vous faites parfaitement pendant un temps. » Se termine sur le choix de la suite.",
  defi:
    "Présenté comme le défi d'une vie : maîtriser les « après ». Un écart ? D'accord, mais je sais comment réagir. Une semaine compliquée ? D'accord, mais je garde mes piliers. Un coup de mou ? Je ralentis, mais je ne recule pas.",
  defiCourt: 'Maîtriser les « après »',
  trophee: 'Cure de 3 mois complétée',
};

/** Podcasts 12 à 24 de la cure 6 mois. */
const SUITE_SIX_MOIS: FichePodcast[] = [
  {
    numero: 12,
    titre: "Inflammation : l'ennemie silencieuse",
    resume:
      "L'inflammation de bas grade comme frein silencieux à la perte de poids. Aliments pro-inflammatoires à limiter : sucres, viandes transformées, huiles raffinées. Aliments anti-inflammatoires à privilégier : curcuma, oméga-3, fruits rouges, légumes verts. Établit la corrélation entre inflammation, rétention d'eau, douleurs et fatigue.",
    defi:
      "Pendant 7 jours, composer ses repas autour d'aliments anti-inflammatoires — saumon + légumes vapeur + huile de lin, salade avocat-curcuma-noix-citron, soupe maison poireau-carotte-gingembre, tisane romarin ou curcuma le soir. En parallèle : réduire au maximum les produits industriels, éviter l'alcool, viser minimum 7 h de sommeil, maintenir hydratation et complémentation. Présenté comme une mise au repos du système.",
    defiCourt: '7 jours de repas anti-inflammatoires',
    trophee: 'Mi-parcours atteint',
  },
  {
    numero: 13,
    titre: 'Vitamines et inflammation : le duo essentiel',
    resume:
      "Présentation générale des vitamines et de leur rôle dans la régulation du poids et de l'inflammation. Carences fréquentes, vitamine D en tête. Les liposolubles (A, D, E, K) ne s'absorbent qu'en présence de graisses. Focus immunité, peau, hormones. Message clé : en déficit, le foie élimine moins bien, les cellules sont moins protégées, l'immunité s'affaiblit — le corps retient, gonfle et stocke, même avec une alimentation correcte.",
    defi:
      'Ajouter chaque jour au moins deux sources de vitamines liposolubles dans ses repas, toujours associées à un peu de matière grasse. Consigne importante : ne jamais prendre les compléments liposolubles à jeun, toujours au cours d’un repas contenant du gras.',
    defiCourt: '2 sources de vitamines liposolubles/jour, avec du gras',
  },
  {
    numero: 14,
    titre: 'Minéraux : énergie, métabolisme, équilibre',
    resume:
      "Rôle des minéraux dans le métabolisme énergétique et la régulation hormonale. Zinc et immunité, chrome et glycémie, magnésium et stress, fer et vitalité. Signal utile en entretien : un déficit en chrome se traduit très souvent par des fringales sucrées, des coups de fatigue après les repas et une sensation de yoyo énergétique. Sources naturelles et réflexion sur une complémentation ciblée.",
    defi:
      'Consommer chaque jour au moins 3 sources naturelles de minéraux et observer ses sensations : énergie, récupération, sommeil, moral. Exemples donnés : œufs + salade de lentilles + carré de chocolat noir + poignée de noix, ou poisson gras + brocolis vapeur + eau riche en magnésium.',
    defiCourt: '3 sources naturelles de minéraux par jour',
  },
  {
    numero: 15,
    titre: 'Lipides : faire la paix avec les bonnes graisses',
    resume:
      'Déconstruit la peur des graisses et donne les apports recommandés. Différencie acides gras saturés, mono-insaturés et polyinsaturés. Zoom sur les oméga 3, 6, 9 et leurs ratios idéaux. Aliments riches en bons lipides : poissons gras, avocats, graines, huiles de qualité. Formule de clôture : fuyez les calories vides, pas les bons lipides.',
    defi:
      "Introduire chaque jour une source de bon gras différente. L'objectif explicite est la diversité, pas la quantité.",
    defiCourt: '1 source de bon gras différente chaque jour',
  },
  {
    numero: 16,
    titre: 'Densité nutritionnelle : nourrir au lieu de remplir',
    resume:
      'Différencie les calories pleines, qui nourrissent, des calories vides, qui remplissent. On peut manger beaucoup et rester carencé. Aliments à très forte densité : spiruline, légumes verts, graines, œufs. Réflexion sur le rapport quantité/qualité, avec la formule : vos cellules ne veulent pas juste être pleines, elles veulent être nourries.',
    defi:
      "Enrichir ses assiettes avec au moins un aliment super-nutritif par jour — persil ou coriandre frais dans les plats, graines de chanvre ou de lin sur les salades, amandes ou myrtilles avec un carré de chocolat noir, lentilles ou quinoa en accompagnement, soupe maison au curcuma ou au gingembre. Puis observer : plus d'énergie l'après-midi ? meilleure concentration ? moins d'envies de sucre ?",
    defiCourt: '1 aliment super-nutritif par jour',
  },
  {
    numero: 17,
    titre: 'Aliments anti-fatigue : se booster naturellement',
    resume:
      "Décrypte la fatigue d'origine nutritionnelle : carences, digestion lente, hypoglycémie. Aliments boosters naturels : graines, légumineuses, fruits rouges, vitamine C. Erreurs fréquentes : trop de café, pas assez de bons glucides. Objectif : retrouver une énergie stable sans stimulation artificielle.",
    defi:
      "Intégrer chaque jour deux aliments « booster ». Pistes données : flocons d'avoine + graines + fruits rouges au petit-déjeuner, collation noix + fruit frais, citron/gingembre/curcuma/herbes fraîches dans les plats, infusion de romarin ou de menthe poivrée après le déjeuner. Puis noter comment elle se sent l'après-midi, dans sa tête et dans son corps.",
    defiCourt: '2 aliments « booster » par jour',
  },
  {
    numero: 18,
    titre: 'Additifs et produits lights : les dangers cachés',
    resume:
      "Présentation des additifs : rôles, intérêts, classement par code couleur de dangerosité, les plus courants, leur impact sur la santé — certains sans danger avéré à ce jour, la plupart problématiques. Pourquoi les produits light ne font pas maigrir, voire l'inverse : le cerveau reçoit un faux message sucré, ce qui dérègle au lieu de sevrer ; les édulcorants perturbent le microbiote et donc indirectement le poids ; le sentiment de bonne conscience pousse à en consommer davantage, pour un total calorique souvent identique. Conclusion : mieux vaut peu de vrai que beaucoup de faux.",
    defi:
      'Identifier 3 produits « allégés », « zéro » ou ultra-transformés consommés régulièrement et les remplacer par des alternatives plus brutes : soda light → eau pétillante citron, dessert 0 % → fromage blanc nature + baies + cannelle, barre protéinée industrielle → poignée de noix + carré de chocolat noir. Puis observer : digestion plus fluide, satiété plus rapide, énergie plus stable, envies de sucre en baisse.',
    defiCourt: 'Remplacer 3 produits allégés/ultra-transformés',
  },
  {
    numero: 19,
    titre: 'Nutrition et hormones : tout est lié',
    resume:
      "Les hormones présentées comme les vraies décideuses de la perte de poids. Rôle de l'insuline dans le stockage (rappel de la semaine 9), de la leptine et de la ghréline dans la satiété, de la thyroïde dans le métabolisme. Comment l'alimentation peut soutenir l'équilibre hormonal. Mentionne les perturbateurs du quotidien — ultra-transformés, plastiques chauffés au micro-ondes, certains additifs — et les aliments de soutien comme les graines de lin moulues et les légumes crucifères.",
    defi:
      "Choisir un axe personnel à travailler. Stress → magnésium : légumes verts, chocolat noir 85 %, infusions relaxantes le soir, noix et amandes. Fringales → structurer les repas : une source de protéines à chaque repas, éviter les sucres rapides, soigner l'équilibre global de l'assiette. Fatigue → acides aminés essentiels : œufs, légumineuses, poisson, viande blanche.",
    defiCourt: 'Choisir un axe : stress, fringales ou fatigue',
  },
  {
    numero: 20,
    titre: "L'assiette influence l'humeur",
    resume:
      "Lien entre nutrition et neurotransmetteurs : sérotonine, dopamine. Rappel du tryptophane — rôle, sources, conditions d'assimilation. Place de la vitamine D. Impact des carences nutritionnelles sur la stabilité émotionnelle. Objectif : créer un terrain alimentaire propice à la bonne humeur.",
    defi:
      "Ajouter un aliment bénéfique pour l'humeur à chaque repas : banane + noix le matin, légumineuses + légumes colorés + herbes fraîches le midi, poisson gras + légumes vapeur + huile de colza le soir, chocolat noir + infusion en collation. Et surtout, être attentive à ce qu'elle ressent après le repas : plus calme ? moins lourde mentalement ? plus concentrée ?",
    defiCourt: '1 aliment « bonne humeur » à chaque repas',
  },
  {
    numero: 21,
    titre: "L'humeur influence l'assiette",
    resume:
      "Le pendant émotionnel de la semaine précédente : manger ses émotions. Stress, colère, vide, ennui conduisent à une alimentation compensatoire, « doudou », souvent riche, par besoin de se remplir. Prise de conscience des mécanismes de compensation, outils pratiques pour enrayer les compulsions, et construction d'un « kit anti-craquage » personnel.",
    defi:
      "Identifier chaque jour une situation où elle a mangé sans avoir réellement faim, et noter : le contexte, l'émotion, l'aliment, et ce qu'elle aurait pu faire à la place. Consigne explicite : pas pour se juger, pour comprendre — plus il y a de conscience dans le geste, moins il est automatique.",
    defiCourt: 'Repérer chaque jour une prise alimentaire sans faim',
  },
  {
    numero: 22,
    titre: 'Intuition alimentaire : se reconnecter à soi',
    resume:
      "Reconnexion aux sensations de faim, de satiété et de plaisir. À ce stade du suivi, la cliente est jugée capable de sortir du cadre des quantités prédéfinies suivies depuis le début de la cure, pour une alimentation davantage guidée par ses sens. Apprentissage de l'écoute active du corps. Outils : respiration, journal alimentaire, ralentissement.",
    defi:
      "Manger en pleine conscience au moins une fois par jour. Avant le repas : de quoi ai-je envie ? de quoi ai-je besoin ? Pendant : est-ce que j'ai encore faim ? Après : comment je me sens ? L'objectif n'est pas de faire parfaitement, mais d'observer et de ressentir.",
    defiCourt: '1 repas par jour en pleine conscience',
  },
  {
    numero: 23,
    titre: 'Alimentation libre et durable : sortir des cases',
    resume:
      "Sortir du contrôle permanent pour entrer dans l'autonomie. Garder une structure sans rigidité. Replacer le plaisir dans un cadre équilibré. Vivre la nutrition comme une ressource, pas comme une punition.",
    defi:
      "Prendre 10 minutes et répondre à 3 questions : Qu'est-ce que je veux garder à vie de cette cure ? Qu'est-ce que je veux adapter à ma réalité ? Quels seront mes repères pour les moments où je décroche ? Les réponses sont à noter quelque part — c'est sa boussole et son plan B.",
    defiCourt: '10 minutes, 3 questions de projection',
  },
  {
    numero: 24,
    titre: 'Bilan final : le nouveau point de départ',
    resume:
      "Épisode de transition, pas de clôture : il fait le passage entre un cadre qui a guidé et la capacité à continuer seule. Bilan de la progression — poids, habitudes, mental. Message central : durable ne veut pas dire figé — le corps change, la vie change, les saisons changent, et il est normal d'avoir besoin d'ajustements ; l'important est de garder ses repères pour pouvoir revenir quand ça dérape. Rappelle qu'elle garde l'application, les recettes, le carnet, les outils, les compléments, et qu'elle sait où nous trouver. Ouvre sur la suite du parcours : stabilisation, autonomie, booster.",
    defi:
      "Prendre un quart d'heure, sans écrans, avec un carnet, et répondre à 4 questions : Qu'est-ce que j'ai appris sur moi ces six derniers mois ? Qu'est-ce que j'ai envie de garder pour les années à venir ? Quels sont les signaux qui m'alertent quand je perds le fil ? Comment puis-je continuer à avancer, avec liberté et sérénité ? C'est sa feuille de route pour la suite.",
    defiCourt: '15 minutes, carnet, 4 questions bilan',
    trophee: '6 mois. Une nouvelle version de vous.',
  },
];

/* ------------------------------------------------------------------------ */
/*  Lecture                                                                  */
/* ------------------------------------------------------------------------ */

/** Le sommaire complet d'une cure, du podcast 0 au dernier. */
export function sommaireDuParcours(code: CodeParcours): FichePodcast[] {
  return code === 'B'
    ? [PODCAST_0_TROIS_MOIS, ...TRONC_COMMUN, FIN_TROIS_MOIS]
    : [PODCAST_0_SIX_MOIS, ...TRONC_COMMUN, ...SUITE_SIX_MOIS];
}

/** Le seul endroit qui sait que l'étape N de Mon Parcours est le podcast N − 1. */
export function podcastDeLEtape(etape: number): number {
  return etape - 1;
}

/** La fiche du podcast que Mon Parcours numérote « étape N », ou null s'il n'y en a pas. */
export function fichePodcast(code: CodeParcours, etape: number): FichePodcast | null {
  return sommaireDuParcours(code)[podcastDeLEtape(etape)] ?? null;
}

/** Ce que la thérapeute dit d'un podcast : « Podcast 0 — Introduction », « Podcast 3 — Semaine 3 ». */
export function sousTitrePodcast(numero: number): string {
  return numero === 0 ? 'Introduction' : `Semaine ${numero}`;
}

export type EtatPodcast = 'ecoute' | 'en_cours' | 'a_venir' | 'pas_en_ligne';

/**
 * Où en est la cliente, d'après Mon Parcours.
 *
 * Mon Parcours ne dit que combien d'étapes sont terminées, pas lesquelles —
 * mais il les débloque dans l'ordre, donc les N premières le sont. « En
 * cours » est la première qui ne l'est pas : c'est celle qu'elle écoute
 * cette semaine, et c'est son défi qu'on reprend en rendez-vous.
 *
 * Quand tout est terminé, c'est la dernière qui reste « en cours » : son
 * défi est celui d'une vie, on ne l'a pas fini le jour où on l'a écouté.
 */
export function etatDuPodcast(
  numero: number,
  avancement: { terminees: number; total: number },
): EtatPodcast {
  const etape = numero + 1;
  if (etape > avancement.total) return 'pas_en_ligne';
  const enCours = Math.min(avancement.terminees + 1, avancement.total);
  if (etape < enCours) return 'ecoute';
  if (etape === enCours) return 'en_cours';
  return 'a_venir';
}

/** Le numéro du podcast en cours, dans la numérotation du document. */
export function podcastEnCours(avancement: { terminees: number; total: number }): number {
  return podcastDeLEtape(Math.max(1, Math.min(avancement.terminees + 1, avancement.total)));
}
