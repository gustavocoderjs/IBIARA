import http from 'node:http';

// Explicit local-only preview for the compiled Worker. This never runs in the
// deployed app and must not be exposed through a public tunnel or network bind.
// Isolated browser checks never write into the person's local demo workspace.
const isolated = process.argv.includes('--isolated');
const port = isolated ? 5174 : 5173;
const owner = isolated ? `browser_test_${crypto.randomUUID()}` : 'local_browser_demo';
const upstreamPort = 4173;
const upstreamOrigin = `http://127.0.0.1:${upstreamPort}`;
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const allowedOrigins = new Set([...allowedHosts].map(host => `http://${host}`));
const loopbackAddresses = new Set(['127.0.0.1', '::ffff:127.0.0.1', '::1']);

const server = http.createServer((request, response) => {
    const origin = request.headers.origin;
    if (!loopbackAddresses.has(request.socket.remoteAddress ?? '') ||
        !allowedHosts.has(request.headers.host ?? '') ||
        (origin && !allowedOrigins.has(origin)) ||
        request.headers['sec-fetch-site'] === 'cross-site' ||
        !request.url?.startsWith('/') || request.url.startsWith('//')) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Preview disponível somente em localhost.');
        return;
    }

    const headers = { ...request.headers, host: `127.0.0.1:${upstreamPort}` };
    for (const name of Object.keys(headers)) {
        if (name.startsWith('oai-authenticated-user-') || name.startsWith('x-forwarded-') ||
            ['forwarded', 'connection', 'proxy-authorization', 'proxy-connection'].includes(name)) delete headers[name];
    }
    headers['oai-authenticated-user-id'] = owner;
    headers['oai-authenticated-user-email'] = 'demo@localhost.test';
    headers['oai-authenticated-user-full-name'] = 'Operador%20da%20demo%20local';
    headers['oai-authenticated-user-full-name-encoding'] = 'percent-encoded-utf-8';
    // The app checks same-origin mutations against the actual Worker URL.
    if (origin) headers.origin = upstreamOrigin;

    const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort,
        path: request.url, method: request.method, headers }, incoming => {
        const resultHeaders = { ...incoming.headers };
        delete resultHeaders.connection;
        if (resultHeaders.location?.startsWith(upstreamOrigin)) {
            const location = new URL(resultHeaders.location);
            resultHeaders.location = `${location.pathname}${location.search}${location.hash}`;
        }
        response.writeHead(incoming.statusCode ?? 502, resultHeaders);
        incoming.pipe(response);
    });
    upstream.setTimeout(90000, () => upstream.destroy(new Error('Worker timeout')));
    upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Worker local indisponível. Execute pnpm start --port 4173 em outro terminal.');
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => { if (!response.writableFinished) upstream.destroy(); });
    request.pipe(upstream);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
    console.log(`Demo local: http://127.0.0.1:${port} → Worker ${upstreamOrigin}`);
    console.log('Identidade fictícia local. Preview compilado, sem HMR.');
    if (isolated) console.log('Cenário de teste isolado; sua conversa habitual permanece intacta.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
