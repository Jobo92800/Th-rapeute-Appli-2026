# MAbeautyplus V2 — mémoire du projet

Ce fichier est lu au début de chaque session. Il porte les décisions et les
conventions qui ne se déduisent pas du code. **Le tenir à jour à chaque
changement de cap.**

---

## Ce qu'on construit

Application de suivi des clientes pour les 5 centres MAbeautyplus, qui
remplace une application existante (dépôt `Jobo92800/MABEAUTYPLUS`).

Elle est bâtie autour de la **Méthode Empreinte** : le **BioPortrait**, un
bilan de 28 questions croisé avec 5 mesures InBody, produit un profil
comportemental et un terrain physiologique, qui orientent la cure et
l'accompagnement.

Le diagnostic s'appelait « Empreinte » jusqu'au 2 septembre 2026. **Le mot
visible est désormais « BioPortrait »** — écrans, contrat, guide des
thérapeutes. La *méthode*, elle, reste la Méthode Empreinte. Les noms
techniques n'ont pas suivi et c'est délibéré : la table s'appelle toujours
`bareme_empreinte`, les colonnes `profil_dominant`, et les champs Airtable
`Profil Empreinte` / `Terrain Empreinte`. Les renommer imposerait de
renommer les champs Airtable **et** de redéployer la synchro dans le même
mouvement — beaucoup de risque pour un nom que personne ne lit. À faire d'un
seul coup si un jour ça vaut la peine.

**Interlocuteur : Jonathan, non développeur.** Expliquer en français, sans
jargon, et donner les manipulations pas à pas avec les endroits exacts où
cliquer. Ne jamais supposer qu'une étape technique est évidente.

---

## Décisions prises (ne pas les rouvrir sans raison)

