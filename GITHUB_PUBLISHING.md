# GitHub publishing and recovery

Notes on how the Aethervault repository is hosted, how to push future work, and how to restore the project on another PC. This file contains no credentials and must stay that way.

## Repository

| Item | Value |
|---|---|
| URL | https://github.com/wefwa232/Aethervault |
| Visibility | **Public** (changed by the owner after the initial private publication on 2026-10-22) |
| Remote name | `origin` (`https://github.com/wefwa232/Aethervault.git`) |
| Default branch on GitHub | `phase-five` (current development branch, contains all Phase Four and Phase Five work) |
| Stable older checkpoint | `main` (Phase Three checkpoint, `23c8bb2`; not the latest state) |
| Initial publication date | 2026-10-22 |
| License | None. All rights are reserved by default. Do not add an open-source license without a decision. |

## Published branches

| Branch | Head | Meaning |
|---|---|---|
| `phase-five` | current head (see `git log -1`) | Current development: Combat A and Combat B complete, Combat C not started |
| `phase-four` | `6f44c1b` | Phase Four work line; the completed checkpoint is tagged `phase-four-complete` |
| `main` | `23c8bb2` | Phase Three checkpoint (v0.4) |

Only project branches are published. No unrelated branches exist in this repository.

## Published tags

- `phase-three-complete` (`23c8bb2`)
- `phase-four-complete` (`89d7920`)
- `phase-five-combat-a` (`dccdc42`)
- `phase-five-combat-b` (`6fb43d9`)

## Future pushes

Commit on `phase-five` as usual, then push the branch:

```bash
git push
```

Push a new tag after creating it:

```bash
git tag <tag-name> <commit>
git push origin <tag-name>
```

Push every tag at once (only when you intend to publish all of them):

```bash
git push origin --tags
```

Never use `git push --force` on this repository. It is not needed for normal work and would rewrite published history.

## Clone on another PC

Requirements: Git, and Node.js if you want to run the test scripts. Chrome is recommended for playing.

```bash
git clone https://github.com/wefwa232/Aethervault.git
cd Aethervault
git checkout phase-five
```

GitHub requires you to be signed in to the `wefwa232` account to clone the repository if it is made private again. Use the GitHub login or a personal access token stored in your own credential manager. Do not paste tokens into files, commits or chat.

## Restore the project from GitHub

1. Clone the repository as above.
2. Run `git checkout phase-five` to resume development, or `git checkout phase-four-complete` / `git checkout phase-five-combat-b` (detached) to inspect a checkpoint.
3. Play with `Play-Aethervault.bat` on Windows, or `node serve.mjs 5173` and open `http://127.0.0.1:5173`.

Saves are not in the repository. A restored clone starts with an empty save unless you move your save manually (see below).

## Verify the correct branch after cloning

```bash
git branch --show-current        # expect: phase-five
git log -1 --oneline             # expect the latest phase-five commit
git tag --list "phase-*"         # expect the four tags listed above
git status                       # expect: nothing to commit, working tree clean
```

## Reminders

- **Do not commit secrets.** No API keys, OAuth secrets, tokens, passwords, private keys, cookies or `.env` files.
- **Do not commit local saves or browser profiles.** Save data lives in the browser's local storage, not in the repository. Export it yourself if you need it elsewhere.
- **Do not commit test output that contains local paths** unless you have decided to keep it as documentation.
- **Pushing source code does not deploy the game as a website.** GitHub Pages, Vercel or any other hosting is a separate, unbuilt decision. Nothing in this repository is live on the internet.
- If a secret is ever pushed by mistake, rotate it immediately. Removing it from a later commit does not remove it from history.
