---
name: amend-pr
description: My preferences for updating pull requests. (only trigger when invoked)
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr view:*), Bash(gh pr edit:*)
---

Unless directed otherwise, when this skill is invoked:

1. Make the changes and verify they accomplish what was requested.
2. `git add` the intended changes. Check `git status` for stray files.
3. `git commit --amend` onto the existing commit so the PR stays a single commit. Keep the existing message unless the change makes it inaccurate.
4. `git push --force-with-lease`.
5. Update the PR title and description with `gh pr edit` only if the amendment changed what the PR does.

## PR description

- Short. A few sentences of what and why, then bullets only if the change has distinct parts.
- List verification you actually performed. Never include a plan for verification you didn't do.
- No AI attribution or co-author trailers.
- Add code blocks, diagrams, or screenshots only when the change is genuinely hard to follow without them. Default to none.