| Sujet | Décision |
|---|---|
| Base | **Supabase dédié V2**, projet `kefvxglmybbbcdcautcm`. La V1 tourne sur un Supabase géré par Bolt + Firebase, on n'y touche pas. |
| Transition | L'ancienne application **reste en service**. La V2 sert les nouvelles clientes. Une cliente est créée dans une seule des deux. Rien n'est supprimé. |
| Migration des données | Repoussée. Le champ `clientes.origine` (`v2` / `import_v1`) est prêt pour plus tard. |
| Périmètre soins | Luxothérapie Perte de poids, **Luxothérapie Relaxation**, I-Shape, Pressodynamie. Le **Dôme est retiré** des écrans — le nouveau bilan ne le prescrit plus — mais le socle le connaît encore (tarif, libellé, colonne) : le remettre tient en une ligne. Compléments alimentaires conservés. Tous les autres soins (Mésojet, Advance Lift, Cavitalyse, Adipologie, Psio) sont abandonnés. |
| Prix | `59 € × total séances + 29 € guide + 60 € tenue si électro`. Le catalogue de 60 lignes de la V1 et ses tables de répartition sont **obsolètes**. |
| Cures suivantes | Une cliente qui revient reçoit une cure distincte (échéancier, séances, ligne de montant Airtable propres). Sur ces cures, **le guide et la tenue se décochent** : elle les a déjà, on ne les lui revend pas. Sur un premier bilan ils restent automatiques. |
| Acompte | Pour la cliente qui dit oui mais ne peut pas tout régler le jour même. **Prix du bilan + un créneau réservé × 59 €** — une demi-heure bloquée par soin, trois soins enchaînés font 1h30 et donc trois séances dues. Il **se déduit du total**, c'est son premier règlement : le bilan reste offert puisqu'elle démarre, les 129 € ne servent qu'à mesurer ce que le centre perdrait si elle ne revenait pas. Les créneaux sont comptés d'après les soins de sa cure et restent corrigeables. Au centre seulement — chez Alma le crédit couvre déjà tout. La table `echeances` portait le type `acompte` depuis la 005 sans l'utiliser, et le contrat savait déjà l'annoncer à part. |
| Durée d'une cure | Le soin qui compte le plus de séances donne le tempo : les soins se font sur les mêmes venues, une cure de 20 luxo et 4 presso dure le temps des 20 luxo. **13 séances ou moins → 3 mois, 14 à 16 → 4 mois, au-delà → 5 mois**, plus un mois dès trois soins principaux (la Relaxation ne compte pas, elle s'ajoute à une venue existante). Paliers repris de la maquette du diagnostic. Ils **plafonnent le nombre de chèques** : on n'encaisse pas un règlement après la dernière séance. Quand la thérapeute réduit l'offre, la cure raccourcit et le choix se resserre tout seul. Alma n'est pas concerné — c'est un crédit avancé, le centre est payé tout de suite. |
| Règlement | Les mêmes conditions partout — premier bilan comme cure suivante, un seul calcul couvert par le banc d'essai. **Au centre par chèques**, de 1 à 4 fois sans frais : les échéances suivent les séances, et le guide et la tenue tombent sur la première — la cliente repart avec. **Ou Alma par carte**, en 2, 3, 4, 10 ou 12 fois, avec des frais à la charge de la cliente, portés par `frais_financement`. **Les
taux viennent du tableau de bord Alma du compte MB3PRO** et sont recoupés sur
dix simulations réelles : 0,87 · 1,73 · 1,9 · 6,9489 · 8,1063 %. Deux pièges
qui nous ont coûté une erreur. Le tableau de bord affiche sous chaque taux
client un **taux d'usure** en rouge — le 4× avait été saisi à 2,58 %, son taux
d'usure, au lieu de 1,9 % : 11 € de trop réclamés sur une cure à 1 623 €. Et
en 10× / 12×, Alma applique ses 6,5 % et 7,5 % **au total avec frais**, pas au
montant de la cure. La répartition diffère aussi selon la formule : en 2×, 3×
et 4× la totalité des frais tombe sur le premier versement, en 10× et 12× les
mensualités sont égales. Les anciennes valeurs `4x_maison` et `10x_alma` restent acceptées pour les cures déjà signées. |
| Montant dans Airtable | « Montant Cure » porte ce que la cliente **règle**, frais Alma compris : c'est le montant du contrat et celui des relances. Le tableau de bord de la V2 compte, lui, le montant **hors frais** — les frais Alma ne sont pas du chiffre d'affaires du centre. Les deux diffèrent sur les cures Alma, et c'est voulu. |
| Connexion | **Un compte par thérapeute**, pas par centre. Cloisonnement par centre en RLS. Un compte `direction` voit les 5 centres. Les adresses sont courtes — `prenom@mabeautyplus.fr`, sans accent ni majuscule : elles se tapent chaque matin sur un clavier partagé. Les trois Alexandra qui avaient imposé des adresses longues ne sont plus qu'une (migration 042). Les comptes se créent dans Supabase (Authentication → Add user, **Auto Confirm** coché), puis `supabase/rattacher_les_comptes.sql` les relie et dit qui manque. |
| Airtable | Reste le CRM et le moteur des automatisations. La V2 y écrit via une fonction Edge, jamais depuis le navigateur. |
| Parcours audio | L'application « Mon Parcours » (`Jobo92800/Applipodcast`, `applipodcast.netlify.app`) reste **séparée** : son projet Supabase, son site Netlify, ses fonctions. La V2 se contente de créer le compte de la cliente au moment de la signature du contrat, avec le parcours A/B/C **choisi par la thérapeute**. **Il n'y a aucun lien personnel à récupérer** : l'adresse du site est la même pour toutes, ce qui est personnel c'est le compte. Le chemin normal est désormais le **mot de passe choisi avec la cliente au comptoir** : le compte est créé avec l'email déjà confirmé, elle se connecte tout de suite. L'invitation par email reste en secours (laisser le mot de passe vide), mais son lien est à usage unique et expire en 24 h — c'est ce qui posait problème. Dans Airtable, `Lien parcours audio` renvoie l'adresse du site quand `Accès audio` est rempli. |
| Support | Ordinateur (90 % du temps). Seul le questionnaire du bilan est pensé pour la tablette. |
| Stock | La quantité en rayon **ne se stocke pas** : elle se calcule (entrées − sorties), comme les séances restantes. La V1 recopiait un compteur, qui mentait au bout de quelques jours. Une vente de compléments **est** un mouvement de sortie, écrit par la base : les deux systèmes ne peuvent plus diverger. Le stock peut passer en négatif — c'est le signe qu'un comptage s'impose, pas une raison de refuser une vente réelle. Le guide et la tenue sortent du rayon **à la signature du contrat** : c'est le moment où la cliente repart avec. La taille de la tenue est demandée dans la fenêtre de signature, et la signature reste bloquée tant qu'elle n'est pas choisie. |
| Parrainage | 2 séances offertes par filleule **qui a signé son contrat**, plafond 10 (5 filleules). Elles ne touchent jamais la cure en cours — déjà signée, réglée, facturée : ce sont des crédits pour **la cure suivante**, où elles s'ajoutent au décompte sans changer le montant. Un parrainage traverse les 5 centres. Rien de calculable n'est stocké : les filleules se lisent sur les fiches, « engagée » veut dire « a un contrat », les séances gagnées se calculent. Le seul fait écrit est « cette cure comporte N séances offertes ». |
| Reprise du CRM | Les fiches Airtable entrent dans la V2 avec, pour chaque montant renseigné, une cure « reprise » : montant seul, sans séances ni échéancier, **datée à la création de la fiche** — Airtable ne date que celle-là, y compris pour les cures 2 et suivantes. Ces cures portent `origine = 'import_v1'` et un mode de règlement `inconnu` : inventer « 4 fois sans frais » fausserait le tableau de bord. Une fiche importée ne repart pas dans Airtable à sa création : elle en vient. |
| Cures reprises soldées | Une cure reprise du CRM porte **une échéance unique, déjà réglée**, à sa propre date. Airtable ne garde aucune trace des règlements : sans ça, 630 000 € resteraient éternellement « à encaisser ». La date de règlement vaut celle de la cure — approximation assumée, faute de mieux. |
| Hommes et femmes | Les centres reçoivent aussi des hommes : la fiche porte une **civilité** (Mme par défaut, y compris sur les 680 fiches reprises — le CRM ne la connaissait pas). Elle est demandée dès l'étape contact du bilan et figure sur le contrat. Les consentements n'ont rien demandé : ils sont déjà écrits au neutre, sauf celui de la ménopause, ce qui va de soi. |
| Vue d'ensemble | La direction dispose d'un centre « Tous les centres » dans le sélecteur : la liste des clientes et l'accueil montrent alors les cinq d'un coup, avec une colonne Centre. Les gestes qui supposent un centre — créer une fiche, démarrer un bilan, tenir le stock — le disent et demandent d'en choisir un, plutôt que d'en choisir un à la place de la personne. |
| Tableau de bord | **Réservé à la direction** : le lien n'apparaît pas aux thérapeutes, et la fonction SQL refuse de répondre à un autre rôle. Filtrable par centre ou sur les cinq. Deux notions d'argent à ne jamais confondre : l'**encaissé** (ce qui est rentré, à la date de règlement de chaque échéance) et le **signé** (ce que les cures validées représentent, encaissé plus tard, parfois sur dix mois). Un mois à gros signé et faible encaissé est normal. |
| Exception cure | Une pathologie ou une consigne impérative vit **sur la fiche**, pas dans les notes : une note se lit quand on pense à ouvrir l'onglet, une exception doit être vue sans avoir été cherchée. Elle s'affiche en rouge sous l'en-tête quel que soit l'onglet, et signale la cliente dans la liste. Un seul texte, remplacé à chaque modification — une consigne périmée au milieu d'un fil est pire que pas de consigne. |
| Arrêt de cure | Une cliente qui s'arrête en route ne laisse plus une cure « en cours » éternelle. **Arrêter la cure** annule ses échéances non réglées — on ne réclame pas de l'argent pour des séances qui n'auront pas lieu — et la sort de tous les comptes. Le geste se date, s'explique, et **se défait** tant que l'avoir qu'il a créé n'a pas été dépensé. Séances, bilan et documents restent sur la fiche. |
| Avoir | Ce que le centre doit à une cliente. Il naît d'un arrêt de cure — elle a payé plus qu'elle n'a reçu — ou d'un geste commercial. **Il ne se stocke pas, il se calcule** : on écrit des mouvements (accordé, utilisé, remboursé) et le solde est leur somme, comme le stock. Il se dépense sur une cure — il descend l'échéancier en partant de la dernière échéance, **sans toucher au montant signé** — ou se rembourse en argent. Un avoir traverse les 5 centres, comme le parrainage. Le montant proposé à l'arrêt (encaissé moins consommé) n'est jamais imposé : la thérapeute le corrige. |
| Messages internes | Un **carnet de liaison**, pas une messagerie : pas de fil de discussion, pas de pièce jointe, rien entre thérapeutes. Deux objets qui se ressemblent et qu'il ne faut pas confondre, parce que leur état utile n'est pas le même. Une **annonce** part de la direction vers des thérapeutes : ce qu'on veut savoir, c'est **qui l'a lue**. Un **signalement** part d'une thérapeute vers la direction : ce qu'on veut savoir, c'est **où en est le traitement** (nouveau, en cours, traité, sans suite). Un statut unique pour les deux aurait obligé à répondre « traité » à une annonce. Une thérapeute ne voit pas les signalements de ses collègues — l'un d'eux peut dire « le stock que Marie a compté est faux », et ça se règle avec la direction — ni le compte de diffusion d'une annonce, qui ne regarde qu'elle. |
| Suppression | **Archiver** est le geste courant : réversible, rien n'est perdu. **Supprimer** est définitif, emporte tout le dossier, exige de retaper le nom, et reste réservé à la direction. |

