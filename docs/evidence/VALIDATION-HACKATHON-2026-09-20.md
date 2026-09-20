# Validação — correção de receitas e plano gratuito

Data: 20/09/2026. SANDBOX. Escopo: seleção de versões em novas RFQs e documentação.

- `pnpm test`: 31 testes aprovados (25 domínio + 6 voz).
- Regressão: ficha v1 sem frango, proposta emitida, revisão v2 com frango, nova RFQ excluindo frango. Restaurante não emite nova oferta pela v1; concorrentes compatíveis permanecem. Oferta anterior preserva composição e preço, e pode ser aceita enquanto válida.
- Regressão: revisão compatível para 250 g de patinho; nova proposta usa v2 e reserva os 250 g.
- `pnpm typecheck`: aprovado.
- `pnpm lint`: aprovado sem avisos.
- Build de produção Vinext: cinco etapas concluídas com sucesso. Avisos informativos de proxy e classificação estática de rotas persistem.
- Nenhuma alteração de schema, UI ou integração externa. Fluxos de domínio afetados cobertos pelos testes; não houve nova validação de microfone/dispositivos nem ensaio manual da UI nesta revisão.
- Supabase: plano Free conferido na página oficial; formulário de cadastro aberto. Sem conta/projeto provisionado ou migração do banco. NeuraLake/Agora permanecem mocks.
