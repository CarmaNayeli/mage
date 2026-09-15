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
# The JDK's default SecureRandom on Linux seeds itself from /dev/random, which can
# block for a real, noticeable amount of time (seconds) the first time anything reads
# it in a freshly-booted container with a thin entropy pool - exactly the shape of
# account registration/login's very first PBKDF2 salt/token generation being slow
# once per boot while every later one is fast. /dev/urandom never blocks (and is
# considered just as cryptographically strong once the kernel CSPRNG is seeded at
# all, which it always is on any real Linux boot) - both processes get real crypto
# calls (Mage.Server: session tokens/TLS-adjacent bits; the gateway: PasswordHasher).
JAVA_EGD="-Djava.security.egd=file:/dev/./urandom"

cd /app/server
echo "=== starting Mage.Server ==="
java $JAVA_OPENS $JAVA_EGD -Xmx1024m -jar ./lib/mage-server-*.jar &
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
java $JAVA_OPENS $JAVA_EGD -Djava.net.preferIPv4Stack=true -jar /app/gateway/mage-web-gateway.jar 8080 127.0.0.1 17171 &
GATEWAY_PID=$!

# Exit (letting Fly restart the machine) if EITHER top-level process dies, rather than
# limping along with only one of the two actually working.
wait -n "$SERVER_PID" "$GATEWAY_PID"
echo "=== a top-level process exited - shutting down ==="
