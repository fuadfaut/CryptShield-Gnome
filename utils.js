import Gio from 'gi://Gio';

export const SERVICE_NAME = 'dnscrypt-proxy.service';
export const CONFIG_PATH = '/etc/dnscrypt-proxy/dnscrypt-proxy.toml';
export const QUERY_LOG_PATH = '/var/log/dnscrypt-query.log';

export const RESOLVERS = [
    {id: '', label: 'All Servers'},
    {id: 'cloudflare', label: 'Cloudflare'},
    {id: 'quad9', label: 'Quad9'},
    {id: 'adguard', label: 'AdGuard DNS'},
    {id: 'google', label: 'Google DNS'},
    {id: 'nextdns', label: 'NextDNS'},
    {id: 'cisco', label: 'Cisco OpenDNS'},
    {id: 'mullvad-doh', label: 'Mullvad'},
    {id: 'cleanbrowsing-adult', label: 'CleanBrowsing'},
    {id: 'doh.tiar.app', label: 'TiarApp'}
];

export function resolverLabel(id) {
    return RESOLVERS.find(resolver => resolver.id === id)?.label ?? 'Cloudflare';
}

export function normalizeResolver(id) {
    return RESOLVERS.some(resolver => resolver.id === id) ? id : 'cloudflare';
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

export async function setServiceActive(active) {
    await runCommand(['pkexec', 'systemctl', active ? 'start' : 'stop', SERVICE_NAME]);
}

export async function restartService() {
    await runCommand(['pkexec', 'systemctl', 'restart', SERVICE_NAME]);
}

export async function setStartupEnabled(enabled) {
    await runCommand(['pkexec', 'systemctl', enabled ? 'enable' : 'disable', SERVICE_NAME]);
}

function boolExpression(key, value) {
    return `s/^[# ]*${key}[ ]*=.*/${key} = ${value ? 'true' : 'false'}/g`;
}

function resolverExpression(resolver) {
    if (!resolver)
        return "s/^[# ]*server_names[ ]*=.*/# server_names = ['cloudflare']/g";

    return `s/^[# ]*server_names[ ]*=.*/server_names = ['${resolver}']/g`;
}

export async function configureDnscrypt(settings) {
    const resolver = normalizeResolver(settings.get_string('resolver'));
    const caching = settings.get_boolean('local-caching');
    const dnssec = settings.get_boolean('require-dnssec');
    const forceTcp = settings.get_boolean('force-tcp');

    const expressions = [
        resolverExpression(resolver),
        boolExpression('cache', caching),
        boolExpression('require_dnssec', dnssec),
        boolExpression('force_tcp', forceTcp),
        "s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g"
    ];

    for (const expression of expressions)
        await runCommand(['pkexec', 'sed', '-i', '-E', expression, CONFIG_PATH]);
}

export async function readQueryStats() {
    const totalResult = await runCommand(['wc', '-l', QUERY_LOG_PATH], {allowFailure: true});
    const total = totalResult.ok ? Number.parseInt(totalResult.stdout.trim().split(/\s+/)[0], 10) || 0 : 0;

    const tailResult = await runCommand(['tail', '-n', '2000', QUERY_LOG_PATH], {allowFailure: true});
    const sample = tailResult.ok ? tailResult.stdout : '';
    const blocked = sample
        .split('\n')
        .filter(line => /\b(DROP|REJECT|SYNTH|BLOCK|BLOCKED)\b/i.test(line))
        .length;

    return {total, blocked};
}
