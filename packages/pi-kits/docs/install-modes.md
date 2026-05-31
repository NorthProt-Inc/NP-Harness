# Pi Kits install modes

Pi Kits uses two install modes in the MVP: copy mode and reference mode.

## Copy mode

Copy mode is used when the installed resource is self-contained and safe to place inside the target project's `.pi/` directory.

| Resource | Catalog source | Project target |
| --- | --- | --- |
| Skill | `kits/skills/<name>/` | `.pi/skills/<name>/` |
| Prompt | `kits/prompts/<name>.md` | `.pi/prompts/<name>.md` |
| Single-file extension | `kits/extensions/<name>.ts` | `.pi/extensions/<name>.ts` |

Copy installs are owned by `.pi/kits.json`. Removal deletes only paths recorded in the manifest. Existing targets that are not already manifest-managed are treated as conflicts and are not overwritten.

## Reference mode

Reference mode is used for package extensions. Package extensions are added to the project's `.pi/settings.json` `extensions[]` array as the catalog package directory path:

```json
{
  "extensions": [
    "~/.pi/agent/kits/extensions/example-package"
  ]
}
```

The value intentionally points at the package directory, not an `index.ts` or other entrypoint file. This preserves the package root so Pi and Node can resolve the package metadata, dependencies, and declared extension entrypoints consistently.

Pi Kits sorts and deduplicates `extensions[]` while preserving unrelated settings. Removal deletes only extension references recorded in `.pi/kits.json`; unmanaged extension references remain untouched.

## Why package extensions are not copied in the MVP

Vendoring a package extension would require dependency installation, lockfile handling, update strategy, and conflict rules for nested package files. The MVP avoids those risks by referencing the catalog package directory directly.

Future versions may add a vendor mode that copies package extensions into projects with explicit dependency and update semantics.
