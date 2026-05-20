# CryptShield GNOME Extension

CryptShield GNOME Extension is a native GNOME Shell indicator for controlling and monitoring `dnscrypt-proxy` from the top bar. It is the lightweight GNOME extension version of CryptShield and is intended to live as a standalone project, separate from the previous Tauri desktop app.

 > ⚠️Warning
This is a **vibe-coding project** and should be treated as experimental system software. It edits DNS, NetworkManager profiles, `systemd-resolved` runtime DNS, `dnscrypt-proxy` configuration, and installs a privileged Polkit helper. Review the scripts before using it on a work machine, shared machine, or production system. The default helper install requires administrator authentication via Polkit; passwordless mode is not installed by default.

## Features

- Top bar logo indicator that reflects both `dnscrypt-proxy.service` status and whether system DNS is routed through the local proxy.
- Popup menu with one-click start/stop, resolver status, Preferences shortcut, and restart action.
- Libadwaita Preferences window for resolver selection and advanced options.
- GSettings-backed configuration for resolver, startup behavior, caching, DNSSEC, and Force TCP.
- Polkit-backed system operations through `pkexec`, routed through a fixed helper instead of arbitrary shell snippets.
- NetworkManager dispatcher hook that re-applies local DNS routing when networks change, without running privileged work inside GNOME Shell startup.
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

Install this once so the extension uses a fixed, validated helper instead of ad-hoc privileged shell commands:

```bash
sudo ./install-helper.sh
```

The helper is installed as `/usr/local/libexec/cryptshield-helper`. A NetworkManager dispatcher hook is installed as `/etc/NetworkManager/dispatcher.d/90-cryptshield` so active network changes can re-apply local DNS routing when `dnscrypt-proxy.service` is already running. The default Polkit rule uses `AUTH_ADMIN_KEEP`, so protected actions can ask for administrator authentication and may be cached by Polkit for a short time. The helper validates CryptShield actions and only manages `dnscrypt-proxy`, its config, and active NetworkManager DNS settings.

For a personal single-user machine where you want the GNOME toggle to work after login without another password prompt, install the helper in passwordless mode:

```bash
sudo ./install-helper.sh --passwordless
```

Passwordless mode is still limited to the fixed CryptShield helper path, active local sessions, and users in the `wheel` group, but it should not be used on shared, work, or production machines.

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
cp -r extension.js prefs.js utils.js metadata.json stylesheet.css schemas public ~/.local/share/gnome-shell/extensions/cryptshield@fuadfaut.my.id/
gnome-extensions enable cryptshield@fuadfaut.my.id
```

Restart GNOME Shell or log out and back in after changing extension source files.

## Build Zip

```bash
glib-compile-schemas schemas
gnome-extensions pack . --force --extra-source=utils.js --extra-source=install-helper.sh --extra-source=helpers/cryptshield-helper --extra-source=helpers/cryptshield-nm-dispatcher --extra-source=polkit/90-cryptshield.rules --extra-source=polkit/90-cryptshield-passwordless.rules.example --extra-source=public/logo-tray-on.svg --extra-source=public/logo-tray-off.svg
```

The generated bundle is named:

```text
cryptshield@fuadfaut.my.id.shell-extension.zip
```

## Project Files

- `extension.js` - GNOME Shell top bar indicator, popup menu, status polling, and service actions.
- `prefs.js` - Libadwaita Preferences UI.
- `utils.js` - async GJS helpers for `systemctl`, `pkexec`, config writes, and status checks.
- `helpers/` - privileged helper and NetworkManager dispatcher hook.
- `stylesheet.css` - GNOME Shell menu and panel styling.
- `public/` - tray logo assets used by the panel indicator.
- `schemas/` - GSettings schema and compiled schema cache.
- `metadata.json` - GNOME extension metadata.
- `ui.html` - original UI mockup reference.
- `prd.md` - product requirements document.

## Notes

CryptShield writes `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`, controls `dnscrypt-proxy.service`, and changes every active NetworkManager connection to use the local DNSCrypt listener at `127.0.0.1` and `::1` while protection is enabled. The selected resolver in Preferences is written as the upstream `dnscrypt-proxy` server. GNOME may show an administrator authentication prompt when applying a protected action.

If the service is active but system DNS is not routed through the local proxy, the indicator shows `DNSCrypt Not Routed` instead of reporting full protection.

The extension does not read DNS query logs during startup or menu rendering.
