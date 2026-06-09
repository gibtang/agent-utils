# Deep Dive: iguana-docs
> Updated score: 74/100 | Verdict: BEST SAAS CANDIDATE

## What It Does
Document-to-Markdown conversion SaaS for AI developers. Supports PDF, DOCX, PPTX, Excel, HTML, and other document formats through Microsoft MarkItDown. Provides a web UI, guest conversions, async job queue, conversion history, and a REST API.

## Updated Thesis
The strongest positioning is not "multi-format Markdown converter." That category is already crowded.

The stronger wedge is:

> The simplest hosted document-to-Markdown API for AI developers.

AI/RAG teams do not want to maintain Pandoc, MarkItDown, OCR workers, file queues, retry logic, storage cleanup, webhooks, or format-specific parsers. They want to POST a document and get clean Markdown back with predictable pricing, deletion guarantees, and integration docs.

This is the best SaaS candidate in the portfolio because it has:

- Clear B2B/developer buyer
- Immediate AI/RAG workflow pain
- API-first monetization
- Low-friction PLG demo path
- Already-built core product
- High willingness to pay relative to implementation cost

## Competitive Landscape

| Competitor | Pricing | Target | Key Features | Weakness |
|---|---:|---|---|---|
| **Microsoft MarkItDown** | Free/open source | Devs | Converts many formats to Markdown: PDF, Office, images, audio, HTML, ZIP, EPUB, etc. | CLI/library, not hosted, no billing, no queue, no API product |
| **IBM Docling** | Free/open source | AI/enterprise devs | Document parsing, layout understanding, Markdown/JSON export | Self-hosted, heavier setup, not simple hosted API |
| **Unstructured.io** | Free + pay-as-you-go/enterprise | Enterprise RAG | Mature hosted document processing, partitioning, connectors | Complex, enterprise-oriented, pricing can feel heavy for small teams |
| **LlamaParse** | Free/paid | LlamaIndex/RAG devs | Hosted document parsing, many file types, Markdown output | Tied to LlamaIndex ecosystem, broader RAG positioning |
| **Mathpix** | $20-50/mo | Academic/STEM | Excellent OCR/math/LaTeX extraction | STEM-focused, expensive for general documents |
| **Marker** | Open source | Devs | Strong PDF-to-Markdown pipeline | CLI/self-hosted, PDF-first |
| **CloudConvert** | $10-100/mo | General devs | 200+ file conversions | General conversion, not Markdown/RAG optimized |
| **Pandoc** | Free/open source | Devs/writers | Universal document conversion | CLI-only, rough output on many real-world files |
| **Stirling PDF** | Open source/self-host | Power users/IT | Broad PDF toolkit | PDF-toolbox positioning, not Markdown API |

### Competitive Correction
The old claim that Iguana Docs is the only hosted, multi-format, Markdown-specific API is too strong.

Relevant current datapoints:

- Microsoft MarkItDown already supports many common formats and is the dependency behind Iguana Docs: https://github.com/microsoft/markitdown
- IBM Docling already provides document conversion and structured export for AI workflows: https://docling-project.github.io/docling/
- Unstructured sells hosted document processing and publicly prices pay-as-you-go document parsing: https://unstructured.io/pricing
- LlamaParse offers hosted parsing for LLM/RAG pipelines: https://www.llamaindex.cloud/

The gap is narrower but still real:

> Iguana Docs can win by being the lowest-friction, developer-friendly hosted API for clean Markdown conversion.

Do not compete on "most powerful document intelligence." Compete on:

- Simplicity
- Fast setup
- Clean API docs
- Predictable pricing
- Markdown quality
- Deletion/privacy guarantees
- Batch + webhook reliability

## Target Customers

### Primary
AI application developers building:

- RAG pipelines
- Internal document search
- Chat-with-docs apps
- Legal/finance/ops document ingestion
- Knowledge-base ingestion
- LLM-powered summarization/classification workflows

### Secondary

- Indie hackers building AI wrappers
- Agencies building client chatbots
- No-code/low-code automation builders
- Researchers converting mixed document sets
- Content teams converting legacy docs to Markdown

## Core User Pain

- "I need to feed PDFs and Office docs into my LLM, but the extracted text is messy."
- "Every file type needs a different parser."
- "I don't want to self-host MarkItDown, Pandoc, OCR, queues, and file cleanup."
- "I need async batch conversion with a webhook."
- "I need to test quality before committing to a paid API."
- "I need predictable pricing and retention/deletion guarantees."

## Product Wedge

### Primary Wedge
Simple hosted document-to-Markdown API:

```bash
curl -X POST https://api.iguana-docs.com/v1/convert \
  -H "Authorization: Bearer $IGUANA_API_KEY" \
  -F "file=@contract.pdf" \
  -F "output=markdown"
```

Returns:

```json
{
  "job_id": "job_123",
  "status": "completed",
  "markdown_url": "https://...",
  "metadata": {
    "pages": 14,
    "format": "pdf",
    "images_extracted": 3,
    "tables_detected": 2
  }
}
```

### Secondary Wedge
No-signup web demo:

