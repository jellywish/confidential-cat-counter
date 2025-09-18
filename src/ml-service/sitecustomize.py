"""
Global network egress guard for the ml-service test/dev container.

Blocks outbound socket connections to any destination except localhost and the
docker-compose 'redis' service. Enabled by default; can be disabled by setting
EGRESS_GUARD_DISABLED=true.
"""

import os
import socket


if os.getenv("EGRESS_GUARD_DISABLED", "false").lower() != "true":
    _orig_connect = socket.socket.connect

    allowed_ips = {"127.0.0.1", "::1"}
    try:
        allowed_ips.add(socket.gethostbyname("redis"))
    except Exception:
        # If redis not resolvable yet, allowlist will be localhost-only; retries will resolve
        pass

    def _guard_connect(self, address):
        try:
            host, port = address
            # If address already an IP string, check directly; otherwise resolve
            ip = host
            try:
                # If host is not an IP, resolve it
                socket.inet_aton(host)
            except OSError:
                try:
                    ip = socket.gethostbyname(host)
                except Exception:
                    # If cannot resolve, block
                    raise PermissionError(f"Egress blocked: cannot resolve host {host}")

            if ip not in allowed_ips:
                raise PermissionError(f"Egress blocked to {host} ({ip})")
        except Exception as e:
            # Raise immediately to block connection
            raise
        return _orig_connect(self, address)

    socket.socket.connect = _guard_connect  # type: ignore