---

## Charte graphique

Celle du diagnostic BioPortrait, étendue à toute l'application : **teal**
(`#3BBFBF`) pour l'interface, **magenta** (`#E8318A`) réservé aux gestes qui
engagent — signer, valider, démarrer. Typographie **Poppins**, titres en
maigre avec le mot important en gras. Coins généreux (cartes 16 px, boutons
en pilule), fond blanc lavé d'un halo de teal.

Le logo vectorisé est dans `public/logo.svg`, **recadré sur son contenu** :
le fichier d'origine était fait aux deux tiers de vide, si bien que le nom
restait minuscule quelle que soit la taille donnée à l'image. Recadré, c'est
une enseigne large — 2,5 fois plus large que haute — qui remplit la barre
latérale et se lit du premier coup. Si un jour vous repartez du fichier
d'origine, pensez à refaire ce recadrage — `viewBox="5.6 41.2 107.3 42.6"` —
et à **retirer le rectangle de fond** qui couvre toute la planche : opaque,
il est invisible sur du blanc et bien voyant dès que le logo se pose sur
autre chose. La page de connexion l'a montré tout de suite.

Les noms de teintes n'ont pas changé — `marine` désigne désormais le teal,
`ardoise` un gris qui tire vers le vert-de-gris. Changer la charte se fait
donc dans `tailwind.config.js` et `src/index.css`, sans toucher aux écrans.

