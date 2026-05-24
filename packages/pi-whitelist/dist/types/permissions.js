// Pure type definitions with no runtime dependencies.
export const EXTERNAL_PERMISSION_MODES = [
    'acceptEdits',
    'auto',
    'bypassPermissions',
    'default',
    'dontAsk',
    'plan',
];
export const MODE_CYCLE = [
    'default',
    'auto',
    'plan',
    'bypassPermissions',
];
export const PERMISSION_MODE_ALIASES = {
    default: 'default',
    auto: 'auto',
    plan: 'plan',
    bypass: 'bypassPermissions',
    bypassPermissions: 'bypassPermissions',
    acceptEdits: 'acceptEdits',
    dontAsk: 'dontAsk',
};
//# sourceMappingURL=permissions.js.map