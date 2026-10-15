/*
  MAbeautyplus V2 — Migration 079 : le bilan offert en promotion

  POURQUOI UN TROISIÈME CAS, PLUTÔT QUE DE RÉUTILISER « offert ».

  Jonathan ouvre une promotion : le BioPortrait est offert, même quand la
  cliente ne prend pas de cure (14 octobre 2026). Jusqu'ici un bilan avait
  trois états et deux seulement s'écrivaient à la sortie du rendez-vous —
  `facture`, quand elle repart sans cure et règle ses 129 €, et `offert`,
  qui voulait dire UNE seule chose : « le bilan est dans la cure qu'elle
  vient de signer, on ne le facture pas deux fois ». C'est aussi ce qu'un
  point de suivi écrit, pour la même raison : rien n'est vendu ce jour-là.

  Ranger la promotion sous `offert` aurait fait mentir deux écrans.

    — SUR LA FICHE, un bilan `offert` affiche « Bilan offert — elle a
      démarré son accompagnement ». C'est vrai des deux cas existants. Ce
      serait faux de la promotion, et faux au pire endroit : la phrase qu'on
      lit avant de la rappeler.

    — DANS LA LISTE DES CLIENTES, la colonne Règlement signale d'une
      pastille celle qui a fait un bilan sans prendre de cure — c'est elle
      qu'on relance. Elle se cherche sur `facturation = 'facture'`, et une
      cliente de la promotion n'aurait rien porté du tout : la colonne
      aurait dit « — », et elle se serait perdue au milieu de celles qui
      n'ont jamais rien fait. Or ce sont précisément les clientes de la
      promotion qu'on veut rappeler.

  `offert_promo` dit donc ce qui s'est passé, et les deux écrans n'ont plus
  à le deviner. Même parti pris que partout ailleurs ici : NOMMER LE CAS
  QU'ON VEUT, jamais le déduire en excluant ceux qu'on connaît.

  CE QUE ÇA NE CHANGE PAS.

  L'argent : zéro euro, comme `offert`. Le tableau de bord ne somme que les
  bilans `facture` (028 puis 054), un bilan offert n'y entre donc pas, et le
  champ « Bilan seul » du CRM reçoit 0 €. Le BioPortrait et le récapitulatif
  partent comme pour « Bilan seul » — elle repart avec son document et la
  proposition qu'on vient de lui présenter. Aucune cure n'est ouverte.

  LA PROMOTION EST TEMPORAIRE, CETTE VALEUR NE L'EST PAS. Le jour où elle
  s'arrête, on retire le bouton de l'écran et les bilans déjà enregistrés
  gardent leur état : ils disent qu'ils ont été offerts à ce moment-là, et
  c'est ce qu'on voudra relire. Rien à défaire en base.

  Sans danger, rejouable autant de fois que nécessaire.
*/

BEGIN;

ALTER TABLE bilans DROP CONSTRAINT IF EXISTS bilans_facturation_check;

ALTER TABLE bilans ADD CONSTRAINT bilans_facturation_check
  CHECK (facturation IN ('en_attente', 'facture', 'offert', 'offert_promo'));

COMMENT ON COLUMN bilans.facturation IS
  'en_attente : rien n''est tranché. facture : la cliente ne démarre pas et '
  'règle son bilan. offert : il est compris dans la cure qu''elle signe, ou '
  'c''est un point de suivi — rien n''est vendu ce jour-là. offert_promo : '
  'offert en promotion alors qu''elle ne prend pas de cure (079).';

COMMIT;

-- Contrôle : la contrainte accepte les quatre états, et elle en refuse un
-- cinquième. Doit répondre « ok ».
SELECT
  CASE
    WHEN pg_get_constraintdef(oid) LIKE '%offert_promo%' THEN 'ok'
    ELSE '>>> la contrainte n''a pas été reprise'
  END AS etat,
  pg_get_constraintdef(oid) AS contrainte
FROM pg_constraint
WHERE conrelid = 'bilans'::regclass AND conname = 'bilans_facturation_check';
