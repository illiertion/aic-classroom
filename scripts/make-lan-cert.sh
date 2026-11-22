#!/usr/bin/env bash
# Creates a self-signed certificate for the classroom dev server so phones and
# tablets get a secure context (needed for screen share, clipboard, WebCrypto).
# Usage: bash scripts/make-lan-cert.sh [extra-ip ...]
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .certs

SAN="DNS:localhost,IP:127.0.0.1"
for ip in 100.95.131.112 192.168.45.177 "$@"; do
  [ -n "$ip" ] || continue
  case "$SAN" in
    *"IP:$ip"*) ;;
    *) SAN="$SAN,IP:$ip" ;;
  esac
done

MSYS2_ARG_CONV_EXCL='*' openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
  -days 3650 \
  -keyout .certs/aic-key.pem \
  -out .certs/aic-cert.pem \
  -subj "/CN=aic-classroom" \
  -addext "subjectAltName=$SAN" \
  -addext "basicConstraints=CA:FALSE" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth"

echo "certificate: .certs/aic-cert.pem"
echo "SAN: $SAN"
