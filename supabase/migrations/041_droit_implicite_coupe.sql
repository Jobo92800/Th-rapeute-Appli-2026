/*
  MAbeautyplus V2 — Migration 041 : couper le droit implicite pour l'avenir

  La 040 referme les commandes qui existent aujourd'hui. Celle-ci empêche le
  défaut de revenir : PostgreSQL ouvre à tout le monde chaque commande
  nouvellement créée, et il suffit d'un oubli pour rouvrir la porte.

  Elle tient en une ligne, et elle est **volontairement séparée de la 040**.
  C'est la ligne la plus susceptible d'échouer selon les droits du compte qui
  la joue — et comme PostgreSQL annule un script entier au premier échec,
  la garder avec le reste risquait de faire retomber la correction
  essentielle. Séparée, si elle échoue, la 040 reste appliquée.

  CE QUE ÇA CHANGE POUR LA SUITE : toute nouvelle commande devra porter son
  propre `GRANT EXECUTE`, sans quoi elle ne sera appelable par personne et
  ça se verra immédiatement. C'est le but — un échec bruyant vaut mieux
  qu'une porte ouverte que personne ne remarque pendant six mois.

  Pour revenir en arrière si elle gênait :

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
*/

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
