import { env } from 'cloudflare:workers';

import { type State, DomainError } from '../domain/types';

import type { AggregateStore } from '../domain/transaction';
export { getState, transact } from '../domain/transaction';
export class D1Store implements AggregateStore {
    private db() { if (!env.DB)
        throw new DomainError('STORAGE_UNAVAILABLE', 'Persistência indisponível. Tente novamente.', 503); return env.DB; }
    async read(owner: string) { const row = await this.db().prepare('SELECT revision, data FROM workspaces WHERE owner_id = ?').bind(owner).first<{
        revision: number;
        data: string;
    }>(); return row ? { revision: row.revision, state: JSON.parse(row.data) as State } : null; }
    async insert(owner: string, state: State) { await this.db().prepare('INSERT OR IGNORE INTO workspaces (owner_id, revision, data, updated_at) VALUES (?, 0, ?, ?)').bind(owner, JSON.stringify(state), new Date().toISOString()).run(); }
    async compareAndSwap(owner: string, revision: number, state: State, at: string) { const result = await this.db().prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(JSON.stringify(state), at, owner, revision).run(); return result.meta.changes === 1; }
}