---

## Conventions de code

- **Tout en français** : noms de fichiers, variables, fonctions, commentaires,
  tables et colonnes. Le code se lit comme le métier se parle.
- `src/domain/` = règles métier pures, sans dépendance à l'interface ni au
  réseau. C'est là que vivent la tarification, le BioPortrait, le jeu du jour,
  l'état des règlements.
- **Aucun prix en dur dans le code.** Ils vivent dans la table `tarifs`,
  datés. Un programme copie le prix en vigueur à sa validation : les cures
  passées ne changent jamais de montant.
- **Aucun état dérivable n'est stocké.** Les séances restantes se calculent
  (vendues − faites), le retard de règlement se déduit de la date. C'était le
  défaut n°1 de la V1.
- Les erreurs affichées disent **ce qui ne va pas et quoi faire**, jamais un
  écran vide qui se confond avec « pas de données ».
- Avant de livrer un écran, le **regarder** : lancer `npm run dev` et ouvrir
  la page. Pour un composant qui a besoin de données, une page d'aperçu
  temporaire avec des données factices, retirée juste après.

---

## Architecture

**Vite · React 18 · TypeScript · Tailwind · TanStack Query · Supabase.**

```
src/domain/        règles métier pures (tarification, bioportrait, jeuDuJour, reglement, contrat, stock, parrainage)
src/services/      accès aux données (clientes, metier, stock, parrainage, tableauDeBord, contratPdf, consentementsPdf)
src/lib/           supabase, session
public/guide.html  le guide des thérapeutes, servi tel quel — lien « Tuto » dans le menu
public/logo.svg    le logo vectorisé, recadré sur son contenu
src/pages/         Accueil, Clientes, FicheCliente, NouveauBilan, Stock, TableauDeBord, Messages, Connexion
src/components/    bilan/, contrat/, cure/, fiche/, stock/, tableau/, Layout
supabase/migrations/   le schéma, numéroté, à exécuter dans l'ordre
supabase/functions/    synchro-airtable, envoyer-contrat, acces-parcours-audio, importer-airtable
```

