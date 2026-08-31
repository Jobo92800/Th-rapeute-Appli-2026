# MAbeautyplus V2 — Suivi client

Nouvelle application de suivi des clientes, construite autour du Bilan Empreinte
et de la grille à 59 € la séance.

L'ancienne application reste en service pendant la transition. Les deux
cohabitent sans se gêner : **une cliente est créée dans une seule des deux**.

---

## Mise en route

### 1. Variables d'environnement

```bash
cp .env.example .env
```

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` — ce sont celles du
projet Supabase **déjà utilisé** par l'application actuelle (Supabase →
Project Settings → API).

### 2. Base de données

Dans l'éditeur SQL de Supabase, exécuter les trois migrations **dans l'ordre** :

| Fichier | Ce qu'il crée |
|---|---|
| `supabase/migrations/001_referentiel.sql` | centres, comptes, thérapeutes, tarifs, table des jeux |
| `supabase/migrations/002_clientes_et_sync.sql` | fiches clientes et file d'attente Airtable |
| `supabase/migrations/003_jeux.sql` | les 60 jeux de la méthode |

Ces migrations sont **purement additives** : elles ne touchent à aucune table
utilisée par l'application actuelle (`stock_*`, `signed_contracts`,
`client_empreinte_bilans` restent intactes).

### 3. Comptes de centre

Un compte par centre. Dans Supabase → Authentication → Users → **Add user**,
créer les cinq comptes avec un mot de passe solide, puis les rattacher :

```sql
-- À adapter avec les adresses réellement créées.
insert into comptes_centre (user_id, centre_id, role)
select id, 'grau-du-roi', 'centre' from auth.users where email = 'graududroi@mabeautyplus.fr'
union all
select id, 'le-cres',     'centre' from auth.users where email = 'lecres@mabeautyplus.fr'
union all
select id, 'serignan',    'centre' from auth.users where email = 'serignan@mabeautyplus.fr'
union all
select id, 'cabestany',   'centre' from auth.users where email = 'cabestany@mabeautyplus.fr'
union all
select id, 'avignon',     'centre' from auth.users where email = 'avignon@mabeautyplus.fr'
on conflict (user_id) do update set centre_id = excluded.centre_id;

-- Compte direction : accès à tous les centres.
insert into comptes_centre (user_id, centre_id, role)
select id, null, 'direction' from auth.users where email = 'contact@mabeautyplus.fr'
on conflict (user_id) do update set role = 'direction', centre_id = null;
```

### 4. Lancer

```bash
npm install
npm run dev
```

---

## Ce qui est en place

- **Connexion par centre.** Le centre découle du compte : plus de choix libre
  dans l'URL comme dans la V1. Un compte direction voit les cinq centres et
  bascule de l'un à l'autre.
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
