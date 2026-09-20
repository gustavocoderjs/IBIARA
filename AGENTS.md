# i.byara — instruções de desenvolvimento

Leia `docs/IBYARA_GUIDE.md`, `docs/RELEASE_NOTES.md` e a tarefa antes de editar.
Prioridade: requisitos confirmados > contratos > implementação. Preserve marca e produto.

- Acompanhamento atual: https://trello.com/b/YNokvONE/ibyara-hackathon (Trello substitui Jira).
- Fundação dos quatro agentes: leia `docs/MVP-FOUNDATION.md` e `docs/API.md`.
- Contextos/credenciais são por identidade; restaurantes comunicam somente com buyer via router.

- Preço/custo/taxas: domínio determinístico, frações BigInt e centavos inteiros; nunca LLM ou float como autoridade financeira.
- Receita: preserve quantidade, cru/pronto, rendimento e origem. Ambiguidade permanece pendente.
- Privacidade: escopo por operador autenticado e projeção por personagem. Não publique custos ou orçamento privado na RFQ.
- Comércio: mandato, total completo, validade e reserva idempotente. Persistência financeira não fica no navegador.
- Estoque: reserva não é consumo; contagem parcial não zera itens omitidos; não devolva ingredientes já consumidos.
- IA: mocks identificados. Integração depende de contratos verificados e não de headers/SDKs inventados.
- Mudanças de schema geram migrações novas. Migrações aplicadas não podem ser reescritas.
- Antes da entrega: `pnpm test`, `pnpm typecheck`, build e testes de fluxo afetados. Registre execução e limites reais.
- Mantenha `.env.example` sem segredos. Nunca publique banco local, tokens, documentos reais ou credenciais.
- Não declare conformidade A2A pública, segurança multi-tenant comercial ou voz homologada a partir desta demo.
- Frontend: leia `PRODUCT.md` e `DESIGN.md`; a revisão 0.3.0 substitui a paleta verde proposta no guia por decisão explícita do usuário.
- Impeccable: `pnpm design:context` carrega o contexto; `pnpm design:audit` executa a análise estática. Skill oficial versionada em `.agents/skills/impeccable`; preserve licença e origem ao atualizar.
- Fotografias geradas são ilustrativas. Associe somente nomes conhecidos, preserve a identificação e não crie preços, avaliações ou escassez fictícios como fatos.
