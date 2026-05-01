#!/bin/bash
set -e

if [ -z "$TOKEN_ACCES" ]; then
  echo "[github-sync] ERROR: TOKEN_ACCES secret not found"
  exit 1
fi

REMOTE_URL="https://jeryyah:${TOKEN_ACCES}@github.com/jeryyah/Dolpay.git"

echo "[github-sync] Pushing to GitHub (jeryyah/Dolpay)..."
git push "$REMOTE_URL" HEAD:main --force 2>&1 | sed 's/'"${TOKEN_ACCES}"'/***HIDDEN***/g'
echo "[github-sync] Done at $(date)"
