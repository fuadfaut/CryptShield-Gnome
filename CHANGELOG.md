# Changelog

## 1.0.0 - 2026-05-16

### Fixed

- Batched config, service, and DNS routing changes into one Polkit action to reduce repeated password prompts.
- Added an installable root-owned helper and focused Polkit rule so CryptShield actions can run without repeated password prompts after one setup step.
- Routed active NetworkManager connection profiles and systemd-resolved links through the local DNSCrypt listener when protection starts.
- Limited config rewrites to the first global dnscrypt-proxy setting so Local DoH listen settings are not accidentally enabled on port 53.
- Switched the panel switch handler to the GNOME Shell `toggled` signal.
- Fixed routed detection for NetworkManager's escaped IPv6 DNS output.
- Enabled dnscrypt-proxy blocked name/IP lists and dedicated blocked-query logs, then read those logs for the blocked counter.
- Fixed deactivation so the helper is called without resolver arguments.
- Restored DNS safely on deactivation by backing up NetworkManager DNS profile settings and rebuilding runtime systemd-resolved DNS from NetworkManager.
- Removed the resolver label from the top bar indicator and switched the panel icon to the tray logo assets.
- Added README warning that this is an experimental vibe-coding project that changes system DNS and installs a privileged helper.
- Changed status detection so the UI does not report full protection when the service is active but system DNS is not using DNSCrypt.

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
