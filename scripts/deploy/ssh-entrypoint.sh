#!/usr/bin/env bash
set -euo pipefail
umask 077

state=/app/slacord-deploy
read -r mode revision digest extra <<< "${SSH_ORIGINAL_COMMAND:-}"
case "$mode" in
  check)
    [[ -z "${revision:-}${digest:-}${extra:-}" ]] || exit 64
    exec node "$state/tools/deploy-ubuntu.mjs" check
    ;;
  prepare|deploy)
    [[ "${revision:-}" =~ ^[a-f0-9]{40}$ ]] || exit 64
    [[ "${digest:-}" =~ ^[a-f0-9]{64}$ ]] || exit 64
    [[ -z "${extra:-}" ]] || exit 64
    ;;
  *) echo 'Only check, prepare, and deploy commands are allowed.' >&2; exit 64 ;;
esac

require_settled_environment() {
  if [[ -e "$state/env-apply-pending.json" || -L "$state/env-apply-pending.json" ||
      -e "$state/private/env-apply-original.json" || -L "$state/private/env-apply-original.json" ]]; then
    echo 'Environment apply recovery is required.' >&2
    exit 75
  fi
}
require_settled_environment
mkdir -p "$state/uploads" "$state/releases"
exec 9>"$state/deploy.lock"
flock -w 1800 9 || { echo 'Another deployment is still running.' >&2; exit 1; }
require_settled_environment
archive=$(mktemp "$state/uploads/source.XXXXXX.tar.gz")
trap 'rm -f -- "$archive"' EXIT
timeout 300 cat > "$archive"
actual=$(sha256sum "$archive")
[[ "${actual%% *}" == "$digest" ]] || { echo 'Source checksum mismatch.' >&2; exit 1; }
node "$state/tools/deploy-ubuntu.mjs" "$mode" "$revision" "$archive"
