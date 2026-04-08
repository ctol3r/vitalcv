#!/bin/bash
set -e

# Merge PR 119
echo "Merging PR 119 (origin/release/wedge-convergence-rc2)..."
git merge origin/release/wedge-convergence-rc2 -X ours --no-commit || true
# Manually accept HEAD (ours) for modify/delete conflicts
for file in $(git diff --name-only --diff-filter=U); do
  echo "Keeping HEAD for $file"
  git checkout HEAD -- "$file" || git rm "$file"
done
git commit -m "Merge PR 119 (release/wedge-convergence-rc2) into main"

# Merge PR 120
echo "Merging PR 120 (origin/feature/data-spine-deploy-parity2)..."
git merge origin/feature/data-spine-deploy-parity2 -X ours --no-commit || true
for file in $(git diff --name-only --diff-filter=U); do
  echo "Keeping HEAD for $file"
  git checkout HEAD -- "$file" || git rm "$file"
done
git commit -m "Merge PR 120 (feature/data-spine-deploy-parity2) into main"

# Merge PR 121
echo "Merging PR 121 (origin/polish/ui-ux-enhancement-wave)..."
git merge origin/polish/ui-ux-enhancement-wave -X ours --no-commit || true
for file in $(git diff --name-only --diff-filter=U); do
  echo "Keeping HEAD for $file"
  git checkout HEAD -- "$file" || git rm "$file"
done
git commit -m "Merge PR 121 (polish/ui-ux-enhancement-wave) into main"

