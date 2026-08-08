#!/usr/bin/env bash
#
# Stale-PR janitor — bounds the open-PR backlog at ~5 weeks of true inactivity.
#
# Policy §7.2 of docs/ops/open-pr-disposition-2026-08-07.md:
#   no real activity for STALE_DAYS  -> label `stale` + a warning comment
#   still nothing CLOSE_DAYS later   -> close with a re-cut receipt + delete branch
#   any real activity while labelled -> the label comes off, clock resets
#
# Why this exists: the 2026-08-02 disposition sentenced 225 PRs to close and the
# closure was never executed, so 194 of them were still open six days later —
# ~90% of a 216-PR backlog. A written disposition is not a mechanism. This is.
#
# "Real activity" deliberately EXCLUDES label changes, because this script's own
# labelling would otherwise reset the very clock it is trying to run. It is
# computed from commits and non-bot comments only, so a bot re-run, a dependabot
# rebase comment, or this janitor's own warning cannot keep a dead PR alive.
#
# Fail-safe posture: every mutating call goes through run(), which only echoes
# unless ENFORCE=true. The workflow ships with enforcement OFF — a scheduled run
# logs exactly what it would do and changes nothing until an operator sets the
# STALE_JANITOR_ENFORCE repo variable. That is deliberate: on the first live run
# this would close every PR already past the threshold, and some of those need a
# human decision rather than a timer (see the `parked` exemption).
#
# Exemptions are by LABEL, not by draft status. A draft is still backlog; a
# `parked` PR is a deliberate decision with a named unblock condition. Per the
# disposition, `parked` is only legitimate alongside that named condition.

set -euo pipefail

REPO="${REPO:?REPO is required (owner/name)}"
STALE_LABEL="${STALE_LABEL:-stale}"
STALE_DAYS="${STALE_DAYS:-21}"
CLOSE_DAYS="${CLOSE_DAYS:-14}"
EXEMPT_LABELS="${EXEMPT_LABELS:-parked,security,pinned}"
MAX_OPS="${MAX_OPS:-50}"
ENFORCE="${ENFORCE:-false}"

now=$(date -u +%s)
ops=0
marked=0
closed=0
unstaled=0
skipped_exempt=0

iso_to_epoch() { date -u -d "$1" +%s 2>/dev/null || echo 0; }
days_since() { echo $(( (now - $(iso_to_epoch "$1")) / 86400 )); }

# Every mutation funnels through here. In dry-run it prints and returns 0.
run() {
  if [ "$ENFORCE" = "true" ]; then
    "$@"
  else
    printf '      DRY-RUN would: %s\n' "$*"
  fi
}

budget_left() {
  if [ "$ops" -ge "$MAX_OPS" ]; then return 1; fi
  return 0
}

echo "stale-janitor — repo=$REPO enforce=$ENFORCE stale=${STALE_DAYS}d close=${CLOSE_DAYS}d"
echo "exempt labels: $EXEMPT_LABELS | max mutating PRs this run: $MAX_OPS"
echo

# Make sure the label exists before we try to apply it; a missing label makes
# the POST fail per-PR instead of once, which reads as 30 unrelated errors.
if [ "$ENFORCE" = "true" ]; then
  gh api "repos/$REPO/labels/$STALE_LABEL" >/dev/null 2>&1 || \
    gh api -X POST "repos/$REPO/labels" \
      -f name="$STALE_LABEL" \
      -f color="ededed" \
      -f description="No commits or human comments for ${STALE_DAYS}d; closes after ${CLOSE_DAYS}d more" \
      >/dev/null 2>&1 || true
fi

prs=$(gh api --paginate "repos/$REPO/pulls?state=open&per_page=100")

# Compact tuple per PR so the loop below does no further parsing of the list.
#
# NOTE the process substitution rather than a pipe into `while`: a piped loop
# runs in a SUBSHELL, so every counter below — including the MAX_OPS budget —
# would be discarded at the `done`, silently removing the rate limit.
while IFS=$'\t' read -r num updated labels head_ref head_repo draft; do

  # Exemption is checked first so an exempt PR costs zero extra API calls.
  exempt=""
  IFS=',' read -ra want <<< "$EXEMPT_LABELS"
  for e in "${want[@]}"; do
    [ -z "$e" ] && continue
    case ",$labels," in *",$e,"*) exempt="$e" ;; esac
  done
  if [ -n "$exempt" ]; then
    skipped_exempt=$((skipped_exempt + 1))
    printf '  #%-5s SKIP    exempt via label "%s"\n' "$num" "$exempt"
    continue
  fi

  has_stale=false
  case ",$labels," in *",$STALE_LABEL,"*) has_stale=true ;; esac

  if [ "$has_stale" = "false" ]; then
    age=$(days_since "$updated")
    if [ "$age" -lt "$STALE_DAYS" ]; then
      printf '  #%-5s ok      %sd since update%s\n' "$num" "$age" \
        "$([ "$draft" = "true" ] && echo ' (draft — not exempt, see header)')"
      continue
    fi
    budget_left || { printf '  #%-5s DEFER   op budget reached\n' "$num"; continue; }
    ops=$((ops + 1)); marked=$((marked + 1))
    printf '  #%-5s MARK    %sd inactive -> label + warn\n' "$num" "$age"
    run gh api -X POST "repos/$REPO/issues/$num/labels" -f "labels[]=$STALE_LABEL"
    run gh api -X POST "repos/$REPO/issues/$num/comments" -f body="\
This pull request has had no commits or human comments for ${STALE_DAYS} days, so it has been \
labelled \`${STALE_LABEL}\`.

