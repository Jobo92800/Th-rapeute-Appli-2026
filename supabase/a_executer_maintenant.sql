/*
  MAbeautyplus V2 — Réparation des accents

  Le presse-papiers du Mac a annoncé le texte dans un encodage non-UTF-8 :
  « Le Crès » est arrivé en base sous la forme « Le Cr√®s ».

  Ce script réécrit tous les textes accentués en se basant sur les
  identifiants techniques (id, code, email), qui eux ne contiennent aucun
  accent et sont donc restés intacts.

  Sans danger, rejouable autant de fois que nécessaire.
*/

-- 1. CENTRES ----------------------------------------------------------------

UPDATE centres SET nom = v.nom, adresse = v.adresse, code_postal = v.cp, ville = v.ville,
       siege_adresse = v.sa, siege_code_postal = v.scp, siege_ville = v.sv, nom_airtable = v.na
FROM (VALUES
  ('grau-du-roi', 'Le Grau-du-Roi', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Grau-du-Roi'),
  ('le-cres', 'Le Crès', '1 Avenue des Chasseurs', '34920', 'Le Crès', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Le Crès'),
  ('serignan', 'Sérignan', '120 Avenue de la Plage', '34410', 'Sérignan', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Sérignan'),
  ('cabestany', 'Cabestany', '4 Rue Ambroise Croizat', '66330', 'Cabestany', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Cabestany'),
  ('avignon', 'Avignon', '8 Bd de la Fraternité', '84140', 'Avignon', '577 Rue des Tamaris', '30240', 'Le Grau-du-Roi', 'Avignon')
) AS v(id, nom, adresse, cp, ville, sa, scp, sv, na)
WHERE centres.id = v.id;

-- 2. THÉRAPEUTES (rattachées par leur email, qui est sans accent) ------------

UPDATE therapeutes SET prenom = v.prenom
FROM (VALUES
  ('marie@mabeautyplus.fr', 'Marie'),
  ('fanny@mabeautyplus.fr', 'Fanny'),
  ('nadia@mabeautyplus.fr', 'Nadia'),
  ('stephanie@mabeautyplus.fr', 'Stéphanie'),
  ('alexandra.lecres@mabeautyplus.fr', 'Alexandra'),
  ('paola@mabeautyplus.fr', 'Paola'),
  ('malvina@mabeautyplus.fr', 'Malvina'),
  ('flora@mabeautyplus.fr', 'Flora'),
  ('caroll@mabeautyplus.fr', 'Caroll'),
  ('aude@mabeautyplus.fr', 'Aude'),
  ('marie-san@mabeautyplus.fr', 'Marie-san'),
  ('audrey@mabeautyplus.fr', 'Audrey'),
  ('sara@mabeautyplus.fr', 'Sara'),
  ('alexandra.cabestany@mabeautyplus.fr', 'Alexandra C'),
  ('marine@mabeautyplus.fr', 'Marine'),
  ('alexandra.avignon@mabeautyplus.fr', 'Alexandra 2'),
  ('laura@mabeautyplus.fr', 'Laura'),
  ('direction@mabeautyplus.fr', 'Direction')
) AS v(email, prenom)
WHERE therapeutes.email = v.email;

-- 3. TARIFS -----------------------------------------------------------------

UPDATE tarifs SET libelle = v.libelle
FROM (VALUES
  ('seance', 'Séance de 30 minutes intégrée à l''accompagnement'),
  ('guide', 'Guide de rééquilibrage alimentaire — systématique'),
  ('tenue', 'Tenue I-Shape — si électrostimulation'),
  ('bilan', 'Bilan Empreinte seul — offert si démarrage'),
  ('dome', 'Séance de Dôme (à confirmer : 39 € ou 59 €)')
) AS v(code, libelle)
WHERE tarifs.code = v.code;

-- 4. LES 60 JEUX ------------------------------------------------------------
--    Réécriture complète : c'est le texte le plus riche en accents.

INSERT INTO jeux (
  code, phase, etape, theme, titre, materiel, objectif, regles,
  phrase_lancement, mission, duree, options, a_enregistrer, action_cliente,
  prise_conscience, resultat, petit_pas, ordre
) VALUES
  ('A01', 'A', 3, 'Priorité de départ', 'Ma priorité de la semaine', '6 cartes à poser : REPAS · GRIGNOTAGES / ENVIES · HYDRATATION · SOMMEIL · STRESS · MOUVEMENT', 'Choisir le sujet qui servira de fil rouge jusqu’au prochain rendez-vous.', '["Poser les 6 cartes devant la cliente.", "Lui demander d’en choisir UNE.", "Demander : « Qu’est-ce qui est le plus difficile pour vous dans ce sujet ? »"]'::jsonb, 'Parmi ces 6 sujets, lequel voulez-vous améliorer en premier cette semaine ?', 'Repérer 3 moments où cette difficulté apparaît cette semaine, sans chercher à la corriger.', '3 min', '["🍽️ REPAS", "🍪 GRIGNOTAGES / ENVIES", "💧 HYDRATATION", "🌙 SOMMEIL", "⚡ STRESS", "🚶 MOUVEMENT"]'::jsonb, 'Enregistrer la priorité choisie. Ex. : Grignotages / envies.', 'Choisit 1 carte parmi 6 : le sujet qu’elle veut améliorer en premier.', 'Elle identifie clairement sa priorité du moment.', 'Cette priorité devient le fil rouge jusqu’au prochain rendez-vous.', 'Observer simplement 3 moments où cette difficulté apparaît.', 1),
  ('A02', 'A', 3, 'Organisation', 'Reset : ma semaine 1', 'Plateau semaine + 6 jetons', 'Repérer les moments de la semaine à simplifier en priorité.', '["Poser les jetons sur les moments compliqués.", "Choisir les 2 plus difficiles.", "Trouver une simplification pour chacun."]'::jsonb, 'Montrez-moi les moments où votre semaine devient la plus compliquée.', 'Préparer 2 repas simples à l’avance.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons sur les moments de la semaine où ses repas deviennent compliqués.', 'Elle voit quand son organisation lui fait perdre ses repères.', 'On choisit 1 moment précis à simplifier cette semaine.', 'Préparer 2 repas simples à l’avance.', 2),
  ('A03', 'A', 3, 'Hydratation', 'Combien je bois vraiment ?', 'Jauge + pince', 'Comparer l’impression de boire avec la quantité réellement consommée.', '["Estimer sa quantité d’eau.", "Placer la pince sur la jauge.", "Comparer avec ce qui est réellement bu."]'::jsonb, 'À votre avis, combien buvez-vous vraiment dans une journée ?', 'Mesurer réellement pendant 24 h.', '3–5 min', '[]'::jsonb, '', 'Place une pince sur la quantité d’eau qu’elle pense boire dans une journée.', 'Elle visualise concrètement son niveau d’hydratation.', 'Elle repart avec un repère simple à vérifier pendant 24 h.', 'Mesurer réellement pendant 24 h.', 3),
  ('A04', 'A', 3, 'Alimentation', 'Mon assiette repère', 'Assiette A5 + cartes aliments', 'Construire un repère visuel simple pour les repas.', '["Composer un repas habituel.", "Repérer ce qui manque.", "Construire son assiette repère."]'::jsonb, 'Composez-moi un repas comme vous le feriez chez vous.', 'Reproduire l’assiette repère sur 3 repas.', '3–5 min', '[]'::jsonb, '', 'Compose un repas habituel avec les cartes aliments.', 'Elle voit immédiatement ce qui manque ou prend trop de place.', 'On construit ensemble une assiette repère simple à reproduire.', 'Reproduire l’assiette repère sur 3 repas.', 4),
  ('A05', 'A', 3, 'Comportements', 'Faim ou envie ?', '2 cartes FAIM / ENVIE', 'Apprendre à distinguer une faim physique d’une envie de manger.', '["Penser à un grignotage récent.", "Choisir FAIM ou ENVIE.", "Expliquer le choix en une phrase."]'::jsonb, 'Pensez à votre dernier grignotage : c’était plutôt de la faim ou une envie ?', 'Se poser la question avant 1 grignotage.', '3–5 min', '[]'::jsonb, '', 'Choisit FAIM ou ENVIE pour un grignotage récent.', 'Elle apprend à distinguer besoin physique et envie de manger.', 'Elle sait quelle question se poser avant un prochain grignotage.', 'Se poser la question avant 1 grignotage.', 5),
  ('A06', 'A', 3, 'Alimentation', 'Le puzzle protéines', 'Cartes aliments + 3 cartes repas', 'Repérer où ajouter une source de protéines dans la journée.', '["Repérer les aliments protéinés.", "Les placer aux repas possibles.", "Choisir le repas le plus faible."]'::jsonb, 'Parmi ces aliments, lesquels pourraient renforcer vos repas ?', 'Ajouter une source adaptée au repas le plus faible.', '3–5 min', '[]'::jsonb, '', 'Place les cartes protéines sur ses repas habituels.', 'Elle repère le repas où une source de protéines manque le plus.', 'On choisit 1 ajout simple pour ce repas.', 'Ajouter une source adaptée au repas le plus faible.', 6),
  ('A07', 'A', 3, 'Alimentation', 'L’arc-en-ciel des végétaux', '6 cartes couleurs', 'Visualiser la variété végétale de la semaine.', '["Garder les couleurs consommées souvent.", "Repérer les couleurs absentes.", "Choisir une couleur à ajouter."]'::jsonb, 'Quelles couleurs retrouvez-vous le plus souvent dans vos repas ?', 'Ajouter 2 couleurs végétales dans la semaine.', '3–5 min', '[]'::jsonb, '', 'Choisit les couleurs végétales présentes dans ses repas habituels.', 'Elle visualise rapidement la variété de ses végétaux.', 'Elle choisit 1 couleur à ajouter cette semaine.', 'Ajouter 2 couleurs végétales dans la semaine.', 7),
  ('A08', 'A', 3, 'Alimentation', 'Mon petit-déjeuner', '3 cartes profil', 'Observer si le petit-déjeuner actuel correspond réellement à la faim de la cliente.', '["Choisir : pas faim / faim / faim rapide ensuite.", "Décrire un matin type.", "Choisir ce qu’on va observer."]'::jsonb, 'Au réveil, vous vous reconnaissez dans laquelle de ces trois situations ?', 'Observer faim au réveil et vers 11 h pendant 3 jours.', '3–5 min', '[]'::jsonb, '', 'Choisit la carte qui décrit le mieux son matin.', 'Elle observe le lien entre son petit-déjeuner et sa faim de fin de matinée.', 'On choisit un seul élément à observer pendant 3 matins.', 'Observer faim au réveil et vers 11 h pendant 3 jours.', 8),
  ('A09', 'A', 3, 'Comportements', 'Mon moment de grignotage', 'Frise journée + jetons', 'Repérer le moment où le grignotage revient le plus souvent.', '["Replacer 3 grignotages récents.", "Repérer la zone qui revient.", "Entourer le moment à surveiller."]'::jsonb, 'À quels moments vos grignotages arrivent-ils le plus souvent ?', 'Noter 3 situations cette semaine.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons aux heures de ses derniers grignotages.', 'Elle voit le créneau qui revient le plus souvent.', 'Ce créneau devient le moment à observer cette semaine.', 'Noter 3 situations cette semaine.', 9),
  ('A10', 'A', 3, 'Alimentation', 'Vrai ou faux : les sucres', '5 cartes question + VRAI/FAUX', 'Corriger quelques idées reçues simples sur les sucres.', '["Lire une carte.", "Choisir VRAI ou FAUX.", "Retourner la carte pour voir l’explication."]'::jsonb, 'On va tester quelques idées reçues en cinq cartes.', 'Choisir 1 source de sucre facile à réduire.', '3–5 min', '[]'::jsonb, '', 'Répond VRAI ou FAUX à 3 cartes.', 'Elle corrige une idée reçue simple sur les sucres.', 'Elle garde 1 seul repère utile à appliquer.', 'Choisir 1 source de sucre facile à réduire.', 10),
  ('A11', 'A', 3, 'Organisation', 'Mon panier express', '15 cartes aliments', 'Créer une base de courses simple pour plusieurs repas.', '["Choisir 8 aliments.", "Construire 3 repas avec.", "Vérifier que les 3 repas sont réalistes."]'::jsonb, 'Avec seulement huit aliments, créons trois repas faciles.', 'Faire sa prochaine liste de courses.', '3–5 min', '[]'::jsonb, '', 'Choisit 8 aliments et tente de former 3 repas simples.', 'Elle voit qu’une base de courses simple peut suffire.', 'Elle repart avec une mini-liste de courses réaliste.', 'Faire sa prochaine liste de courses.', 11),
  ('A12', 'A', 3, 'Environnement', 'Ce que je vois, je mange', 'Plan frigo/placard + cartes', 'Rendre l’environnement alimentaire plus favorable.', '["Placer les aliments très visibles chez soi.", "Repérer ce qui déclenche.", "Déplacer un élément."]'::jsonb, 'Qu’est-ce que vous voyez en premier quand vous ouvrez votre cuisine ?', 'Modifier réellement son environnement.', '3–5 min', '[]'::jsonb, '', 'Place les aliments selon ce qu’elle voit en premier chez elle.', 'Elle comprend l’effet de la visibilité sur ses choix.', 'Elle choisit 1 chose à déplacer dans sa cuisine.', 'Modifier réellement son environnement.', 12),
  ('A13', 'A', 3, 'Comportements', 'Mes déclencheurs', '6 cartes déclencheurs', 'Identifier le déclencheur principal des envies de manger.', '["Choisir les 3 plus fréquents.", "Les classer du plus fort au plus faible.", "Garder le n°1."]'::jsonb, 'Parmi ces déclencheurs, lesquels vous concernent le plus ?', 'Observer le déclencheur n°1 pendant 7 jours.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 carte déclencheur parmi 6.', 'Elle identifie ce qui déclenche le plus souvent ses envies de manger.', 'Ce déclencheur devient son point d’observation.', 'Observer le déclencheur n°1 pendant 7 jours.', 13),
  ('A14', 'A', 3, 'Comportements', 'La pause de 10 minutes', '3 cartes actions', 'Créer une petite pause entre l’envie et l’action automatique.', '["Choisir eau / bouger / changer d’activité.", "Imaginer un moment à risque.", "Décider laquelle tester."]'::jsonb, 'Si l’envie arrive ce soir, quelle pause serait la plus facile à tester ?', 'Tester la pause 1 fois.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 carte pause parmi 3.', 'Elle comprend qu’elle peut créer un délai avant un automatisme.', 'Elle choisit la pause qu’elle testera une fois.', 'Tester la pause 1 fois.', 14),
  ('A15', 'A', 3, 'Alimentation', 'Ma faim et ma satiété', 'Règle 0–10 + 2 pinces', 'Apprendre à situer la faim avant et la satiété après le repas.', '["Choisir un repas récent.", "Placer la faim avant.", "Placer la satiété après."]'::jsonb, 'Sur cette échelle, où étiez-vous avant et après votre dernier repas ?', 'Refaire l’exercice 1 fois par jour.', '3–5 min', '[]'::jsonb, '', 'Place 2 pinces : faim avant le repas, satiété après.', 'Elle visualise ses sensations autour du repas.', 'Elle repart avec l’échelle comme repère simple.', 'Refaire l’exercice 1 fois par jour.', 15),
  ('A16', 'A', 3, 'Alimentation', 'Au restaurant, je compose', 'Cartes menu', 'Garder des repères simples tout en conservant le plaisir.', '["Composer un repas qui fait envie.", "Vérifier faim et plaisir.", "Choisir 1 repère à conserver."]'::jsonb, 'Composez le restaurant qui vous ferait vraiment plaisir.', 'Utiliser ce repère au prochain restaurant.', '3–5 min', '[]'::jsonb, '', 'Compose un menu plaisir avec les cartes.', 'Elle voit qu’un restaurant peut rester compatible avec ses repères.', 'Elle choisit 1 repère à garder au prochain restaurant.', 'Utiliser ce repère au prochain restaurant.', 16),
  ('A17', 'A', 3, 'Organisation', 'Mon week-end réaliste', 'Cartes habitudes + samedi/dimanche', 'Éviter le tout-ou-rien du week-end.', '["Choisir 3 repères utiles.", "Les placer sur le week-end.", "Garder seulement ce qui est réaliste."]'::jsonb, 'Quelles habitudes pourriez-vous vraiment garder le week-end ?', 'En maintenir au moins 2.', '3–5 min', '[]'::jsonb, '', 'Choisit 2 habitudes qu’elle peut réellement garder le week-end.', 'Elle comprend qu’elle n’a pas besoin d’être parfaite.', 'Ces 2 habitudes deviennent ses repères du week-end.', 'En maintenir au moins 2.', 17),
  ('A18', 'A', 3, 'Hydratation', 'Mes rendez-vous avec l’eau', 'Cartes moments de journée', 'Associer l’hydratation à des moments faciles à retenir.', '["Choisir 3 moments faciles.", "Les mettre dans l’ordre.", "Associer un verre d’eau à chacun."]'::jsonb, 'À quels moments de votre journée pourriez-vous penser à boire sans effort ?', 'Tester pendant 3 jours.', '3–5 min', '[]'::jsonb, '', 'Place 3 cartes eau à des moments fixes de sa journée.', 'Elle associe l’hydratation à des habitudes déjà existantes.', 'Elle repart avec 3 rendez-vous hydratation simples.', 'Tester pendant 3 jours.', 18),
  ('A19', 'A', 3, 'Mouvement', 'Les occasions invisibles de bouger', 'Maison / trajet / travail', 'Trouver du mouvement sans devoir prévoir une séance de sport.', '["Trouver une petite occasion dans chaque univers.", "Choisir la plus facile.", "Fixer quand la faire."]'::jsonb, 'Où pourriez-vous bouger un peu plus sans bouleverser votre journée ?', 'Ajouter 10 min de mouvement sur 3 journées.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 occasion de bouger dans la maison, le trajet ou le travail.', 'Elle voit que bouger ne signifie pas forcément faire du sport.', 'Elle planifie 1 occasion réaliste de mouvement.', 'Ajouter 10 min de mouvement sur 3 journées.', 19),
  ('A20', 'A', 3, 'Progression', 'Mon premier mois', '8 cartes progrès', 'Faire le point sur les premiers changements et la suite.', '["Choisir 3 choses qui ont progressé.", "Choisir 1 chose encore difficile.", "En faire la priorité suivante."]'::jsonb, 'Qu’est-ce qui a déjà commencé à changer depuis le début ?', 'Renforcer ce levier au mois suivant.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 cartes progrès puis 1 priorité.', 'Elle voit ce qui a déjà changé depuis le début.', 'On choisit ensemble le prochain axe à renforcer.', 'Renforcer ce levier au mois suivant.', 20),
  ('B01', 'B', 4, 'Stress', 'Thermomètre du stress', 'Échelle 0–10 + pince', 'Identifier une action capable de faire baisser le stress d’un petit cran.', '["Placer son stress actuel.", "Demander : qu’est-ce qui ferait -1 ?", "Choisir une action."]'::jsonb, 'Où placez-vous votre stress aujourd’hui ?', 'Tester cette action.', '3–5 min', '[]'::jsonb, '', 'Place la pince sur son niveau de stress du jour.', 'Elle visualise son état au lieu de rester dans une impression vague.', 'Elle choisit 1 action qui pourrait faire baisser ce niveau d’un point.', 'Tester cette action.', 1),
  ('B02', 'B', 4, 'Sommeil', 'Mon sommeil en 5 cartes', '5 cartes sommeil', 'Choisir le levier de sommeil le plus facile à améliorer.', '["Trier en « ça va » / « à améliorer ».", "Choisir le plus accessible.", "Fixer un petit changement."]'::jsonb, 'Parmi ces cinq éléments, lequel serait le plus facile à améliorer ?', 'Changer 1 habitude du soir.', '3–5 min', '[]'::jsonb, '', 'Trie 5 cartes sommeil en « ça va » ou « à améliorer ».', 'Elle repère le levier le plus facile à améliorer.', 'Elle choisit 1 changement simple pour le soir.', 'Changer 1 habitude du soir.', 2),
  ('B03', 'B', 4, 'Énergie', 'Mon budget énergie', '10 jetons', 'Voir où part l’énergie et récupérer une petite place pour soi.', '["Répartir les jetons entre ses obligations.", "Observer où tout part.", "Récupérer 1 jeton pour soi."]'::jsonb, 'Si vous aviez dix jetons d’énergie, où partiraient-ils aujourd’hui ?', 'Créer un petit temps de récupération.', '3–5 min', '[]'::jsonb, '', 'Répartit 10 jetons entre ce qui lui prend de l’énergie.', 'Elle voit où part son énergie dans la journée.', 'Elle récupère 1 jeton pour une activité qui la recharge.', 'Créer un petit temps de récupération.', 3),
  ('B04', 'B', 4, 'Environnement', 'Ce qui m’aide / me freine', 'Cartes situations + 2 zones', 'Distinguer ce qui soutient les changements de ce qui les freine.', '["Trier AIDE / FREINE.", "Garder le frein principal.", "Chercher ce qui peut être modifié."]'::jsonb, 'Qu’est-ce qui vous aide vraiment, et qu’est-ce qui vous freine ?', 'Modifier 1 élément.', '3–5 min', '[]'::jsonb, '', 'Classe des cartes en AIDE ou FREINE.', 'Elle repère ce qui facilite ou sabote ses habitudes.', 'Elle choisit 1 frein concret à modifier.', 'Modifier 1 élément.', 4),
  ('B05', 'B', 4, 'Mouvement', 'Mes minutes invisibles', 'Frise journée + jetons 5 min', 'Trouver de petits moments réalistes pour réduire la sédentarité.', '["Chercher 3 moments disponibles.", "Poser les jetons.", "Garder les plus réalistes."]'::jsonb, 'Où se cachent trois petites fenêtres de cinq minutes dans votre journée ?', 'Faire 3 pauses actives.', '3–5 min', '[]'::jsonb, '', 'Place 3 jetons de 5 minutes dans sa journée.', 'Elle découvre de petits créneaux qu’elle ne voyait pas.', 'Elle choisit 1 créneau pour bouger ou récupérer.', 'Faire 3 pauses actives.', 5),
  ('B06', 'B', 4, 'Organisation', 'Ma semaine réaliste', 'Plateau semaine + 3 cartes objectif', 'Planifier une semaine faisable plutôt qu’une semaine parfaite.', '["Choisir alimentation / mouvement / bien-être.", "Placer une action de chaque.", "Vérifier que c’est faisable."]'::jsonb, 'Construisons une semaine que vous pourriez réellement tenir.', 'Réussir 2 objectifs sur 3.', '3–5 min', '[]'::jsonb, '', 'Place 3 actions réalistes sur sa semaine.', 'Elle voit qu’une bonne semaine n’a pas besoin d’être parfaite.', 'Elle ne garde que les actions qu’elle peut vraiment tenir.', 'Réussir 2 objectifs sur 3.', 6),
  ('B07', 'B', 4, 'Motivation', 'Mes 3 petits pas', 'Escalier 3 marches', 'Découper un objectif trop grand en trois petites étapes.', '["Choisir un objectif.", "Le découper en 3 étapes.", "Regarder uniquement la première."]'::jsonb, 'Quel objectif vous paraît trop gros aujourd’hui ?', 'Faire la marche n°1.', '3–5 min', '[]'::jsonb, '', 'Découpe 1 objectif en 3 petites marches.', 'Elle comprend qu’un grand changement se construit étape par étape.', 'Elle ne garde que la première marche à faire.', 'Faire la marche n°1.', 7),
  ('B08', 'B', 4, 'Comportements', 'Le scénario de mon automatisme', '4 cartes Situation / Ressenti / Action / Après', 'Comprendre la séquence qui mène à un automatisme alimentaire.', '["Reprendre un épisode réel.", "Remettre les 4 cartes dans l’ordre.", "Voir où intervenir."]'::jsonb, 'Reprenons un moment récent où vous avez mangé sans l’avoir vraiment décidé.', 'Modifier 1 étape du scénario.', '3–5 min', '[]'::jsonb, '', 'Remet 4 cartes dans l’ordre : situation → ressenti → action → après.', 'Elle voit comment son automatisme se construit.', 'On choisit l’étape la plus facile à modifier.', 'Modifier 1 étape du scénario.', 8),
  ('B09', 'B', 4, 'Alimentation', 'Mon plaisir au repas social', 'Apéro / plat / dessert / alcool', 'Choisir consciemment où mettre le plaisir lors d’un repas social.', '["Choisir ce qui compte vraiment.", "Garder 1 ou 2 plaisirs prioritaires.", "Décider consciemment."]'::jsonb, 'Dans un repas social, qu’est-ce qui vous fait vraiment plaisir ?', 'Faire ce choix au prochain repas social.', '3–5 min', '[]'::jsonb, '', 'Choisit ce qui lui fait vraiment plaisir dans un repas social.', 'Elle distingue plaisir choisi et accumulation automatique.', 'Elle garde 1 ou 2 plaisirs prioritaires.', 'Faire ce choix au prochain repas social.', 9),
  ('B10', 'B', 4, 'Progression', 'Mes preuves de progression', '8 cartes indicateurs', 'Voir les progrès qui ne se résument pas au poids.', '["Mettre le poids de côté un instant.", "Choisir 3 progrès visibles ailleurs.", "Garder celui qui compte le plus."]'::jsonb, 'Si on oublie la balance une minute, qu’est-ce qui s’est amélioré ?', 'Observer cet indicateur.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 cartes progrès qui ne parlent pas du poids.', 'Elle voit que les résultats ne se résument pas à la balance.', 'Elle garde 1 indicateur à suivre.', 'Observer cet indicateur.', 10),
  ('B11', 'B', 4, 'Habitudes', 'Ce que je fais déjà différemment', 'Cartes habitudes', 'Prendre conscience des habitudes déjà modifiées.', '["Choisir 3 habitudes modifiées.", "Donner un exemple réel.", "En choisir une à consolider."]'::jsonb, 'Qu’est-ce que vous faites aujourd’hui que vous ne faisiez pas au départ ?', 'Répéter volontairement l’habitude choisie.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 habitudes qu’elle fait déjà différemment.', 'Elle réalise qu’elle a déjà modifié son quotidien.', 'Elle choisit 1 habitude à consolider.', 'Répéter volontairement l’habitude choisie.', 11),
  ('B12', 'B', 4, 'Corps', 'Je comprends mon bilan', '9 cartes indicateurs', 'Aider la cliente à comprendre quelques indicateurs utiles de son suivi.', '["Retrouver les 3 indicateurs expliqués.", "Dire ce qu’ils signifient simplement.", "En choisir 1 à suivre."]'::jsonb, 'Parmi ces indicateurs, lesquels vous parlent maintenant le plus ?', 'Le comparer au prochain point.', '3–5 min', '[]'::jsonb, '', 'Associe 3 indicateurs du bilan à leur explication simple.', 'Elle comprend mieux ce que l’équipe suit avec elle.', 'Elle choisit 1 indicateur à revoir au prochain point.', 'Le comparer au prochain point.', 12),
  ('B13', 'B', 4, 'Après 50 ans', 'Ce qui a changé avec les années', 'Roue 6 axes', 'Identifier les changements ressentis et choisir une adaptation réaliste.', '["Choisir 2 axes.", "Dire ce qui a changé.", "Trouver une adaptation réaliste."]'::jsonb, 'Sur quels sujets sentez-vous le plus de différence par rapport à il y a quelques années ?', 'Tester cette adaptation.', '3–5 min', '[]'::jsonb, '', 'Choisit 2 domaines qui ont changé avec les années.', 'Elle met des mots sur ce qui a évolué dans son quotidien.', 'On choisit 1 adaptation réaliste, sans poser de diagnostic.', 'Tester cette adaptation.', 13),
  ('B14', 'B', 4, 'Après 50 ans', 'Je protège ma masse musculaire', 'Cartes AIDE / AIDE PEU', 'Relier mouvement et repères alimentaires au maintien musculaire.', '["Trier les habitudes.", "Choisir 1 action mouvement.", "Choisir 1 repère alimentaire."]'::jsonb, 'Parmi ces habitudes, lesquelles vous semblent les plus protectrices ?', 'Tester les deux repères.', '3–5 min', '[]'::jsonb, '', 'Trie les habitudes qui soutiennent le maintien de la masse musculaire.', 'Elle repère les comportements qu’elle peut renforcer au quotidien.', 'Elle choisit 1 habitude à renforcer cette semaine.', 'Tester les deux repères.', 14),
  ('B15', 'B', 4, 'Mouvement', 'Mon mouvement préféré', '6 cartes activités', 'Choisir une activité à la fois agréable et faisable.', '["Classer par envie.", "Classer par facilité.", "Garder celle qui arrive en tête des deux."]'::jsonb, 'Qu’est-ce qui vous donne envie et reste facile à mettre dans votre semaine ?', 'La faire 2 fois.', '3–5 min', '[]'::jsonb, '', 'Classe 6 activités selon son envie de les faire.', 'Elle identifie le mouvement qu’elle a le plus de chance de refaire.', 'Elle choisit 1 activité réaliste.', 'La faire 2 fois.', 15),
  ('B16', 'B', 4, 'Hydratation', 'Le défi bouteille', 'Jauge bouteille', 'Rendre l’objectif d’hydratation visible au fil de la journée.', '["Placer 3 repères sur la bouteille.", "Associer chacun à un moment.", "Garder la jauge visible."]'::jsonb, 'Plaçons trois repères faciles à suivre sur votre journée.', 'Tester 3 jours.', '3–5 min', '[]'::jsonb, '', 'Place 3 repères sur une bouteille.', 'Elle visualise sa journée d’hydratation d’un coup d’œil.', 'La bouteille devient son repère pendant 3 jours.', 'Tester 3 jours.', 16),
  ('B17', 'B', 4, 'Alimentation', 'Les 5 sens à table', '5 cartes sens', 'Ralentir le repas en portant attention aux sensations.', '["Tirer 2 cartes sens.", "Les utiliser sur les premières bouchées.", "Décrire ce qu’on remarque."]'::jsonb, 'Choisissez deux sens à observer au prochain repas.', 'Refaire sur 1 repas.', '3–5 min', '[]'::jsonb, '', 'Tire 2 cartes sens et observe les premières bouchées avec ces sens.', 'Elle ralentit et remarque davantage son repas.', 'Elle choisit 1 sens à réutiliser sur un prochain repas.', 'Refaire sur 1 repas.', 17),
  ('B18', 'B', 4, 'Alimentation', 'Ma vitesse de repas', 'Rapide / moyen / lent', 'Identifier sa vitesse de repas et tester un ralentissement simple.', '["Choisir sa vitesse habituelle.", "Identifier quand elle accélère.", "Choisir une façon de ralentir."]'::jsonb, 'Vous mangez plutôt rapidement, normalement ou lentement ?', 'Faire une pause à mi-repas.', '3–5 min', '[]'::jsonb, '', 'Choisit RAPIDE, MOYEN ou LENT pour un repas habituel.', 'Elle prend conscience de sa vitesse de repas.', 'Elle choisit 1 geste simple pour ralentir.', 'Faire une pause à mi-repas.', 18),
  ('B19', 'B', 4, 'Alimentation', 'Portions sans balance', 'Main / paume / poing / pouce', 'Utiliser des repères visuels simples plutôt qu’une pesée permanente.', '["Associer les cartes aux familles d’aliments.", "Vérifier ensemble.", "Choisir le repère le plus utile."]'::jsonb, 'Associons ces repères de la main aux différents aliments.', 'Tester sur 2 repas.', '3–5 min', '[]'::jsonb, '', 'Associe paume, poing et pouce aux familles d’aliments.', 'Elle apprend des repères visuels simples sans balance.', 'Elle garde 1 repère utile pour ses repas.', 'Tester sur 2 repas.', 19),
  ('B20', 'B', 4, 'Alimentation', 'Les bons duos', 'Cartes à associer', 'Créer des associations simples qui rendent les repas plus complets.', '["Former les paires qui vont bien ensemble.", "Vérifier les associations.", "Choisir 2 duos adaptés."]'::jsonb, 'Quelles paires pourriez-vous facilement reproduire chez vous ?', 'Reproduire les 2 duos.', '3–5 min', '[]'::jsonb, '', 'Associe les cartes qui forment des duos simples.', 'Elle comprend comment compléter facilement un repas.', 'Elle garde 2 duos faciles à reproduire.', 'Reproduire les 2 duos.', 20),
  ('B21', 'B', 4, 'Micronutrition', 'Vrai ou faux micronutrition', 'Cartes V/F validées', 'Consolider quelques repères éducatifs validés en formation interne.', '["Tirer 3 cartes.", "Répondre VRAI ou FAUX.", "Lire l’explication courte."]'::jsonb, 'Trois cartes seulement : voyons quels repères vous avez retenus.', 'Retenir 1 seul repère.', '3–5 min', '[]'::jsonb, '', 'Répond VRAI ou FAUX à 3 cartes.', 'Elle vérifie un repère de micronutrition validé.', 'Elle ne garde qu’1 message utile à retenir.', 'Retenir 1 seul repère.', 21),
  ('B22', 'B', 4, 'Confiance', 'Je sors du « tout est foutu »', 'Phrase automatique / nouvelle phrase', 'Remplacer une pensée décourageante par une formulation plus utile.', '["Choisir une phrase qu’elle se dit souvent.", "Trouver une formulation plus utile.", "Lire la nouvelle à voix haute."]'::jsonb, 'Quelle phrase vous dites-vous quand vous avez l’impression d’avoir raté ?', 'Réutiliser la nouvelle phrase 3 fois.', '3–5 min', '[]'::jsonb, '', 'Choisit une phrase décourageante et la remplace par une phrase plus utile.', 'Elle voit l’effet du tout-ou-rien sur sa motivation.', 'Elle repart avec sa nouvelle phrase.', 'Réutiliser la nouvelle phrase 3 fois.', 22),
  ('B23', 'B', 4, 'Énergie', 'Ma batterie', 'Batterie 0–100 + cartes', 'Voir ce qui recharge et ce qui vide l’énergie.', '["Indiquer son niveau.", "Choisir ce qui recharge et ce qui vide.", "Ajouter une petite recharge."]'::jsonb, 'À combien est votre batterie aujourd’hui ?', 'Faire 10 min de recharge.', '3–5 min', '[]'::jsonb, '', 'Place sa batterie sur 0–100 puis choisit 1 recharge.', 'Elle prend conscience de son niveau d’énergie.', 'Elle planifie 10 minutes de récupération.', 'Faire 10 min de recharge.', 23),
  ('B24', 'B', 4, 'Récupération', 'Ma journée de récupération', 'Matin / midi / soir + cartes pause', 'Insérer de petites récupérations dans une journée chargée.', '["Choisir 2 moments difficiles.", "Placer une micro-pause.", "Décider exactement quand."]'::jsonb, 'Où auriez-vous le plus besoin d’une petite coupure dans votre journée ?', 'Tester les 2 pauses.', '3–5 min', '[]'::jsonb, '', 'Place 1 carte pause dans le moment le plus difficile de sa journée.', 'Elle voit où une courte récupération pourrait l’aider.', 'Elle planifie cette pause à un moment précis.', 'Tester les 2 pauses.', 24),
  ('B25', 'B', 4, 'Progression', 'Checkpoint milieu de cure', 'Puzzle 6 pièces', 'Faire le point à mi-parcours et choisir les priorités de la suite.', '["Poser les 6 domaines.", "Choisir les 2 plus solides.", "Choisir les 2 à renforcer."]'::jsonb, 'Qu’est-ce qui est devenu solide, et qu’est-ce qui mérite encore du travail ?', 'Les 2 priorités deviennent le fil conducteur suivant.', '3–5 min', '[]'::jsonb, '', 'Classe 6 domaines en SOLIDE ou À RENFORCER.', 'Elle voit clairement où elle en est à mi-parcours.', 'On garde 2 priorités pour la suite.', 'Les 2 priorités deviennent le fil conducteur suivant.', 25),
  ('C01', 'C', 5, 'Progression', 'Mes 5 victoires', '5 cartes trophée', 'Terminer le parcours en visualisant cinq changements importants.', '["Choisir 5 changements dont elle est fière.", "Donner un exemple pour chacun.", "Les garder visibles."]'::jsonb, 'Quelles sont les cinq choses dont vous êtes la plus fière aujourd’hui ?', 'Les noter ou les photographier.', '3–5 min', '[]'::jsonb, '', 'Choisit 5 cartes qui représentent ses plus grandes victoires.', 'Elle mesure le chemin parcouru depuis le départ.', 'Elle garde une trace concrète de ses 5 victoires.', 'Les noter ou les photographier.', 1),
  ('C02', 'C', 5, 'Stabilisation', 'Si… alors…', 'Cartes obstacles + réponses', 'Préparer une réponse simple à trois situations à risque.', '["Choisir 3 situations à risque.", "Associer une réponse à chacune.", "Lire les 3 plans."]'::jsonb, 'Si cette situation arrive, qu’aimeriez-vous faire à la place ?', 'Tester 1 plan.', '3–5 min', '[]'::jsonb, '', 'Choisit 1 situation à risque et lui associe 1 réponse.', 'Elle voit qu’elle peut préparer sa réaction avant que la situation arrive.', 'Elle repart avec un plan simple « SI… ALORS… ».', 'Tester 1 plan.', 2),
  ('C03', 'C', 5, 'Alimentation', 'Après le restaurant', '1 situation + 3 cartes réactions', 'Revenir à ses repères après un repas plus riche sans compensation excessive.', '["Imaginer un repas plus riche.", "Choisir quoi faire ensuite.", "Retenir : retour normal, sans punition."]'::jsonb, 'Après un restaurant plus riche, quelle serait la meilleure suite ?', 'Appliquer au prochain repas concerné.', '3–5 min', '[]'::jsonb, '', 'Choisit parmi 3 réactions celle qui convient après un restaurant.', 'Elle comprend qu’un repas plus riche ne demande pas de compensation extrême.', 'Son repère devient : reprendre normalement au repas suivant.', 'Appliquer au prochain repas concerné.', 3),
  ('C04', 'C', 5, 'Stabilisation', 'Ma valise vacances & fêtes', 'Valise + 6 cartes repères', 'Choisir quelques repères simples à conserver dans les périodes festives.', '["Choisir seulement 3 repères.", "Les mettre dans la valise.", "Expliquer pourquoi eux."]'::jsonb, 'Si vous ne pouviez emporter que trois repères, lesquels choisiriez-vous ?', 'Les conserver pendant une sortie.', '3–5 min', '[]'::jsonb, '', 'Met 3 cartes repères dans une valise.', 'Elle identifie l’essentiel à garder pendant vacances ou fêtes.', 'Elle repart avec seulement 3 repères.', 'Les conserver pendant une sortie.', 4),
  ('C05', 'C', 5, 'Stabilisation', 'Mon mode minimum', '4 cartes essentielles', 'Préparer une version minimale du parcours pour les semaines difficiles.', '["Choisir le minimum pour alimentation, eau, mouvement, récupération.", "Ne rien ajouter.", "Garder ce plan pour les semaines difficiles."]'::jsonb, 'Quand tout se complique, quel est votre minimum réaliste ?', 'Tester sur une journée chargée.', '3–5 min', '[]'::jsonb, '', 'Choisit son minimum réaliste pour une semaine difficile.', 'Elle comprend que maintenir un peu vaut mieux que tout abandonner.', 'Elle définit son « mode minimum » personnel.', 'Tester sur une journée chargée.', 5),
  ('C06', 'C', 5, 'Stabilisation', 'Mes 3 non-négociables', 'Cartes habitudes + 3 cadenas', 'Identifier trois habitudes protectrices à conserver dans la durée.', '["Choisir les 3 habitudes les plus protectrices.", "Poser un cadenas sur chacune.", "Vérifier qu’elles sont réalistes."]'::jsonb, 'Quelles trois habitudes voulez-vous absolument protéger ?', 'Les tenir 7 jours.', '3–5 min', '[]'::jsonb, '', 'Pose 3 cadenas sur ses habitudes les plus importantes.', 'Elle sait ce qu’elle veut protéger dans la durée.', 'Ces 3 habitudes deviennent ses non-négociables.', 'Les tenir 7 jours.', 6),
  ('C07', 'C', 5, 'Stabilisation', 'Je reprends simplement', 'Cartes Prochain repas / Demain / Cette semaine', 'Savoir reprendre après une période moins structurée sans repartir dans le tout-ou-rien.', '["Remettre les 3 cartes dans l’ordre.", "Mettre une action simple sur chaque étape.", "Écarter les compensations extrêmes."]'::jsonb, 'Après quelques jours moins structurés, par quoi commence-t-on simplement ?', 'Utiliser le plan quand nécessaire.', '3–5 min', '[]'::jsonb, '', 'Remet 3 cartes dans l’ordre : prochain repas → demain → cette semaine.', 'Elle comprend qu’elle peut reprendre sans tout recommencer.', 'Elle garde un plan de reprise très simple.', 'Utiliser le plan quand nécessaire.', 7),
  ('C08', 'C', 5, 'Organisation', 'Mon frigo du futur', 'Frigo + cartes aliments', 'Organiser son environnement pour faciliter les choix utiles.', '["Choisir 5 indispensables simples.", "Les placer aux endroits accessibles.", "Faire sa liste."]'::jsonb, 'Quels cinq aliments vous facilitent vraiment la semaine ?', 'En avoir au moins 3 disponibles.', '3–5 min', '[]'::jsonb, '', 'Choisit 5 aliments indispensables à garder disponibles chez elle.', 'Elle voit comment l’environnement peut faciliter ses choix.', 'Elle repart avec une liste de 5 indispensables.', 'En avoir au moins 3 disponibles.', 8),
  ('C09', 'C', 5, 'Entourage', 'Mon cercle de soutien', 'Cible 3 cercles', 'Identifier les personnes et ressources qui peuvent aider après la cure.', '["Placer les personnes ou ressources.", "Choisir celle qui peut vraiment aider.", "Définir ce qu’on peut lui demander."]'::jsonb, 'Qui pourrait réellement vous aider si vous en aviez besoin ?', 'Faire 1 demande concrète.', '3–5 min', '[]'::jsonb, '', 'Place les personnes qui peuvent l’aider sur une cible.', 'Elle identifie sur qui elle peut réellement compter.', 'Elle choisit 1 personne et 1 demande possible.', 'Faire 1 demande concrète.', 9),
  ('C10', 'C', 5, 'Autonomie', 'Je sais quoi faire si…', 'Cartes situations', 'Vérifier que la cliente sait répondre seule aux situations courantes.', '["Tirer une situation.", "La cliente explique ce qu’elle ferait.", "La thérapeute complète si besoin."]'::jsonb, 'Je vous donne une situation : dites-moi ce que vous feriez aujourd’hui.', 'Repérer la situation encore difficile.', '3–5 min', '[]'::jsonb, '', 'Tire 1 situation et explique simplement ce qu’elle ferait.', 'Elle teste son autonomie face à une situation du quotidien.', 'On repère s’il reste 1 situation à retravailler.', 'Repérer la situation encore difficile.', 10),
  ('C11', 'C', 5, 'Confiance', 'Mon chemin parcouru', 'Frise Point A → Point B', 'Comparer clairement le début du parcours avec la situation actuelle.', '["Reprendre 5 domaines.", "Placer où elle était et où elle est.", "Regarder le chemin."]'::jsonb, 'Regardons concrètement la différence entre votre départ et aujourd’hui.', 'Écrire ce qu’elle ne veut plus oublier.', '3–5 min', '[]'::jsonb, '', 'Place des repères AVANT et AUJOURD’HUI sur une frise.', 'Elle visualise le chemin parcouru.', 'Elle choisit ce qu’elle veut absolument conserver.', 'Écrire ce qu’elle ne veut plus oublier.', 11),
  ('C12', 'C', 5, 'Organisation', 'Ma semaine stable', 'Plateau semaine + repères', 'Construire une semaine durable qui garde place au plaisir et à la récupération.', '["Placer quelques repas repères.", "Ajouter mouvement, récupération et plaisir.", "Vérifier que la semaine reste réaliste."]'::jsonb, 'Construisons une semaine stable, pas une semaine parfaite.', 'La tester réellement.', '3–5 min', '[]'::jsonb, '', 'Compose une semaine type avec quelques repères simples.', 'Elle voit à quoi ressemble une semaine stable, pas parfaite.', 'Elle repart avec sa semaine de référence.', 'La tester réellement.', 12),
  ('C13', 'C', 5, 'Stabilisation', 'Mes signaux d’alerte', 'Vert / orange / rouge', 'Repérer tôt les signes personnels de déséquilibre.', '["Trier ses propres signaux.", "Repérer le premier signal orange.", "Décider quoi faire dès qu’il apparaît."]'::jsonb, 'Quels signes vous montrent que vous commencez à perdre vos repères ?', 'Réagir au premier orange.', '3–5 min', '[]'::jsonb, '', 'Place ses signaux personnels en VERT, ORANGE ou ROUGE.', 'Elle repère les signes qui apparaissent avant une perte de repères.', 'Elle choisit quoi faire dès le premier signal orange.', 'Réagir au premier orange.', 13),
  ('C14', 'C', 5, 'Autonomie', 'Ma routine après MAbeautyplus', 'Roue 6 axes', 'Définir la routine minimale à maintenir après l’accompagnement.', '["Faire le tour des 6 axes.", "Choisir ce qui doit absolument continuer.", "Créer sa routine minimale."]'::jsonb, 'Qu’est-ce que vous voulez continuer même sans rendez-vous chaque semaine ?', 'La noter et la conserver.', '3–5 min', '[]'::jsonb, '', 'Choisit 3 habitudes à maintenir après l’accompagnement.', 'Elle sait ce qui soutiendra son autonomie.', 'Elle crée sa routine minimale après MAbeautyplus.', 'La noter et la conserver.', 14),
  ('C15', 'C', 5, 'Point B', 'Ma carte de nouveau départ', 'Carte à compléter', 'Formuler ce que la cliente a appris et ce qu’elle veut préserver.', '["Compléter « Aujourd’hui je me sens… ».", "Compléter « J’ai appris… ».", "Compléter « Je continuerai… »."]'::jsonb, 'Si vous deviez laisser un message à la version de vous-même dans un mois, que diriez-vous ?', 'Relire la carte dans 1 mois.', '3–5 min', '[]'::jsonb, '', 'Complète 3 phrases sur une carte.', 'Elle formule ce qu’elle a appris et ce qu’elle veut préserver.', 'Elle repart avec une carte à relire dans un mois.', 'Relire la carte dans 1 mois.', 15)
ON CONFLICT (code) DO UPDATE SET
  phase = EXCLUDED.phase, etape = EXCLUDED.etape, theme = EXCLUDED.theme,
  titre = EXCLUDED.titre, materiel = EXCLUDED.materiel, objectif = EXCLUDED.objectif,
  regles = EXCLUDED.regles, phrase_lancement = EXCLUDED.phrase_lancement,
  mission = EXCLUDED.mission, duree = EXCLUDED.duree, options = EXCLUDED.options,
  a_enregistrer = EXCLUDED.a_enregistrer, action_cliente = EXCLUDED.action_cliente,
  prise_conscience = EXCLUDED.prise_conscience, resultat = EXCLUDED.resultat,
  petit_pas = EXCLUDED.petit_pas, ordre = EXCLUDED.ordre;


-- 5. CONTRÔLE ---------------------------------------------------------------
--    Doit afficher : Le Crès, Sérignan, Stéphanie, et un jeu accentué lisible.

SELECT 'centre'     AS quoi, nom    AS texte FROM centres     WHERE id = 'le-cres'
UNION ALL SELECT 'centre',     nom             FROM centres     WHERE id = 'serignan'
UNION ALL SELECT 'therapeute', prenom          FROM therapeutes WHERE email = 'stephanie@mabeautyplus.fr'
UNION ALL SELECT 'jeu',        titre           FROM jeux        WHERE code = 'A07'
UNION ALL SELECT 'tarif',      libelle         FROM tarifs      WHERE code = 'seance';


/*
  MAbeautyplus V2 — Migration 005 : bilan, programme, règlement, séances

  Le cœur métier de la nouvelle méthode.

    bareme_empreinte  le questionnaire et sa pondération, stockés en base
                      pour pouvoir évoluer sans toucher au code
    bilans            un passage de bilan : réponses, InBody, Empreinte
    programmes        la cure vendue, avec les prix figés à la validation
    programme_lignes  le détail par technologie
    echeances         acompte et échéances, avec leur statut de règlement
    seances           chaque venue, avec le jeu imposé et le verrou de clôture
    mensurations      les 11 mesures corporelles
    ventes_complements  les compléments vendus, reliés au stock
*/

-- ===========================================================================
-- 1. BARÈME DU QUESTIONNAIRE
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bareme_empreinte (
  version     integer PRIMARY KEY,
  contenu     jsonb NOT NULL,
  actif       boolean NOT NULL DEFAULT false,
  commentaire text NOT NULL DEFAULT '',
  cree_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bareme_empreinte IS
  'Questions, options et pondération par axe. Chaque bilan retient la version qui l''a produit, pour rester recalculable si le questionnaire évolue.';

-- Une seule version active à la fois.
CREATE UNIQUE INDEX IF NOT EXISTS bareme_une_seule_active ON bareme_empreinte (actif) WHERE actif;

INSERT INTO bareme_empreinte (version, contenu, actif, commentaire)
VALUES (1, '{"STEPS": [{"phase": "client", "type": "radio", "t": "En fin de journée, l''envie de quelque chose de sucré ou de gras s''impose, même sans vraie faim.", "o": [["Jamais", {}], ["Parfois", {"P1": 1}], ["Souvent", {"P1": 2}], ["Presque chaque soir", {"P1": 3}]]}, {"phase": "client", "type": "radio", "t": "Quand une émotion monte (stress, contrariété, ennui), manger m''aide à l''apaiser.", "o": [["Pas du tout", {}], ["Un peu", {"P1": 1}], ["Assez", {"P1": 2}], ["Tout à fait", {"P1": 3}]]}, {"phase": "client", "type": "radio", "t": "Ce qui décrit le mieux votre façon de manger :", "o": [["Je mange pour me réconforter", {"P1": 2}], ["Je mange vite, machinalement", {"P4": 2}], ["Je saute des repas puis je me rattrape", {"P5": 2}], ["Je mange équilibré, et pourtant je ne perds pas", {"T4": 2}]]}, {"phase": "client", "type": "radio", "t": "Après un repas, vous ressentez le plus souvent :", "o": [["Un ballonnement, le ventre qui gonfle", {"T5": 2, "T2": 1}], ["Un coup de barre", {"T4": 2}], ["Une faim qui revient vite", {"T1": 2, "P1": 1}], ["Rien de particulier", {}]]}, {"phase": "client", "type": "radio", "t": "Je me sens sous tension ou « à cent à l''heure », même sans raison urgente.", "o": [["Jamais", {}], ["Parfois", {"P2": 1}], ["Souvent", {"P2": 2}], ["En permanence", {"P2": 3}]]}, {"phase": "client", "type": "radio", "t": "Ma charge mentale (penser à tout, tout gérer) est constamment élevée.", "o": [["Pas vraiment", {}], ["Un peu", {"P2": 1}], ["Beaucoup", {"P2": 2}], ["Épuisante", {"P2": 3}]]}, {"phase": "client", "type": "radio", "t": "Votre sommeil ressemble le plus à :", "o": [["Je m''endors difficilement", {"P2": 2}], ["Je me réveille la nuit, vers 3–4 h", {"T1": 2, "P2": 1}], ["Je dors mais je me réveille fatiguée", {"T4": 2, "P4": 1}], ["Je dors bien", {}]]}, {"phase": "client", "type": "radio", "t": "En ce moment, devant le miroir :", "o": [["Je me reconnais", {}], ["Je suis gênée mais ça va", {"P3": 1}], ["Je m''évite", {"P3": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai le sentiment de m''être « laissée aller » et de ne plus être tout à fait moi-même.", "o": [["Pas du tout", {}], ["Un peu", {"P3": 1}], ["Assez", {"P3": 2}], ["Complètement", {"P3": 3}]]}, {"phase": "client", "type": "radio", "t": "Mon énergie est basse ; bouger me demande un vrai effort.", "o": [["Jamais", {}], ["Parfois", {"P4": 1}], ["Souvent", {"P4": 2}], ["Presque tout le temps", {"P4": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai perdu le lien avec mon corps ; je ne l''écoute plus vraiment.", "o": [["Pas du tout", {}], ["Un peu", {"P4": 1}], ["Beaucoup", {"P4": 2}]]}, {"phase": "client", "type": "radio", "t": "J''ai déjà suivi plusieurs régimes ou méthodes, avec un effet yo-yo.", "o": [["Non", {}], ["Un ou deux", {"P5": 1}], ["Plusieurs", {"P5": 2}], ["Beaucoup, en boucle", {"P5": 3}]]}, {"phase": "client", "type": "radio", "t": "J''ai l''impression que « mon corps résiste » et que rien ne fonctionne durablement.", "o": [["Pas du tout", {}], ["Un peu", {"P5": 1}], ["Beaucoup", {"P5": 3}]]}, {"phase": "client", "type": "radio", "t": "Votre historique de poids ressemble le plus à :", "o": [["Stable, puis une prise récente", {"P2": 1}], ["Un yo-yo depuis des années", {"P5": 2}], ["Une prise progressive et continue", {"T4": 2}], ["Une prise liée à un événement (grossesse, ménopause, choc)", {"T1": 2}]]}, {"phase": "client", "type": "radio", "t": "Quand vous prenez du poids, votre corps stocke en priorité :", "o": [["Sur le ventre", {"T1": 2, "P2": 1}], ["Sur les hanches, cuisses, culotte de cheval", {"T1": 2}], ["Sur le bas des jambes, avec un gonflement", {"T3": 2}], ["Partout, de façon diffuse", {"T2": 1, "T4": 1}]]}, {"phase": "client", "type": "radio", "t": "En fin de journée, vos jambes sont plutôt :", "o": [["Légères", {}], ["Lourdes et gonflées", {"T3": 2}], ["Douloureuses", {"T3": 1, "T2": 1}]]}, {"phase": "client", "type": "radio", "t": "Si vous appuyez quelques secondes sur le haut de la cheville en fin de journée, la marque met du temps à s''effacer.", "o": [["Non / je ne sais pas", {}], ["Un peu", {"T3": 1}], ["Oui, nettement", {"T3": 2}]]}, {"phase": "client", "type": "radio", "t": "Vos mains et vos pieds sont souvent froids, vous êtes frileuse.", "o": [["Non", {}], ["Un peu", {"T4": 1}], ["Nettement", {"T4": 2}]]}, {"phase": "client", "type": "radio", "t": "Au réveil, votre visage et vos doigts sont plutôt :", "o": [["Nets", {}], ["Un peu bouffis, les bagues serrent", {"T2": 2, "T3": 1}]]}, {"phase": "client", "type": "radio", "t": "Votre transit est :", "o": [["Régulier", {}], ["Plutôt paresseux / constipé", {"T5": 2}], ["Ballonné, le ventre gonfle dans la journée", {"T5": 2}]]}, {"phase": "client", "type": "radio", "t": "Votre peau est réactive : rougeurs, imperfections, sensibilité récurrentes.", "o": [["Non, stable", {}], ["Parfois", {"T2": 1}], ["Souvent", {"T2": 2}]]}, {"phase": "client", "type": "radio", "t": "Votre étape de vie :", "o": [["Aucun changement hormonal", {}], ["Périménopause / ménopause", {"T1": 1}], ["Post-grossesse récente", {"T1": 1}]]}, {"phase": "client", "type": "radio", "major": true, "t": "S''il fallait nommer LA raison n°1 qui vous empêche de perdre :", "o": [["Mes émotions et le grignotage", {"P1": 4}], ["Mon stress et mon rythme de vie", {"P2": 4}], ["Ne plus me sentir bien dans mon corps", {"P3": 4}], ["Mon manque d''énergie et de mouvement", {"P4": 4}], ["Mon corps qui résiste malgré mes efforts", {"P5": 4}]]}, {"phase": "client", "type": "radio", "major": true, "t": "Ce que votre corps fait le plus :", "o": [["Il retient l''eau, il gonfle", {"T2": 4}], ["Il stocke dès que je stresse", {"T1": 4}], ["Tout se joue sur le bas du corps", {"T3": 4}], ["Il brûle lentement, je stocke facilement", {"T4": 4}], ["Je digère mal, je suis souvent ballonnée", {"T5": 4}]]}, {"phase": "client", "type": "slider", "t": "Votre blocage, vous le sentez plutôt :", "left": "Dans la tête, le comportement", "right": "Dans le corps, la physiologie"}, {"phase": "client", "type": "text", "t": "En une phrase, qu''aimeriez-vous transformer en priorité ?"}, {"phase": "client", "type": "contact"}, {"type": "transition"}, {"phase": "analyse", "type": "radio", "t": "Graisse viscérale", "o": [["Basse", {}], ["Moyenne", {"T1": 1}], ["Élevée", {"T1": 2, "T2": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Masse musculaire", "o": [["Élevée", {}], ["Moyenne", {"T4": 1}], ["Basse", {"T4": 2, "P4": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Métabolisme de base", "o": [["Rapide", {}], ["Normal", {"T4": 1}], ["Lent", {"T4": 2}]]}, {"phase": "analyse", "type": "radio", "t": "Masse grasse principalement localisée :", "o": [["Sur le haut du corps", {"T1": 2}], ["Répartie de façon diffuse", {"T2": 2}], ["Sur le bas du corps", {"T3": 2, "T1": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Niveau d''eau corporelle / rétention", "o": [["Normal", {}], ["Rétention marquée", {"T2": 2, "T3": 1}]]}, {"phase": "analyse", "type": "radio", "t": "Âge métabolique par rapport à l''âge réel", "o": [["Inférieur ou égal", {}], ["Supérieur", {"T4": 2}]]}, {"phase": "analyse", "type": "radio", "t": "Niveau de masse grasse", "o": [["Normal", {}], ["Modérément élevé", {"T2": 1}], ["Élevé", {"T2": 1, "T1": 1}]]}], "AX": {"P1": {"name": "Réconfort", "sig": "« l''aliment refuge »", "feel": "Chez vous, l''aliment n''est pas un besoin, c''est une <b>régulation émotionnelle</b>. Face au stress, le cerveau réclame du sucre pour libérer de la dopamine, et le réconfort devient un réflexe automatique.", "imp": ["Grignotage sucré du soir", "Humeur en dents de scie", "Culpabilité après les repas", "Énergie qui chute le soir"], "note": "L''aliment sert d''apaisement émotionnel ; le grignotage s''installe en réflexe."}, "P2": {"name": "Sous Pression", "sig": "« le corps en alerte »", "feel": "Votre corps vit en <b>état d''alerte permanent</b>. Le stress maintient un cortisol élevé, l''hormone qui pousse à stocker sur le ventre, et qui sabote le sommeil.", "imp": ["Cortisol élevé, stockage du ventre", "Sommeil léger", "Fringales de fin de journée", "Récupération lente"], "note": "Le stress chronique entretient le stockage et fatigue le sommeil."}, "P3": {"name": "Rupture", "sig": "« le lien distendu »", "feel": "Le lien avec votre image s''est <b>distendu</b>. À force de vous éviter dans le miroir, la motivation s''érode : on ne prend pas soin d''un corps dont on s''est coupée.", "imp": ["Évitement des miroirs et photos", "Baisse de confiance", "Motivation en pointillés", "Sentiment de ne plus être soi"], "note": "Le rapport à l''image s''est distendu, la motivation s''en ressent."}, "P4": {"name": "En Veille", "sig": "« le corps endormi »", "feel": "Votre corps tourne au ralenti. Moins de mouvement, c''est moins de masse musculaire, donc un <b>métabolisme qui s''endort</b> et une énergie qui manque à l''appel.", "imp": ["Fatigue au réveil", "Masse musculaire en baisse", "Sensations émoussées", "Le mouvement coûte"], "note": "Le corps est en veille : peu de mouvement, énergie basse."}, "P5": {"name": "Résistance", "sig": "« le corps verrouillé »", "feel": "Votre corps s''est <b>verrouillé pour se protéger</b>. À force de régimes, le métabolisme s''est adapté à la baisse : il apprend à résister et à tout stocker dès que possible.", "imp": ["Effet yo-yo installé", "Perte de poids qui stagne", "Découragement", "Métabolisme sur la défensive"], "note": "Les tentatives passées ont installé un métabolisme sur la défensive."}, "T1": {"name": "Hormonal", "sig": "« le stockage hormonal »", "feel": "Vos hormones pilotent le stockage. Un déséquilibre discret (cortisol, œstrogènes, thyroïde, cycle) suffit à <b>bloquer la perte</b> et à orienter le stockage sur le ventre ou les hanches.", "imp": ["Stockage ventre et hanches", "Variations d''humeur", "Fatigue cyclique", "Résistance à la perte"], "note": "Les hormones orientent le stockage et freinent la perte."}, "T2": {"name": "Inflammatoire", "sig": "« le corps qui se défend »", "feel": "Votre organisme entretient une <b>inflammation silencieuse</b>. Vos cellules stockent par réflexe de protection : le corps se défend au lieu de déstocker, et retient l''eau.", "imp": ["Rétention d''eau", "Ventre gonflé le matin", "Articulations sensibles", "Peau réactive"], "note": "Une inflammation de fond pousse le corps à retenir et à se défendre."}, "T3": {"name": "Circulatoire", "sig": "« les fluides qui stagnent »", "feel": "Votre circulation est paresseuse. Les <b>fluides stagnent</b> au lieu de circuler : ils s''accumulent dans le bas du corps et forment une rétention visible en fin de journée.", "imp": ["Jambes lourdes", "Gonflement du bas du corps", "Cellulite aqueuse", "Marque du godet"], "note": "Les fluides circulent mal et stagnent dans le bas du corps."}, "T4": {"name": "Métabolique Lent", "sig": "« le moteur au ralenti »", "feel": "Votre moteur brûle au ralenti. Vous dépensez moins que vous ne stockez, souvent avec une <b>signature thyroïdienne discrète</b> : frilosité, mains froides, digestion lente.", "imp": ["Perte de poids lente", "Frilosité, mains froides", "Coup de barre après les repas", "Masse musculaire à réveiller"], "note": "Le métabolisme brûle lentement, le corps stocke facilement."}, "T5": {"name": "Digestif", "sig": "« l''assimilation ralentie »", "feel": "Votre digestion peine à suivre. <b>Assimilation et élimination sont ralenties</b>, le ventre gonfle, et un système digestif engorgé freine toute la perte.", "imp": ["Ballonnements", "Transit irrégulier", "Lourdeur après manger", "Inconfort abdominal"], "note": "La digestion et l''élimination sont ralenties, le ventre gonfle."}}, "CURE_PRIO": {"T1": "On équilibre le terrain hormonal et on cible le stockage abdominal.", "T2": "On calme l''inflammation et on relance l''élimination.", "T3": "On relance le drainage en priorité.", "T4": "On réveille le métabolisme et on relance la combustion.", "T5": "On soulage la digestion et on désengorge."}, "TERRAIN_COMPL": {"T1": {"n": "Le Draineur", "r": "soutient l''élimination et le déstockage"}, "T2": {"n": "Le Draineur", "r": "évacue l''eau retenue, désengorge le terrain inflammatoire"}, "T3": {"n": "Le Draineur", "r": "relance la circulation et draine le bas du corps"}, "T4": {"n": "Burn / Le Minceur", "r": "relance la combustion des graisses"}, "T5": {"n": "Le Sauveur", "r": "soutient la digestion et l''assimilation"}}}'::jsonb, true,
        'Version d''origine, reprise du formulaire Bilan Empreinte.')
ON CONFLICT (version) DO UPDATE SET contenu = EXCLUDED.contenu;

-- ===========================================================================
-- 2. BILANS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bilans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id             text NOT NULL REFERENCES centres(id),
  therapeute_id         uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  date_bilan            date NOT NULL DEFAULT CURRENT_DATE,
  statut                text NOT NULL DEFAULT 'en_cours'
                          CHECK (statut IN ('en_cours', 'termine', 'abandonne')),

  bareme_version        integer NOT NULL DEFAULT 1 REFERENCES bareme_empreinte(version),
  reponses              jsonb NOT NULL DEFAULT '{}'::jsonb,
  curseur               integer NOT NULL DEFAULT 50 CHECK (curseur BETWEEN 0 AND 100),
  texte_libre           text NOT NULL DEFAULT '',
  inbody                jsonb NOT NULL DEFAULT '{}'::jsonb,

  scores                jsonb NOT NULL DEFAULT '{}'::jsonb,
  profil_dominant       text,
  terrain_dominant      text,
  profils_secondaires   text[] NOT NULL DEFAULT '{}',
  terrains_secondaires  text[] NOT NULL DEFAULT '{}',

  -- 87 € si la cliente ne démarre pas, offert si elle démarre.
  facturation           text NOT NULL DEFAULT 'en_attente'
                          CHECK (facturation IN ('en_attente', 'facture', 'offert')),
  montant_facture       numeric(10,2),

  cree_le               timestamptz NOT NULL DEFAULT now(),
  maj_le                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bilans_cliente_idx ON bilans (cliente_id, date_bilan DESC);
CREATE INDEX IF NOT EXISTS bilans_centre_idx  ON bilans (centre_id, date_bilan DESC);

DROP TRIGGER IF EXISTS bilans_maj_le ON bilans;
CREATE TRIGGER bilans_maj_le BEFORE UPDATE ON bilans
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ===========================================================================
-- 3. PROGRAMMES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS programmes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  bilan_id              uuid REFERENCES bilans(id) ON DELETE SET NULL,
  centre_id             text NOT NULL REFERENCES centres(id),
  therapeute_id         uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  numero                integer NOT NULL DEFAULT 1,
  statut                text NOT NULL DEFAULT 'propose'
                          CHECK (statut IN ('propose', 'valide', 'en_cours', 'termine', 'abandonne')),

  electro               boolean NOT NULL DEFAULT false,
  guide                 boolean NOT NULL DEFAULT true,

  -- Prix figés à la validation : les cures passées ne bougent jamais.
  prix_guide            numeric(10,2) NOT NULL DEFAULT 0,
  prix_tenue            numeric(10,2) NOT NULL DEFAULT 0,
  montant_total         numeric(10,2) NOT NULL DEFAULT 0,

  mode_reglement        text NOT NULL DEFAULT '4x_maison'
                          CHECK (mode_reglement IN ('comptant', '4x_maison', '10x_alma')),
  frais_financement     numeric(10,2) NOT NULL DEFAULT 0,

  complement_recommande text,
  date_validation       date,

  cree_le               timestamptz NOT NULL DEFAULT now(),
  maj_le                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, numero)
);

CREATE INDEX IF NOT EXISTS programmes_cliente_idx ON programmes (cliente_id, numero);
CREATE INDEX IF NOT EXISTS programmes_centre_idx  ON programmes (centre_id, statut);

DROP TRIGGER IF EXISTS programmes_maj_le ON programmes;
CREATE TRIGGER programmes_maj_le BEFORE UPDATE ON programmes
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE IF NOT EXISTS programme_lignes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  technologie     text NOT NULL CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome')),
  seances_prevues integer NOT NULL DEFAULT 0 CHECK (seances_prevues >= 0),
  prix_unitaire   numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (programme_id, technologie)
);

-- ===========================================================================
-- 4. ÉCHÉANCES
-- ===========================================================================

CREATE TABLE IF NOT EXISTS echeances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'echeance' CHECK (type IN ('acompte', 'echeance')),
  rang            integer NOT NULL,
  montant         numeric(10,2) NOT NULL DEFAULT 0,
  date_prevue     date,
  moyen           text CHECK (moyen IS NULL OR moyen IN ('cheque', 'especes', 'cb', 'virement', 'alma')),
  statut          text NOT NULL DEFAULT 'a_venir'
                    CHECK (statut IN ('a_venir', 'paye', 'donne', 'impaye')),
  date_reglement  date,
  note            text,
  UNIQUE (programme_id, type, rang)
);

CREATE INDEX IF NOT EXISTS echeances_programme_idx ON echeances (programme_id, rang);
CREATE INDEX IF NOT EXISTS echeances_a_encaisser_idx ON echeances (date_prevue)
  WHERE statut IN ('a_venir', 'impaye');

-- ===========================================================================
-- 5. SÉANCES
--    Le nombre de séances restantes se déduit d'ici : jamais un compteur saisi.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS seances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  centre_id       text NOT NULL REFERENCES centres(id),
  therapeute_id   uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),

  date_seance     date NOT NULL DEFAULT CURRENT_DATE,
  technologie     text NOT NULL CHECK (technologie IN ('luxo', 'ishape', 'presso', 'dome')),

  poids           numeric(5,2),
  commentaire     text NOT NULL DEFAULT '',
  photo_prise     boolean NOT NULL DEFAULT false,

  -- Le jeu du jour, imposé par le moteur.
  jeu_code        text REFERENCES jeux(code),
  jeu_valide      boolean NOT NULL DEFAULT false,
  jeu_reponse     jsonb NOT NULL DEFAULT '{}'::jsonb,

  cloturee        boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now(),

  -- La règle de la méthode : pas de clôture sans jeu validé.
  CONSTRAINT cloture_exige_le_jeu CHECK (NOT cloturee OR jeu_valide)
);

