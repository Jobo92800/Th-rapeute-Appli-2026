import ChoixDeVille from '../ChoixDeVille';
import type { useVilleAutomatique } from '../../lib/villeAutomatique';

/*
  Les coordonnées d'une cliente, telles que les deux bilans les demandent.

  Le BioPortrait et le Bio-Portrait Anti-Âge ouvrent tous deux sur cet
  écran : même fiche, mêmes champs, même ville déduite du code postal. Le
  formulaire vit ici une fois, pour que les deux ne divergent jamais.
*/

export interface Contact {
  civilite: 'Mme' | 'M.';
  date_naissance: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  code_postal: string;
  ville: string;
  age: string;
}

export const CONTACT_VIDE: Contact = {
  civilite: 'Mme',
  date_naissance: '',
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  adresse: '',
  code_postal: '',
  ville: '',
  age: '',
};

/** L'âge se calcule : on ne le demande pas deux fois. */
export function ageDepuis(naissance: string): string {
  if (!naissance) return '';
  const d = new Date(naissance);
  if (Number.isNaN(d.getTime())) return '';

  const maintenant = new Date();
  let age = maintenant.getFullYear() - d.getFullYear();
  const m = maintenant.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && maintenant.getDate() < d.getDate())) age--;

  return age > 0 && age < 120 ? String(age) : '';
}

export function ChampContact({
  id,
  libelle,
  v,
  on,
  type = 'text',
}: {
  id: string;
  libelle: string;
  v: string;
  on: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiquette">
        {libelle}
      </label>
      <input id={id} type={type} value={v} onChange={(e) => on(e.target.value)} className="champ" />
    </div>
  );
}

/** Le formulaire complet, civilité comprise. `prefixe` distingue deux écrans sur une même page. */
export function FormulaireCoordonnees({
  contact,
  setContact,
  villes,
  prefixe,
}: {
  contact: Contact;
  setContact: (f: (c: Contact) => Contact) => void;
  villes: ReturnType<typeof useVilleAutomatique>;
  prefixe: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="etiquette">Civilité</span>
        <div className="flex gap-2">
          {(['Mme', 'M.'] as const).map((civ) => (
            <button
              key={civ}
              type="button"
              onClick={() => setContact((c) => ({ ...c, civilite: civ }))}
              aria-pressed={contact.civilite === civ}
              className={`flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                contact.civilite === civ
                  ? 'border-marine-500 bg-marine-500 text-white'
                  : 'border-ardoise-200 bg-white text-ardoise-700 hover:border-marine-300'
              }`}
            >
              {civ === 'Mme' ? 'Madame' : 'Monsieur'}
            </button>
          ))}
        </div>
      </div>

      <ChampContact id={`${prefixe}_prenom`} libelle="Prénom" v={contact.prenom} on={(v) => setContact((c) => ({ ...c, prenom: v }))} />
      <ChampContact id={`${prefixe}_nom`} libelle="Nom" v={contact.nom} on={(v) => setContact((c) => ({ ...c, nom: v }))} />
      <ChampContact id={`${prefixe}_naissance`} libelle="Date de naissance" type="date" v={contact.date_naissance} on={(v) => setContact((c) => ({ ...c, date_naissance: v, age: ageDepuis(v) || c.age }))} />
      <ChampContact id={`${prefixe}_age`} libelle="Âge" type="number" v={contact.age} on={(v) => setContact((c) => ({ ...c, age: v }))} />
      <ChampContact id={`${prefixe}_tel`} libelle="Téléphone" type="tel" v={contact.telephone} on={(v) => setContact((c) => ({ ...c, telephone: v }))} />
      <ChampContact id={`${prefixe}_mail`} libelle="Email" type="email" v={contact.email} on={(v) => setContact((c) => ({ ...c, email: v }))} />
      <div className="sm:col-span-2">
        <ChampContact id={`${prefixe}_adr`} libelle="Adresse" v={contact.adresse} on={(v) => setContact((c) => ({ ...c, adresse: v }))} />
      </div>
      <ChampContact id={`${prefixe}_cp`} libelle="Code postal" v={contact.code_postal} on={(v) => setContact((c) => ({ ...c, code_postal: v }))} />
      <div>
        <ChampContact id={`${prefixe}_ville`} libelle="Ville" v={contact.ville} on={(v) => setContact((c) => ({ ...c, ville: v }))} />
        <ChoixDeVille propositions={villes.propositions} onChoisir={villes.choisir} />
      </div>
    </div>
  );
}

/** Les coordonnées telles qu'on les écrit sur la fiche. */
export function coordonneesPourLaFiche(contact: Contact) {
  return {
    civilite: contact.civilite,
    prenom: contact.prenom.trim(),
    nom: contact.nom.trim(),
    email: contact.email || null,
    telephone: contact.telephone || null,
    date_naissance: contact.date_naissance || null,
    age: contact.age ? Number(contact.age) : null,
    adresse: contact.adresse || null,
    code_postal: contact.code_postal || null,
    ville: contact.ville || null,
  };
}
