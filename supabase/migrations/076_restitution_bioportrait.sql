/*
  MAbeautyplus V2 — Migration 076 : le contenu de la restitution BioPortrait

  La restitution remise à la cliente passe de deux pages à quatre — trois pour
  celle qui démarre, qui a son contrat pour le prix. Elle raconte ce qu'elle
  vit, ce qui se passe dans son corps, et met chaque élément de sa cure en
  face d'un point précis de son analyse.

  TOUT CE QU'ELLE DIT VIENT D'ICI, c'est-à-dire du barème. Les textes
  d'interprétation vivaient jusqu'à présent à moitié en base et à moitié dans
  le code du PDF ; une liste figée à côté d'un contenu versionné finit
  toujours par mentir — c'est ce qui avait fait écrire « Rétention » sous le
  score InBody.

  Ce que la migration ajoute, SANS TOUCHER à une seule question, à un seul
  point ni à un seul palier. À réponses identiques, une cliente paie
  exactement pareil :

    · `AX[code]` gagne de quoi écrire deux pages — `resume`, `manif`,
      `vecu` (ce qu'elle vit, les profils seulement), `meca` (ce qui se
      passe réellement), `prio` pour un profil, `agir` pour un terrain. Et
      `sig`, le sous-titre, est réécrit sur cinq axes : « le corps consolé »
      plutôt que « l'aliment refuge ». L'écran de restitution lit le même
      champ, donc la thérapeute dira devant la cliente ce que le document
      écrira.

    · Chaque question d'analyse gagne `lecture`, un tableau parallèle à ses
      réponses : pour chacune, la situation en deux mots, le nombre de
      pastilles, s'il faut alerter, et la phrase qui explique. LE POINT DE
      VIGILANCE DE LA PAGE 1 EN SORT : c'est la première réponse en alerte,
      et s'il n'y en a aucune il n'y a pas de point — l'ancienne version en
      désignait un au hasard pendant que le tableau disait, deux lignes plus
      haut, qu'il n'y avait rien à signaler.

    · `RESTITUTION` porte les soins — titre, description, atouts,
      pictogramme —, le socle commun, et la matrice qui met un soin en face de
      chaque point de l'analyse, avec ce qu'il y apporte.

  LE VOCABULAIRE EST CELUI DE LA MAISON : « I-Shape » et non
  « Electrostimulation », « Mon Parcours » et non « l'application Nutrition »,
  « Missions Déclic » et non « défis », « guide de rééquilibrage alimentaire »
  et non « rééducation ». La Luxothérapie Ménopause n'existe pas ici et n'est
  pas reprise ; le Dôme, qui n'a rien à voir avec le BioPortrait, n'entre dans
  aucune association.

  LE GENRE. Quatre textes étaient écrits au féminin. Ils portent `{e}`, que
  l'application remplace par « e » ou par rien selon la civilité : une fiche
  d'homme ne lira pas « vous êtes allongée ».

  Les soins sont nommés par LEURS CODES de la maison (LUXO, RELAX, ISHAPE,
  PRESSO) et les mesures par LEUR RANG dans le questionnaire, jamais par leur
  libellé — « Score InBody / 100 » ici, « Score global » dans le paquet
  d'origine.

  CE FICHIER EST GÉNÉRÉ depuis `supabase/contenu/restitution-bioportrait.json`,
  que le banc d'essai lit aussi. Ne pas le modifier à la main :
  `node tests/generer-migration-restitution.mjs`.

  Rejouable sans risque.
*/

BEGIN;

