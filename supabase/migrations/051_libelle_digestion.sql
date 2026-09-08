/*
  MAbeautyplus V2 — Migration 051 : un libellé de réponse plus juste

  « Constipation, sensation de lourdeur » devient
  « Constipation / Diarrhée / Ventre gonflé ».

  La question du transit ne couvrait qu'un sens du désordre. Une cliente
  sujette à la diarrhée ne se reconnaissait dans aucune des trois réponses
  et cochait « Réguliers », ce qui effaçait un terrain digestif que le
  BioPortrait aurait dû voir.

  CE QUI NE CHANGE PAS. Ni les points, ni les prestations, ni l'ordre des
  options : cette réponse vaut toujours 3 points de terrain Digestif et
  2 points de pressodynamie. Seul le texte affiché bouge.

  POURQUOI ON MODIFIE LA VERSION 3 AU LIEU D'EN CRÉER UNE QUATRIÈME.

  Un bilan retient sa version de barème pour rester recalculable, et c'est
  pour ça qu'on ne touche jamais aux points d'une version livrée. Ici, rien
  de calculable ne bouge : les réponses sont enregistrées par leur RANG, pas
  par leur texte, et le rang 2 reste le rang 2. Créer une version 4 pour un
  libellé obligerait à reporter les 28 questions et leurs barèmes, avec le
  risque d'erreur que ça comporte, pour un mot.

  Le SEUL effet de bord assumé : un bilan passé, réaffiché aujourd'hui,
  montrera le nouveau texte en face de l'ancienne réponse. La réponse reste
  la bonne — c'est le même trouble digestif, dit plus largement.

  LA MIGRATION 036 EST CORRIGÉE EN MÊME TEMPS.

  Le banc d'essai lit le barème dans le fichier de la 036, pas dans la base :
  laisser les deux diverger reviendrait à tester un questionnaire qui ne
  tourne nulle part. Les deux chemins convergent donc — une base déjà
  installée est rattrapée par ce script, une base neuve part de la 036
  corrigée — et rejouer celui-ci n'a alors plus aucun effet, sa clause
  portant sur la question et non sur la réponse.
*/

UPDATE bareme_empreinte
   SET contenu = jsonb_set(
         contenu,
         '{STEPS,16,o,2,0}',
         '"Constipation / Diarrhée / Ventre gonflé"'::jsonb
       )
 WHERE version = 3
   AND contenu #>> '{STEPS,16,t}' = 'Votre digestion / transit :';

/*
  Contrôle : doit renvoyer la question, ses trois réponses dans l'ordre, et
  la troisième portant le nouveau texte. Si la question n'est pas la bonne,
  l'UPDATE ci-dessus n'a rien fait — sa clause le garantit — et ce contrôle
  le montrera.
*/
SELECT
  contenu #>> '{STEPS,16,t}'   AS question,
  contenu #>> '{STEPS,16,o,0,0}' AS reponse_1,
  contenu #>> '{STEPS,16,o,1,0}' AS reponse_2,
  contenu #>> '{STEPS,16,o,2,0}' AS reponse_3,
  contenu #>> '{STEPS,16,o,2,1}' AS points_axes,
  contenu #>> '{STEPS,16,o,2,2}' AS points_prestations
FROM bareme_empreinte
WHERE version = 3;
