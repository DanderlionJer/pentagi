# All-in-one PentAGI worker: full GNU tools (not BusyBox), dig/host/curl/python/docker-cli, etc.
# Build on the Docker host (not inside a worker):
#   docker build -f examples/pentagi-worker-full/Dockerfile -t pentagi-worker-full:latest .
# Then set in .env:
#   DOCKER_DEFAULT_IMAGE_FOR_PENTEST=pentagi-worker-full:latest
#   DOCKER_DEFAULT_IMAGE=pentagi-worker-full:latest
#
# docker-cli talks to the host engine via /var/run/docker.sock when PentAGI mounts it.

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    bind9-dnsutils \
    ca-certificates \
    curl \
    docker-cli \
    iputils-ping \
    netcat-openbsd \
    openssl \
    openssh-client \
    python3 \
    python3-pip \
    telnet \
    wget \
    whois \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

COPY scripts/smtp_relay_test.py /usr/local/bin/smtp_relay_test.py
RUN chmod +x /usr/local/bin/smtp_relay_test.py

COPY examples/pentagi-worker-full/pentagi-selfhelp.sh /usr/local/bin/pentagi-selfhelp
RUN chmod +x /usr/local/bin/pentagi-selfhelp \
    && sed -i 's/\r$//' /usr/local/bin/pentagi-selfhelp
