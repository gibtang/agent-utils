import { z } from 'zod';

const fieldTypes = ['email', 'text', 'password', 'textarea'] as const;

export const handoffFieldSchemaSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,64}$/),
  label: z.string().max(120),
  helpText: z.string().max(240).optional(),
  type: z.enum(fieldTypes),
  required: z.boolean(),
  prefill: z.string().max(256).optional(),
}).superRefine((field, context) => {
  if (field.type === 'password' && field.prefill !== undefined) {
    context.addIssue({ code: 'custom', path: ['prefill'], message: 'password fields cannot have a prefill' });
  }
});

export const handoffFieldSchemaArraySchema = z.array(handoffFieldSchemaSchema).max(12).superRefine((fields, context) => {
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    if (seen.has(field.name)) context.addIssue({ code: 'custom', path: [index, 'name'], message: 'field names must be unique' });
    seen.add(field.name);
  });
});

export const createHandoffInputSchema = z.object({
  fieldSchema: handoffFieldSchemaArraySchema,
  title: z.string().max(120).optional(),
  linkTtlHours: z.number().min(0.5).max(24).default(1),
  callbackUrl: z.url().refine((value) => new URL(value).protocol === 'https:', 'callbackUrl must use https').optional(),
});

export type HandoffFieldSchema = z.infer<typeof handoffFieldSchemaSchema>;
export type CreateHandoffInput = z.infer<typeof createHandoffInputSchema>;
