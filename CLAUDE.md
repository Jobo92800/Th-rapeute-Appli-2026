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
src/domain/        règles métier pures (tarification, empreinte, jeuDuJour, reglement, contrat)
src/services/      accès aux données (clientes, metier, contratPdf, consentementsPdf)
src/lib/           supabase, session
src/pages/         Accueil, Clientes, FicheCliente, NouveauBilan, Connexion
src/components/    bilan/, contrat/, fiche/, Layout
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
parcours audio avec mot de passe donné au comptoir.

**Tout est vérifié en conditions réelles** : fiches, bilan, cure, contrat,
consentements, synchro Airtable et parcours audio fonctionnent.

**Reste à faire**

- Envoi du contrat par email : la fonction `envoyer-contrat` est écrite mais
  pas déployée. Demande un compte Resend avec `mabeautyplus.fr` vérifié et le
  secret `RESEND_API_KEY`. **À arbitrer** : les documents arrivant désormais
  en pièces jointes dans Airtable, l'envoi peut aussi se faire depuis les
  automatisations Airtable — c'est peut-être plus simple que Resend.
- **Écran Stock** : le lien du menu existe mais mène à un écran vide. Le
  modèle Supabase de la V1 (`stock_products`, `stock_levels`,
  `stock_movements`) est bon, à reprendre tel quel dans le projet V2.
- **Ventes de compléments** reliées au décompte de stock : la table
  `ventes_complements` existe et n'a aucune interface. Les deux systèmes
  s'ignoraient dans la V1, ne pas refaire cette erreur.
- **Tableau de bord d'accueil** : aujourd'hui il ne montre que le nombre de
  fiches et l'état de la synchro. Il devrait montrer les échéances du jour,
  les retards, les séances à faire, les alertes de stock.
- **Compte à rebours des compléments** : règles d'épuisement reprises de la
  V1 (BURN et DETOX 15 jours par boîte, SKIN 30, SOS pas de calcul).
- Migration éventuelle de l'historique Firestore.
- Le dépôt est **public** : il contient le questionnaire Empreinte, les 60
  jeux, les textes de contrat et la grille tarifaire. À repasser en privé.
- `ADMIN_CODE` du podcast toujours à `0000`.

**Questions ouvertes**

- Tarif du Dôme : 39 € (V1) ou 59 € comme la Méthode ?
- Les compléments sont-ils inclus dans le montant de la cure ou vendus à part ?
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

Migrations passées jusqu'à **013** incluse.

Les migrations SQL se collent dans l'éditeur SQL de Supabase, dans l'ordre
des numéros. Elles sont rejouables sans risque.