**It will be closed in ${CLOSE_DAYS} days** unless something happens on it. Any commit or comment \
removes the label and resets the clock. If it is deliberately waiting on something, replace the \
label with \`parked\` and say in a comment what it is waiting on — \`parked\` is exempt, but only \
with a named unblock condition.

Closing is not a judgement on the work. On this repo a PR that sits while \`main\` moves usually \
costs more to re-validate than to re-cut small from current \`main\`, and stale branches keep \
firing CI gates that nobody reads. See \`docs/ops/open-pr-disposition-2026-08-07.md\`."
    continue
  fi

  # Already labelled: decide between un-staling and closing, using activity that
  # excludes labels. `max` over an empty array yields null, hence the // "".
  last_labeled=$(gh api --paginate "repos/$REPO/issues/$num/events?per_page=100" \
    | jq -r --arg L "$STALE_LABEL" \
        '[.[] | select(.event == "labeled" and .label.name == $L) | .created_at] | max // ""')
  if [ -z "$last_labeled" ]; then
    printf '  #%-5s WARN    has label but no labeled event; treating as fresh\n' "$num"
    continue
  fi

  last_commit=$(gh api --paginate "repos/$REPO/pulls/$num/commits?per_page=100" \
    | jq -r '[.[].commit.committer.date] | max // ""')
  last_human=$(gh api --paginate "repos/$REPO/issues/$num/comments?per_page=100" \
    | jq -r '[.[] | select(.user.type != "Bot") | .created_at] | max // ""')

  activity=""
  for t in "$last_commit" "$last_human"; do
    [ -z "$t" ] && continue
    if [ -z "$activity" ] || [ "$(iso_to_epoch "$t")" -gt "$(iso_to_epoch "$activity")" ]; then
      activity="$t"
    fi
  done

  if [ -n "$activity" ] && [ "$(iso_to_epoch "$activity")" -gt "$(iso_to_epoch "$last_labeled")" ]; then
    budget_left || { printf '  #%-5s DEFER   op budget reached\n' "$num"; continue; }
    ops=$((ops + 1)); unstaled=$((unstaled + 1))
    printf '  #%-5s REVIVE  activity %s after label %s -> unstale\n' "$num" "$activity" "$last_labeled"
    run gh api -X DELETE "repos/$REPO/issues/$num/labels/$STALE_LABEL"
    continue
  fi

  waited=$(days_since "$last_labeled")
  if [ "$waited" -lt "$CLOSE_DAYS" ]; then
    printf '  #%-5s wait    stale %sd of %sd\n' "$num" "$waited" "$CLOSE_DAYS"
    continue
  fi

  budget_left || { printf '  #%-5s DEFER   op budget reached\n' "$num"; continue; }
  ops=$((ops + 1)); closed=$((closed + 1))
  printf '  #%-5s CLOSE   stale %sd -> close + delete branch\n' "$num" "$waited"
  run gh api -X POST "repos/$REPO/issues/$num/comments" -f body="\
Closing after ${STALE_DAYS}+${CLOSE_DAYS} days with no commits or human comments.

Nothing here is lost: the branch, the diff and this discussion stay on GitHub, and reopening is a \
click if the branch still exists. If the intent still matters, the cheaper path on this repo is to \
re-cut it small from current \`main\` rather than re-validate a tree that \`main\` has moved past.

Automated by \`.github/workflows/stale-janitor.yml\`; policy in \
\`docs/ops/open-pr-disposition-2026-08-07.md\`."
  run gh api -X PATCH "repos/$REPO/pulls/$num" -f state=closed

  # Only ever delete a branch that lives in THIS repo — never a fork's, and
  # never a branch some other open PR is still targeting as its base.
  if [ "$head_repo" = "$REPO" ] && [ -n "$head_ref" ]; then
    base_users=$(echo "$prs" | jq -r --arg B "$head_ref" --argjson N "$num" \
      '[.[] | select(.base.ref == $B and .number != $N)] | length')
    if [ "$base_users" != "0" ]; then
      printf '          keep branch %s — %s open PR(s) still target it as base\n' "$head_ref" "$base_users"
    else
      run gh api -X DELETE "repos/$REPO/git/refs/heads/$head_ref"
    fi
  else
    printf '          keep branch — head is a fork (%s)\n' "${head_repo:-unknown}"
  fi
done < <(echo "$prs" | jq -r '.[] | [
    .number,
    .updated_at,
    (.labels // [] | map(.name) | join(",")),
    .head.ref,
    (.head.repo.full_name // ""),
    .draft
  ] | @tsv')

echo
echo "summary: marked=$marked closed=$closed revived=$unstaled exempt=$skipped_exempt (enforce=$ENFORCE)"
if [ "$ENFORCE" != "true" ]; then
  echo "NOTE: dry run — nothing above was applied. Set the STALE_JANITOR_ENFORCE repo"
  echo "      variable to 'true' (or dispatch with dry_run=false) to make it act."
fi
