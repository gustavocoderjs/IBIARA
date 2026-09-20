import test from 'node:test';
import assert from 'node:assert/strict';
import { BuyerConversation, demoIntent, noMatchMessage, proposalFromOffer, proposalMessage } from '../lib/client/buyer-conversation.ts';
import type { Send } from '../lib/client/workspace-types.ts';
import { initialState } from '../lib/domain/fixtures.ts';
import { commandSchema, execute } from '../lib/domain/commands.ts';
import { project } from '../lib/domain/projection.ts';
import { marketSimulation } from '../lib/client/market-simulation.ts';
import { money } from '../lib/domain/money.ts';
import { evaluateMarketPressure } from '../lib/domain/market-pressure.ts';
import { quote } from '../lib/domain/pricing.ts';

const at = '2026-09-20T15:00:00.000Z';
function scenario() {
  const state = initialState('conversation-test', at);
  execute(state, { type: 'seed_demo', scope: 'merchant' }, at);
  const calls: string[] = [];
  const send: Send = async command => {
    calls.push(String(command.type));
    const result = execute(state, commandSchema.parse(command), at);
    return { result, state: project(state, 'buyer', at) } as unknown as NonNullable<Awaited<ReturnType<Send>>>;
  };
  const conversation = new BuyerConversation(send, () => {});
  return { state, calls, conversation, send };
}

test('proposal mapping explicitly allows public fields and strips merchant economics', async () => {
  const { state, conversation } = scenario();
  await conversation.start(demoIntent);
  const offer = state.offers.find(o => o.id === conversation.snapshot.proposal?.offerId)!;
  const proposal = proposalFromOffer(offer);
  assert.deepEqual(Object.keys(proposal).sort(), ['offerId', 'rfqId', 'quoteToken', 'expiresAt', 'merchantName', 'itemName', 'totalCents', 'etaMinutes', 'status'].sort());
  assert.equal(proposal.totalCents, offer.totalCents);
  assert.equal(proposal.etaMinutes, offer.eta);
  assert.doesNotMatch(JSON.stringify(conversation.snapshot), /receipt|requirements|floorCents|costCents|minMarginBps|stockSnapshot/);
  assert.doesNotMatch(JSON.stringify(project(state, 'buyer', at)), /floorCents|costCents|stockSnapshot/);
});

test('real negotiation waits for human approval; accept and reservation occur once, refusal revokes', async () => {
  const { state, calls, conversation } = scenario();
  await conversation.authorize();
  await Promise.all([conversation.start(demoIntent), conversation.start(demoIntent)]);
  assert.equal(conversation.snapshot.state, 'AWAITING_APPROVAL');
  assert.deepEqual(calls, ['mandate', 'rfq', 'negotiate']);
  assert.equal(state.orders.length, 0);
  assert.equal(state.mandates[0].committedCents, 0);
  assert.ok(state.restaurants.every(r => r.stock.every(i => i.reserved === '0')));
  assert.ok(state.events.some(e => e.type === 'COUNTER_ACCEPTED'));
  await Promise.all([conversation.authorize(), conversation.authorize()]);
  assert.equal(calls.filter(c => c === 'accept').length, 1);
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].totalCents, conversation.snapshot.proposal!.totalCents);
  assert.equal(conversation.snapshot.state, 'CONFIRMED');
  assert.ok(state.events.some(e => e.type === 'ORDER_CONFIRMED'));
  const declined = scenario();
  await declined.conversation.start(demoIntent);
  await declined.conversation.decline();
  await declined.conversation.authorize();
  assert.equal(declined.state.orders.length, 0);
  assert.equal(declined.state.mandates[0].revoked, true);
  assert.equal(declined.calls.includes('accept'), false);
  const unchanged = scenario();
  for (const restaurant of unchanged.state.restaurants) restaurant.policy!.maxRounds = 0;
  await unchanged.conversation.start(demoIntent);
  assert.equal(unchanged.state.events.some(e => e.type === 'COUNTER_ACCEPTED'), false);
  assert.ok(unchanged.state.offers.every(o => o.round === 0));
  assert.equal(unchanged.conversation.snapshot.state, 'AWAITING_APPROVAL');
});

test('conversation output follows actual proposal values and exact selected quote expires safely', async () => {
  const { state, conversation } = scenario();
  state.restaurants[0].deliveryCents += 17;
  await conversation.start(demoIntent);
  const p = conversation.snapshot.proposal!;
  assert.equal(conversation.snapshot.message, proposalMessage(p));
  assert.ok(proposalMessage(p).includes(p.merchantName));
  assert.ok(proposalMessage(p).includes(money(p.totalCents)));
  assert.ok(proposalMessage(p).includes(`${p.etaMinutes} min`));
  assert.notEqual(proposalMessage({ ...p, totalCents: p.totalCents + 1 }), proposalMessage(p));
  const offer = state.offers.find(o => o.id === p.offerId)!;
  offer.expiresAt = at;
  await conversation.authorize();
  assert.equal(conversation.snapshot.state, 'ERROR');
  assert.equal(state.orders.length, 0);
  const uncertain = scenario();
  const lostResponse = new BuyerConversation(async (command, options) => {
    const response = await uncertain.send(command, options);
    return command.type === 'accept' ? null : response;
  }, () => {});
  await lostResponse.start(demoIntent);
  await lostResponse.authorize();
  assert.equal(uncertain.state.orders.length, 1);
  assert.equal(lostResponse.snapshot.confirmationUncertain, true);
  await lostResponse.decline();
  assert.equal(uncertain.calls.includes('revoke'), false);
  assert.match(lostResponse.snapshot.message, /pedido pode ter sido criado/);
});

test('NO_MATCH and simulator isolation: no fabricated offer or implicit accept', async () => {
  const a = scenario(), b = scenario();
  const before = structuredClone(b.state);
  for (const count of [0, 3, 50]) {
    const simulation = marketSimulation(count), restaurant = b.state.restaurants[0];
    evaluateMarketPressure({ ...simulation, availableCapacity: 12, activeOrders: 0, surplusState: true,
      commercialPolicy: restaurant.policy!, baseReceipt: quote(restaurant, restaurant.recipes[0], at) });
  }
  assert.deepEqual(b.state, before);
  await a.conversation.start(demoIntent);
  await b.conversation.start(demoIntent);
  assert.equal(a.conversation.snapshot.proposal!.totalCents, b.conversation.snapshot.proposal!.totalCents);
  const noMatch = scenario();
  await noMatch.conversation.start({ ...demoIntent, maxCents: 1 });
  assert.equal(noMatch.conversation.snapshot.state, 'NO_MATCH');
  assert.equal(noMatch.conversation.snapshot.message, noMatchMessage);
  assert.equal(noMatch.conversation.snapshot.proposal, undefined);
  await noMatch.conversation.authorize();
  assert.equal(noMatch.calls.includes('accept'), false);
  assert.equal(noMatch.state.orders.length, 0);
});
