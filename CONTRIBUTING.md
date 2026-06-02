# Contributing to AgentUtils

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Code of Conduct

Be respectful. No harassment, discrimination, or toxic behavior. Treat everyone as a collaborator.

## Development Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Firebase project (Auth + Admin SDK)

### Getting Started

```bash
# Clone and install
git clone https://github.com/gibtang/agent-utils.git
cd agent-utils
npm install

# Set up environment
cp .env.example .env.local
# Fill in your credentials in .env.local

# Start dev server
npm run dev
```

### Required Environment Variables

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_ID`, etc. — Firebase Auth
- `MONGODB_URI` — MongoDB connection string
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe billing
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` — File storage
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS
- `RESEND_API_KEY` — Email

## Making Changes

### Branch Naming

Use descriptive branch names:

```
feat/add-rate-limiter-ui
fix/dlq-retry-bug
docs/update-api-reference
```

For GitHub issues:

```
<issue-number>/<short-title>
```

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add rate limiter dashboard
fix: resolve DLQ retry timeout
docs: update webhook inbox guide
```

### Code Style

- TypeScript everywhere — no `any` types
- Follow existing patterns in the codebase
- Run `npm run lint` before committing

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.test.ts

# Run with coverage
npm run test:coverage
```

Write tests for:
- New API endpoints (integration tests)
- Utility functions (unit tests)
- React components (component tests)

## Pull Request Process

1. **Fork** the repo (or branch if you have write access)
2. **Create a branch** from `master`
3. **Make your changes** with tests
4. **Run tests** — all must pass
5. **Open a PR** against `master`
6. **Describe your changes** — what, why, and how to test
7. **Link issues** — mention "Closes #N" if applicable

### PR Review

- Keep PRs small and focused (< 400 lines ideal)
- One logical change per PR
- Respond to review comments constructively
- Mark resolved threads

## Project Structure

```
app/              # Next.js App Router pages
app/api/          # REST API endpoints (one dir per tool)
lib/              # Shared utilities (auth, pricing, storage)
models/           # Mongoose schemas
mcp/              # MCP server for AI agent integrations
public/           # Static assets (llms.txt, openapi.json)
```

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/gibtang/agent-utils/labels/good%20first%20issue). These are:

- Well-scoped with clear acceptance criteria
- Don't require deep codebase knowledge
- Include pointers to relevant files

## Questions?

- Open a [GitHub Discussion](https://github.com/gibtang/agent-utils/discussions) for questions
- Open an [Issue](https://github.com/gibtang/agent-utils/issues) for bugs or features

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.
