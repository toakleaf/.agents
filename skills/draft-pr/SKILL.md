---
name: draft-pr
description: My preferences for turning file changes into a pull request (PR)
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git fetch:*), Bash(git switch:*), Bash(git checkout:*), Bash(git stash:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr create:*), Bash(gh pr view:*)
---

Unless directed otherwise, when this skill is invoked:

1. Run `git status` first and branch accordingly:
   - branches named "worktree<n>" are long lived worktree branches and should not be pushed to remote or used for pr
   - **Already on a non-default branch** with the intended work — stay on it.
   - **On the default branch** — `git fetch`, then `git switch -c <name> origin/<default>`. Uncommitted changes carry over; if the switch is refused, stash, switch, then pop.
   - Name the branch `feature|bugfix/<team>/[<ticket>-]<slug>`. Team is `ui/arch` for product/UI code, `ait` for AI tooling, agents, skills, and harness config. (See the `git-branch-naming` skill.)
2. If the changes aren't finished, make them. If they are, confirm they're present on this branch.
3. `git add` the intended changes. Don't blanket-add — check `git status` for stray files.
4. If changes are part of publishable package[s], include changeset[s].
5. Commit. Match the repo's existing convention — run `git log --oneline -10` and follow what's there (subject prefixes, ticket IDs, casing). Keep the subject short.
6. `git push -u origin HEAD`.
7. `gh pr create --draft --base <default-branch>`. Report the PR URL.

## PR description

- Short. A few sentences of what and why, then bullets only if the change has distinct parts.
- List verification you actually performed. Never include a plan for verification you didn't do.
- No AI attribution or co-author trailers.
- Add code blocks, diagrams, or screenshots only when the change is genuinely hard to follow without them. Default to none.
