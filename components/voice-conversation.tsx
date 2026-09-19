'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUp, MessageCircle, Mic, MicOff, Sprout, Square, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BrowserCapture, browserRecognition, type CaptureState } from '@/lib/adapters/browser-voice';
import type { Send, ViewState } from '@/lib/client/workspace-types';

const subscribeCapabilities = () => () => {};
const voiceCapabilities = () => (browserRecognition() ? 1 : 0) | ('speechSynthesis' in window ? 2 : 0) | 4;
const serverCapabilities = () => 0;

export function VoiceConversation({ data, send, busy, draft, setDraft, navigate }: {
  data: ViewState; send: Send; busy: boolean; draft: string; setDraft: (value: string) => void; navigate: (view: string) => void;
}) {
  const [capture, setCapture] = useState<CaptureState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [readReplies, setReadReplies] = useState(true);
  const capabilities = useSyncExternalStore(subscribeCapabilities, voiceCapabilities, serverCapabilities);
  const supported = { recognition: !!(capabilities & 1), synthesis: !!(capabilities & 2), checked: !!(capabilities & 4) };
  const session = useRef<BrowserCapture | null>(null);
  const alive = useRef(true), speechGeneration = useRef(0), speech = useRef<SpeechSynthesisUtterance | null>(null);
  const last = data.restaurant?.conversation.filter(turn => turn.role === 'assistant').at(-1);
  const capturing = capture !== 'idle';

  const stopSpeaking = () => {
    speechGeneration.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speech.current = null; setSpeaking(false);
  };
  const speak = (text: string) => {
    stopSpeaking();
    if (!('speechSynthesis' in window)) { setError('Leitura em voz alta indisponível. A resposta está disponível em texto.'); return; }
    session.current?.cancel(); setInterim('');
    const generation = speechGeneration.current;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.lang === 'pt-BR') ?? null;
    utterance.onstart = () => { if (alive.current && generation === speechGeneration.current) setSpeaking(true); };
    utterance.onend = () => { if (alive.current && generation === speechGeneration.current) setSpeaking(false); };
    utterance.onerror = () => {
      if (alive.current && generation === speechGeneration.current) {
        setSpeaking(false); setError('O navegador não reproduziu o áudio. A resposta está preservada em texto.');
      }
    };
    speech.current = utterance;
    window.speechSynthesis.speak(utterance);
  };
  useEffect(() => {
    alive.current = true;
    const pause = () => {
      if (!document.hidden) return;
      session.current?.cancel(); setInterim(''); stopSpeaking();
    };
    document.addEventListener('visibilitychange', pause);
    return () => {
      alive.current = false;
      session.current?.cancel();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      document.removeEventListener('visibilitychange', pause);
    };
  }, []);
  const start = () => {
    if (busy || capturing) return;
    stopSpeaking(); setError(''); setInterim('');
    const base = draft.trim();
    session.current?.cancel();
    session.current = new BrowserCapture(browserRecognition(), {
      state: value => { if (alive.current) { setCapture(value); if (value === 'idle') setInterim(''); } },
      transcript: (final, partial) => {
        if (!alive.current) return;
        setDraft([base, final].filter(Boolean).join(' ')); setInterim(partial);
      },
      error: message => { if (alive.current) setError(message); },
    });
    session.current.start();
  };
  const submit = async () => {
    if (!draft.trim() || busy || capturing) return;
    stopSpeaking(); setError('');
    const result = await send({ type: 'turn', text: draft }, { quiet: true });
    if (!result) return;
    setDraft('');
    if (!alive.current) return;
    const reply = result.state.restaurant?.conversation.filter(turn => turn.role === 'assistant').at(-1);
    if (readReplies && reply) speak(reply.text);
  };
  const status = busy ? 'Enviando sua mensagem…' : speaking ? 'Byara está falando' : capture === 'requesting' ? 'Aguardando o microfone…' : capture === 'listening' ? 'Estou ouvindo você' : capture === 'finishing' ? 'Concluindo a transcrição…' : draft ? 'Revise e envie quando estiver pronto' : 'Toque para conversar';

  return <div className="voice-layout">
    <section className="voice-stage panel" aria-label="Conversa por voz">
      <div className="voice-topline"><span className="tag neutral">Voz do navegador · beta</span><Button variant="ghost" onClick={() => navigate('conversation')}><MessageCircle size={17}/>Texto</Button></div>
      <div className="voice-intro"><div className={`voice-orbit ${capture === 'listening' ? 'is-listening' : ''} ${speaking ? 'is-speaking' : ''}`}><Sprout size={48}/></div>
      <div className="voice-intro-copy"><h2>Uma conversa de cada vez.</h2>
      <p className="voice-status" role="status">{status}</p></div></div>
      <div className="voice-microphone-row">
        {capturing ? <Button className="voice-microphone stop" aria-label="Parar de ouvir" disabled={capture === 'finishing'} onClick={() => session.current?.stop()}><Square size={27}/></Button>
          : <Button className="voice-microphone" aria-label="Começar a falar" disabled={busy || !supported.checked || !supported.recognition} onClick={start}><Mic size={30}/></Button>}
        {capturing && <Button variant="ghost" onClick={() => { session.current?.cancel(); setInterim(''); }}><MicOff size={17}/>Cancelar escuta</Button>}
      </div>
      {supported.checked && !supported.recognition && <p className="voice-fallback">Este navegador não oferece ditado. Escreva abaixo para continuar a conversa.</p>}
      {error && <div className="voice-error" role="alert"><AlertCircle size={18}/><span>{error}</span></div>}
      <div className="voice-draft">
        <label htmlFor="voice-transcript">Sua mensagem <span>Revise antes de enviar</span></label>
        <Textarea id="voice-transcript" placeholder="Fale sobre seu prato ou escreva aqui…" value={draft} disabled={capturing || busy} maxLength={4000} onChange={event => setDraft(event.target.value)} rows={3}/>
        {interim && <p className="interim-transcript" aria-live="polite">{interim}…</p>}
        <Button className="voice-send" disabled={!draft.trim() || draft.length > 4000 || busy || capturing} onClick={submit}><ArrowUp size={18}/>{busy ? 'Enviando…' : 'Enviar mensagem'}</Button>
      </div>
      <p className="voice-privacy">O microfone só abre ao tocar. O serviço do navegador pode processar áudio online. Agora segue em mock.</p>
    </section>
    <aside className="voice-response panel">
      <div className="section-heading"><div className="inline-flex items-center gap-2"><Sprout size={19}/><h2>Byara</h2></div><span className="tag neutral">Interpretador local</span></div>
      <p className="voice-response-text" aria-live="polite">{last?.text ?? 'Conte o nome da sua cozinha e o que você prepara.'}</p>
      <div className="voice-playback">
        <Button variant="outline" disabled={!last || capturing || !supported.synthesis} onClick={() => speaking ? stopSpeaking() : speak(last!.text)}>{speaking ? <VolumeX size={18}/> : <Volume2 size={18}/>}{speaking ? 'Parar resposta' : 'Ouvir resposta'}</Button>
        <label className="touch-switch" htmlFor="read-voice-replies"><span>Ouvir novas respostas</span><Switch id="read-voice-replies" checked={readReplies} disabled={!supported.synthesis} onCheckedChange={value => { setReadReplies(value); if (!value) stopSpeaking(); }}/></label>
      </div>
      <p className="small-note">A conversa organiza fichas técnicas. Para disponibilidade, contagens e limites comerciais, use Ajustes rápidos.</p>
      <Button variant="ghost" onClick={() => navigate('quick')}>Abrir ajustes rápidos</Button>
    </aside>
  </div>;
}
