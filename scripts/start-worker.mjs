import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import './sites-env.mjs';

const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const config = fileURLToPath(new URL('../dist/server/wrangler.json', import.meta.url));
const devVars = fileURLToPath(new URL('../.dev.vars', import.meta.url));
const args = process.argv.slice(2);
if (!existsSync(config)) throw new Error('Build ausente. Execute pnpm build antes de pnpm start.');

// The generated Worker config lives in dist/server. Resolve development secrets
// from the project root explicitly instead of copying them into build output.
const hasEnvFile = args.some(arg => arg === '--env-file' || arg.startsWith('--env-file='));
const child = spawn(process.execPath, [cli, 'dev', '--config', config,
    '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--inspector-port', '0',
    ...(!hasEnvFile && existsSync(devVars) ? ['--env-file', devVars] : []), ...args],
{ stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
