import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('llms.txt', () => {
  const llmsPath = path.resolve(__dirname, '../public/llms.txt');

  it('exists in public/', () => {
    expect(fs.existsSync(llmsPath)).toBe(true);
  });

  it('has AgentUtils header', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    expect(content).toContain('# AgentUtils');
  });

  it('has authentication section', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    expect(content).toContain('## Authentication');
    expect(content).toContain('x-api-key');
  });

  it('documents all tools', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    const tools = ['File Host', 'Dead Letter Queue', 'Human-in-the-Loop', 'Agent Shield', 'AgentVerify OTP'];
    for (const tool of tools) {
      expect(content).toContain(tool);
    }
  });

  it('has rate limits section', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    expect(content).toContain('## Rate Limits');
  });

  it('links to OpenAPI spec', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    expect(content).toContain('/api/docs');
  });

  it('has response format section', () => {
    const content = fs.readFileSync(llmsPath, 'utf-8');
    expect(content).toContain('## Response Format');
    expect(content).toContain('success');
  });
});
