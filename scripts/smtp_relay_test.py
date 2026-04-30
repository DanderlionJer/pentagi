#!/usr/bin/env python3
"""
Synchronous SMTP relay/open-relay probe: waits for the server banner and logs
every line (avoids printf|nc flooding before220). Use only on systems you
are authorized to test.
"""
from __future__ import annotations

import argparse
import socket
import sys
from datetime import datetime, timezone


def log_line(fp, prefix: str, text: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"{ts} {prefix}{text}\n"
    fp.write(line)
    fp.flush()


def read_smtp_response(sock: socket.socket, fp) -> list[str]:
    """Read one SMTP reply (possibly multi-line per RFC 5321)."""
    lines: list[str] = []
    while True:
        buf = b""
        while not buf.endswith(b"\r\n"):
            ch = sock.recv(1)
            if not ch:
                raise ConnectionError("peer closed connection before end of line")
            buf += ch
        text = buf.decode("utf-8", errors="replace").rstrip("\r\n")
        log_line(fp, "< ", text)
        lines.append(text)
        if len(text) >= 4 and text[3] == " ":
            break
        if len(text) >= 4 and text[3] != "-":
            break
    return lines


def send_line(sock: socket.socket, fp, line: str) -> None:
    log_line(fp, "> ", line)
    sock.sendall((line + "\r\n").encode("utf-8"))


def main() -> int:
    p = argparse.ArgumentParser(description="SMTP dialogue logger / relay probe")
    p.add_argument("host", help="SMTP host")
    p.add_argument("--port", type=int, default=25)
    p.add_argument("--ehlo", default="probe.example", help="EHLO/HELO hostname")
    p.add_argument("--mail-from", default="probe@example.com")
    p.add_argument("--rcpt-to", default="victim@example.com")
    p.add_argument("--subject", default="Relay test")
    p.add_argument("--body", default="Relay probe body.\n")
    p.add_argument("--timeout", type=float, default=60.0)
    p.add_argument("--log", default="-", help="append log path, or '-' for stdout")
    p.add_argument("--use-helo", action="store_true", help="send HELO instead of EHLO")
    args = p.parse_args()

    if args.log == "-":
        fp = sys.stdout
        close_fp = None
    else:
        fp = open(args.log, "a", encoding="utf-8")
        close_fp = fp

    try:
        log_line(fp, "# ", f"connect {args.host}:{args.port} mail-from={args.mail_from!r} rcpt-to={args.rcpt_to!r}")
        sock = socket.create_connection((args.host, args.port), timeout=args.timeout)
        try:
            sock.settimeout(args.timeout)
            read_smtp_response(sock, fp)

            if args.use_helo:
                send_line(sock, fp, f"HELO {args.ehlo}")
            else:
                send_line(sock, fp, f"EHLO {args.ehlo}")
            read_smtp_response(sock, fp)

            send_line(sock, fp, f"MAIL FROM:<{args.mail_from}>")
            read_smtp_response(sock, fp)

            send_line(sock, fp, f"RCPT TO:<{args.rcpt_to}>")
            read_smtp_response(sock, fp)

            send_line(sock, fp, "DATA")
            read_smtp_response(sock, fp)

            msg = f"Subject: {args.subject}\r\n\r\n{args.body}"
            for line in msg.split("\n"):
                if line.startswith("."):
                    line = "." + line
                sock.sendall((line + "\r\n").encode("utf-8"))
            sock.sendall(b".\r\n")
            log_line(fp, "> ", ".")
            read_smtp_response(sock, fp)

            send_line(sock, fp, "QUIT")
            read_smtp_response(sock, fp)
        finally:
            sock.close()
        log_line(fp, "# ", "session finished")
        return 0
    except OSError as e:
        log_line(fp, "! ", f"{type(e).__name__}: {e}")
        return 1
    finally:
        if close_fp is not None:
            close_fp.close()


if __name__ == "__main__":
    raise SystemExit(main())
