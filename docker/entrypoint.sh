#!/bin/bash
# bash, not sh: eclipse-temurin's /bin/sh is dash, which doesn't support the
# /dev/tcp/... redirection below - that check silently never succeeded under dash
# (no error, just never true), so the smoke test never ran even once Mage.Server
# was actually up and Fly's own (separate) health check was passing.
set -e

cd /app/server
echo "=== starting Mage.Server ==="
java -Xmx1024m -jar ./lib/mage-server-*.jar &
SERVER_PID=$!

echo "=== waiting for Mage.Server to listen on 17171 (first run also builds the card database - can take a few minutes) ==="
until (exec 3<>/dev/tcp/127.0.0.1/17171) 2>/dev/null; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "=== Mage.Server exited before it started listening - aborting ==="
        exit 1
    fi
    sleep 3
done
echo "=== Mage.Server is up - running the gateway smoke test ==="

java -jar /app/gateway/mage-web-gateway.jar 127.0.0.1 17171 /app/gateway/smoke-test.txt &
SMOKE_PID=$!

# Keep the container alive on Mage.Server (the actual long-lived process); the smoke
# test's own output interleaves into the same log stream ("fly logs" shows both).
wait "$SERVER_PID"
