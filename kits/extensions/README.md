# Extensions

Add single-file extensions as `extensions/<name>.ts` or package extensions as `extensions/<name>/package.json` with `pi.extensions` metadata.

Single-file extensions are copied to `.pi/extensions/<name>.ts`. Package extensions are referenced by catalog directory path in `.pi/settings.json`.
