// Progressive browser fallback. This is NOT the Agora integration.
// No audio is recorded/stored by i.byara; the browser may use its own remote service.
export type CaptureState = 'idle' | 'requesting' | 'listening' | 'finishing';
type Result = { isFinal: boolean; 0: { transcript: string } };
export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
export type RecognitionConstructor = new () => Recognition;
export type CaptureCallbacks = {
  state: (state: CaptureState) => void;
  transcript: (final: string, interim: string) => void;
  error: (message: string) => void;
};
export function browserRecognition(): RecognitionConstructor | undefined {
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
const messages: Record<string, string> = {
  'not-allowed': 'Microfone não autorizado. Libere o acesso no navegador ou continue por texto.',
  'service-not-allowed': 'O serviço de voz foi bloqueado. Continue por texto.',
  'audio-capture': 'Nenhum microfone disponível. Conecte um microfone ou continue por texto.',
  'network': 'O serviço de voz não respondeu. Seu texto foi preservado; tente novamente.',
  'no-speech': 'Não detectei uma fala. Toque no microfone para tentar novamente.',
  'language-not-supported': 'O reconhecimento em português não está disponível neste navegador.',
};

/** One user-initiated turn. Detaches callbacks on abort to ignore late provider events. */
export class BrowserCapture {
  private recognition: Recognition | null = null;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  constructor(private Constructor: RecognitionConstructor | undefined, private callbacks: CaptureCallbacks) {}
  start() {
    this.cancel();
    if (!this.Constructor) { this.callbacks.error('Ditado indisponível neste navegador. Você pode escrever abaixo.'); return; }
    const rec = new this.Constructor();
    this.recognition = rec;
    let hasFinal = false, failed = false;
    rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true;
    rec.onstart = () => { if (this.recognition === rec) this.callbacks.state('listening'); };
    rec.onresult = event => {
      if (this.recognition !== rec) return;
      const results = Array.from(event.results);
      const final = results.filter(r => r.isFinal).map(r => r[0].transcript).join(' ').trim();
      const interim = results.filter(r => !r.isFinal).map(r => r[0].transcript).join(' ').trim();
      hasFinal = !!final;
      this.callbacks.transcript(final, interim);
    };
    rec.onerror = event => {
      if (this.recognition !== rec) return;
      failed = true;
      if (event.error !== 'aborted') this.callbacks.error(messages[event.error] ?? 'Não foi possível ouvir. Seu texto foi preservado.');
      this.cancel();
    };
    rec.onend = () => {
      if (this.recognition !== rec) return;
      if (!hasFinal && !failed) this.callbacks.error(messages['no-speech']);
      this.detach(); this.callbacks.state('idle');
    };
    this.callbacks.state('requesting');
    try {
      rec.start();
      // A missing browser terminal event must never leave the UI recording forever.
      if (this.recognition === rec) this.deadline = setTimeout(() => { this.callbacks.error('A captura terminou por tempo. Revise o texto antes de enviar.'); this.cancel(); }, 60000);
    } catch { this.callbacks.error('Não foi possível iniciar o microfone. Continue por texto.'); this.cancel(); }
  }
  stop() {
    if (!this.recognition) return;
    clearTimeout(this.deadline);
    this.callbacks.state('finishing');
    try {
      this.recognition.stop();
      if (this.recognition) this.deadline = setTimeout(() => { this.callbacks.error('A transcrição não foi concluída. O texto confirmado foi preservado.'); this.cancel(); }, 5000);
    } catch { this.cancel(); }
  }
  private detach() {
    clearTimeout(this.deadline);
    if (this.recognition) {
      this.recognition.onstart = this.recognition.onresult = this.recognition.onerror = this.recognition.onend = null;
      this.recognition = null;
    }
  }
  cancel() {
    const rec = this.recognition;
    this.detach();
    try { rec?.abort(); } catch { /* Already ended. */ }
    this.callbacks.state('idle');
  }
}
