# MAbeautyplus V2 — mémoire du projet

Ce fichier est lu au début de chaque session. Il porte les décisions et les
conventions qui ne se déduisent pas du code. **Le tenir à jour à chaque
changement de cap.**

---

## Ce qu'on construit

Application de suivi des clientes pour les 5 centres MAbeautyplus, qui
remplace une application existante (dépôt `Jobo92800/MABEAUTYPLUS`).

Elle est bâtie autour de la **Méthode Empreinte** : un bilan de 24 questions
croisé avec 7 mesures InBody produit un profil comportemental et un terrain
physiologique, qui orientent la cure et l'accompagnement.

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
| Périmètre soins | Luxothérapie, I-Shape, Pressodynamie. **Dôme en option**, compléments alimentaires conservés. Tous les autres soins (Mésojet, Advance Lift, Cavitalyse, Adipologie, Psio) sont abandonnés. |
| Prix | `59 € × total séances + 29 € guide + 60 € tenue si électro`. Le catalogue de 60 lignes de la V1 et ses tables de répartition sont **obsolètes**. |
| Cures suivantes | Une cliente qui revient reçoit une cure distincte (échéancier, séances, ligne de montant Airtable propres). Sur ces cures, **le guide et la tenue se décochent** : elle les a déjà, on ne les lui revend pas. Sur un premier bilan ils restent automatiques. |
| Règlement | 4× sans frais (maison) ou 10× Alma (taux repris de la V1, constante empirique comprise). |
| Connexion | **Un compte par thérapeute**, pas par centre. Cloisonnement par centre en RLS. Un compte `direction` voit les 5 centres. |
| Airtable | Reste le CRM et le moteur des automatisations. La V2 y écrit via une fonction Edge, jamais depuis le navigateur. |
| Parcours audio | L'application « Mon Parcours » (`Jobo92800/Applipodcast`, `applipodcast.netlify.app`) reste **séparée** : son projet Supabase, son site Netlify, ses fonctions. La V2 se contente de créer le compte de la cliente au moment de la signature du contrat, avec le parcours A/B/C **choisi par la thérapeute**. **Il n'y a aucun lien personnel à récupérer** : l'adresse du site est la même pour toutes, ce qui est personnel c'est le compte. Le chemin normal est désormais le **mot de passe choisi avec la cliente au comptoir** : le compte est créé avec l'email déjà confirmé, elle se connecte tout de suite. L'invitation par email reste en secours (laisser le mot de passe vide), mais son lien est à usage unique et expire en 24 h — c'est ce qui posait problème. Dans Airtable, `Lien parcours audio` renvoie l'adresse du site quand `Accès audio` est rempli. |
| Support | Ordinateur (90 % du temps). Seul le questionnaire du bilan est pensé pour la tablette. |
| Stock | La quantité en rayon **ne se stocke pas** : elle se calcule (entrées − sorties), comme les séances restantes. La V1 recopiait un compteur, qui mentait au bout de quelques jours. Une vente de compléments **est** un mouvement de sortie, écrit par la base : les deux systèmes ne peuvent plus diverger. Le stock peut passer en négatif — c'est le signe qu'un comptage s'impose, pas une raison de refuser une vente réelle. Le guide et la tenue sortent du rayon **à la signature du contrat** : c'est le moment où la cliente repart avec. La taille de la tenue est demandée dans la fenêtre de signature, et la signature reste bloquée tant qu'elle n'est pas choisie. |
| Parrainage | 2 séances offertes par filleule **qui a signé son contrat**, plafond 10 (5 filleules). Elles ne touchent jamais la cure en cours — déjà signée, réglée, facturée : ce sont des crédits pour **la cure suivante**, où elles s'ajoutent au décompte sans changer le montant. Un parrainage traverse les 5 centres. Rien de calculable n'est stocké : les filleules se lisent sur les fiches, « engagée » veut dire « a un contrat », les séances gagnées se calculent. Le seul fait écrit est « cette cure comporte N séances offertes ». |
| Suppression | **Archiver** est le geste courant : réversible, rien n'est perdu. **Supprimer** est définitif, emporte tout le dossier, exige de retaper le nom, et reste réservé à la direction. |

---

## Conventions de code

- **Tout en français** : noms de fichiers, variables, fonctions, commentaires,
  tables et colonnes. Le code se lit comme le métier se parle.