-- 1. De quoi écrire les deux premières pages, axe par axe.
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,P1}', (contenu->'AX'->'P1') || '{"sig":"« le corps consolé »","resume":"Vous mangez pour apaiser, pas par faim. Le corps reçoit de l''énergie à des moments où il n''en demandait pas.","manif":["Grignotage en fin de journée","Envies fortes de sucré","Culpabilité après coup"],"vecu":"La journée tient. C''est le soir que ça lâche, quand la tension retombe et que le calme revient. Ce n''est pas de la gourmandise et ce n''est pas un défaut de caractère : c''est le geste le plus simple, le plus rapide et le plus efficace pour faire baisser la pression. Il fonctionne. C''est bien pour cela qu''il revient.","meca":"Le problème n''est pas la quantité, c''est le moment. Vous apportez de l''énergie à un corps qui, à cette heure-là, ne dépense presque plus rien. Ce qui arrive n''est pas utilisé, il est mis de côté. Et plus le geste se répète, plus il s''automatise : le corps finit par le réclamer avant même que vous y pensiez.","prio":"Sécuriser la fin de journée pour que le corps n''ait plus besoin de réclamer."}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'P1';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,P2}', (contenu->'AX'->'P2') || '{"sig":"« le corps en alerte »","resume":"Votre corps ne redescend jamais vraiment. Il reste mobilisé, et un corps mobilisé ne se déleste de rien.","manif":["Tension permanente","Sommeil léger ou coupé","Difficulté à s''arrêter"],"vecu":"Vous faites beaucoup, souvent pour les autres, et vous ne vous arrêtez pas vraiment. Même au repos, la tête continue. Vous avez sans doute l''impression de bien tenir — et c''est vrai. Ce qui ne tient pas, c''est le corps, qui n''a plus de moment pour souffler.","meca":"Un corps en alerte permanente gère son énergie comme en période de danger : il la garde. Il stocke davantage, il retient l''eau, il récupère mal. Tant que l''alerte ne retombe pas, il n''a aucune raison de relâcher ses réserves — quoi que vous mettiez dans votre assiette.","prio":"Créer de vrais temps de relâchement pour que le corps sorte de l''alerte."}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'P2';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,P3}', (contenu->'AX'->'P3') || '{"sig":"« le corps en montagnes russes »","resume":"Vous alternez des phases très strictes et des phases où tout lâche. Le corps ne sait jamais à quoi s''attendre.","manif":["Phases très strictes puis relâchement","Poids en dents de scie","Tout ou rien"],"vecu":"Quand vous vous y mettez, vous vous y mettez vraiment. Et ça marche, au début. Puis un écart arrive, et tout s''effondre d''un coup — pas seulement l''écart, tout le reste avec. Vous repartez à zéro quelques semaines plus tard, un peu plus découragé{e} à chaque fois.","meca":"Pour le corps, chaque phase stricte est une alerte. Il baisse sa dépense pour tenir. Quand la phase s''arrête, lui n''est pas reparti : il reçoit de nouveau, mais il dépense toujours au ralenti. C''est mécaniquement là que la reprise se fait, et elle se fait plus vite que la perte.","prio":"Sortir du tout ou rien pour installer quelque chose qui tient sans effort héroïque."}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'P3';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,P4}', (contenu->'AX'->'P4') || '{"sig":"« le corps endormi »","resume":"Votre corps tourne au ralenti. Moins de mouvement, c''est moins de masse musculaire, donc un métabolisme qui s''endort.","manif":["Fatigue au réveil","Masse musculaire en baisse","Le mouvement coûte"],"vecu":"Vous n''avez pas moins de volonté qu''avant. Vous avez moins d''élan. Bouger demande un effort qu''il ne demandait pas il y a dix ans, alors on bouge un peu moins, et comme on bouge moins, l''élan baisse encore. C''est un cercle qui se referme doucement, sans qu''on le voie venir.","meca":"Le muscle consomme de l''énergie en permanence, même au repos — et c''est la seule part de votre dépense que l''on peut reconstruire. Quand il diminue, c''est tout le moteur de fond qui diminue avec lui — celui qui tourne jour et nuit sans que vous y pensiez. Vous pouvez manger exactement comme avant et prendre du poids, simplement parce que vous ne brûlez plus autant qu''avant.","prio":"Relancer le moteur de fond avant de toucher à quoi que ce soit dans l''assiette."}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'P4';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,P5}', (contenu->'AX'->'P5') || '{"sig":"« le corps qui ne répond plus »","resume":"Vous avez déjà beaucoup essayé. Le corps a appris à se défendre, et il ne répond plus aux méthodes habituelles.","manif":["Beaucoup de méthodes déjà tentées","Résultats de plus en plus faibles","Blocage malgré les efforts"],"vecu":"Vous savez quoi faire. Vous l''avez fait, souvent mieux que la plupart des gens. Et pourtant, ce qui marchait avant ne marche plus. C''est probablement ce qui vous épuise le plus : l''impression d''avoir tout donné pour rien.","meca":"Chaque restriction forte a appris quelque chose à votre corps : dépenser moins. Il a fait exactement ce qu''il devait faire pour vous protéger, et il l''a bien fait. Aujourd''hui, la même méthode appliquée plus fort ne donne plus rien, parce que le problème n''est plus dans l''assiette : il est dans un moteur abîmé.","prio":"Réparer avant de demander. Redonner au corps une raison de relâcher."}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'P5';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,T1}', (contenu->'AX'->'T1') || '{"sig":"« le corps qui se réorganise »","resume":"Votre corps traverse une période de réorganisation. Il ne stocke plus au même endroit, ni de la même façon.","manif":["Silhouette qui change de forme","Prise localisée, ventre ou hanches","Sensation de gonflement variable"],"meca":"Les repères d''avant ne s''appliquent plus. Ce n''est pas que vous faites moins bien : c''est que le corps a changé de règles. Le même effort ne produit plus le même résultat, et la graisse se redistribue.","agir":"accompagner cette réorganisation au lieu de la combattre"}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'T1';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,T2}', (contenu->'AX'->'T2') || '{"sig":"« le corps qui s''irrite »","resume":"Votre corps est dans un état d''irritation de fond. Il gonfle, il récupère mal, il se défend en permanence.","manif":["Gonflements diffus","Récupération lente","Sensation d''être « engorgé{e} »"],"meca":"Un corps irrité met son énergie dans sa défense, pas dans sa transformation. Tant que le fond ne s''apaise pas, une grande partie de ce que vous faites est absorbée par cette lutte permanente.","agir":"apaiser le terrain avant de chercher à faire bouger le poids"}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'T2';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,T3}', (contenu->'AX'->'T3') || '{"sig":"« la circulation ralentie »","resume":"Les échanges se font mal. Ce qui devrait circuler et s''éliminer stagne.","manif":["Jambes lourdes en fin de journée","Chevilles qui gonflent","Sensation de lourdeur générale"],"meca":"Une circulation ralentie, c''est un corps qui élimine mal : les liquides s''installent, les tissus s''engorgent. Une partie de ce que vous voyez sur la balance et dans le miroir n''est pas de la graisse, c''est de la stagnation.","agir":"relancer les échanges pour que le corps puisse enfin éliminer"}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'T3';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,T4}', (contenu->'AX'->'T4') || '{"sig":"« le moteur au ralenti »","resume":"Votre dépense de fond est basse. Le corps consomme peu, et tout ce qui arrive en trop se stocke facilement.","manif":["Frilosité","Poids qui ne bouge pas malgré les efforts","Coups de fatigue dans la journée"],"meca":"C''est le métabolisme de base qui décide de l''essentiel de ce que vous brûlez sur une journée, bien avant le sport. Quand il est bas, la marge est mince : le moindre excès se voit, et la moindre restriction le fait baisser encore.","agir":"remonter la dépense de fond, ce qui ne se fait jamais en mangeant moins"}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'T4';
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{AX,T5}', (contenu->'AX'->'T5') || '{"sig":"« l''assimilation ralentie »","resume":"Votre digestion peine à suivre. Assimilation et élimination sont ralenties, le ventre gonfle.","manif":["Ballonnements","Transit irrégulier","Lourdeur après manger"],"meca":"Quand la digestion est lente, deux choses se passent en même temps : vous assimilez mal ce dont vous avez besoin, et vous éliminez mal ce dont vous n''avez pas besoin. Le ventre gonfle, l''énergie chute après les repas, et le corps travaille à vide.","agir":"remettre la digestion en route pour que le corps profite enfin de ce qu''il reçoit"}'::jsonb)
WHERE version = 3 AND contenu->'AX' ? 'T5';

