# Security Policy

## Status

CryptShield GNOME Extension is experimental system software. It changes DNS routing, NetworkManager connection profiles, `systemd-resolved` runtime DNS, and `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`.

Do not treat this project as production-ready security software.

## Privileged Helper

CryptShield installs a root-owned helper at:

```text
/usr/local/libexec/cryptshield-helper
```

The helper intentionally performs a narrow set of privileged actions:

- start, stop, restart, enable, and disable `dnscrypt-proxy.service`
- update selected `dnscrypt-proxy` settings
- route active NetworkManager DNS to `127.0.0.1` and `::1`
- backup and restore NetworkManager DNS settings
- update `systemd-resolved` runtime DNS

The default Polkit rule uses `AUTH_ADMIN_KEEP`, not passwordless access. Users may still be asked for administrator authentication.

## Passwordless Mode

Passwordless mode is not installed by default.

The file `polkit/90-cryptshield-passwordless.rules.example` is provided only for personal single-user machines. Review it before installing. Do not use it on shared, work, or production machines.

## Reporting

If you find a security issue, do not open a public exploit report with weaponized details. Open a minimal GitHub issue describing the affected component and impact, or contact the maintainer privately if contact information is available in the repository profile.
