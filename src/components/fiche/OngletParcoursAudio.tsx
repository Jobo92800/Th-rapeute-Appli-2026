import { useQuery } from '@tanstack/react-query';
import { contratsDeLaCliente } from '../../services/metier';
import SuiviPodcasts from './SuiviPodcasts';
import CarteParcoursAudio from './CarteParcoursAudio';
import type { Cliente } from '../../types/db';

/**
 * Tout ce qui touche à « Mon Parcours », au même endroit.
 *
 * D'abord ce que la cliente écoute cette semaine — c'est ce que la
 * thérapeute regarde à chaque rendez-vous —, puis le compte lui-même, qui
 * ne se manipule qu'en rattrapage. Le bloc du compte vivait dans l'onglet
 * Contrat parce que l'accès se donne à la signature ; il garde ce
 * discours, il a seulement changé d'onglet.
 */
export default function OngletParcoursAudio({ cliente }: { cliente: Cliente }) {
  const { data: contrats = [] } = useQuery({
    queryKey: ['contrats', cliente.id],
    queryFn: () => contratsDeLaCliente(cliente.id),
  });

  return (
    <div className="space-y-5">
      <SuiviPodcasts cliente={cliente} />
      <CarteParcoursAudio cliente={cliente} contratSigneLe={contrats[0]?.signe_le ?? null} />
    </div>
  );
}
