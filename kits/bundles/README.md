# Bundles

Add bundles as `bundles/<name>.json`.

Example:

```json
{
  "name": "frontend",
  "description": "Frontend kit",
  "resources": ["skill:frontend-design", "prompt:ui-review"]
}
```

Bundles expand to concrete resource keys; they are not installed as manifest entries.
