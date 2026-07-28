import Gio from 'gi://Gio';

export const SERVICE_NAME = 'dnscrypt-proxy.service';
export const CONFIG_PATH = '/etc/dnscrypt-proxy/dnscrypt-proxy.toml';
const LOCAL_DNS_IPV4 = '127.0.0.1';
const LOCAL_DNS_IPV6 = '::1';
const LOCAL_DNS_PRIORITY = '-50';
const DNS_PROBE_HOST = 'example.com';
const DNS_READY_TIMEOUT_SECONDS = 90;
const HELPER_PATH = '/usr/local/libexec/cryptshield-helper';

export const RESOLVERS = [
    {id: '', label: 'All Servers'},
    {id: 'cloudflare', label: 'Cloudflare'},
    {id: 'quad9-dnscrypt-ip4-filter-pri', label: 'Quad9'},
    {id: 'adguard-dns-doh', label: 'AdGuard DNS'},
    {id: 'google', label: 'Google DNS'},
    {id: 'nextdns', label: 'NextDNS'},
    {id: 'cisco', label: 'Cisco OpenDNS'},
    {id: 'mullvad-doh', label: 'Mullvad'},
    {id: 'cleanbrowsing-adult', label: 'CleanBrowsing'},
    {id: 'doh.tiar.app-doh', label: 'TiarApp'}
];

export function resolverLabel(id) {
    return RESOLVERS.find(resolver => resolver.id === id)?.label ?? 'Cloudflare';
}

export function normalizeResolver(id) {
    const legacyMap = {
        'doh.tiar.app': 'doh.tiar.app-doh',
        'quad9': 'quad9-dnscrypt-ip4-filter-pri',
        'adguard': 'adguard-dns-doh',
        'adguard-dns': 'adguard-dns-doh'
    };
    const mapped = legacyMap[id] ?? id;
    return RESOLVERS.some(resolver => resolver.id === mapped) ? mapped : 'cloudflare';
}

export function resolverIndex(id) {
    const index = RESOLVERS.findIndex(resolver => resolver.id === id);
    return index >= 0 ? index : 1;
}

export function resolverIdAt(index) {
    return RESOLVERS[index]?.id ?? 'cloudflare';
}

