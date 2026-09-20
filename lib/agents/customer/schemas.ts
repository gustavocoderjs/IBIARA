import { z } from 'zod';

// Extracted values remain proposals until the person reviews the existing form.
export const customerDraftSchema = z.object({
    description: z.string().trim().min(1).max(1000).nullable(),
    budget: z.string().regex(/^\d{1,4}(?:\.\d{1,2})?$/).nullable(),
    portions: z.number().int().min(1).max(20).nullable(),
    maxMinutes: z.number().int().min(1).max(180).nullable(),
    zone: z.enum(['demo_butanta', 'other']).nullable(),
    excluded: z.array(z.string().trim().min(1).max(100)).max(20).nullable(),
    foodSafetyConcern: z.boolean().nullable(),
}).strict();
export const customerPatchSchema = customerDraftSchema.partial();
export const agentDecisionSchema = z.discriminatedUnion('tool', [
    z.object({ tool: z.literal('propose_request'), patch: customerPatchSchema }).strict(),
    z.object({ tool: z.literal('inspect_offers') }).strict(),
    z.object({ tool: z.literal('consult_menu') }).strict(),
]);
const messageTurnSchema = z.object({
    message: z.string().trim().min(1).max(1000),
    expectedVersion: z.number().int().min(0).max(10000),
}).strict();
export const customerTurnSchema = z.union([messageTurnSchema,
    z.object({ reset: z.literal(true), expectedVersion: z.number().int().min(0).max(10000) }).strict(),
]);
export type CustomerDraft = z.infer<typeof customerDraftSchema>;
export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type CustomerTurn = z.infer<typeof customerTurnSchema>;
export type AgentUsage = { mode: 'NEURALAKE' | 'LOCAL_MOCK'; model: string | null; tokens: number | null; cost: null };
export type CustomerSession = {
    version: number;
    draft: CustomerDraft;
    turns: { role: 'user' | 'assistant'; text: string; at: string }[];
    calls: number;
    lastUsage: AgentUsage | null;
};
