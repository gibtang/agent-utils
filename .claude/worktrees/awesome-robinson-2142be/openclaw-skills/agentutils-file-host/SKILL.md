---
name: agentutils-file-host
description: Upload and share ephemeral files from AI agents. Files auto-expire after a configurable TTL. Use when an agent needs to park a file (PDF, CSV, image, log), share a download URL, or hand off data between agent runs. Trigger words: upload file, share file, temporary file, file host, ephemeral storage, park file, download URL.
---

# AgentUtils File Host

Ephemeral file hosting for AI agents. Upload files, get a URL, files auto-expire.

## API Base

`https://agentutils.dev/api`

## Authentication

All requests require `x-api-key` header. Get a key at https://agentutils.dev/dashboard.

```
x-api-key: au_YOUR_KEY
```

## Commands

```bash
scripts/agentutils-file-host.sh <command> [arguments]
```

### `upload <file_path> [ttl_hours]`

Upload a file and get a download URL. TTL defaults to 1 hour.

```bash
scripts/agentutils-file-host.sh upload report.csv 2
scripts/agentutils-file-host.sh upload screenshot.png
```

### `get <file_id>`

Retrieve file metadata and download info.

```bash
scripts/agentutils-file-host.sh get abc123def456
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/file-host` | POST | Upload file (multipart, field: "file", optional: `ttl` in hours) |
| `/api/file-host/{id}` | GET | Retrieve a file |

### Upload Example

```bash
curl -X POST https://agentutils.dev/api/file-host \
  -H "x-api-key: au_YOUR_KEY" \
  -F "file=@report.csv" \
  -F "ttl=2"
```

### Download Example

```bash
curl -H "x-api-key: au_YOUR_KEY" \
  https://agentutils.dev/api/file-host/abc123def456
```

## Response Format

**Upload response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "url": "https://agentutils.dev/api/file-host/abc123def456",
    "expiresAt": "2025-01-15T10:00:00Z"
  }
}
```

## Tier Limits

| Tier | Max File Size | Retention |
|------|--------------|-----------|
| Free | 5MB | 1 hour |
| Builder ($19) | 25MB | 12 hours |
| Pro ($49) | 50MB | 24 hours |
| Enterprise | 500MB | 72 hours |

## Tips

- Files auto-expire — no cleanup needed
- Use TTL to control how long files live (in hours)
- The returned URL can be shared with anyone (no auth needed to download)
- Good for: reports, screenshots, logs, data handoffs between agents