export function runCommand(argv, options = {}) {
    const {allowFailure = false} = options;

    return new Promise((resolve, reject) => {
        let proc;

        try {
            proc = Gio.Subprocess.new(
                argv,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (error) {
            if (allowFailure) {
                resolve({
                    stdout: '',
                    stderr: error.message,
                    status: -1,
                    ok: false
                });
                return;
            }

            reject(error);
            return;
        }

        proc.communicate_utf8_async(null, null, (source, result) => {
            try {
                const [, stdout, stderr] = source.communicate_utf8_finish(result);
                const status = source.get_exit_status();

                if (!source.get_successful() && !allowFailure) {
                    reject(new Error((stderr || stdout || `Command failed: ${argv.join(' ')}`).trim()));
                    return;
                }

                resolve({
                    stdout: stdout ?? '',
                    stderr: stderr ?? '',
                    status,
                    ok: source.get_successful()
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

export async function getServiceStatus() {
    const result = await runCommand(['systemctl', 'is-active', SERVICE_NAME], {allowFailure: true});
    return result.stdout.trim();
}

export async function getProtectionStatus() {
    const [serviceStatus, dnsRouteStatus] = await Promise.all([
        getServiceStatus(),
        getDnsRouteStatus()
    ]);

    return {
        serviceStatus,
        isServiceActive: serviceStatus === 'active',
        isDnsRouted: dnsRouteStatus.routed,
        routeSource: dnsRouteStatus.source
    };
}

export async function setProtectionActive(settings, active) {
    if (await runInstalledHelper(active ? 'activate' : 'deactivate', active ? settings : null))
        return;

    const steps = active
        ? [
            prepareRuntimeScript(),
            configScript(settings),
            `systemctl start ${shellQuote(SERVICE_NAME)}`,
            routeSystemDnsScript()
        ]
        : [
            `systemctl stop ${shellQuote(SERVICE_NAME)}`,
            revertSystemDnsScript()
        ];

    await runPrivilegedScript(steps.join('\n'));
}

export async function restartProtection(settings) {
    if (await runInstalledHelper('restart', settings))
        return;

    await runPrivilegedScript([
        prepareRuntimeScript(),
        configScript(settings),
        `systemctl restart ${shellQuote(SERVICE_NAME)}`,
        routeSystemDnsScript()
    ].join('\n'));
}

export async function setStartupEnabled(enabled) {
    if (await runInstalledHelper('startup', null, enabled))
        return;

    await runCommand(['pkexec', 'systemctl', enabled ? 'enable' : 'disable', SERVICE_NAME]);
}

function boolExpression(key, value) {
    return `0,/^[ ]*#?[ ]*${key}[ ]*=.*/s//${key} = ${value ? 'true' : 'false'}/`;
}

function resolverExpression(resolver) {
    if (!resolver)
        return "0,/^[ ]*#?[ ]*server_names[ ]*=.*/s//# server_names = ['cloudflare']/";

    return `0,/^[ ]*#?[ ]*server_names[ ]*=.*/s//server_names = ['${resolver}']/`;
}

export async function configureDnscrypt(settings) {
    if (await runInstalledHelper('configure', settings))
        return;

    await runPrivilegedScript([
        prepareRuntimeScript(),
        configScript(settings)
    ].join('\n'));
}

async function runInstalledHelper(action, settings, value = null) {
    if (!Gio.File.new_for_path(HELPER_PATH).query_exists(null))
        return false;

    const argv = ['pkexec', HELPER_PATH, action];

    if (settings) {
        argv.push(
            normalizeResolver(settings.get_string('resolver')),
            boolArg(settings.get_boolean('local-caching')),
            boolArg(settings.get_boolean('require-dnssec')),
            boolArg(settings.get_boolean('force-tcp'))
        );
    } else if (value !== null) {
        argv.push(boolArg(value));
    }

    await runCommand(argv);
    return true;
}

function boolArg(value) {
    return value ? 'true' : 'false';
}

function configScript(settings) {
    const resolver = normalizeResolver(settings.get_string('resolver'));
    const caching = settings.get_boolean('local-caching');
    const dnssec = settings.get_boolean('require-dnssec');
    const forceTcp = settings.get_boolean('force-tcp');

    const expressions = [
        resolverExpression(resolver),
        `0,/^[ ]*#?[ ]*listen_addresses[ ]*=.*/s//listen_addresses = ['${LOCAL_DNS_IPV4}:53', '[${LOCAL_DNS_IPV6}]:53']/`,
        boolExpression('cache', caching),
        boolExpression('require_dnssec', dnssec),
        boolExpression('force_tcp', forceTcp),
        "0,/^[ ]*#?[ ]*file[ ]*=[ ]*'query.log'/s//file = '\\/var\\/log\\/dnscrypt-query.log'/",
        "/^\\[blocked_names\\]/,/^\\[blocked_ips\\]/s|^[ ]*#?[ ]*blocked_names_file[ ]*=.*|blocked_names_file = '/etc/dnscrypt-proxy/blocked-names.txt'|",
        "/^\\[blocked_names\\]/,/^\\[blocked_ips\\]/s|^[ ]*#?[ ]*log_file[ ]*=.*|log_file = '/var/log/dnscrypt-blocked-names.log'|",
        "/^\\[blocked_ips\\]/,/^\\[allowed_names\\]/s|^[ ]*#?[ ]*blocked_ips_file[ ]*=.*|blocked_ips_file = '/etc/dnscrypt-proxy/blocked-ips.txt'|",
        "/^\\[blocked_ips\\]/,/^\\[allowed_names\\]/s|^[ ]*#?[ ]*log_file[ ]*=.*|log_file = '/var/log/dnscrypt-blocked-ips.log'|"
    ];

    const sedArgs = ['sed', '-i', '-E'];
    for (const expression of expressions)
        sedArgs.push('-e', expression);

    sedArgs.push(CONFIG_PATH);
    return shellCommand(sedArgs);
}

function prepareRuntimeScript() {
    return 'mkdir -p /var/cache/dnscrypt-proxy';
}

function routeSystemDnsScript() {
    return `
${dnsReadinessScript()}
wait_for_local_dns

if command -v nmcli >/dev/null 2>&1; then
    nmcli -t -f UUID,TYPE,DEVICE connection show --active | while IFS=: read -r uuid type device; do
        [ -n "$uuid" ] || continue
        is_managed_dns_connection "$type" || continue
        nmcli connection modify "$uuid" \\
            ipv4.dns "${LOCAL_DNS_IPV4}" \\
            ipv4.ignore-auto-dns yes \\
            ipv4.dns-priority ${LOCAL_DNS_PRIORITY} \\
            ipv6.dns "${LOCAL_DNS_IPV6}" \\
            ipv6.ignore-auto-dns yes \\
            ipv6.dns-priority ${LOCAL_DNS_PRIORITY} || continue
        if [ -n "$device" ]; then
            nmcli device reapply "$device" >/dev/null 2>&1 || nmcli connection up "$uuid" >/dev/null 2>&1 || true
        fi
    done
fi

if command -v resolvectl >/dev/null 2>&1 && command -v nmcli >/dev/null 2>&1; then
    nmcli -t -f DEVICE,STATE device status | while IFS=: read -r device state; do
        [ -n "$device" ] || continue
        [ "$device" != "lo" ] || continue
        [ "$state" = "connected" ] || continue
        resolvectl dns "$device" ${LOCAL_DNS_IPV4} ${LOCAL_DNS_IPV6} || true
        resolvectl domain "$device" '~.' || true
        resolvectl default-route "$device" yes || true
    done
fi`.trim();
}

function dnsReadinessScript() {
    return `
probe_local_dns_once() {
    if command -v dig >/dev/null 2>&1; then
        dig @${shellQuote(LOCAL_DNS_IPV4)} ${shellQuote(DNS_PROBE_HOST)} A +time=1 +tries=1 +short 2>/dev/null | grep -q .
        return $?
    fi

    if command -v nslookup >/dev/null 2>&1; then
        nslookup -timeout=1 ${shellQuote(DNS_PROBE_HOST)} ${shellQuote(LOCAL_DNS_IPV4)} >/dev/null 2>&1
        return $?
    fi

    command -v dnscrypt-proxy >/dev/null 2>&1 || return 1
    dnscrypt-proxy -resolve ${shellQuote(`${DNS_PROBE_HOST},${LOCAL_DNS_IPV4}:53`)} >/dev/null 2>&1
}

wait_for_local_dns() {
    deadline=$(( $(date +%s) + ${DNS_READY_TIMEOUT_SECONDS} ))

    while [ "$(date +%s)" -le "$deadline" ]; do
        if probe_local_dns_once; then
            return 0
        fi

        sleep 1
    done

    echo "CryptShield: local DNS did not become ready; system DNS was not routed." >&2
    return 1
}`.trim();
}

function revertSystemDnsScript() {
    return `
if command -v nmcli >/dev/null 2>&1; then
    nmcli -t -f UUID,TYPE,DEVICE connection show --active | while IFS=: read -r uuid type device; do
        [ -n "$uuid" ] || continue
        is_managed_dns_connection "$type" || continue
        nmcli connection modify "$uuid" \\
            ipv4.dns "" \\
            ipv4.ignore-auto-dns no \\
            ipv4.dns-priority 0 \\
            ipv6.dns "" \\
            ipv6.ignore-auto-dns no \\
            ipv6.dns-priority 0 || continue
        if [ -n "$device" ]; then
            nmcli device reapply "$device" >/dev/null 2>&1 || nmcli connection up "$uuid" >/dev/null 2>&1 || true
        fi
    done
fi

if command -v resolvectl >/dev/null 2>&1 && command -v nmcli >/dev/null 2>&1; then
    nmcli -t -f DEVICE,STATE device status | while IFS=: read -r device state; do
        [ -n "$device" ] || continue
        [ "$device" != "lo" ] || continue
        [ "$state" = "connected" ] || continue
        dns_servers="$(nmcli -g IP4.DNS,IP6.DNS device show "$device" | tr '\\n' ' ' | sed 's/[[:space:]]*$//')"
        [ -n "$dns_servers" ] || continue
        resolvectl dns "$device" $dns_servers || true
        resolvectl default-route "$device" yes || true
    done
fi`.trim();
}

async function getDnsRouteStatus() {
    const resolvedResult = await runCommand(['resolvectl', 'dns'], {allowFailure: true});

    if (resolvedResult.ok && hasLocalDns(resolvedResult.stdout))
        return {routed: true, source: 'systemd-resolved'};

    const resolvConfResult = await runCommand(['cat', '/etc/resolv.conf'], {allowFailure: true});

    return {
        routed: resolvConfResult.ok && hasLocalDns(resolvConfResult.stdout),
        source: resolvConfResult.ok ? 'resolv.conf' : 'unknown'
    };
}

function hasLocalDns(output) {
    return hasLocalIpv4(output) || hasLocalIpv6(output);
}

function hasLocalIpv4(output) {
    return new RegExp(`(^|\\s|,)${LOCAL_DNS_IPV4.replaceAll('.', '\\.')}($|\\s|,)`).test(output);
}

function hasLocalIpv6(output) {
    return /(^|\s|,)(::1|\[::1\])($|\s|,)/.test(output);
}

function runPrivilegedScript(script) {
    return runCommand(['pkexec', 'sh', '-c', `set -eu
is_managed_dns_connection() {
    case "$1" in
        loopback|dummy) return 1 ;;
        *) return 0 ;;
    esac
}
${script}`]);
}

function shellCommand(argv) {
    return argv.map(shellQuote).join(' ');
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, "'\\''")}'`;
}