CREATE INDEX IF NOT EXISTS seances_programme_idx ON seances (programme_id, date_seance DESC);
CREATE INDEX IF NOT EXISTS seances_cliente_idx   ON seances (cliente_id, date_seance DESC);
CREATE INDEX IF NOT EXISTS seances_jeux_faits_idx ON seances (programme_id, jeu_code) WHERE cloturee;

-- ===========================================================================
-- 6. MENSURATIONS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS mensurations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  programme_id  uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id     text NOT NULL REFERENCES centres(id),
  date_mesure   date NOT NULL DEFAULT CURRENT_DATE,
  poitrine      numeric(5,1),
  sous_poitrine numeric(5,1),
  taille        numeric(5,1),
  ventre        numeric(5,1),
  hanches       numeric(5,1),
  bras_droit    numeric(5,1),
  bras_gauche   numeric(5,1),
  cuisse_droite numeric(5,1),
  cuisse_gauche numeric(5,1),
  mollet_droit  numeric(5,1),
  mollet_gauche numeric(5,1),
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensurations_cliente_idx ON mensurations (cliente_id, date_mesure DESC);

-- ===========================================================================
-- 7. VENTES DE COMPLÉMENTS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ventes_complements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  programme_id  uuid REFERENCES programmes(id) ON DELETE SET NULL,
  centre_id     text NOT NULL REFERENCES centres(id),
  therapeute_id uuid REFERENCES therapeutes(id) DEFAULT therapeute_courante(),
  date_vente    date NOT NULL DEFAULT CURRENT_DATE,
  produit       text NOT NULL CHECK (produit IN ('BURN', 'SOS', 'DETOX', 'SKIN')),
  quantite      integer NOT NULL DEFAULT 1 CHECK (quantite > 0),
  prix_unitaire numeric(10,2) NOT NULL DEFAULT 37,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ventes_complements_cliente_idx
  ON ventes_complements (cliente_id, date_vente DESC);

