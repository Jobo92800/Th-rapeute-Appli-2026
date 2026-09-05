/*
  Les accords.

  Un monsieur ne doit jamais lire « archivée » sous son nom, ni signer un
  contrat où il déclare avoir été « informée ». Ces contrôles tiennent la
  règle : ce qui désigne une personne précise s'accorde à sa civilité.
*/

import { section, verifie, egal } from './harnais.mts';
import { abrege, accorde, estFeminin, laCliente, pronom, titre } from '../src/domain/civilite.ts';

export function controlerCivilite() {
  section('Le féminin et le masculin');

  egal('une dame', pronom('Mme'), 'elle');
  egal('un monsieur', pronom('M.'), 'il');
  egal('Madame en toutes lettres', titre('Mme'), 'Madame');
  egal('Monsieur en toutes lettres', titre('M.'), 'Monsieur');
  egal('abrégé au féminin', abrege('Mme'), 'Mme');
  egal('abrégé au masculin', abrege('M.'), 'M.');

  section('Le doute profite au féminin');

  /*
    Les 680 fiches reprises du CRM n'ont pas de civilité : Airtable ne la
    connaissait pas. Les traiter au masculin ferait 680 erreurs d'un coup.
  */
  verifie('une fiche sans civilité reste au féminin', estFeminin(null));
  verifie('et une civilité absente aussi', estFeminin(undefined));
  egal('le pronom suit', pronom(null), 'elle');

  section('Les participes');

  egal('archivé au masculin', accorde('archivé', 'M.'), 'archivé');
  egal('archivée au féminin', accorde('archivé', 'Mme'), 'archivée');
  egal('supprimé', accorde('supprimé', 'M.'), 'supprimé');
  egal('parrainée', accorde('parrainé', 'Mme'), 'parrainée');
  egal('venu', accorde('venu', 'M.'), 'venu');

  section('Nommer la personne');

  egal('la cliente', laCliente('Mme'), 'la cliente');
  egal('le client', laCliente('M.'), 'le client');
  egal('cette cliente', laCliente('Mme', 'cette'), 'cette cliente');
  egal('ce client', laCliente('M.', 'cette'), 'ce client');
  egal('une cliente', laCliente('Mme', 'une'), 'une cliente');
  egal('un client', laCliente('M.', 'une'), 'un client');
  egal('sans civilité, au féminin', laCliente(null, 'cette'), 'cette cliente');
}