- `src/domain/` = règles métier pures, sans dépendance à l'interface ni au
  réseau. C'est là que vivent la tarification, l'Empreinte, le jeu du jour,
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
src/domain/        règles métier pures (tarification, empreinte, jeuDuJour, reglement, contrat, stock, parrainage)
src/services/      accès aux données (clientes, metier, stock, parrainage, contratPdf, consentementsPdf)
src/lib/           supabase, session
src/pages/         Accueil, Clientes, FicheCliente, NouveauBilan, Stock, Connexion
src/components/    bilan/, contrat/, cure/, fiche/, stock/, Layout
supabase/migrations/   le schéma, numéroté, à exécuter dans l'ordre
supabase/functions/    synchro-airtable, envoyer-contrat, acces-parcours-audio
```

Le questionnaire Empreinte **n'est pas dans le code** : il est stocké en base
(`bareme_empreinte.contenu`, jsonb, versionné). Le faire évoluer ne demande
aucune modification de code, et les bilans passés restent recalculables
puisque chacun retient sa version de barème.

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
`Montant en retard`.

Les contrats et consentements partent en pièces jointes via l'API de contenu
d'Airtable (base64), sans URL publique.

Secrets de la fonction : `AIRTABLE_TOKEN`, `AIRTABLE_BASE`, `AIRTABLE_TABLE`.

---

## Où on en est

**Fait** — socle et connexion · fiches clientes · Bilan Empreinte complet ·
programme et prix · cures successives avec guide et tenue facultatifs ·
échéancier daté avec états de retard, visibles sur la liste · séances et
moteur du jeu du jour · mensurations avec courbe · notes entre thérapeutes ·
contrats et consentements signés, avec lecture obligatoire avant signature ·
synchronisation Airtable complète, PDF en pièces jointes compris ·
archivage réversible et suppression définitive (direction) · accès au
parcours audio avec mot de passe donné au comptoir · stock et ventes de
compléments, la vente décomptant le rayon toute seule · **parrainage**, avec
séances offertes reportées sur la cure suivante.

**Tout est vérifié en conditions réelles** : fiches, bilan, cure, contrat,
consentements, synchro Airtable et parcours audio fonctionnent. Le stock,
lui, n'a été vu que sur des données factices : il attend la migration 015.

**Reste à faire**

- Envoi du contrat par email : la fonction `envoyer-contrat` est écrite mais
  pas déployée. Demande un compte Resend avec `mabeautyplus.fr` vérifié et le
  secret `RESEND_API_KEY`. **À arbitrer** : les documents arrivant désormais
  en pièces jointes dans Airtable, l'envoi peut aussi se faire depuis les
  automatisations Airtable — c'est peut-être plus simple que Resend.
- **Sécurité des fonctions SQL** : les fonctions `SECURITY DEFINER` reçoivent
  un `GRANT` à `service_role` ou `authenticated`, mais personne ne retire le
  droit implicite que PostgreSQL donne à `PUBLIC`. N'importe qui muni de la
  clé publique du site peut donc appeler `reclamer_taches_airtable` et vider
  la file de synchro en la marquant « en cours ». Aucune donnée cliente ne
  fuit ; la synchro, elle, s'arrêterait sans un mot. À refermer par une
  migration `REVOKE EXECUTE … FROM PUBLIC, anon` sur les six fonctions
  concernées (001, 010, 012, 014).
- **Vente des cosmétiques KOS** : ils sont au stock, mais aucune interface ne
  les vend. Une vente se note en sortie manuelle (« Ça sort »). Seuls les
  compléments se vendent depuis la fiche cliente.
- **Le parrainage sur le contrat** : les séances offertes s'ajoutent au suivi,
  mais le PDF du contrat n'en parle pas — il n'annonce que les séances
  facturées. À trancher : faut-il les y mentionner ?
- **Le parrainage dans Airtable** : ni le parrain ni les filleules ne
  remontent (champs à créer côté Airtable, puis fonction Edge à compléter).
- **Tableau de bord d'accueil** : aujourd'hui il ne montre que le nombre de
  fiches et l'état de la synchro. Il devrait montrer les échéances du jour,
  les retards, les séances à faire, les alertes de stock.
- Migration éventuelle de l'historique Firestore.
- Le dépôt est **public** : il contient le questionnaire Empreinte, les 60
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
  Trois causes déjà vues : migration non passée, fonction pas redéployée,
  secrets absents.
- **Code admin du podcast.** `ADMIN_CODE` de l'application Mon Parcours vaut
  `0000` : quatre chiffres, devinables en quelques secondes, et il ouvre la
  création de comptes, le déblocage d'étapes et le dépôt de fichiers. À
  remplacer par une phrase longue, côté Netlify (podcast) **et** côté secret
  `PODCAST_ADMIN_CODE` (V2), les deux doivent rester identiques.
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

## Déploiement

Dépôt : `Jobo92800/Th-rapeute-Appli-2026` (public pour l'instant — contient
le questionnaire Empreinte, les 60 jeux, les textes de contrat et la grille
tarifaire ; à repasser en privé). Netlify déploie automatiquement sur chaque
poussée. Variables à définir côté Netlify : `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`.

## Commandes

Trois choses ne passent **pas** par GitHub et se déploient à la main :
les migrations SQL, les fonctions Edge, et les champs Airtable.

```bash
npm run dev                     # développement
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

Migrations passées jusqu'à **016** incluse. Les **017** (parrainage) et
**018** (pastille de crédits sur la liste) sont écrites et attendent d'être
collées dans l'éditeur SQL, dans cet ordre.

Les migrations SQL se collent dans l'éditeur SQL de Supabase, dans l'ordre
des numéros. Elles sont rejouables sans risque.
