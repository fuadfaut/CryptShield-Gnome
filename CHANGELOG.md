# Changelog

## 1.0.0 - 2026-05-16

### Added

- Initial standalone GNOME Shell extension version of CryptShield.
- Top bar indicator with active/inactive shield state.
- Popup menu with DNSCrypt start/stop switch, resolver subtitle, query stats, Preferences shortcut, and restart action.
- Libadwaita Preferences window with resolver selection and advanced options.
- GSettings schema for resolver, startup, local caching, DNSSEC, and Force TCP preferences.
- Async GJS command helpers for `systemctl`, `pkexec`, `sed`, and query log stats.
- Local install and zip build instructions for the separated GNOME extension project.

### Notes

- Targets GNOME Shell 46+ and Fedora-style `dnscrypt-proxy` deployments.
- System changes require Polkit authorization because the extension controls `dnscrypt-proxy.service` and writes `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`.
