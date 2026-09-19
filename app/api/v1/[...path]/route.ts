import { D1Store, getState, transact } from '@/lib/server/repository';
import { commandSchema } from '@/lib/domain/commands';
import { DomainError, nowIso, type Role } from '@/lib/domain/types';
import { project, visibleEvents } from '@/lib/domain/projection';
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
function owner(req: Request) {
    const id = req.headers.get('oai-authenticated-user-id');
    if (id)
        return id;
    // Development-only local operator. Vite eliminates this branch in production.
    if (import.meta.env.DEV)
        return 'local-demo-operator';
    throw new DomainError('UNAUTHENTICATED', 'Entre com sua conta para abrir a demonstração.', 401);
}
function role(req: Request): Role { const r = new URL(req.url).searchParams.get('role') ?? 'merchant'; if (r !== 'merchant' && r !== 'buyer')
    throw new DomainError('UNAUTHORIZED_SCOPE', 'Contexto inválido.', 403); return r; }
function fail(error: unknown) { const e = error instanceof DomainError ? error : new DomainError('SERVICE_UNAVAILABLE', 'Não foi possível concluir. Seus dados anteriores foram preservados.', 503); if (!(error instanceof DomainError))
    console.error('ibyara_request_failed', error instanceof Error ? error.message : 'unknown'); return Response.json({ error: { code: e.code, message: e.message, retryable: e.status >= 500 || e.code === 'CONCURRENT_UPDATE', correlationId: crypto.randomUUID() } }, { status: e.status, headers }); }
export async function GET(req: Request) { try {
    const path = new URL(req.url).pathname.split('/').pop();
    if (path === 'healthz')
        return Response.json({ status: 'ok', release: '0.3.0', mode: 'SANDBOX' }, { headers });
    const id = owner(req), store = new D1Store();
    const { state } = await getState(store, id);
    const context = role(req);
    if (path === 'events') {
        const url = new URL(req.url);
        const after = Number(req.headers.get('Last-Event-ID') ?? url.searchParams.get('after') ?? 0);
        const data = visibleEvents(state, context).filter(e => e.id > after);
        return new Response(`retry: 3000\n${data.map(e => `id: ${e.id}\nevent: change\ndata: ${JSON.stringify(e)}\n\n`).join('')}: heartbeat\n\n`, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
    }
    if (path === 'state' || path === 'readyz')
        return Response.json(path === 'readyz' ? { status: 'ready', storage: 'D1' } : project(state, context, nowIso(state)), { headers });
    throw new DomainError('NOT_FOUND', 'Rota não encontrada.', 404);
}
catch (e) {
    return fail(e);
} }
export async function POST(req: Request) { try {
    const id = owner(req);
    if (new URL(req.url).pathname.split('/').pop() !== 'commands')
        throw new DomainError('NOT_FOUND', 'Rota não encontrada.', 404);
    const origin = req.headers.get('Origin');
    if (origin && origin !== new URL(req.url).origin)
        throw new DomainError('INVALID_ORIGIN', 'Origem não autorizada.', 403);
    if (!req.headers.get('Content-Type')?.startsWith('application/json'))
        throw new DomainError('INVALID_CONTENT_TYPE', 'Envie JSON.', 415);
    const raw = await req.text();
    if (raw.length > 280000)
        throw new DomainError('PAYLOAD_TOO_LARGE', 'Arquivo muito grande.', 413);
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch {
        throw new DomainError('INVALID_JSON', 'JSON inválido.');
    }
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success)
        throw new DomainError('INVALID_COMMAND', parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join(';'));
    const key = req.headers.get('Idempotency-Key');
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
        throw new DomainError('IDEMPOTENCY_KEY_REQUIRED', 'Use uma chave de idempotência válida.');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parsed.data))))).map(x => x.toString(16).padStart(2, '0')).join('');
    const r = await transact(new D1Store(), id, parsed.data, key, digest);
    return Response.json({ result: r.result, replayed: r.replayed, state: project(r.state, parsed.data.scope, nowIso(r.state)) }, { headers });
}
catch (e) {
    return fail(e);
} }