-- ===========================================================================
-- 8. VUE DE SUIVI : séances vendues, faites, restantes
-- ===========================================================================

-- security_invoker : la vue applique les droits de l'appelant, donc le
-- cloisonnement par centre des tables sous-jacentes s'applique aussi ici.
CREATE OR REPLACE VIEW suivi_seances WITH (security_invoker = true) AS
SELECT
  p.id                                              AS programme_id,
  p.cliente_id,
  p.centre_id,
  l.technologie,
  l.seances_prevues,
  COUNT(s.id) FILTER (WHERE s.cloturee)             AS seances_faites,
  l.seances_prevues - COUNT(s.id) FILTER (WHERE s.cloturee) AS seances_restantes
FROM programmes p
JOIN programme_lignes l ON l.programme_id = p.id
LEFT JOIN seances s ON s.programme_id = p.id AND s.technologie = l.technologie
GROUP BY p.id, p.cliente_id, p.centre_id, l.technologie, l.seances_prevues;

-- ===========================================================================
-- 9. SYNCHRONISATION AIRTABLE
-- ===========================================================================

DROP TRIGGER IF EXISTS bilans_vers_airtable ON bilans;
CREATE TRIGGER bilans_vers_airtable
  AFTER INSERT OR UPDATE OF statut, profil_dominant, terrain_dominant, facturation
  ON bilans FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('bilan');

