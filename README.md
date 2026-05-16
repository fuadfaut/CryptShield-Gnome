# CryptShield GNOME Extension

CryptShield GNOME Extension is a native GNOME Shell indicator for controlling and monitoring `dnscrypt-proxy` from the top bar. It is the lightweight GNOME extension version of CryptShield and is intended to live as a standalone project, separate from the previous Tauri desktop app.

## Features

- Top bar shield indicator that reflects `dnscrypt-proxy.service` status.
- Popup menu with one-click start/stop, resolver status, query counters, Preferences shortcut, and restart action.
- Libadwaita Preferences window for resolver selection and advanced options.
- GSettings-backed configuration for resolver, startup behavior, caching, DNSSEC, and Force TCP.
- Polkit-backed system operations through `pkexec`.
- Lightweight polling of `systemctl is-active dnscrypt-proxy.service`.

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

CryptShield writes `/etc/dnscrypt-proxy/dnscrypt-proxy.toml` with elevated `pkexec sed` calls and controls `dnscrypt-proxy.service` through `systemctl`. GNOME may show an administrator authentication prompt when applying changes.

Query counters read `/var/log/dnscrypt-query.log` when available. If the query log is missing or not readable, the extension keeps the counters at zero instead of blocking the shell.