/*
  2. La lecture des cinq mesures d'analyse.

  Le tableau `lecture` suit les réponses une à une : la réponse cochée donne
  directement sa ligne du tableau de composition corporelle. Il se pose par le
  LIBELLÉ de la question, et le script s'arrête net si l'une d'elles a changé
  de nom ou de nombre de réponses — mieux vaut un échec bruyant qu'une phrase
  écrite sous la mauvaise réponse.
*/
DO $$
DECLARE
  attendu jsonb := '{"Graisse viscérale":[{"s":"Basse","n":3,"a":false,"t":"La graisse profonde est basse : c''est un point d''appui solide pour la suite."},{"s":"Dans la moyenne","n":2,"a":false,"t":"Rien d''alarmant de ce côté, mais c''est une zone à ne pas laisser monter."},{"s":"Élevée","n":1,"a":true,"t":"La graisse profonde est installée : c''est elle qui entretient l''inflammation et la résistance à la perte."},{"s":"Très élevée","n":1,"a":true,"t":"La graisse profonde est au-delà de la fourchette : c''est le premier point sur lequel agir."}],"Masse musculaire":[{"s":"Très faible","n":1,"a":true,"t":"Votre moteur de fond est nettement en dessous de ce qu''il devrait être — c''est lui qui brûle jour et nuit."},{"s":"Norme basse","n":1,"a":true,"t":"Votre moteur de fond est en dessous de ce qu''il devrait être."},{"s":"Dans la norme","n":2,"a":false,"t":"La masse musculaire tient. C''est maintenant qu''il faut la protéger."},{"s":"Élevée","n":3,"a":false,"t":"Votre masse musculaire est au-dessus de la norme : votre dépense de fond est bien soutenue."},{"s":"Très élevée","n":3,"a":false,"t":"Une masse musculaire élevée : le moteur est là, il s''agit de le garder."}],"Métabolisme de base":[{"s":"Actif","n":3,"a":false,"t":"Votre dépense de fond est au-dessus de la norme : le corps consomme bien, même au repos."},{"s":"Dans la fourchette","n":2,"a":false,"t":"Il tient encore. C''est maintenant qu''il faut le protéger."},{"s":"Lent","n":1,"a":true,"t":"Votre dépense de fond est basse : la marge est mince, le moindre écart se voit."},{"s":"Très lent","n":1,"a":true,"t":"Votre corps brûle nettement moins qu''il ne le devrait : c''est le moteur qu''il faut relancer avant tout."}],"Rétention d''eau":[{"s":"Basse","n":3,"a":false,"t":"L''élimination se fait bien : ce que montre la balance est du vrai poids."},{"s":"Dans la moyenne","n":2,"a":false,"t":"L''élimination se fait correctement."},{"s":"Élevée","n":1,"a":true,"t":"Une partie de ce que vous voyez n''est pas de la graisse, c''est de l''eau retenue."}],"Score InBody / 100":[{"s":"Moins de 40","n":1,"a":true,"t":"Le score global est bas : plusieurs mesures tirent dans le même sens."},{"s":"40 à 50 sur 100","n":1,"a":true,"t":"Le score reste bas : il résume les autres mesures, et plusieurs ont de la marge."},{"s":"50 à 70 sur 100","n":2,"a":false,"t":"Un score correct, avec de la marge de progression."},{"s":"70 à 100 sur 100","n":3,"a":false,"t":"Un bon score d''ensemble : la base est là."}]}'::jsonb;
  question text;
  idx      int;
  combien  int;
