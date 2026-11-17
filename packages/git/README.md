> 🇫🇷 [Version française](README.fr.md)

# @quatrain/git

Git for Quatrain applications: the contract of forge adapters (Forgejo, GitHub…) and a local
working copy of a repository.

## Forge adapters

`GitForgeAdapterInterface` describes what an application asks a forge through its API or its
command line: repositories, pull requests, releases, file trees. `AbstractGitForgeAdapter` and
`AbstractGitHttpClient` are the bases of the adapters, such as `@quatrain/git-forgejo` and
`@quatrain/git-github`.

## Working copy

`GitWorkingCopy` keeps a directory in step with a branch of a remote, for applications that
edit the files of a repository on disk.

```typescript
import { GitWorkingCopy } from '@quatrain/git'

const copy = new GitWorkingCopy({
   path: '/data/acme/knowledge',
   remote: 'https://git.example.org/acme/knowledge.git',
   branch: 'main',
   token: () => secrets.get('acme', 'repository.token'),
   author: { name: 'Ada', email: 'ada@example.org' },
})

await copy.prepare() // first use: fetches the branch; later: fast-forwards it
// … write files under copy.path …
await copy.commit('feat: add the onboarding guide', ['content/guides/onboarding.md'])
await copy.push()
const { clean, changes, lastCommit, ahead } = await copy.status()
```

| Method | Does |
|---|---|
| `prepare()` | Creates the working copy and fetches the branch, or brings it up to date. A remote without the branch gives an empty working copy; the first push creates the branch |
| `refresh()` | Fetches and fast-forwards. Fails when both sides moved: history is never rewritten |
| `status()` | Branch, pending changes, last commit, commits not pushed yet |
| `commit(message, paths?, author?)` | Commits the paths, or every change. Returns `false` when there is nothing to commit |
| `push()` | Pushes the branch |

What it guarantees:

- **No shell.** Git receives its arguments as a list: a file name or a message is never read
  as a command.
- **The token stays in memory.** It is sent as an HTTP header, given to git through the
  environment of its process and scoped to the remote. It is never in the remote address, in
  the configuration of the working copy, on a command line nor in an error message. A remote
  address carrying a credential is refused.
- **Nothing from the machine.** System and user configuration, credential helpers and hooks
  are ignored.
- **HTTPS only**, unless `protocols` says otherwise, and no redirection is followed.
- **No symbolic link.** Links stored in the repository are checked out as plain files, so its
  content cannot point outside the working copy.
- **One operation at a time** on a given instance.

A failure raises `GitCommandError`, whose message holds what git printed.

`GitWorkingCopy` does not decide which addresses may be reached: an application that takes the
remote from its users checks it first.
