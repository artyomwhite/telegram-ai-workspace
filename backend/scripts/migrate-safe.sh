#!/bin/sh

MAX_RETRIES=3
RETRY_DELAY=10

attempt=1
while [ "$attempt" -le "$MAX_RETRIES" ]; do
  echo "[migrate] attempt ${attempt}/${MAX_RETRIES}"
  if npx prisma migrate deploy; then
    echo "[migrate] success"
    exit 0
  fi
  echo "[migrate] failed (possible advisory lock), retry in ${RETRY_DELAY}s..."
  attempt=$((attempt + 1))
  if [ "$attempt" -le "$MAX_RETRIES" ]; then
    sleep "$RETRY_DELAY"
  fi
done

echo "[migrate] WARNING: skipped after ${MAX_RETRIES} attempts — starting app without blocking"
exit 0
