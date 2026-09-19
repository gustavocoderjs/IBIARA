import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserCapture, type Recognition, type CaptureState } from '../lib/adapters/browser-voice.ts';

class FakeRecognition implements Recognition {
  static last: FakeRecognition;
  lang = ''; continuous = true; interimResults = false;
  onstart: Recognition['onstart'] = null;
  onresult: Recognition['onresult'] = null;
  onerror: Recognition['onerror'] = null;
  onend: Recognition['onend'] = null;
  aborted = false; stopped = false;
  constructor() { FakeRecognition.last = this; }
  start() {}
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}
function fixture(supported = true) {
  const states: CaptureState[] = [], transcripts: string[][] = [], errors: string[] = [];
  const capture = new BrowserCapture(supported ? FakeRecognition : undefined, {
    state: value => states.push(value), transcript: (final, interim) => transcripts.push([final, interim]), error: message => errors.push(message),
  });
  return { capture, states, transcripts, errors };
}
test('unsupported voice reports fallback without claiming to listen', () => {
  const f = fixture(false); f.capture.start();
  assert.deepEqual(f.states, ['idle']); assert.match(f.errors[0], /indisponível/);
});
test('permission request is distinct from actual listening, and denial terminates capture', () => {
  const f = fixture(); f.capture.start(); const rec = FakeRecognition.last;
  assert.equal(f.states.at(-1), 'requesting'); assert.equal(rec.lang, 'pt-BR');
  rec.onerror?.({ error: 'not-allowed' });
  assert.equal(f.states.at(-1), 'idle'); assert.equal(rec.aborted, true); assert.match(f.errors[0], /não autorizado/);
});
test('transcript separates interim from final without accumulating duplicate results', () => {
  const f = fixture(); f.capture.start(); const rec = FakeRecognition.last; rec.onstart?.();
  assert.equal(f.states.at(-1), 'listening');
  rec.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'duzentos' } }] });
  rec.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'duzentos gramas' } }] });
  rec.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'duzentos gramas' } }, { isFinal: false, 0: { transcript: 'de patinho' } }] });
  assert.deepEqual(f.transcripts, [['', 'duzentos'], ['duzentos gramas', ''], ['duzentos gramas', 'de patinho']]);
  f.capture.stop(); assert.equal(rec.stopped, true); assert.equal(f.states.at(-1), 'finishing');
  rec.onend?.(); assert.equal(f.states.at(-1), 'idle'); assert.equal(f.errors.length, 0);
});
test('cancellation detaches audio and ignores late transcript/started events', () => {
  const f = fixture(); f.capture.start(); const rec = FakeRecognition.last;
  const lateResult = rec.onresult, lateStart = rec.onstart;
  f.capture.cancel(); lateStart?.(); lateResult?.({ results: [{ isFinal: true, 0: { transcript: 'não enviar' } }] });
  assert.equal(rec.aborted, true); assert.equal(rec.onresult, null); assert.equal(f.transcripts.length, 0); assert.equal(f.states.at(-1), 'idle');
});
test('network error leaves confirmed text intact and permits a new turn', () => {
  const f = fixture(); f.capture.start(); const rec = FakeRecognition.last;
  rec.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'um ovo' } }] });
  rec.onerror?.({ error: 'network' });
  assert.deepEqual(f.transcripts, [['um ovo', '']]); assert.equal(f.states.at(-1), 'idle');
  f.capture.start(); assert.notEqual(FakeRecognition.last, rec); f.capture.cancel();
});
test('silent turn ends with useful feedback and no generated transcript', () => {
  const f = fixture(); f.capture.start(); FakeRecognition.last.onend?.();
  assert.equal(f.transcripts.length, 0); assert.equal(f.states.at(-1), 'idle'); assert.match(f.errors[0], /Não detectei/);
});