- Drag in file
- See Markdown preview
- Copy/download result
- "Use this in your app" API CTA

The web UI should sell the API, not become a consumer document app.

## Feature Priorities

### Must Build Next
1. **Developer portal**
   - OpenAPI spec
   - Curl examples
   - JS/Python snippets
   - Error codes
   - File limits
   - Webhook docs

2. **Webhook notifications**
   - `job.completed`
   - `job.failed`
   - `job.expired`
   - signed webhook payloads

3. **Batch conversion**
   - ZIP upload
   - multiple file upload
   - one job with many child conversions
   - batch result ZIP
   - per-file success/failure report

4. **File deletion guarantees**
   - "Delete immediately after conversion"
   - "Retain for 24h"
   - "Retain for 7d"
   - visible privacy controls

5. **Quality benchmark page**
   - Compare Iguana Docs vs MarkItDown raw, Docling, Unstructured, LlamaParse on representative docs
   - Show actual Markdown outputs
   - Include failure cases honestly

### Should Build After Revenue
1. **Custom output formatting**
   - heading style
   - table mode
   - image extraction on/off
   - frontmatter metadata
   - page break markers

2. **Priority queue for paid users**
   - faster processing
   - larger files
   - higher concurrency

3. **Conversion diagnostics**
   - pages processed
   - warnings
   - table extraction confidence
   - OCR-needed warning

4. **SDKs**
   - TypeScript
   - Python

### Avoid For Now
- Full RAG platform
- Vector embeddings
- Chat-with-docs
- Long-term document storage
- Document management system
- Translation
- Complex workflow builder

## Pricing

| Tier | Price | Limits | Target |
|---|---:|---|---|
| Free | $0 | 3 conversions/day, 10MB max, web UI only | Evaluation |
| Developer | $19/mo | 300 conversions/mo, 25MB max, API access | Indie devs |
| Pro | $49/mo | 1,500 conversions/mo, 75MB max, batch jobs | AI app builders |
| Business | $149/mo | 10k conversions/mo, 200MB max, webhooks, priority queue | AI startups/agencies |
| Enterprise | Custom | Custom limits, retention, SLA, procurement | Larger teams |

Prefer usage-based over seat-based pricing. The buyer thinks in documents/pages/files, not seats.

## Revenue Path

At $49 ARPU:

- 100 paid users = $4.9K MRR
- 250 paid users = $12.25K MRR
- 400 paid users = $19.6K MRR

This is plausible because the customer is a developer/team with a recurring pipeline need. It does not rely on consumer habit formation.

## Go-To-Market

### Developer SEO
Write practical integration pages:

- "Convert PDF to Markdown API"
- "DOCX to Markdown API"
- "PPTX to Markdown for RAG"
- "MarkItDown hosted API"
- "LlamaParse alternative"
- "Unstructured alternative for simple Markdown conversion"
- "Convert documents to Markdown for LangChain"
- "Convert PDFs to Markdown for OpenAI embeddings"

### Launch Channels

- Hacker News
- Product Hunt
- r/LocalLLaMA
- r/MachineLearning
- r/LangChain
- AI engineering Twitter/X
- Indie Hackers
- "Show HN: A dead-simple hosted MarkItDown API"

### Content Hooks

- Public benchmark repo
- "I tested 100 messy PDFs across 5 parsers"
- "Why Markdown is the best interchange format for RAG"
- "How to build a document ingestion pipeline without self-hosting parsers"

## Risks

1. **Microsoft hosts MarkItDown**
   - Existential if they provide a cheap API.
   - Mitigation: move fast, own SEO, add queue/webhook/batch/deletion workflow around it.

2. **Quality expectations**
   - Real-world PDFs are messy.
   - Mitigation: expose warnings, confidence signals, and failure diagnostics instead of pretending all conversions are perfect.

3. **Enterprise incumbents**
   - Unstructured/LlamaParse can out-feature Iguana.
   - Mitigation: stay simpler and cheaper for developers who only need Markdown.

4. **Support burden**
   - Users will upload bad scans, weird PDFs, giant files.
   - Mitigation: clear limits, async jobs, paid priority, explicit OCR-needed response.

## Kill Switches

- <500 guest users/month after 90 days of promotion
- <2% free-to-paid conversion after 6 months
- >10% conversion failure rate on normal user-uploaded documents
- Support load exceeds solo-maintainable level
- Microsoft or another incumbent launches a simple hosted MarkItDown-compatible API and captures the obvious SEO

## Recommendation
Build and monetize this first.

Iguana Docs is the best SaaS opportunity in the portfolio because it has a real business buyer, recurring workflow value, and a simple API monetization path. The market is competitive, but that is a sign the pain is real. The winning move is not to out-enterprise Unstructured or out-research Docling. The winning move is to be the easiest hosted document-to-Markdown API to try, integrate, and pay for.

## Priority Actions

1. Launch API documentation portal.
2. Add webhooks for async conversion.
3. Add batch conversion with ZIP output.
4. Add deletion/retention controls.
5. Publish a public parser benchmark.
6. Write 5 developer SEO pages targeting PDF/DOCX/PPTX to Markdown API queries.
