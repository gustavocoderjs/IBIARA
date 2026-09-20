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
    selectionPreference: z.enum(['LOWEST_PRICE', 'BEST_RATED', 'NEAREST', 'FASTEST']).nullable().optional(),
    restaurantId: z.enum(['niko', 'casa', 'panela']).nullable().optional(),
    deliveryPointId: z.enum(['butanta_centro', 'usp', 'vila_indiana']).nullable().optional(),
}).strict();
// Extraction may report an unsupported quantity. It is not a valid purchase
// draft: grounding clears invalid quantities before customerDraftSchema.parse.
const proposedQuantity = z.preprocess(value => typeof value === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(value)
    ? Number(value.replace(',', '.')) : value, z.number().finite().nullable().optional());
const proposedMinutes = z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value) : value, customerDraftSchema.shape.maxMinutes.optional());
export const customerPatchSchema = customerDraftSchema.partial().extend({ portions: proposedQuantity, maxMinutes: proposedMinutes });
export const agentDecisionSchema = z.discriminatedUnion('tool', [
    z.object({ tool: z.literal('propose_request'), patch: customerPatchSchema }).strict(),
    z.object({ tool: z.literal('inspect_offers'), patch: customerPatchSchema.optional() }).strict(),
    z.object({ tool: z.literal('consult_menu'), patch: customerPatchSchema.optional() }).strict(),
    z.object({ tool: z.literal('discover_restaurants'), patch: customerPatchSchema.optional() }).strict(),
    // Providers may retain the common envelope. An empty patch is harmless;
    // any field is rejected because explaining a question cannot edit the draft.
    z.object({ tool: z.literal('explain_question'), patch: z.object({}).strict().optional() }).strict(),
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
export type CustomerDiscovery = {
    ingredientIds: string[];
    preferences: string[];
    choices: { restaurantId: string; menuItemId: string; name: string }[];
    offset: number;
    nameQuery?: string;
    choiceKind?: 'restaurant' | 'dish';
    restaurantChoices?: { restaurantId: string; name: string }[];
    nearby?: boolean;
};
export type CustomerQuestion = {
    kind: 'field' | 'location' | 'restaurant_choice' | 'dish_choice' | 'meal_style' | 'portion_meaning' | 'help';
    field?: keyof CustomerDraft;
    text: string;
    options?: string[];
};
export type CustomerSession = {
    version: number;
    draft: CustomerDraft;
    turns: { role: 'user' | 'assistant'; text: string; at: string }[];
    calls: number;
    lastUsage: AgentUsage | null;
    // Optional for previously persisted workspaces; never part of the purchase mandate.
    discovery?: CustomerDiscovery;
    pendingQuestion?: keyof CustomerDraft | null;
    question?: CustomerQuestion | null;
    fieldSources?: Partial<Record<keyof CustomerDraft, { turn: number; text: string }>>;
};
