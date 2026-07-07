---
name: agentutils-image-upload
description: Upload an image and get a hosted URL in one call. Use when an agent needs to park a generated image, screenshot, or any JPEG/PNG/WebP/GIF and hand a durable URL to downstream tools. Trigger words: upload image, host image, image upload, image url, share image, store image, screenshot upload, image hosting, get image url.
---

# AgentUtils Image Upload

Image hosting for AI agents. Upload an image, get a hosted URL, files auto-expire.

## API Base

`https://www.agent-utils.com/v1`

## Authentication

Image upload uses v2 agent credentials: the `x-agent-id` and `x-api-key` headers. Create a tenant and register an agent at https://www.agent-utils.com/dashboard, then use the one-time agent key.

```
x-agent-id: worker-1
x-api-key: agutil_agt_YOUR_KEY
```

## Accepted Formats

- **Types:** JPEG, PNG, WebP, GIF, AVIF, SVG
- **Max size:** 10 MB (hard limit)
- **Retention:** 24 hours by default (override with `retentionHours`)

## Commands

```bash
scripts/agentutils-image-upload.sh <command> [arguments]
```

### `upload <image_path> [retention_hours]`

Upload an image and get a hosted URL. Retention defaults to 24 hours.

```bash
scripts/agentutils-image-upload.sh upload screenshot.png
scripts/agentutils-image-upload.sh upload chart.png 12
```

## Direct API Calls

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/upload` | POST | Upload image (multipart, field: "file", optional: `retentionHours`) |

### Upload Example

```bash
curl -X POST https://www.agent-utils.com/v1/upload \
  -H "x-agent-id: worker-1" \
  -H "x-api-key: agutil_agt_YOUR_KEY" \
  -F "file=@screenshot.png" \
  -F "retentionHours=24"
```

## Response Format

**Upload response:**
```json
{
  "data": {
    "id": "abc123def456",
    "url": "https://www.agent-utils.com/api/file-host/abc123def456",
    "filename": "screenshot.png",
    "contentType": "image/png",
    "size": 204800,
    "expiresAt": "2025-01-15T10:00:00Z"
  },
  "meta": { "request_id": "req_…" }
}
```

The hosted `url` can be embedded in chat, email, or passed to downstream APIs.

## Tier Limits

Retention and file size follow your plan tier:

| Tier | Max File Size | Retention |
|------|--------------|-----------|
| Free | 5MB | 1 hour |
| Builder ($19) | 25MB | 12 hours |
| Pro ($49) | 50MB | 24 hours |
| Enterprise | 500MB | 72 hours |

> Images are additionally capped at **10 MB** and **JPEG/PNG/WebP/GIF/AVIF/SVG** only, regardless of tier.

## Tips

- Only images are accepted — use the File Host skill for other file types
- Override `retentionHours` to control how long the URL lives
- The returned `url` is public — no auth needed to view the image
- Good for: generated images, screenshots, pipeline handoffs between agents
