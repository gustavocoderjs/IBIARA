import { DomainError } from '../../domain/types.ts';

export type AgentEnvironment = {
    NEURALAKE_MODE?: string;
    NEURALAKE_BASE_URL?: string;
    NEURALAKE_API_KEY?: string;
    NEURALAKE_MODEL?: string;
    NEURALAKE_CUSTOMER_API_KEY?: string;
    NEURALAKE_NIKO_API_KEY?: string;
    NEURALAKE_CASA_API_KEY?: string;
    NEURALAKE_PANELA_API_KEY?: string;
};
export function agentConfig(env: AgentEnvironment) {
    const mode = env.NEURALAKE_MODE ?? 'mock';
    if (mode !== 'mock' && mode !== 'live')
        throw new DomainError('PROVIDER_CONFIGURATION', 'Modo de inferência inválido.', 503);
    const baseUrl = (env.NEURALAKE_BASE_URL || 'https://api.neuralake.cloud/v1').replace(/\/$/, '');
    // Fixed destination prevents a misconfigured endpoint from receiving the key.
    if (mode === 'live' && (baseUrl !== 'https://api.neuralake.cloud/v1' || !env.NEURALAKE_API_KEY?.trim()))
        throw new DomainError('PROVIDER_CONFIGURATION', 'Configure a NeuraLake no servidor.', 503);
    return { mode, baseUrl, apiKey: env.NEURALAKE_API_KEY ?? '', model: env.NEURALAKE_MODEL || 'auto',
        timeoutMs: 15000 as number, maxTokens: 512 as number, maxCalls: 24 as number } as const;
}
export type AgentConfig = ReturnType<typeof agentConfig>;

export type AgentId = 'buyer' | 'niko' | 'casa' | 'panela';
export function configForAgent(env: AgentEnvironment, id: AgentId): AgentConfig {
    const keys = { buyer: env.NEURALAKE_CUSTOMER_API_KEY || env.NEURALAKE_API_KEY,
        niko: env.NEURALAKE_NIKO_API_KEY, casa: env.NEURALAKE_CASA_API_KEY,
        panela: env.NEURALAKE_PANELA_API_KEY };
    // Restaurant credentials never fall back to another agent's credential.
    return agentConfig({ ...env, NEURALAKE_API_KEY: keys[id] });
}
