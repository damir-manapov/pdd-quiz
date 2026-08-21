#!/usr/bin/env bash
set -euo pipefail

echo "=== Secret scan (gitleaks) ==="
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "ERROR: gitleaks is not installed or not on PATH"
  echo "Install it from https://github.com/gitleaks/gitleaks (do not install into the project root)"
  exit 1
fi
gitleaks git . -v
gitleaks dir . -v

echo "=== Expo dependency drift (expo install --check) ==="
pnpm exec expo install --check

echo "=== Vulnerabilities (pnpm audit) ==="
pnpm audit --prod

echo "=== health.sh OK ==="
