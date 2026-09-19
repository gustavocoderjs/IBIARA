'use client';
export function registerWorkspaceTools(getRole: () => string, read: () => Promise<unknown>, navigate: (view: string) => void) {
    const context = (document as Document & {
        modelContext?: {
            registerTool: (tool: unknown, options: {
                signal: AbortSignal;
            }) => unknown;
        };
    }).modelContext;
    if (!context?.registerTool)
        return () => { };
    const life = new AbortController();
    const tools = [{ name: 'ibyara_read_workspace', title: 'Ler contexto atual', description: 'Lê os mesmos dados autorizados exibidos na visão atual. Não modifica pedidos, autorizações ou estoque.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: async (input: unknown) => { if (!input || typeof input !== 'object' || Object.keys(input).length)
                throw new Error('Objeto vazio obrigatório.'); return read(); } },
        { name: 'ibyara_open_section', title: 'Abrir seção da i.byara', description: 'Navega dentro da visão atual; não executa transações nem muda o principal.', inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['quick', 'voice', 'conversation', 'recipes', 'stock', 'policy', 'market', 'orders', 'activity', 'integrations'] } }, required: ['section'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input: unknown) => { if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'section')
                throw new Error('Informe somente section.'); const section = (input as {
                section: string;
            }).section; const allowed = getRole() === 'merchant' ? ['quick', 'voice', 'conversation', 'recipes', 'stock', 'policy', 'orders', 'activity', 'integrations'] : ['market', 'orders', 'activity', 'integrations']; if (!allowed.includes(section))
                throw new Error('Seção não disponível nesta visão.'); navigate(section); return { section, role: getRole() }; } }];
    for (const tool of tools)
        try {
            void Promise.resolve(context.registerTool(tool, { signal: life.signal })).catch(() => { });
        }
        catch { }
    return () => life.abort();
}
