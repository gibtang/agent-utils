import { z } from 'zod';

/** Agent names are trimmed, 1–80 chars, and limited to letters, digits, spaces, underscores, and hyphens. */
export const agentNameSchema = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9 _-]+$/, 'name contains unsupported characters');
export const createAgentSchema = z.object({ name: agentNameSchema });
export const renameAgentSchema = z.object({ name: agentNameSchema });
export const createPairingCodeSchema = z.object({ runtime: z.string().trim().min(1).max(120).optional() });
export const redeemPairingCodeSchema = z.object({ code: z.string().trim().min(1).max(256), runtimeVersion: z.string().trim().min(1).max(120).optional() });
