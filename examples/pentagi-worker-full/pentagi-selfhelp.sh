#!/usr/bin/env bash
# Run inside worker: pentagi-selfhelp
# Quick fixes for common issues (proxy, paths).

set -euo pipefail

echo "=== PentAGI worker self-help ==="
echo
echo "1) HTTP/HTTPS downloads fail but ping works?"
echo "   Often a bad HTTP_PROXY in the container (e.g. Windows host IP). Try:"
echo "   unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY"
echo "   Then retry curl/wget. Re-set only if you really need a proxy."
echo
echo "2) apk/apt failed in OLD minimal images?"
echo "   This image already includes tools; no need to install at runtime."
echo
echo "3) SMTP relay log (authorized targets only):"
echo "   python3 /usr/local/bin/smtp_relay_test.py TARGET --log /work/relay.log"
echo
echo "=== Tool check ==="
for c in dig host curl wget nc openssl python3 docker bash; do
  if command -v "$c" >/dev/null 2>&1; then
    echo "  OK  $c -> $(command -v "$c")"
  else
    echo "  MISSING $c"
  fi
done
echo
echo "nc is OpenBSD netcat; use: nc -h | head"
echo "wget: $(wget --version 2>/dev/null | head -1 || echo 'n/a')"
echo "curl: $(curl --version 2>/dev/null | head -1 || echo 'n/a')"