Le questionnaire du BioPortrait **n'est pas dans le code** : il est stocké en base
(`bareme_empreinte.contenu`, jsonb, versionné). Le faire évoluer ne demande
aucune modification de code, et les bilans passés restent recalculables
puisque chacun retient sa version de barème.

La **version 3** est celle qui tourne (migration 036). Les questions sont
rangées par thème, deux questions de santé ouvrent le parcours et leurs
réponses **retirent** un soin de la prescription, et chaque réponse donne
des points par soin — un barème à paliers en déduit les séances et le degré
de recommandation.

Ce que la 3 change par rapport à la 2 : **vingt-huit questions au lieu de
vingt**, les huit nouvelles étant toutes des « signaux du corps ». Le
terrain physiologique ne tenait qu'à deux questions (jambes, digestion)
quand le profil comportemental en avait douze : les cinq terrains ne se
départageaient pas, et se déduisaient surtout de l'InBody. **Les prix, les
paliers, les formules et les contre-indications n'ont pas bougé** — à
réponses identiques, une cliente paie exactement pareil.

Maquettes de référence, versionnées :
`docs/maquettes/diagnostic-bioportrait-v3.html` (celle qui fait foi) et
`docs/maquettes/diagnostic-empreinte-v2.html` (la précédente).

Les versions 1 et 2 restent en base : les bilans déjà passés les
référencent et doivent rester recalculables.

---

## Airtable

Base `appI97jEL2mSCg3Wc`, table Clients `tblfqxwGePzeiWqqY`.

Le rapprochement se fait sur **`clientes.airtable_record_id`**, retenu dès la
première création. La V1 cherchait par nom + prénom + centre, ce qui cassait
au moindre renommage — ne jamais revenir à ça.

Champs créés pour la V2 : `Source appli`, `Profil Empreinte`,
`Terrain Empreinte`, `Date bilan`, `Nb séances`, `Détail prescription`,
`Électrostimulation`, `Mode de règlement`, `Statut programme`,
`Date validation`, `Reste à encaisser`, `Échéances en retard`,
`Montant en retard`, `Parrain`, `Filleules`, `Filleules engagées`,
`Séances offertes restantes`, `Civilité`, `Exception cure`, `Frais de
financement`. Le champ **`Avoir`**, monétaire, existait déjà dans le CRM :
la V2 y écrit désormais le solde de la cliente, zéro compris — sans quoi un
avoir soldé y resterait affiché pour toujours. Ces trois derniers sont des champs **texte** : les frais y
partent formatés (« 76,70 € ») et ne se somment donc pas — à passer en
numérique si un jour on veut les additionner.

Le parrainage a un piège : quand une filleule signe, c'est la fiche de **sa
marraine** qui change de valeur, pas la sienne. Un déclencheur sur `contrats`
remet donc la marraine dans la file (migration 019). Sans lui, le CRM
annoncerait toujours zéro filleule engagée.

Les contrats et consentements partent en pièces jointes via l'API de contenu
d'Airtable (base64), sans URL publique.

Secrets de la fonction : `AIRTABLE_TOKEN`, `AIRTABLE_BASE`, `AIRTABLE_TABLE`.

---

## Où on en est

