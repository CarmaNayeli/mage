# Builds and runs Mage.Server + Web.Gateway for the hosted-practice-bot project.
# Multi-stage: Maven build (needs the full source tree) -> lean JRE runtime.
#
# This exists mainly to get a REAL Maven build (the dev sandbox this was written in
# has no Maven installed) - Fly.io's remote builder runs this Dockerfile, which is the
# actual verification that Phase 0/1 of the web-client plan compile and wire together
# correctly, not just individually-compiled classes checked by hand.

FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY . .
# Mage.Sets alone is ~33,000 source files in one javac invocation (maven-compiler-plugin
# runs in-process, sharing Maven's own JVM heap) - the default heap starved and stalled
# silently for over an hour on the first real attempt, with no error, just no progress.
ENV MAVEN_OPTS="-Xmx3g -XX:+UseG1GC"
# -am: also build Mage.Server's and Web.Gateway's own dependencies (Mage, Mage.Common,
# Mage.Sets, the bundled AI/game/deck plugin modules) in the same reactor pass.
# assembly:single as a second goal, not a phase binding: Mage.Server's own
# maven-assembly-plugin config has no <executions> - the project's own release
# script (Utils/build-and-package.pl) runs it this same way, `mvn package
# assembly:single`, rather than binding it to the package phase for every build.
RUN mvn -B -pl Mage.Server,Web.Gateway -am -DskipTests package assembly:single

FROM eclipse-temurin:17-jre
WORKDIR /app

# Mage.Server's own distribution.xml assembly output - config.xml, plugins/, lib/,
# startServer.sh - unpacked as-is, same shape as a normal XMage server release.
COPY --from=builder /build/Mage.Server/target/mage-server.zip /tmp/mage-server.zip
RUN mkdir -p /app/server \
    && cd /app/server \
    && jar xf /tmp/mage-server.zip \
    && rm /tmp/mage-server.zip

COPY --from=builder /build/Web.Gateway/target/mage-web-gateway-*.jar /app/gateway/mage-web-gateway.jar
COPY Web.Gateway/sample-decks/smoke-test.txt /app/gateway/smoke-test.txt
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 17171
ENTRYPOINT ["/app/entrypoint.sh"]
