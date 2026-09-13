/**
 * Generates public/openapi.json and public/llms.txt from the operation registry.
 *
 * Run via `npm run generate:contracts`. Node resolves `@/*` through tsx + the
 * tsconfig paths. getServerConfig() applies dev defaults when NODE_ENV is not
 * 'production', so an unset NODE_ENV yields APP_URL http://localhost:3000.
 */
import path from 'node:path';
import { writeContracts } from '@/lib/contracts/generate';

const rootDir = path.resolve(__dirname, '..');
const { openapiPath, llmsTxtPath } = writeContracts(rootDir);
console.log(`Wrote ${openapiPath}`);
console.log(`Wrote ${llmsTxtPath}`);
