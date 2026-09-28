/**
 * llms.txt generation from the operation registry.
 *
 * Deterministic plain-text listing of every operation: name, summary, actor,
 * HTTP mapping (if any) and possible error codes. Order follows registry
 * insertion order so regeneration is byte-stable.
 */
import { listOperations } from '@/lib/contracts/registry';

/** Build the llms.txt document from the registered operations. */
export function toLlmsTxt(operations = listOperations()): string {
  const lines: string[] = [];
  lines.push('# AgentUtils API');
  lines.push('');
  lines.push('');
  lines.push('Every callable operation, generated from the same registry as the OpenAPI document and the MCP tool surface.');
  lines.push('');
  for (const op of operations) {
    lines.push(`## ${op.name}`);
    lines.push('');
    lines.push(op.summary);
    lines.push('');
    lines.push(op.description);
    lines.push('');
    lines.push(`- actor: ${op.actor}`);
    if (op.http) lines.push(`- http: ${op.http.method} ${op.http.path}`);
    if (op.mcp) {
      lines.push(`- mcp: ${op.mcp.readOnly ? 'read-only' : 'writes'}, ${op.mcp.destructive ? 'destructive' : 'non-destructive'}, ${op.mcp.idempotent ? 'idempotent' : 'not idempotent'}`);
    }
    lines.push(`- errors: ${op.errors.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
