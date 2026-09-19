// Agora is intentionally unconnected: no fabricated app IDs, tokens or SDK calls.
export interface VoiceAdapter {
    transcribe(audio: Blob, locale: string): Promise<{
        text: string;
        confidence: number | null;
    }>;
    speak(text: string, locale: string): Promise<Blob>;
}
export const agoraCapabilities = { provider: 'Agora', mode: 'MOCK', connected: false, fullDuplex: false, browserFallback: 'SpeechRecognition when supported, user initiated only' };
export class AgoraAdapter implements VoiceAdapter {
    async transcribe(): Promise<never> { throw new Error('PROVIDER_UNAVAILABLE: Agora não configurada. Use texto ou ditado do navegador.'); }
    async speak(): Promise<never> { throw new Error('PROVIDER_UNAVAILABLE: Agora não configurada.'); }
}
// TODO(AGORA-01): choose and verify RTC/Conversational AI contract and SDK version.
// TODO(AGORA-02): server-only expiring tokens bound to principal/channel; never
// expose APP_CERTIFICATE in the browser. Validate token expiration and revocation.
// TODO(AGORA-03): wire explicit microphone consent, pt-BR transcript events,
// interruption, reconnect and provider telemetry. Preserve unconfirmed text.