**Fait** — socle et connexion · fiches clientes · Bilan BioPortrait complet ·
programme et prix · cures successives avec guide et tenue facultatifs ·
échéancier daté avec états de retard, visibles sur la liste · séances et
moteur du jeu du jour · mensurations avec courbe · notes entre thérapeutes ·
contrats et consentements signés, avec lecture obligatoire avant signature ·
synchronisation Airtable complète, PDF en pièces jointes compris ·
**écran d'accueil du jour** (à encaisser, compléments à renouveler, séances
faites, stock) · archivage réversible et suppression définitive (direction) · accès au
parcours audio avec mot de passe donné au comptoir · stock et ventes de
compléments, la vente décomptant le rayon toute seule · parrainage, avec
séances offertes reportées sur la cure suivante · **tableau de bord de la
direction**, filtrable par centre · **arrêt de cure et avoirs**, avec
décompte de ce qu'elle a payé contre ce qu'elle a reçu · **carnet de
liaison interne**, annonces de la direction et signalements des
thérapeutes, avec une pastille au menu.

**Tout est vérifié en conditions réelles** : fiches, bilan, cure, contrat,
consentements, synchro Airtable et parcours audio fonctionnent. Le stock,
lui, n'a été vu que sur des données factices : il attend la migration 015.

**Reste à faire**

- Envoi du contrat par email : la fonction `envoyer-contrat` est écrite mais
  pas déployée. Demande un compte Resend avec `mabeautyplus.fr` vérifié et le
  secret `RESEND_API_KEY`. **À arbitrer** : les documents arrivant désormais
  en pièces jointes dans Airtable, l'envoi peut aussi se faire depuis les
  automatisations Airtable — c'est peut-être plus simple que Resend.
- **Sécurité des fonctions SQL** : réglé par la migration 040. Le trou était
  réel, pas théorique — l'appel à `reclamer_taches_airtable` depuis
  l'extérieur, avec la seule clé publique du site, a bien rendu un ticket de
  synchro le 3 septembre 2026. Neuf fonctions refermées, et
  `ALTER DEFAULT PRIVILEGES` (migration 041, séparée exprès) coupe le droit
  implicite pour toutes celles à venir. **La 040 nomme les commandes en
  interrogeant la base, jamais à la main** : une première version les listait
  en dur, une signature a échoué, et PostgreSQL annulant tout un script d'un
  bloc, rien n'avait été appliqué — sans que ça se voie. Elle se termine
  désormais par une requête de contrôle qui doit ne rien renvoyer. **Conséquence pour la suite : toute nouvelle fonction doit porter
  son propre `GRANT EXECUTE`**, sans quoi elle ne sera appelable par
  personne. C'est volontaire : un échec bruyant vaut mieux qu'un trou
  silencieux.
- **Vente des cosmétiques KOS** : ils sont au stock, mais aucune interface ne
  les vend. Une vente se note en sortie manuelle (« Ça sort »). Seuls les
  compléments se vendent depuis la fiche cliente.
- **Reprise des fiches du CRM** : écran `/reprise-crm` (direction), qui
  compte d'abord et n'écrit qu'après confirmation. Reprend l'identité, les
  coordonnées et une cure par montant Airtable. Le reste — séances,
  échéanciers, bilans, mensurations — n'est pas dans Airtable.
- Migration éventuelle de l'historique Firestore (séances, mensurations,
  bilans de la V1).
- Le dépôt est **public** : il contient le questionnaire BioPortrait, les 60
  jeux, les textes de contrat et la grille tarifaire. À repasser en privé.
- `ADMIN_CODE` du podcast toujours à `0000`.

**Questions ouvertes**

