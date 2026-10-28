#!/bin/sh
set -eu
umask 077
[ "$#" -eq 0 ] || exit 64

# Install only as a NEW dedicated forced command. No shell evaluation of input.
# Sanitize the environment before Node starts (including NODE_OPTIONS/LD_PRELOAD).
exec /usr/bin/env -i \
  PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/root PM2_HOME=/root/.pm2 \
  SSH_ORIGINAL_COMMAND="${SSH_ORIGINAL_COMMAND:-}" \
  /usr/local/bin/node /app/slacord-deploy/tools/env-management.mjs