DROP TRIGGER IF EXISTS programmes_vers_airtable ON programmes;
CREATE TRIGGER programmes_vers_airtable
  AFTER INSERT OR UPDATE OF statut, montant_total, mode_reglement, electro
  ON programmes FOR EACH ROW EXECUTE FUNCTION enfiler_airtable('programme');

-- ===========================================================================
-- 10. RLS — tout est cloisonné par centre
-- ===========================================================================

ALTER TABLE bareme_empreinte   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bilans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_lignes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE echeances          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seances            ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensurations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventes_complements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bareme_lecture ON bareme_empreinte;
CREATE POLICY bareme_lecture ON bareme_empreinte FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS bareme_ecriture ON bareme_empreinte;
CREATE POLICY bareme_ecriture ON bareme_empreinte FOR ALL TO authenticated
  USING (est_direction()) WITH CHECK (est_direction());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bilans', 'programmes', 'seances', 'mensurations', 'ventes_complements']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_acces', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (acces_centre(centre_id)) WITH CHECK (acces_centre(centre_id))',
      t || '_acces', t);
  END LOOP;
END $$;

-- Les lignes et échéances suivent l'accès de leur programme.
DROP POLICY IF EXISTS programme_lignes_acces ON programme_lignes;
CREATE POLICY programme_lignes_acces ON programme_lignes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)));

DROP POLICY IF EXISTS echeances_acces ON echeances;
CREATE POLICY echeances_acces ON echeances FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND acces_centre(p.centre_id)));
