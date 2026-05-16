# CryptShield GNOME Extension

CryptShield GNOME Extension is a native GNOME Shell indicator for controlling and monitoring `dnscrypt-proxy` from the top bar. It is the lightweight GNOME extension version of CryptShield and is intended to live as a standalone project, separate from the previous Tauri desktop app.

## Features

- Top bar shield indicator that reflects both `dnscrypt-proxy.service` status and whether system DNS is routed through the local proxy.
- Popup menu with one-click start/stop, resolver status, query counters, Preferences shortcut, and restart action.
- Libadwaita Preferences window for resolver selection and advanced options.
- GSettings-backed configuration for resolver, startup behavior, caching, DNSSEC, and Force TCP.
- Polkit-backed system operations through `pkexec`, batched to avoid repeated password prompts for one action.
- Lightweight polling of service state and local DNS routing.

## Requirements

- Fedora Linux with GNOME Shell 46-50.
- `dnscrypt-proxy`
- `polkit`
- `glib2`
- `gnome-shell`

Install runtime dependencies:

```bash
sudo dnf install dnscrypt-proxy polkit glib2 gnome-shell
```

## Install Privileged Helper

Install this once to avoid repeated password prompts from the extension:

```bash
sudo ./install-helper.sh
```

The helper is installed as `/usr/local/libexec/cryptshield-helper`, and a Polkit rule allows active local `wheel` users to run only that helper without repeated authentication. The helper validates CryptShield actions and only manages `dnscrypt-proxy`, its config, and active NetworkManager DNS settings.

## Install From Zip

```bash
gnome-extensions install --force cryptshield@fuadfaut.my.id.shell-extension.zip
gnome-extensions enable cryptshield@fuadfaut.my.id
```

Log out and log back in if the indicator does not appear immediately.

## Local Development Install

From this repository:

```bash
glib-compile-schemas schemas
mkdir -p ~/.local/share/gnome-shell/extensions/cryptshield@fuadfaut.my.id
cp -r extension.js prefs.js utils.js metadata.json stylesheet.css schemas ~/.local/share/gnome-shell/extensions/cryptshield@fuadfaut.my.id/
gnome-extensions enable cryptshield@fuadfaut.my.id
```

Restart GNOME Shell or log out and back in after changing extension source files.

## Build Zip

```bash
glib-compile-schemas schemas
gnome-extensions pack . --force --extra-source=utils.js
```

The generated bundle is named:

```text
cryptshield@fuadfaut.my.id.shell-extension.zip
```

## Project Files

- `extension.js` - GNOME Shell top bar indicator, popup menu, status polling, stats, and service actions.
- `prefs.js` - Libadwaita Preferences UI.
- `utils.js` - async GJS helpers for `systemctl`, `pkexec`, config writes, and query stats.
- `stylesheet.css` - GNOME Shell menu and panel styling.
- `schemas/` - GSettings schema and compiled schema cache.
- `metadata.json` - GNOME extension metadata.
- `ui.html` - original UI mockup reference.
- `prd.md` - product requirements document.

## Notes

CryptShield writes `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`, controls `dnscrypt-proxy.service`, and changes every active NetworkManager connection to use the local DNSCrypt listener at `127.0.0.1` and `::1` while protection is enabled. The selected resolver in Preferences is written as the upstream `dnscrypt-proxy` server. Without the privileged helper, GNOME may show an administrator authentication prompt when applying a protected action.

If the service is active but system DNS is not routed through the local proxy, the indicator shows `DNSCrypt Not Routed` instead of reporting full protection.

Query counters read `/var/log/dnscrypt-query.log` when available. If the query log is missing or not readable, the extension keeps the counters at zero instead of blocking the shell.
