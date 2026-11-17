> 🇬🇧 [English version](README.md)

# @quatrain/git

Git pour les applications Quatrain : le contrat des adaptateurs de forge (Forgejo, GitHub…) et
une copie de travail locale d'un dépôt.

## Adaptateurs de forge

`GitForgeAdapterInterface` décrit ce qu'une application demande à une forge par son API ou sa
ligne de commande : dépôts, pull requests, releases, arborescences de fichiers.
`AbstractGitForgeAdapter` et `AbstractGitHttpClient` sont les bases des adaptateurs, comme
`@quatrain/git-forgejo` et `@quatrain/git-github`.

## Copie de travail

`GitWorkingCopy` garde un répertoire à jour avec une branche d'un dépôt distant, pour les
applications qui modifient les fichiers d'un dépôt sur disque.

```typescript
import { GitWorkingCopy } from '@quatrain/git'

const copy = new GitWorkingCopy({
   path: '/data/acme/knowledge',
   remote: 'https://git.example.org/acme/knowledge.git',
   branch: 'main',
   token: () => secrets.get('acme', 'repository.token'),
   author: { name: 'Ada', email: 'ada@example.org' },
})

await copy.prepare() // première fois : récupère la branche ; ensuite : la met à jour
// … écrire des fichiers sous copy.path …
await copy.commit('feat: add the onboarding guide', ['content/guides/onboarding.md'])
await copy.push()
const { clean, changes, lastCommit, ahead } = await copy.status()
```

| Méthode | Effet |
|---|---|
| `prepare()` | Crée la copie de travail et récupère la branche, ou la met à jour. Un dépôt distant sans cette branche donne une copie vide ; le premier envoi crée la branche |
| `refresh()` | Récupère et avance la branche. Échoue si les deux côtés ont avancé : l'historique n'est jamais réécrit |
| `status()` | Branche, modifications en attente, dernier commit, commits pas encore envoyés |
| `commit(message, paths?, author?)` | Valide les chemins donnés, ou toutes les modifications. Renvoie `false` s'il n'y a rien à valider |
| `push()` | Envoie la branche |

Ce qu'elle garantit :

- **Pas de shell.** Git reçoit ses arguments sous forme de liste : un nom de fichier ou un
  message n'est jamais lu comme une commande.
- **Le jeton reste en mémoire.** Il est envoyé comme en-tête HTTP, transmis à git par
  l'environnement de son processus et limité au dépôt distant. Il n'est jamais dans l'adresse du
  dépôt, dans la configuration de la copie de travail, sur une ligne de commande ni dans un
  message d'erreur. Une adresse portant un identifiant est refusée.
- **Rien de la machine.** La configuration système et utilisateur, les assistants
  d'identification et les hooks sont ignorés.
- **HTTPS uniquement**, sauf indication contraire dans `protocols`, et aucune redirection n'est
  suivie.
- **Pas de lien symbolique.** Les liens stockés dans le dépôt sont extraits comme de simples
  fichiers : son contenu ne peut donc pas pointer hors de la copie de travail.
- **Une opération à la fois** sur une même instance.

Un échec lève `GitCommandError`, dont le message reprend ce que git a affiché.

`GitWorkingCopy` ne décide pas quelles adresses peuvent être jointes : une application qui
reçoit l'adresse de ses utilisateurs la vérifie d'abord.