BEGIN
  FOR question IN SELECT jsonb_object_keys(attendu) LOOP
    SELECT (ord - 1)::int INTO idx
    FROM bareme_empreinte b, jsonb_array_elements(b.contenu->'STEPS') WITH ORDINALITY AS t(st, ord)
    WHERE b.version = 3 AND st->>'t' = question
    LIMIT 1;

    IF idx IS NULL THEN
      RAISE EXCEPTION 'Question d''analyse introuvable dans le barème 3 : %', question;
    END IF;

    SELECT jsonb_array_length(contenu->'STEPS'->idx->'o') INTO combien
    FROM bareme_empreinte WHERE version = 3;

    IF combien <> jsonb_array_length(attendu->question) THEN
      RAISE EXCEPTION '« % » a % réponses, la lecture en décrit %.',
        question, combien, jsonb_array_length(attendu->question);
    END IF;

    UPDATE bareme_empreinte
    SET contenu = jsonb_set(contenu, ARRAY['STEPS', idx::text, 'lecture'], attendu->question)
    WHERE version = 3;
  END LOOP;
END $$;

-- 3. Les soins, le socle, et ce que chacun apporte à chaque point de l'analyse.
UPDATE bareme_empreinte
SET contenu = jsonb_set(contenu, '{RESTITUTION}', '{"SOINS":{"LUXO":{"nom":"La Luxothérapie Perte de poids","titre":"Luxothérapie Perte de poids","court":"Stimulation des points réflexes par lumière pulsée. Vous êtes allongé{e}, sans effort.","atouts":["Moins de fringales et de grignotage","Moins de pulsions de sucre","Régulation du système hormonal"],"icone":"lumiere"},"RELAX":{"nom":"La Luxothérapie Relaxation","titre":"Luxothérapie Relaxation","court":"La même technologie, orientée détente profonde et récupération.","atouts":["Mental apaisé","Meilleure qualité de sommeil","Moins d''irritabilité et de charge mentale"],"icone":"lune"},"ISHAPE":{"nom":"L''I-Shape","titre":"I-Shape · électrostimulation","court":"Électrostimulation passive. Le muscle travaille pendant que vous êtes allongé{e}.","atouts":["Le muscle sollicité, moteur de votre dépense","Stimulation et tonicité musculaire","Silhouette travaillée localement"],"icone":"eclair"},"PRESSO":{"nom":"La Pressodynamie","titre":"Pressodynamie","court":"Un drainage mécanique par compression douce, des pieds vers le haut du corps.","atouts":["Moins de rétention d''eau, sensation de légèreté","Transit et élimination améliorés","Drainage et circulation relancés"],"icone":"vague"},"NUTRITION":{"nom":"Le guide de rééquilibrage alimentaire","titre":"Votre guide de rééquilibrage alimentaire","court":"4 phases sur 4 semaines, construites sur votre BioPortrait. Pas un régime.","atouts":["Une méthode qui tient dans la durée","Adaptée à votre profil","Sans interdit absolu"],"icone":"assiette"},"SUIVI":{"nom":"Le suivi et les analyses","titre":"Suivi humain chaque semaine","court":"La même thérapeute, formée en nutrition, qui connaît votre dossier.","atouts":["Un point chaque semaine","Une analyse complète chaque mois","Quelqu''un qui remarque quand ça décroche"],"icone":"mains"},"ANALYSES":{"nom":"Les analyses mensuelles","titre":"Analyse de composition corporelle","court":"Chaque mois, sur balance InBody. Pour voir ce que la balance de la maison ne montre pas.","atouts":[],"icone":"graphique"},"PARCOURS":{"nom":"Mon Parcours","titre":"Mon Parcours, votre application audio","court":"Un podcast et un objectif chaque semaine, à écouter où vous voulez.","atouts":[],"icone":"casque"},"DECLIC":{"nom":"Les Missions Déclic","titre":"Vos Missions Déclic","court":"Une mini-mission simple et concrète chaque semaine, dans votre quotidien.","atouts":[],"icone":"cible"},"BIOPORTRAIT":{"nom":"Le BioPortrait","titre":"Votre BioPortrait","court":"Le diagnostic que vous venez de réaliser. C''est lui qui guide tout votre accompagnement.","atouts":[],"icone":"empreinte"}},"SOCLE":["NUTRITION","SUIVI","ANALYSES","PARCOURS","DECLIC","BIOPORTRAIT"],"TOUJOURS":["NUTRITION","SUIVI"],"ASSOC":{"terrain":{"T1":["LUXO","RELAX","NUTRITION"],"T2":["NUTRITION","PRESSO","RELAX"],"T3":["PRESSO","ISHAPE","NUTRITION"],"T4":["ISHAPE","LUXO","NUTRITION"],"T5":["PRESSO","RELAX","NUTRITION"]},"profil":{"P1":["LUXO","RELAX","NUTRITION"],"P2":["RELAX","LUXO","NUTRITION"],"P3":["NUTRITION","SUIVI","LUXO"],"P4":["ISHAPE","LUXO","NUTRITION"],"P5":["ISHAPE","LUXO","NUTRITION"]},"mesure":{"0":["NUTRITION","SUIVI","ISHAPE"],"1":["ISHAPE","SUIVI","NUTRITION"],"2":["ISHAPE","LUXO","SUIVI"],"3":["PRESSO","SUIVI","NUTRITION"],"4":["SUIVI","ISHAPE","NUTRITION"]}},"EFFET":{"terrain|T1|LUXO":"Accompagne la régulation du système hormonal.","terrain|T1|RELAX":"Apaise l''humeur et le sommeil, souvent perturbés.","terrain|T1|NUTRITION":"Adapte l''assiette à un corps qui a changé de règles.","terrain|T2|NUTRITION":"Retire ce qui entretient l''irritation de fond.","terrain|T2|PRESSO":"Évacue les déchets métaboliques qui stagnent.","terrain|T2|RELAX":"Fait redescendre un corps qui reste en défense.","terrain|T3|PRESSO":"Draine, relance la circulation, réduit la rétention d''eau.","terrain|T3|ISHAPE":"Réactive la pompe musculaire qui fait remonter le sang.","terrain|T3|NUTRITION":"Réduit ce qui favorise la rétention.","terrain|T4|ISHAPE":"Sollicite le muscle, le moteur de votre dépense.","terrain|T4|LUXO":"Rétablit l''équilibre hormonal qui commande la dépense.","terrain|T4|NUTRITION":"Renourrit un corps mis en économie.","terrain|T5|PRESSO":"Améliore le transit, l''élimination et la constipation.","terrain|T5|RELAX":"Apaise le système digestif, très sensible au stress.","terrain|T5|NUTRITION":"Allège la digestion pour relancer l''assimilation.","profil|P1|LUXO":"Réduit les fringales et les pulsions de sucre.","profil|P1|RELAX":"Traite la charge émotionnelle qui déclenche l''envie.","profil|P1|NUTRITION":"Sécurise la fin de journée, là où tout se joue.","profil|P2|RELAX":"Fait baisser le stress, restaure le sommeil.","profil|P2|LUXO":"Coupe les compensations liées à la tension.","profil|P2|NUTRITION":"Nourrit sans rien demander de plus au corps.","profil|P3|NUTRITION":"Sort du tout ou rien, installe un cadre qui tient.","profil|P3|SUIVI":"Rattrape le décrochage avant qu''il fasse tout tomber.","profil|P3|LUXO":"Lisse les pulsions qui déclenchent la rupture.","profil|P4|ISHAPE":"Réveille le muscle, le seul levier sur la dépense de fond.","profil|P4|LUXO":"Relance un corps qui s''est mis au ralenti.","profil|P4|NUTRITION":"Relance le moteur avant de réduire quoi que ce soit.","profil|P5|ISHAPE":"Reconstruit le moteur que les régimes ont abîmé.","profil|P5|LUXO":"Débloque un corps qui ne répond plus.","profil|P5|NUTRITION":"Répare au lieu de forcer encore.","mesure|0|NUTRITION":"C''est le premier levier sur la graisse profonde.","mesure|0|SUIVI":"Se mesure chaque mois, noir sur blanc.","mesure|0|ISHAPE":"Reconstruit le muscle, qui soutient la dépense.","mesure|1|ISHAPE":"Stimule et tonifie la masse musculaire.","mesure|1|SUIVI":"On la suit mois après mois pour la voir remonter.","mesure|1|NUTRITION":"Apporte ce qu''il faut pour reconstruire.","mesure|2|ISHAPE":"Travaille le muscle, dont cette mesure dépend en partie.","mesure|2|LUXO":"Agit sur ce qui l''a mis au ralenti.","mesure|2|SUIVI":"Se vérifie à chaque analyse mensuelle.","mesure|3|PRESSO":"Réduit la rétention et apporte de la légèreté.","mesure|3|SUIVI":"On la mesure pour distinguer l''eau de la graisse.","mesure|3|NUTRITION":"Retire ce qui fait retenir l''eau.","mesure|4|SUIVI":"C''est le repère qui résume tous les autres.","mesure|4|ISHAPE":"Le muscle est ce qui le fait remonter le plus vite.","mesure|4|NUTRITION":"Soutient l''ensemble des indicateurs."},"REPLI":{"LUXO":"Agit sur les mécanismes qui entretiennent la prise de poids.","RELAX":"Fait redescendre la tension, condition pour que le corps relâche.","ISHAPE":"Sollicite le muscle, le moteur de votre dépense.","PRESSO":"Draine, relance la circulation et l''élimination.","NUTRITION":"Adapte votre alimentation à ce que votre corps demande aujourd''hui.","SUIVI":"Un point chaque semaine, une mesure chaque mois."}}'::jsonb)
WHERE version = 3;

COMMIT;

-- Contrôle : tout est en place, et les questions n'ont pas bougé.
SELECT
  (SELECT count(*) FROM jsonb_object_keys(contenu->'AX')) AS axes,
  (SELECT count(*) FROM jsonb_array_elements(contenu->'STEPS') s WHERE s ? 'lecture') AS mesures_lues,
  (SELECT count(*) FROM jsonb_object_keys(contenu->'RESTITUTION'->'EFFET')) AS effets,
  (SELECT count(*) FROM jsonb_array_elements(contenu->'STEPS')) AS etapes,
  contenu->'AX'->'P1'->>'sig' AS sous_titre_reconfort
FROM bareme_empreinte WHERE version = 3;