- Tarif du Dôme : 39 € (V1) ou 59 € comme la Méthode ?
- Les compléments sont-ils inclus dans le montant de la cure ou vendus à part ?
  (l'écran les vend à part, au tarif `complement`, 37 € la boîte)
- Les produits Advance Beauty du Grau-du-Roi (V1) sont-ils encore tenus ?
  Les cosmétiques KOS, eux, sont au catalogue depuis la 016.
- Les frais Alma sont-ils ajoutés au montant cliente ou absorbés par le centre ?
- Classer les 60 jeux en `pedagogique` / `action` (colonne `jeux.nature`,
  tous en `action` par défaut) pour la règle d'alternance sur deux venues
  dans la même semaine.
- Marquer les jeux `prioritaire` pour les programmes courts.

---

## Pièges rencontrés

- **Encodage du presse-papiers.** `LC_CTYPE=C` sur ce Mac : `pbcopy` annonce
  un mauvais encodage et les accents arrivent cassés dans le navigateur
  (« Le Cr√®s »). Toujours préfixer par `LC_ALL=en_US.UTF-8`.
- **Collage tronqué.** Un fichier de plus de 100 lignes collé dans l'éditeur
  web de Supabase se coupe. Déployer la fonction par la CLI.
- **Le bon projet Supabase.** Il y en a plusieurs sur ce compte. Le SQL de la
  V2 va dans **MAbeautyplus V2** (`kefvxglmybbbcdcautcm`), jamais dans
  Appli-Podcast, MB Nutrition ou Smooth Ticket. L'éditeur ne prévient pas :
  il répond « Success » en ayant créé l'objet dans le mauvais projet. Au
  moindre doute, vérifier via l'API que l'objet existe vraiment.
- **Ordre des opérations.** Toujours passer la migration SQL *avant* de
  redéployer la fonction Edge, sinon elle appelle des fonctions absentes.
- **Diagnostiquer la synchro.** La fonction renvoie ses messages d'erreur
  dans sa réponse. Un simple appel suffit à savoir ce qui bloque :
  `curl -s -X POST "$URL/functions/v1/synchro-airtable" -H "Authorization: Bearer $ANON"`.
  Elle nomme la cliente concernée, pas seulement l'entité. Causes déjà vues :
  migration non passée, fonction pas redéployée, secrets absents, et le
  **403 trompeur** — il tombe aussi quand la fiche Airtable visée a été
  supprimée à la main. Dans ce cas, vider `airtable_record_id` sur la fiche
  la fait recréer. Le bouton **Écarter** de l'accueil retire ces tâches de la
  file : l'échec est parfois voulu — une fiche supprimée exprès dans le CRM
  ne pourra jamais être mise à jour. Rien n'est perdu, la prochaine
  modification de la fiche la remet en file.
- **Code admin du podcast.** `ADMIN_CODE` de l'application Mon Parcours vaut
  `0000` : quatre chiffres, devinables en quelques secondes, et il ouvre la
  création de comptes, le déblocage d'étapes et le dépôt de fichiers. À
  remplacer par une phrase longue, côté Netlify (podcast) **et** côté secret
  `PODCAST_ADMIN_CODE` (V2), les deux doivent rester identiques.
- **Les espaces du français dans un PDF.** `toLocaleString('fr-FR')` sépare
  les milliers par une espace **fine insécable** (U+202F). Elle est correcte,
  et un navigateur la dessine parfaitement — mais les polices de base d'un
  PDF ne la connaissent pas et impriment « / » à la place. « 1 977 € » est
  parti chez une cliente en « 1 / 977 € », et le contrat de prestation avait
  le même défaut sur toute cure à quatre chiffres. Tout ce qui s'écrit dans
  un PDF passe désormais par `pourPdf()` (`src/domain/texte.ts`) ; le banc
  d'essai le vérifie sur le contrat et sur le récapitulatif. Ne jamais
  écrire un montant directement dans un PDF.
- **Doublons Airtable.** Le parcours du bilan enchaîne trois écritures ;
  sans verrou, trois synchros parallèles créaient trois fiches. Réglé par
  `reclamer_taches_airtable` (SKIP LOCKED), un verrou par cliente et un
  regroupement des appels côté application. Ne pas défaire.

---

## Les deux dépôts

| Dépôt | Rôle |
|---|---|
| `Jobo92800/Th-rapeute-Appli-2026` | la V2, ce dossier |
| `Jobo92800/Applipodcast` | « Mon Parcours », l'application audio des clientes |

Le second est **modifié aussi** depuis cette collaboration : l'action `creer`
de son API thérapeute accepte un `motDePasse`, ce qui crée le compte avec
l'email déjà confirmé. Son banc d'essai (`node tests/run.mjs`, 52 contrôles)
doit rester vert après toute modification.

## Banc d'essai

`npm test` — **315 contrôles, à garder verts.** Ils couvrent ce qui décide
de ce qu'une cliente paie, reçoit et se voit refuser pour raison de santé :
tarification et échéanciers (centre et Alma), prescription et
contre-indications, planchers des formules, BioPortrait, parrainage, stock,
compte à rebours des compléments, contrat, décompte d'un arrêt de cure.

Deux partis pris. **Aucune bibliothèque de test n'est installée** : Node
exécute le TypeScript directement et le harnais tient en quarante lignes —
une dépendance de moins à suivre. Et les contrôles de prescription lisent
**le barème réellement livré** (extrait de la migration 036), pas une copie
d'essai : si le questionnaire change et qu'un palier devient inatteignable,
le banc le dit.

Le hook `tests/resolveur.mjs` complète les extensions dans les imports, que
Node exige et que Vite devine. Il ne concerne que les tests.

---

## Déploiement

Dépôt : `Jobo92800/Th-rapeute-Appli-2026` (public pour l'instant — contient
le questionnaire BioPortrait, les 60 jeux, les textes de contrat et la grille
tarifaire ; à repasser en privé). Netlify déploie automatiquement sur chaque
poussée.

**Ne jamais pousser sans que Jonathan le demande.** Chaque poussée
reconstruit le site et lui coûte des crédits Netlify — autant pour une
correction d'une ligne que pour une livraison entière. On commite en local,
il regarde le résultat dans `npm run dev` ouvert à côté de la conversation,
et on ne pousse qu'une fois une série de modifications terminée, sur sa
demande explicite. À la fin d'une série, lui dire en une ligne ce qui attend
d'être poussé — sans le faire. Variables à définir côté Netlify : `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`.

## Commandes

Trois choses ne passent **pas** par GitHub et se déploient à la main :
les migrations SQL, les fonctions Edge, et les champs Airtable.

```bash
npm run dev                     # développement
npm test                        # banc d'essai des règles métier
npm run build                   # vérification avant livraison
npx --no-install tsc --noEmit   # typage seul

# déployer une fonction Edge (après un `npx supabase login`, une seule fois)
npx --yes supabase functions deploy synchro-airtable      --project-ref kefvxglmybbbcdcautcm
npx --yes supabase functions deploy acces-parcours-audio  --project-ref kefvxglmybbbcdcautcm

# diagnostiquer la synchro Airtable : elle renvoie ses erreurs
curl -s -X POST "$URL/functions/v1/synchro-airtable" -H "Authorization: Bearer $ANON"
```

Secrets posés côté Supabase V2 : `AIRTABLE_TOKEN`, `AIRTABLE_BASE`,
`AIRTABLE_TABLE`, `PODCAST_API_URL`, `PODCAST_ADMIN_CODE`.

Migrations passées jusqu'à **042** incluse, `synchro-airtable` redéployée,
et les deux champs du récapitulatif créés dans Airtable. Deux attendent
d'être collées : la **041** (le droit implicite coupé pour les commandes
futures) et la **043** (les messages internes). Tant que la 043 n'est pas
passée, l'écran Messages s'ouvre mais ne trouve pas ses tables.

La fermeture des commandes (040) a été **vérifiée des deux côtés** le
3 septembre 2026 : depuis l'extérieur, les neuf commandes répondent
« permission denied » avec la clé publique ; la synchro, qui se présente
avec la clé de service, continue de répondre `{"traitees":0,"echecs":0}` ;
et l'application connectée fonctionne normalement.

Deux diagnostics, dans `supabase/diagnostics/`, ne modifient rien et se
relancent à volonté : `controle_coherence.sql` (quinze vérifications) et
`qui_est_en_retard.sql` (les impayés, nom par nom).

Les migrations SQL se collent dans l'éditeur SQL de Supabase, dans l'ordre
des numéros. Elles sont rejouables sans risque.
