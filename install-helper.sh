#!/bin/sh
set -eu

MODE='auth'

case "${1:-}" in
    '')
        ;;
    --passwordless)
        MODE='passwordless'
        ;;
    --help|-h)
        echo "Usage: sudo ./install-helper.sh [--passwordless]" >&2
        exit 0
        ;;
    *)
        echo "Usage: sudo ./install-helper.sh [--passwordless]" >&2
        exit 2
        ;;
esac

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo: sudo ./install-helper.sh [--passwordless]" >&2
    exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HELPER_SOURCE="$SCRIPT_DIR/helpers/cryptshield-helper"
DISPATCHER_SOURCE="$SCRIPT_DIR/helpers/cryptshield-nm-dispatcher"
RULE_SOURCE="$SCRIPT_DIR/polkit/90-cryptshield.rules"

if [ ! -f "$HELPER_SOURCE" ]; then
    HELPER_SOURCE="$SCRIPT_DIR/cryptshield-helper"
fi

if [ ! -f "$DISPATCHER_SOURCE" ]; then
    DISPATCHER_SOURCE="$SCRIPT_DIR/cryptshield-nm-dispatcher"
fi

if [ ! -f "$RULE_SOURCE" ]; then
    RULE_SOURCE="$SCRIPT_DIR/90-cryptshield.rules"
fi

install -o root -g root -m 0755 -D "$HELPER_SOURCE" /usr/local/libexec/cryptshield-helper
install -o root -g root -m 0755 -D "$DISPATCHER_SOURCE" /etc/NetworkManager/dispatcher.d/90-cryptshield

echo "CryptShield helper installed."
echo "NetworkManager dispatcher installed."

if [ "$MODE" = 'passwordless' ]; then
    install -o root -g root -m 0644 /dev/null /etc/polkit-1/rules.d/90-cryptshield.rules
    cat > /etc/polkit-1/rules.d/90-cryptshield.rules <<'RULE'
polkit.addRule(function(action, subject) {
    if (action.id !== "org.freedesktop.policykit.exec")
        return polkit.Result.NOT_HANDLED;

    if (action.lookup("program") !== "/usr/local/libexec/cryptshield-helper")
        return polkit.Result.NOT_HANDLED;

    if (!subject.local || !subject.active)
        return polkit.Result.NOT_HANDLED;

    if (subject.isInGroup("wheel"))
        return polkit.Result.YES;

    return polkit.Result.NOT_HANDLED;
});
RULE
    chown root:root /etc/polkit-1/rules.d/90-cryptshield.rules
    chmod 0644 /etc/polkit-1/rules.d/90-cryptshield.rules
    echo "Polkit mode is passwordless for active local wheel users."
else
    install -o root -g root -m 0644 -D "$RULE_SOURCE" /etc/polkit-1/rules.d/90-cryptshield.rules
    echo "Polkit mode is AUTH_ADMIN_KEEP: protected actions may ask for administrator authentication."
fi
