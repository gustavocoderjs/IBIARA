import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../scripts/dish-scenarios.mjs';
import { initialState } from '../lib/domain/fixtures.ts';
import { ensureDemoMarket } from '../lib/domain/demo-market.ts';
import { emptyCustomerSession } from '../lib/agents/customer/state.ts';
import { runCustomerTool, draftReadiness } from '../lib/agents/customer/tools.ts';
import type { CustomerDraft, CustomerQuestion } from '../lib/agents/customer/schemas.ts';

type Scenario = { id: string; steps: { message: string; expectedDraft?: Partial<CustomerDraft>;
    expectedReady?: boolean; expectedQuestionKind?: CustomerQuestion['kind'] | null;
    expectedUnsupported?: string; forbiddenReply?: string[] }[] };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// The same externally specified user journeys also run offline. An empty model
// patch tests that deterministic guards never rely on invented extraction values.
for (const scenario of scenarios as Scenario[]) test(`dish journey: ${scenario.id}`, () => {
    const at = '2026-09-20T12:00:00.000Z', state = initialState(scenario.id, at);
    ensureDemoMarket(state, at);
    let session = emptyCustomerSession(), previousReply: string | undefined;
    for (const step of scenario.steps) {
        const result = runCustomerTool({ tool: 'propose_request', patch: {} }, session.draft, state, at,
            step.message, previousReply, session);
        for (const [field, expected] of Object.entries(step.expectedDraft ?? {}))
            assert.deepEqual(result.draft[field as keyof CustomerDraft], expected, `${step.message}: ${field}`);
        const readiness = draftReadiness(result.draft, state);
        if (step.expectedReady !== undefined) assert.equal(readiness.ready, step.expectedReady, step.message);
        if (step.expectedQuestionKind !== undefined) assert.equal(result.question?.kind ?? null, step.expectedQuestionKind, step.message);
        if (step.expectedUnsupported) assert.ok(readiness.unsupported.some(text => normalize(text).includes(normalize(step.expectedUnsupported!))), step.message);
        for (const forbidden of step.forbiddenReply ?? []) assert.ok(!normalize(result.reply).includes(normalize(forbidden)), step.message);
        session = { ...session, ...result }; previousReply = result.reply;
    }
    assert.deepEqual(state.orders, []); assert.deepEqual(state.mandates, []);
});
