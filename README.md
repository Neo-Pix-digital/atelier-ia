# Atelier IA · NéoPix

Plateforme web de l'atelier « L'IA pour gagner 3 heures par semaine ». Version 1.2 · NéoPix digital.

- `index.html` + `app.js` : espace participant (code d'accès, sommaire, modules, demande d'aide, chat, questionnaire, vos données)
- `admin.html` + `admin.js` : espace animateur (tableau de bord en direct, module affiché à tous, alertes d'aide, chat, contenu, sessions et codes, réglages et vérification)
- `shared.js`, `theme.js`, `style.css`, `fonts/` : fichiers communs (thème clair/sombre, polices hébergées ici, sans appel à Google)
- Couleur principale : variables `--accent` et `--accent-soft` en haut de `style.css`
- `supabase/` : structure de la base de données (déjà installée, pour archive)

Adresses :
- Participants : https://neo-pix-digital.github.io/atelier-ia/
- Animateur : https://neo-pix-digital.github.io/atelier-ia/admin.html

## Avant chaque mise en ligne (6 points)

1. Déposer **tous** les fichiers reçus, dossier `fonts` compris, à la racine du dépôt.
2. Attendre 2 minutes, puis ouvrir l'espace animateur avec un rafraîchissement forcé (Ctrl + F5).
3. Onglet **Réglages et vérification** : la version affichée correspond à celle annoncée par Claude.
4. Cliquer sur **Lancer la vérification** : toutes les lignes doivent être vertes.
5. Ouvrir l'espace participant sur téléphone : le premier module s'affiche correctement.
6. En cas de ligne rouge : ne pas animer avec cette version, envoyer une capture à Claude.

## Après chaque atelier

- Onglet **Suivi en direct** : **Exporter cette session (Excel)** pour les relances.
- **Sauvegarde complète** : à ranger en lieu sûr (elle contient des données personnelles).

## Si le site affiche une erreur de connexion (base en pause)

Une tâche planifiée interroge la base les lundis et jeudis pour éviter la mise en pause de l'offre gratuite. Si la base est malgré tout en pause :

1. Ouvrir https://supabase.com/dashboard et se connecter.
2. Choisir le projet **neopix-fiche-client**.
3. Cliquer sur **Resume project** et attendre quelques minutes.
4. Relancer la vérification depuis l'espace animateur.

## Données personnelles

- Durée de conservation et e-mail de contact : onglet **Réglages et vérification**.
- Chaque participant peut supprimer lui-même ses données depuis l'atelier.
- Le texte « Vos données » est un modèle sérieux, mais il n'a pas été relu par un juriste.
