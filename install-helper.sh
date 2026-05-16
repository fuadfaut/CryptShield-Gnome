#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo: sudo ./install-helper.sh" >&2
    exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HELPER_SOURCE="$SCRIPT_DIR/helpers/cryptshield-helper"
RULE_SOURCE="$SCRIPT_DIR/polkit/90-cryptshield.rules"

if [ ! -f "$HELPER_SOURCE" ]; then
    HELPER_SOURCE="$SCRIPT_DIR/cryptshield-helper"
fi

if [ ! -f "$RULE_SOURCE" ]; then
    RULE_SOURCE="$SCRIPT_DIR/90-cryptshield.rules"
fi

install -o root -g root -m 0755 -D "$HELPER_SOURCE" /usr/local/libexec/cryptshield-helper
install -o root -g root -m 0644 -D "$RULE_SOURCE" /etc/polkit-1/rules.d/90-cryptshield.rules

echo "CryptShield helper installed."
echo "Default Polkit mode is AUTH_ADMIN_KEEP: protected actions may ask for administrator authentication."
