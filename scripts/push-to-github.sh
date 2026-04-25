#!/usr/bin/env bash
set -euo pipefail

REPO="jeryyah/Dolpay"
BRANCH="${BRANCH:-main}"
MSG="${1:-Update from Replit $(date '+%Y-%m-%d %H:%M:%S')}"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "ERROR: GITHUB_TOKEN tidak ditemukan di environment." >&2
  echo "Tambahkan GITHUB_TOKEN di Replit Secrets dulu." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Bersihkan lock file kalau ada (sering muncul karena agent checkpointing)
if [ -f .git/index.lock ]; then
  echo "==> Removing stale .git/index.lock"
  rm -f .git/index.lock
fi
rm -f .git/refs/remotes/github/*.lock 2>/dev/null || true

git config user.email "${GIT_AUTHOR_EMAIL:-replit-agent@users.noreply.github.com}"
git config user.name  "${GIT_AUTHOR_NAME:-Replit Agent}"

REMOTE_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$REMOTE_URL"
else
  git remote add github "$REMOTE_URL"
fi

echo "==> Fetching latest from github/${BRANCH}..."
git fetch github "$BRANCH"

REMOTE_TIP="$(git rev-parse "github/${BRANCH}" 2>/dev/null || echo "")"

# Kalau local branch divergen dari github (history beda),
# pindahkan HEAD ke remote tip tapi tahan semua file kita sebagai staged.
if [ -n "$REMOTE_TIP" ]; then
  if ! git merge-base --is-ancestor "$REMOTE_TIP" HEAD 2>/dev/null; then
    echo "==> Local diverged from github/${BRANCH} — soft-resetting onto remote tip"
    git reset --soft "$REMOTE_TIP"
  fi
fi

echo "==> Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "Tidak ada perubahan untuk di-commit."
else
  echo "==> Committing: $MSG"
  git commit -m "$MSG"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "==> Pushing $CURRENT_BRANCH -> github/$BRANCH..."
git push github "HEAD:${BRANCH}"

echo ""
echo "Selesai. Lihat: https://github.com/${REPO}"
