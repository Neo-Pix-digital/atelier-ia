# Atelier IA · NéoPix

Plateforme web de l'atelier « L'IA pour gagner 3 heures par semaine ».

- `index.html` : espace participant (code d'accès, sommaire, modules, chat, questionnaire)
- `admin.html` : espace animateur (suivi en direct, chat, contenu, sessions et codes)
- `shared.js`, `style.css` : fichiers communs
- `supabase/` : structure de la base de données (déjà installée, pour archive)

## Mise en ligne sur GitHub Pages (une seule fois, environ 5 minutes)

1. Sur github.com, dans l'organisation **Neo-Pix-digital**, créer un dépôt public nommé `atelier-ia`.
2. Cliquer sur **uploading an existing file**, glisser tous les fichiers du dossier (y compris `.nojekyll`), puis **Commit changes**.
3. Aller dans **Settings → Pages**, choisir **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
4. Après une à deux minutes, le site est en ligne :
   - Participants : `https://neo-pix-digital.github.io/atelier-ia/`
   - Animateur : `https://neo-pix-digital.github.io/atelier-ia/admin.html`

## Utilisation

- Clé animateur : la même que pour l'administration de la fiche client NéoPix.
- Code d'accès de la première session : `NEOPIX-IA` (à changer dans l'onglet « Sessions et codes »).
- Lien direct à envoyer aux participants : `https://neo-pix-digital.github.io/atelier-ia/?code=NEOPIX-IA` (le code est prérempli).
- Une nouvelle session par atelier : chaque session a son code, ses participants et son chat.
- Vidéos : de préférence sur YouTube en « non répertoriée », puis coller le lien dans le module.
