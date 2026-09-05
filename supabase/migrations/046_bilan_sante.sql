/*
  MAbeautyplus V2 — Migration 046 : le bilan santé de la fiche

  OÙ ÇA VIT, ET POURQUOI LÀ.

  Sur la CLIENTE, pas sur le bilan. Un bilan est daté : il fige des réponses
  à un instant donné, et on ne le rouvre plus. La santé, elle, bouge — une
  hypertension apparaît, une grossesse commence et se termine, un traitement
  change. Ce qu'il faut avoir sous les yeux avant une séance, c'est l'état
  d'aujourd'hui, pas celui du jour du bilan. Même raisonnement que l'exception
  cure : un seul état, remplacé, jamais un fil qu'il faudrait remonter.

  CE QUE ÇA N'EST PAS.

  Ce n'est pas une contre-indication. Les contre-indications viennent des
  deux questions de santé du questionnaire et retirent un soin de la
  prescription ; celles-là sont calculées et personne ne les contourne. Ce
  formulaire-ci ne touche à rien : ni au BioPortrait, ni au barème, ni au
  prix. Il informe la thérapeute, c'est tout.

  Ce n'est pas non plus l'exception cure. Une consigne impérative — « pacemaker,
  pas d'électrostimulation » — se met en exception cure, où elle s'affiche en
  rouge quel que soit l'onglet ouvert. Ici, on note un contexte de santé, pas
  une alerte.

  POURQUOI DU JSONB.

  Quatorze champs qui ne se croisent jamais, qu'on ne trie pas, qu'on
  n'additionne pas et qu'on ne cherche pas : quatorze colonnes coûteraient
  une migration à chaque question ajoutée, pour aucun bénéfice. Le jour où
  l'on voudra compter les clientes hypertendues, `sante->>'hypertension'`
  suffira.

  Ce champ ne part PAS dans Airtable. Le déclencheur de synchro ne s'arme que
  sur des colonnes nommées, et celle-ci n'y est pas — c'est voulu : ce sont
  des données de santé, elles restent dans l'application. À rouvrir si la
  direction le demande explicitement.
*/

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS sante        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sante_maj_le timestamptz;

COMMENT ON COLUMN clientes.sante IS
  'Bilan santé complémentaire, saisi sur l''onglet BioPortrait. Sept oui/non '
  '(hypertension, diabete, renale, epilepsie, enceinte, stress, retention) et '
  'sept champs libres (thyroide, hormones, transit, maladie, intolerance, '
  'bariatrique, medicaments). N''entre dans aucun calcul.';

COMMENT ON COLUMN clientes.sante_maj_le IS
  'Dernière mise à jour du bilan santé. Une santé notée il y a deux ans '
  'ne se lit pas comme une santé notée la semaine dernière.';
