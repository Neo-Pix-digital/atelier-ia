-- Contenu initial des 7 modules + première session test
insert into public.atelier_modules (id, position, title, duration, summary, body, prompts, kind) values
('m1', 10, 'Bienvenue', '10 min',
 'Le programme des 2 heures et la seule question qui compte pour commencer.',
$c$## Ce que vous allez obtenir
En 2 heures, vous repartez avec **3 usages concrets de l'IA**, testés sur votre propre entreprise, qui vous feront gagner du temps dès la semaine prochaine.

## Comment ça se passe
- Pas de théorie inutile : les trois quarts du temps, vous pratiquez.
- Vous travaillez sur **vos vrais cas** : vos clients, vos messages, vos tâches.
- Vous suivez votre avancée ici, module par module, et vous pouvez poser vos questions dans le chat à tout moment.

## Pour démarrer
> Quelle tâche vous fait perdre le plus de temps chaque semaine ?

Notez votre réponse dans le chat de l'atelier : on s'en servira pendant les exercices.$c$,
 '[]'::jsonb, 'lesson'),

('m2', 20, 'Comprendre l''IA en 15 minutes', '15 min',
 'Ce que l''IA fait bien, ce qu''elle fait mal, et la formule pour bien lui parler.',
$c$## Trois idées à retenir
1. **L'IA est un assistant très rapide.** Elle excelle pour rédiger, résumer, reformuler et structurer.
2. **Elle peut se tromper avec assurance.** On relit toujours avant d'envoyer.
3. **Plus la demande est précise, meilleur est le résultat.** C'est toute la compétence à acquérir.

## La formule d'une bonne demande
- **Rôle :** qui l'IA doit être (« Tu es un commerçant expérimenté… »).
- **Contexte :** votre entreprise, votre client, la situation.
- **Tâche :** ce que vous voulez exactement.
- **Format :** longueur, ton, présentation.

## La démonstration
Comparez les deux demandes ci-dessous sur le même sujet. Copiez-les une par une dans votre assistant IA et regardez la différence.$c$,
 '["Écris une réponse à un client mécontent.", "Tu es le gérant d''une boulangerie à La Réunion. Un client se plaint que sa commande de gâteau d''anniversaire était prête avec 30 minutes de retard. Rédige une réponse polie et sincère, qui s''excuse sans se justifier longuement et propose un geste commercial. Ton chaleureux, 5 lignes maximum."]'::jsonb,
 'lesson'),

('m3', 30, 'Atelier 1 : écrire plus vite', '25 min',
 'Mails, réponses clients et avis : faites rédiger le premier jet par l''IA.',
$c$## L'exercice
Choisissez **un vrai message** que vous devez écrire cette semaine : une réponse à un client, une relance de devis, une réponse à un avis en ligne.

1. Copiez un modèle ci-dessous.
2. Remplacez tout ce qui est entre crochets par votre situation.
3. Lancez la demande, puis améliorez le résultat en répondant à l'IA : « plus court », « plus chaleureux », « ajoute le prix ».

> Astuce : si le résultat est trop général, demandez-vous ce qui manque à l'IA pour comprendre votre situation.$c$,
 '["Tu es le gérant de [type d''entreprise] à La Réunion. Un client m''écrit : « [copier son message] ». Rédige une réponse polie et rassurante, qui propose [solution]. Ton chaleureux mais professionnel, 5 lignes maximum.", "Voici un avis client laissé sur ma page : « [avis] ». Rédige une réponse publique qui remercie, reconnaît le problème s''il y en a un, et invite à revenir. 4 lignes, sans formules toutes faites.", "Rédige un mail de relance pour un devis envoyé il y a [nombre] jours à [client] pour [prestation]. Ton cordial, sans insister lourdement, avec une question simple pour obtenir une réponse."]'::jsonb,
 'lesson'),

('m4', 40, 'Atelier 2 : communiquer', '25 min',
 'Posts pour les réseaux sociaux et descriptions de produits, en quelques minutes.',
$c$## L'exercice
Préparez **un post** que vous pourriez publier cette semaine, et **une description** d'un produit ou service que vous vendez.

- Demandez toujours plusieurs propositions : vous choisissez, l'IA exécute.
- Gardez votre voix : si une formule ne vous ressemble pas, dites-le à l'IA.
- Relisez les prix, dates et horaires : c'est là que l'IA se trompe le plus.$c$,
 '["Tu es community manager pour [type d''entreprise]. Écris 3 propositions de post Facebook pour annoncer [nouveauté, promo, événement]. Public : [client type]. Ton : [décontracté / professionnel]. Termine chaque post par une invitation à [appeler, passer en boutique, réserver].", "Rédige une description de [produit ou service] pour mon site ou ma vitrine. Points forts : [liste]. Prix : [prix]. 80 mots maximum, ton simple et concret."]'::jsonb,
 'lesson'),

('m5', 50, 'Atelier 3 : s''organiser', '20 min',
 'Transformez ce que vous avez en tête en procédure, checklist ou planning.',
$c$## Pourquoi c'est le module le plus rentable
Ce que vous faites « de tête » ne peut pas être délégué. Une procédure claire, oui. L'IA est excellente pour transformer des explications en vrac en étapes ordonnées.

## L'exercice
1. Choisissez une tâche que vous êtes le seul à savoir faire : ouverture, commande fournisseur, inventaire, clôture de caisse.
2. Expliquez-la à l'IA comme vous l'expliqueriez à un nouvel employé, sans vous soucier de l'ordre.
3. Demandez-lui une procédure, puis une checklist à imprimer.$c$,
 '["Voici comment je fais [tâche] aujourd''hui, en vrac : [explication]. Transforme ça en procédure claire, étape par étape, qu''un nouvel employé pourrait suivre seul.", "À partir de cette procédure, crée une checklist courte à imprimer et à cocher chaque jour.", "J''ai ces tâches à faire cette semaine : [liste]. Classe-les par urgence et importance, puis propose-moi un planning réaliste réparti du lundi au samedi."]'::jsonb,
 'lesson'),

('m6', 60, 'Prudence et plan d''action', '10 min',
 'Les 3 règles de sécurité, puis vos 3 usages pour la semaine.',
$c$## À ne jamais donner à une IA
- Coordonnées bancaires et mots de passe.
- Données personnelles de vos clients (noms complets, adresses, téléphones).
- Documents confidentiels de votre entreprise.

## À toujours vérifier
- Chiffres, prix, dates et horaires.
- Mentions légales et informations réglementaires.
- L'IA ne remplace ni un comptable ni un juriste.

## Votre plan d'action
Notez ci-dessous les **3 usages** que vous allez appliquer dès cette semaine. Ils sont enregistrés automatiquement.

[[plan]]$c$,
 '[]'::jsonb, 'lesson'),

('m7', 70, 'Votre avis', '5 min',
 'Quelques questions rapides pour améliorer l''atelier. Vos réponses comptent vraiment.',
$c$Merci d'avoir participé à cette première session. Répondez franchement : c'est ce qui nous permet d'améliorer l'atelier.$c$,
 '[]'::jsonb, 'feedback')
on conflict (id) do nothing;

insert into public.atelier_sessions (label, code)
select 'Atelier test n°1', 'NEOPIX-IA'
where not exists (select 1 from public.atelier_sessions);
