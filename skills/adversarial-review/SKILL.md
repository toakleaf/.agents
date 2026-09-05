---
name: adversarial-review
description: Run independent adversarial review rounds.
disable-model-invocation: true
---

Run independent adversarial reviewers after the work is done. Accept user overrides for target, models, agent count, harnesses, or max rounds. For private repos or PRs, get explicit user approval before sending repo context to external reviewer harnesses.

Defaults: target is current git diff; 1 agent per harness; rounds continue until every reviewer returns `LGTM`; Codex `gpt-5.5` medium; Claude `haiku`; Cursor `composer-2.5`.

If a harness reports an auth/setup failure, surface the report and ask the user to open/log into that app manually, then retry. Do not try to repair app authentication from inside the skill; smoke-test Claude before a full round, and if it reports `awsAuthRefresh`, stop/omit Claude and ask the user to refresh AWS auth before retrying. If Codex/Claude/Cursor report local state DB, PATH alias, app-server, session-env, or CLI config permission failures under a read-only sandbox, rerun that harness outside the sandbox after user approval; this is a local harness setup issue, not a review finding. If the rerun is denied or the user's terminal works but the sandbox does not, give exact `$REVIEW_DIR` commands for the user to run manually, then read the reports. Cursor uses the headless `agent` CLI, not the Cursor editor launcher. The current Cursor model name is `composer-2.5`, not `cursor-composer-2-5`.

For private local repos/PRs, first get informed approval that reviewer services may inspect/send private organization code/context outside the repo host. Then prefer repo-local review: check out/fetch the target locally, and prompt reviewers to inspect `git diff`/repo files themselves instead of pasting the full diff into the prompt. Only paste diff context for harnesses that cannot inspect local files.

Example round:

```sh
TMP_ROOT=${TMPDIR:-/tmp/}
REVIEW_DIR=${REVIEW_DIR:-$(mktemp -d "${TMP_ROOT%/}/adversarial-review.XXXXXX")}
HARNESS_HOME=${HARNESS_HOME:-$(mktemp -d "${TMP_ROOT%/}/adversarial-harness-home.XXXXXX")}
mkdir -p "$HARNESS_HOME/codex" "$HARNESS_HOME/xdg/cursor"
cp "$HOME/.codex/auth.json" "$HARNESS_HOME/codex/auth.json" 2>/dev/null || true
cp "$HOME/.codex/config.toml" "$HARNESS_HOME/codex/config.toml" 2>/dev/null || true
cp "${XDG_CONFIG_HOME:-$HOME/.config}/cursor/cli-config.json" "$HARNESS_HOME/xdg/cursor/cli-config.json" 2>/dev/null || true

AGENTS=${AGENTS:-1}
TARGET=${TARGET:-current git diff}
HARNESSES=${HARNESSES:-"codex claude cursor"}
CODEX_MODEL=${CODEX_MODEL:-gpt-5.5}
CODEX_EFFORT=${CODEX_EFFORT:-medium}
CLAUDE_MODEL=${CLAUDE_MODEL:-haiku}
CURSOR_MODEL=${CURSOR_MODEL:-composer-2.5}

ROUND=$(printf '%s' "$(uuidgen 2>/dev/null || date +%s)" | shasum | cut -c1-8)
PROMPT=$REVIEW_DIR/prompt-$ROUND.md

printf 'You are a fresh independent reviewer. Review %s adversarially against this context:\n\n' "$TARGET" > "$PROMPT"
cat >> "$PROMPT" <<'REVIEW_PROMPT_EOF'
Original request:
[Paste or summarize the user's request]

Plan / acceptance criteria:
[Paste the plan, checklist, or expected behavior]

Do not modify files. Report only material issues: missed requirements, correctness bugs, regressions, edge cases, security issues, or maintainability risks. For each issue include file/line, impact, and suggested fix. No praise. If satisfied, respond only: LGTM
REVIEW_PROMPT_EOF

PROMPT_TEXT=$(cat "$PROMPT")

review() {
  name=$1
  shift
  n=1
  while [ "$n" -le "$AGENTS" ]; do
    "$@" > "$REVIEW_DIR/$name-$n-$ROUND.md" 2>&1 &
    n=$((n + 1))
  done
}

for harness in $HARNESSES; do
  case "$harness" in
    codex) review codex env CODEX_HOME="$HARNESS_HOME/codex" codex exec -s read-only -m "$CODEX_MODEL" -c "model_reasoning_effort=\"$CODEX_EFFORT\"" "$PROMPT_TEXT" ;;
    claude) review claude claude --model "$CLAUDE_MODEL" -p "$PROMPT_TEXT" ;;
    cursor) review cursor env XDG_CONFIG_HOME="$HARNESS_HOME/xdg" agent -p "$PROMPT_TEXT" --model "$CURSOR_MODEL" --mode=ask --trust --output-format text ;;
  esac
done

wait
```

1. Read all reports for the round.
2. Dedupe findings.
3. Assess validity.
4. Fix real issues.
5. Rerun relevant tests, linting, typechecking, etc.
6. Start a new round if any issue remains.

Do not stop after “mostly good.” Stop only when every reviewer returns `LGTM`, the user explicitly dismisses remaining findings, or the requested max round count is reached.
