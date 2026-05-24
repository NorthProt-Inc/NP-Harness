import { homedir } from 'node:os';
import { getKnownToolNameFamily } from './tool-names.js';
const CRITICAL_SYSTEM_PATHS = ['/etc', '/usr', '/System'];
const HOME_ALIASES = new Set(['~', '$HOME', '${HOME}']);
function splitCommand(command) {
    return command.trim().split(/\s+/).filter(Boolean);
}
function stripWrappingQuotes(value) {
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
            return value.slice(1, -1);
        }
    }
    return value;
}
function rmFlagState(args) {
    let recursive = false;
    const targets = [];
    let flagsDone = false;
    for (const arg of args) {
        if (!flagsDone && arg === '--') {
            flagsDone = true;
            continue;
        }
        if (!flagsDone && arg.startsWith('-') && arg !== '-') {
            const lower = arg.toLowerCase();
            if (lower === '--recursive' || lower === '--dir')
                recursive = true;
            if (!arg.startsWith('--') && /[rR]/.test(arg.slice(1)))
                recursive = true;
            continue;
        }
        targets.push(stripWrappingQuotes(arg));
    }
    return { recursive, targets };
}
function isRootTarget(target) {
    return target === '/' || target === '/*' || target === '/.' || target === '/./';
}
function isHomeTarget(target) {
    const home = homedir();
    return HOME_ALIASES.has(target)
        || [...HOME_ALIASES].some((alias) => target.startsWith(`${alias}/`))
        || target === home
        || target.startsWith(`${home}/`);
}
function isCriticalSystemPath(path) {
    return CRITICAL_SYSTEM_PATHS.some((critical) => path === critical || path.startsWith(`${critical}/`));
}
function isCriticalRmCommand(command) {
    // Strip shell metacharacters and quotes to flatten the command into raw tokens.
    // This safely exposes hidden commands in strings like `bash -c "rm -rf /"`
    // or `echo ok; rm -rf /` without needing a full bash parser.
    const sanitized = command.replace(/['"`;|&<>\n\r]/g, ' ');
    const tokens = splitCommand(sanitized);
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]?.toLowerCase();
        if (token === 'rm' || token?.endsWith('/rm')) {
            const { recursive, targets } = rmFlagState(tokens.slice(i + 1));
            if (recursive && targets.some((target) => isRootTarget(target) || isHomeTarget(target))) {
                return true;
            }
        }
    }
    return false;
}
export function shouldTripCriticalCircuitBreaker(toolName, ruleContent) {
    const family = getKnownToolNameFamily(toolName);
    const content = ruleContent?.trim();
    if (!content)
        return false;
    if (family === 'bash') {
        return isCriticalRmCommand(content);
    }
    if (family === 'write' || family === 'edit') {
        return isCriticalSystemPath(stripWrappingQuotes(content));
    }
    return false;
}
//# sourceMappingURL=circuit-breaker.js.map