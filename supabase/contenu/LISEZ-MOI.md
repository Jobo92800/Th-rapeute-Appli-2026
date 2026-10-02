# Le contenu de la restitution BioPortrait

`restitution-bioportrait.json` est **la source** des textes de la restitution
remise à la cliente : les interprétations de chaque profil et de chaque
terrain, ce que dit chaque réponse d'analyse, les soins et la matrice qui met
un soin en face de chaque point du bilan.

Il sert deux fois, et c'est tout l'intérêt :

- la **migration 076** en est générée, et c'est elle qui pose le contenu dans
  `bareme_empreinte` — l'application ne lit jamais ce fichier à l'exécution,
  elle lit le barème du bilan, qui est versionné ;
- le **banc d'essai** le lit pour vérifier la logique sans toucher au réseau.

Sans ce fichier commun, le banc contrôlerait une copie des textes et pas ceux
qui partent chez la cliente.

## Changer un texte

1. modifier `restitution-bioportrait.json` ;
2. régénérer la migration : `node tests/generer-migration-restitution.mjs` ;
3. passer la migration dans l'éditeur SQL ;
4. `npm test`.

Les textes portent `{e}` là où l'accord dépend de la personne — « vous êtes
allongé{e} ». L'application remplace par « e » ou par rien selon la civilité.
