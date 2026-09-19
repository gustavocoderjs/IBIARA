import { initialState } from './fixtures.ts';
import { type State, DomainError, nowIso } from './types.ts';
import { execute, type Command } from './commands.ts';
export interface AggregateStore {
    read(owner: string): Promise<{
        revision: number;
        state: State;
    } | null>;
    insert(owner: string, state: State): Promise<void>;
    compareAndSwap(owner: string, revision: number, state: State, at: string): Promise<boolean>;
}
export async function getState(store: AggregateStore, owner: string) { let row = await store.read(owner); if (!row) {
    await store.insert(owner, initialState(owner, new Date().toISOString()));
    row = await store.read(owner);
} if (!row)
    throw new DomainError('STORAGE_UNAVAILABLE', 'Não foi possível carregar seus dados.', 503); return row; }
export async function transact(store: AggregateStore, owner: string, command: Command, key: string, digest: string) {
    for (let retry = 0; retry < 8; retry++) {
        const row = await getState(store, owner);
        const existing = row.state.idempotency[key];
        if (existing) {
            if (existing.digest !== digest)
                throw new DomainError('IDEMPOTENCY_CONFLICT', 'Esta chave já foi utilizada com outro comando.', 409);
            return { state: row.state, result: existing.result, replayed: true };
        }
        const state = structuredClone(row.state);
        const at = nowIso(state);
        const result = execute(state, command, at);
        state.idempotency[key] = { digest, result };
        if (await store.compareAndSwap(owner, row.revision, state, at))
            return { state, result, replayed: false };
    }
    throw new DomainError('CONCURRENT_UPDATE', 'A cozinha recebeu outra atualização. Tente novamente com a mesma solicitação.', 409);
}
