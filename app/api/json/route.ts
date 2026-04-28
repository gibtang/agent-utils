import { NextRequest } from 'next/server';
import Ajv from 'ajv';
import { jsonrepair } from 'jsonrepair';
import { validateApiKey, errorResponse } from '@/lib/auth';
import { successResponse } from '@/lib/response';

const ajv = new Ajv({ coerceTypes: true, useDefaults: true });

export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (!authResult.success) return errorResponse(authResult);

  try {
    const body = await request.json();
    const { data, schema } = body;

    if (data === undefined) {
      return successResponse({ error: 'Missing "data" field' }, 400);
    }

    // Step 1: Repair and parse (handles markdown fences, trailing commas,
    //         single quotes, unquoted keys, Python literals, and more)
    let parsed = data;
    if (typeof data === 'string') {
      try {
        const repaired = jsonrepair(data);
        parsed = JSON.parse(repaired);
      } catch {
        return successResponse({
          error: 'Could not repair or parse JSON',
          raw: data,
        }, 400);
      }
    }

    // Step 2: If schema provided, validate against it
    if (schema) {
      try {
        const validate = ajv.compile(schema);
        const valid = validate(parsed);

        if (!valid) {
          return successResponse({
            valid: false,
            errors: validate.errors?.map(e => ({
              path: e.instancePath || '/',
              message: e.message,
              value: e.data,
            })),
            data: parsed,
          });
        }
      } catch (schemaError: unknown) {
        return successResponse({
          error: 'Invalid JSON Schema',
          details: schemaError instanceof Error ? schemaError.message : 'Unknown error',
        }, 400);
      }
    }

    // Step 3: Deep sort keys (deterministic output)
    const sorted = deepSort(parsed);

    return successResponse({
      valid: true,
      data: sorted,
      type: getType(parsed),
      keys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : undefined,
    });
  } catch (error) {
    console.error('JSON cleaner error:', error);
    return successResponse({ error: 'Failed to process JSON' }, 500);
  }
}

function deepSort(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(deepSort);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, key: string) => {
        sorted[key] = deepSort((obj as Record<string, unknown>)[key]);
        return sorted;
      }, {} as Record<string, unknown>);
  }
  return obj;
}

function getType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}
