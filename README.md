# MAbeautyplus V2 — Suivi client

Nouvelle application de suivi des clientes, construite autour du Bilan Empreinte
et de la grille à 59 € la séance.

L'ancienne application reste en service pendant la transition. Les deux
cohabitent sans se gêner : **une cliente est créée dans une seule des deux**.

Les données de l'ancienne application vivent ailleurs et ne sont pas touchées :
les fiches clientes sur **Firebase** (projet « MAbeautyplus CRM »), le stock et
les contrats signés sur le **Supabase géré par Bolt**. La V2 part sur un projet
Supabase neuf qui n'appartient qu'à elle.

---

## Mise en route

### 1. Variables d'environnement

```bash
cp .env.example .env
```

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` — celles du projet
Supabase **créé pour la V2** (Supabase → Project Settings → API).

### 2. Base de données

Dans l'éditeur SQL de Supabase, exécuter les trois migrations **dans l'ordre** :

| Fichier | Ce qu'il crée |
|---|---|
| `supabase/migrations/001_referentiel.sql` | centres, comptes, thérapeutes, tarifs, table des jeux |
| `supabase/migrations/002_clientes_et_sync.sql` | fiches clientes et file d'attente Airtable |
| `supabase/migrations/003_jeux.sql` | les 60 jeux de la méthode |
| `supabase/migrations/004_comptes_par_therapeute.sql` | un compte de connexion par thérapeute |

Le projet est neuf : ces migrations créent l'intégralité du schéma et
n'entrent en conflit avec rien.

### 3. Comptes de connexion

**Une adresse par thérapeute**, pas une par centre : on sait ainsi qui a créé
chaque fiche et réalisé chaque séance.

Les adresses proposées sont déjà inscrites dans la table `therapeutes`
(colonne `email`) — modifiables si tu préfères d'autres.

Dans Supabase → Authentication → Users → **Add user**, créer le compte avec
l'adresse voulue, en cochant **Auto Confirm User**. Puis exécuter
`supabase/rattacher_les_comptes.sql` dans l'éditeur SQL : il relie les comptes
aux thérapeutes par leur email et affiche qui peut se connecter.

Ce script est rejouable : relance-le à chaque compte ajouté.

Une thérapeute sans compte reste sélectionnable sur les fiches, elle ne peut
simplement pas se connecter. Inutile donc de tout créer d'un coup.

### 4. Lancer

```bash
npm install
npm run dev
```

---

## Ce qui est en place

- **Connexion par thérapeute.** Le centre découle du compte : plus de choix
  libre dans l'URL comme dans la V1. Un compte direction voit les cinq centres
  et bascule de l'un à l'autre.
- **Traçabilité.** Chaque fiche retient qui l'a créée. À la création d'une
  cliente, la thérapeute connectée est cochée d'office.
- **Cloisonnement réel.** Les politiques d'accès Postgres filtrent par centre.
  Une session d'un centre ne peut ni lire ni écrire les fiches d'un autre.
- **Fiches clientes.** Création, modification, archivage. L'âge se déduit de la
  date de naissance. Les homonymes sont signalés sans bloquer la création.
- **File d'attente Airtable.** Toute création ou modification de fiche alimente
  la table `airtable_sync`. L'état d'envoi est visible sur la fiche et sur
  l'accueil. La fonction serveur qui dépile cette file arrive avec le lot 1b.

## Ce qui arrive ensuite

| Lot | Contenu |
|---|---|
| 1b | Fonction Edge de synchronisation Airtable |
| 2 | Bilan Empreinte : questionnaire, InBody, scoring serveur, restitution, PDF |
| 3 | Programme, prix, échéancier 4× / 10× Alma, contrat et consentements |
| 4 | Séances, moteur du jeu du jour, mensurations |
| 5 | Compléments alimentaires reliés au stock, tableau de bord complet |

---

## Repères techniques

- **Vite · React 18 · TypeScript · Tailwind · TanStack Query · Supabase.**
- `src/domain/` contient les règles métier pures, testables et sans dépendance à
  l'interface — à commencer par `tarification.ts`.
- Aucun prix n'est écrit en dur : ils vivent dans la table `tarifs`, datés. Un
  programme copie le prix en vigueur au moment de sa validation, pour que les
  cures passées ne changent jamais de montant.
- Le jeton Airtable **ne doit jamais** arriver dans le navigateur. Il vit en
  secret de fonction Edge (Supabase → Edge Functions → Secrets).
