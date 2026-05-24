---
name: gws-gmail
description: 'Gmail: Send, read, search, triage, reply, and forward email.'
metadata:
  openclaw:
    category: productivity
    requires:
      bins:
      - gws
    cliHelp: gws gmail --help
  version: 1.1.0
---

# gmail (v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws gmail <resource> <method> [flags]
```

## Helper Commands

| Command | Description |
|---------|-------------|
| `+send` | Send an email |
| `+triage` | Show unread inbox summary (sender, subject, date) |
| `+reply` | Reply to a message (handles threading automatically) |
| `+reply-all` | Reply-all to a message |
| `+forward` | Forward a message to new recipients |
| `+watch` | Watch for new emails and stream them as NDJSON |

## API Resources

### users

  - `getProfile` — Gets the current user's Gmail profile.
  - `stop` — Stop receiving push notifications for the given user mailbox.
  - `watch` — Set up or update a push notification watch on the given user mailbox.
  - `drafts` — Operations on the 'drafts' resource
  - `history` — Operations on the 'history' resource
  - `labels` — Operations on the 'labels' resource
  - `messages` — Operations on the 'messages' resource
  - `settings` — Operations on the 'settings' resource
  - `threads` — Operations on the 'threads' resource

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws gmail --help

# Inspect a method's required params, types, and defaults
gws schema gmail.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

---

## +send — Send an Email

```bash
gws gmail +send --to <EMAILS> --subject <SUBJECT> --body <TEXT>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--to` | ✓ | — | Recipient email(s), comma-separated |
| `--subject` | ✓ | — | Email subject |
| `--body` | ✓ | — | Email body (plain text, or HTML with --html) |
| `--cc` | — | — | CC email(s) |
| `--bcc` | — | — | BCC email(s) |
| `--html` | — | — | Treat --body as HTML |
| `--dry-run` | — | — | Preview without sending |

- Handles RFC 2822 formatting and base64 encoding automatically.
- For attachments, use the raw API: `gws gmail users messages send --json '...'`

> [!CAUTION]
> **Write command** — confirm with the user before executing.

---

## +triage — Unread Inbox Summary

```bash
gws gmail +triage
```

| Flag | Default | Description |
|------|---------|-------------|
| `--max` | 20 | Maximum messages to show |
| `--query` | is:unread | Gmail search query |
| `--labels` | — | Include label names in output |

```bash
gws gmail +triage --max 5 --query 'from:boss'
gws gmail +triage --format json | jq '.[].subject'
```

- Read-only — never modifies your mailbox.

---

## +reply — Reply to a Message

```bash
gws gmail +reply --message-id <ID> --body <TEXT>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--message-id` | ✓ | Gmail message ID to reply to |
| `--body` | ✓ | Reply body |
| `--from` | — | Sender address (for send-as/alias) |
| `--to` | — | Additional To recipients |
| `--cc` | — | Additional CC recipients |
| `--bcc` | — | BCC recipients |
| `--html` | — | Send as HTML |
| `--dry-run` | — | Preview without sending |

- Automatically sets In-Reply-To, References, and threadId headers.
- Quotes the original message. For reply-all, use `+reply-all`.

---

## +forward — Forward a Message

```bash
gws gmail +forward --message-id <ID> --to <EMAILS>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--message-id` | ✓ | Gmail message ID to forward |
| `--to` | ✓ | Recipient email(s) |
| `--from` | — | Sender address (for alias) |
| `--cc` | — | CC recipients |
| `--bcc` | — | BCC recipients |
| `--body` | — | Note above forwarded message |
| `--html` | — | Send as HTML |
| `--dry-run` | — | Preview without sending |

- Includes original message with sender, date, subject, and recipients.

---

## Search & Body Extraction

No `+search` CLI helper — use raw API patterns.

### Quick Search (metadata only)

```bash
gws gmail +triage --query 'from:alerts@mail.libcal.com' --max 50
gws gmail +triage --query 'subject:invoice after:2026/01/01' --format json
```

### Full Search with Body

**Step 1:** Find messages:
```bash
gws gmail users messages list --params '{"userId":"me","q":"langara library","maxResults":50}'
```

**Step 2:** Get full message:
```bash
gws gmail users messages get --params '{"userId":"me","id":"MSG_ID","format":"full"}'
```

**Step 3:** Extract text body (base64url decode):
```bash
gws gmail users messages get --params '{"userId":"me","id":"MSG_ID","format":"full"}' 2>&1 | python3 -c "
import sys, json, base64
lines = sys.stdin.readlines()
start = next(i for i, l in enumerate(lines) if l.strip().startswith('{'))
d = json.loads(''.join(lines[start:]))

def get_text(payload):
    if payload.get('mimeType','').startswith('text/plain'):
        data = payload.get('body',{}).get('data','')
        if data:
            return base64.urlsafe_b64decode(data).decode('utf-8','replace')
    for part in payload.get('parts',[]):
        r = get_text(part)
        if r: return r
    return ''

print(get_text(d['payload']))
"
```

### Gmail Search Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:noreply@example.com` | Sender |
| `to:` | `to:me` | Recipient |
| `subject:` | `subject:invoice` | Subject line |
| `after:` | `after:2026/03/01` | Sent after date |
| `before:` | `before:2026/04/01` | Sent before date |
| `has:attachment` | `has:attachment` | Has attachments |
| `filename:` | `filename:pdf` | Attachment type |
| `is:unread` | `is:unread` | Unread messages |
| `label:` | `label:important` | By label |
| `in:` | `in:inbox` | In mailbox section |
| `{a b}` | `{from:a from:b}` | OR grouping |
