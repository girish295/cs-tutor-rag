---
id: git-fundamentals
title: Git Fundamentals and Branching
topic: Tools and Workflow
tags: [git, version-control, branching, merge, rebase, commit]
difficulty: beginner
---

## The three areas

Git moves changes through three places, and nearly every confusing Git moment comes from losing track of which one a file is in.

1. The **working directory** — the files you edit on disk.
2. The **staging area**, also called the index — changes marked for the next commit.
3. The **repository** — the permanent history of commits in `.git`.

`git add` moves changes from working directory to staging. `git commit` moves staged changes into the repository. `git status` tells you exactly where everything currently sits, and is the command to run whenever you are unsure.

The staging area exists so you can commit a *subset* of your changes. If you fixed a bug and also reformatted a file, you can stage and commit them separately, keeping history meaningful.

## Commits are snapshots

A commit records the full state of the tracked tree, along with a parent pointer, author, timestamp and message. Each commit is identified by a SHA-1 hash of its content, which is why history is effectively tamper-evident: changing anything changes every subsequent hash.

Because commits point to their parents, the history forms a directed acyclic graph. A **branch** is nothing more than a movable pointer to one commit, which is why creating a branch in Git is instant and essentially free.

`HEAD` is a pointer to the branch you currently have checked out. "Detached HEAD" simply means `HEAD` points straight at a commit rather than at a branch, so new commits would not advance any branch.

## Everyday commands

```bash
git init                      # create a repository
git clone <url>               # copy a remote repository
git status                    # what is modified, staged, untracked
git diff                      # working directory vs staged
git diff --staged             # staged vs last commit
git add <file>                # stage a file
git add -p                    # stage selected hunks interactively
git commit -m "message"       # commit staged changes
git log --oneline --graph     # compact visual history
```

## Writing good commit messages

The widely followed convention is a summary line of 50 characters or fewer, written in the imperative mood — "Add retry to upload handler", not "Added" or "Adds" — then a blank line, then a body explaining *why* if it is not obvious.

The imperative mood matches the messages Git itself generates, and the emphasis on why matters because the diff already shows what changed; what it cannot show is the reasoning.

## Branching and merging

```bash
git switch -c feature/login   # create and switch (modern form)
git switch main               # switch back
git merge feature/login       # merge the branch into the current one
git branch -d feature/login   # delete once merged
```

A **fast-forward** merge happens when the target branch has no new commits: Git simply advances the pointer, adding no merge commit. A **three-way merge** is needed when both branches advanced, and it produces a merge commit with two parents.

A **conflict** occurs when both branches changed the same lines. Git marks the regions with `<<<<<<<`, `=======` and `>>>>>>>`; you edit the file to the desired final state, delete the markers, `git add` it, and commit. Leaving a marker in the file is the classic conflict-resolution mistake, so search for `<<<<<<<` before committing.

## Merge versus rebase

`git merge` preserves history exactly as it happened and adds a merge commit. `git rebase` replays your commits on top of another branch, producing a linear history with no merge commit — but it **rewrites commits**, giving them new hashes.

```bash
git rebase main               # replay current branch on top of main
git rebase -i HEAD~3          # interactively squash, reword, reorder
```

The governing rule: **never rebase commits that others have already pulled.** Rewriting shared history forces everyone else into a painful recovery. Rebase freely on your own unpushed local branches, where it is excellent for tidying work before review; merge when integrating shared branches.

## Undoing things

Choosing the wrong undo command is how people lose work, so it is worth knowing precisely what each does.

- `git restore <file>` — discard working-directory changes to a file. **Destructive**, the changes are gone.
- `git restore --staged <file>` — unstage but keep the edits.
- `git commit --amend` — replace the previous commit. Rewrites history, so avoid after pushing.
- `git reset --soft HEAD~1` — undo the commit, keep changes staged.
- `git reset --mixed HEAD~1` — undo the commit, keep changes unstaged. This is the default.
- `git reset --hard HEAD~1` — undo the commit and **delete the changes**. The dangerous one.
- `git revert <commit>` — create a *new* commit that undoes an old one. Safe on shared branches because it adds history rather than rewriting it.

`git reflog` records where `HEAD` has been, including after resets, so most "lost" commits are recoverable from it for a few weeks. It is the first thing to try after a bad `reset --hard`.

## Working with remotes

```bash
git remote -v                 # list remotes
git fetch                     # download refs without merging
git pull                      # fetch + merge into current branch
git push origin main          # upload commits
git push -u origin feature/x  # push and set upstream tracking
```

`fetch` is always safe — it only updates your view of the remote. `pull` changes your working branch, which is why `fetch` followed by inspecting the incoming commits is the more cautious habit.

## .gitignore

A `.gitignore` file lists patterns Git should not track: dependencies such as `node_modules/`, build output such as `dist/` and `.next/`, environment files such as `.env.local`, and editor metadata.

Two important caveats. `.gitignore` only affects **untracked** files; a file already committed keeps being tracked until you run `git rm --cached` on it. And ignoring a secret after committing it does not remove it from history — the value is still in the repository and must be treated as compromised and rotated.
