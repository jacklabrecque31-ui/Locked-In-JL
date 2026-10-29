# Locked-in HEC

Site d'étude personnel : résumés, cheat sheets, QCM et agenda de la session A2026.

Tout le contenu est **chiffré** (dossiers `data/` et `img/`). Le dépôt peut donc être public :
sans le mot de passe, personne ne peut lire les notes, même avec le code source.

## Utilisation

- Ouvre le site, entre le mot de passe une fois par appareil, coche « Rester connecté ».
- **iPhone** : Safari → Partager → « Sur l'écran d'accueil ». **Android** : Chrome → ⋮ → « Ajouter à l'écran d'accueil ».
- « Verrouiller cet appareil » (bas du menu) efface la clé de l'appareil.

## D'où vient l'agenda

| Source | Mise à jour | Contenu |
|---|---|---|
| Flux du calendrier ZoneCours | GitHub Actions, toutes les 3 h (`.github/workflows/agenda.yml`) | quiz, remises, examens avec date |
| Tâche Claude du matin (~8 h) | quand l'ordinateur est allumé | nouvelles séances (résumé, cheat sheet, QCM), lectures et préparation |
| Saisie manuelle | à la main | finaux, projets |

Le flux de calendrier se configure une fois : ZoneCours → Calendrier → « Flux du calendrier »,
copier le lien, puis dans GitHub : Settings → Secrets and variables → Actions → New repository secret,
nom `CANVAS_ICS_URL`, valeur = le lien.

## Commandes (pour l'automatisation)

Il faut Node 20 ou plus récent. Ces commandes n'utilisent que la clé publique : aucun mot de passe nécessaire.

```sh
node tools/put.mjs seance  seance.json         # ajoute ou remplace une séance
node tools/put.mjs image   <clé> diapo.jpg     # chiffre une image, affiche le chemin à mettre dans la séance
node tools/put.mjs agenda-zc     agenda.json   # lectures, préparation et remises trouvées sur ZoneCours
node tools/put.mjs agenda-manuel agenda.json   # finaux, projets
node tools/put.mjs etat    etat.json           # date de la dernière vérification, fichiers déjà vus
```

Ne jamais mettre les fichiers JSON en clair dans le dépôt.

## Changer le mot de passe

```sh
LI_OLD='ancien' LI_PASSWORD='nouveau' node tools/keygen.mjs --rewrap
```

Cette commande garde la même paire de clés : le contenu déjà chiffré reste lisible.
Chaque appareil redemandera le nouveau mot de passe.
