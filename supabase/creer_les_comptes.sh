#!/usr/bin/env bash
#
# MAbeautyplus V2 — créer les comptes de connexion des thérapeutes
#
# Treize comptes en une commande, plutôt que treize formulaires.
#
# CE SCRIPT NE CONTIENT AUCUN SECRET. Il lit la clé de service dans
# l'environnement : elle ne s'écrit nulle part sur le disque, et elle ne
# part jamais ailleurs que chez Supabase.
#
# ─────────────────────────────────────────────────────────────────────────
# COMMENT S'EN SERVIR — une seule commande, rien à éditer
#
#   1. Récupérer la clé de service dans Supabase :
#        Project Settings → API → « service_role » → Reveal → copier
#
#   2. Lancer :
#
#        bash ~/Desktop/mabeautyplus-v2/supabase/creer_les_comptes.sh
#
#      Il demande la clé, puis le mot de passe. Collez, appuyez sur Entrée :
#      ni l'une ni l'autre ne s'affiche, et ni l'une ni l'autre n'entre dans
#      l'historique du Terminal.
#
# Une première version demandait d'écrire la clé dans une commande, entre
# guillemets. C'était une mauvaise idée : la clé finissait dans l'historique
# du shell, visible à qui rouvre le Terminal — et il suffisait de coller au
# mauvais endroit pour que rien ne marche. Les deux sont arrivés.
#
# Le script est rejouable : un compte déjà créé est signalé et laissé
# tranquille. Rien n'est écrasé.
# ─────────────────────────────────────────────────────────────────────────

set -u

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="$(grep -m1 '^VITE_SUPABASE_URL=' "$RACINE/.env" | cut -d= -f2- | tr -d '"'"'"' \r')"

if [ -z "$URL" ]; then
  echo "✗ Adresse Supabase introuvable dans .env"
  exit 1
fi

if [ -z "${CLE_SERVICE:-}" ]; then
  echo "Clé de service Supabase — Project Settings → API → service_role → Reveal"
  printf "Collez-la puis Entrée (elle ne s'affichera pas) : "
  read -rs CLE_SERVICE
  echo
fi

# Une clé Supabase est un jeton JWT : elle commence toujours par « eyJ ».
# Ce contrôle attrape le collage de travers avant treize appels pour rien.
case "$CLE_SERVICE" in
  eyJ*) ;;
  "")   echo "✗ Aucune clé saisie."; exit 1 ;;
  *)    echo "✗ Cette clé ne ressemble pas à une clé Supabase : elle devrait"
        echo "  commencer par « eyJ ». Un morceau de texte s'est peut-être"
        echo "  collé devant. Relancez et collez la clé seule."
        exit 1 ;;
esac

printf "Mot de passe de départ (il ne s'affichera pas) : "
read -rs MDP
echo
if [ ${#MDP} -lt 8 ]; then
  echo "✗ Supabase exige au moins 8 caractères."
  exit 1
fi

# Les treize thérapeutes, plus la direction.
COMPTES=(
  "marie@mabeautyplus.fr|Marie · Le Grau-du-Roi"
  "nadia@mabeautyplus.fr|Nadia · Le Grau-du-Roi"
  "stephanie@mabeautyplus.fr|Stéphanie · Le Grau-du-Roi"
  "fanny@mabeautyplus.fr|Fanny · Le Grau-du-Roi"
  "alex@mabeautyplus.fr|Alex · Le Crès"
  "malvina@mabeautyplus.fr|Malvina · Le Crès"
  "caroll@mabeautyplus.fr|Caroll · Sérignan"
  "aude@mabeautyplus.fr|Aude · Sérignan"
  "marie-san@mabeautyplus.fr|Marie-san · Sérignan"
  "marine@mabeautyplus.fr|Marine · Cabestany"
  "sara@mabeautyplus.fr|Sara · Cabestany"
  "alexandra@mabeautyplus.fr|Alexandra · Avignon"
  "laura@mabeautyplus.fr|Laura · Avignon"
)

echo
echo "  Création des comptes sur $URL"
echo "  ────────────────────────────────────────────────────────────"

crees=0
existants=0
echecs=0

for ligne in "${COMPTES[@]}"; do
  adresse="${ligne%%|*}"
  qui="${ligne##*|}"

  reponse=$(curl -s -w $'\n%{http_code}' -X POST "$URL/auth/v1/admin/users" \
    -H "apikey: $CLE_SERVICE" \
    -H "Authorization: Bearer $CLE_SERVICE" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"email":"%s","password":"%s","email_confirm":true}' "$adresse" "$MDP")")

  code="${reponse##*$'\n'}"
  corps="${reponse%$'\n'*}"

  case "$code" in
    200|201)
      printf "  ✓ %-34s %s\n" "$adresse" "$qui"
      crees=$((crees + 1))
      ;;
    422)
      # Adresse déjà prise : le compte existe, on ne touche à rien.
      printf "  · %-34s existe déjà, laissé tel quel\n" "$adresse"
      existants=$((existants + 1))
      ;;
    *)
      message=$(printf '%s' "$corps" | sed -n 's/.*"msg":"\([^"]*\)".*/\1/p')
      [ -z "$message" ] && message=$(printf '%s' "$corps" | head -c 120)
      printf "  ✗ %-34s HTTP %s — %s\n" "$adresse" "$code" "$message"
      echecs=$((echecs + 1))
      ;;
  esac
done

echo "  ────────────────────────────────────────────────────────────"
echo "  $crees créés · $existants déjà là · $echecs en échec"
echo
echo "  Il reste à relier ces comptes aux thérapeutes : collez"
echo "  supabase/rattacher_les_comptes.sql dans l'éditeur SQL."
echo
echo "  La clé n'a été écrite nulle part : elle disparaît avec ce Terminal."
