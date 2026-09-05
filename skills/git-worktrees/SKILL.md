---
name: git-worktrees
description: Instructions for any use of git woktrees
---

- Branches named "worktree<n>" are long-lived worktree specific branches. They should never be pushed to remote or used in pull requests.

- In the ~/r9 directory

  - _Never_ create new, short-lived, temporary git worktrees.
  - Instead reuse the existing `/Users/toakleaf/r9/worktree<number>` worktrees that already exist
  - You can also use the `/Users/toakleaf/r9/r9` worktree if that's free as well
  - It's best to ensure that it's not currently in use or dirty.
  - When you're done with a worktree don't delete it, instead set the branch back to `worktree<number>` or main, and then hard reset the branch from origin main
  - This is because r9 is a huge repo, and creating a new worktree takes a long time and uses a ton of memory

- Outside of ~/r9 feel free to spin up temporary worktrees as needed, but _always_ clean them up ASAP
