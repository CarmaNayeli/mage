#!/bin/bash
# bash, not sh: this and prior scripts relied on bash-only features
# (/dev/tcp/... redirection, `wait -n`) that dash (eclipse-temurin's /bin/sh) lacks.
set -e

# JBoss Remoting's serialization code reflects into java.io.ObjectOutputStream.clear()
# (a private JDK method), which Java 9+'s module system blocks by default - without
# this, connecting fails with InaccessibleObjectException wrapped in
# ExceptionInInitializerError/CannotConnectException. Bisocket transport has the
# server open outbound connections back to clients for callbacks too, so both
# processes need this, not just the one initiating the connection.
JAVA_OPENS="--add-opens java.base/java.io=ALL-UNNAMED"

cd /app/server
echo "=== starting Mage.Server ==="
java $JAVA_OPENS -Xmx1024m -jar ./lib/mage-server-*.jar &
SERVER_PID=$!

# The gateway's own WebSocket port binds immediately (GatewayServer.start() doesn't
# wait on anything) - no need to poll for Mage.Server's port first like earlier
# versions did. A join_practice_table request that arrives before Mage.Server has
# finished its card-database rebuild (first boot only, a few minutes) will just fail
# its connectStart and report a gateway error to that browser; it works on retry.
#
# -Djava.net.preferIPv4Stack=true: without this, `new InetSocketAddress("0.0.0.0",
# port)` ends up bound on the IPv6 wildcard only (confirmed via `fly ssh console` +
# /proc/net/tcp6 - the process and port were both genuinely fine, but absent from
# /proc/net/tcp entirely). Fly's health check probes over IPv4 and got a flat
# "connection refused" against an otherwise perfectly healthy process.
echo "=== starting gateway WebSocket server on 8080 ==="
java $JAVA_OPENS -Djava.net.preferIPv4Stack=true -jar /app/gateway/mage-web-gateway.jar 8080 127.0.0.1 17171 &
GATEWAY_PID=$!

# Exit (letting Fly restart the machine) if EITHER top-level process dies, rather than
# limping along with only one of the two actually working.
wait -n "$SERVER_PID" "$GATEWAY_PID"
echo "=== a top-level process exited - shutting down ==="
