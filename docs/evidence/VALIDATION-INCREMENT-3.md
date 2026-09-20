# Incremento 3 — conversa do consumidor

Validado em 20/09/2026. Modo SANDBOX.

## Estado inicial

Branch `feat/mvp-agent-demo`. Alterações preexistentes preservadas:
`app/appetite.css`, `components/workspace.tsx`; não rastreados:
`components/merchant-economy.tsx`, `lib/client/market-simulation.ts`,
`lib/domain/market-pressure.ts`, `tests/market-simulation.test.ts`.
Nenhum reset, checkout, commit, push ou merge executado.

## Implementação e contrato

Entrada em Economia do agente → Experimentar como cliente, ou no menu do
consumidor → Conversar com meu agente. A troca de personagem limpa a projeção
anterior antes de carregar os dados do consumidor. Guided Demo preservada.

`ConversationInput` recebe texto e limites explícitos da intenção canônica.
Não interpreta linguagem livre nem extrai números com LLM. `BuyerConversation`
orquestra os comandos HTTP existentes: mandate → rfq → negotiate com
`proposalOnly: true`. O Buyer Agent do domínio mantém interpretação, filtros,
contrapropostas e ranking; a nova opção retorna o identificador selecionado
sem chamar accept. Não há alteração de schema persistido ou migração.

O modo legado de negotiate continua executando accept para preservar a demo
guiada. A pausa humana é o contrato desta nova experiência, não uma nova
restrição global de autorização da API.

`proposalFromOffer` copia somente nome público do restaurante/prato, total,
ETA, status e identificadores/validade/token da cotação. `proposalMessage`
gera texto desses campos. As ofertas iniciais e eventos de contraproposta
pertencem somente à RFQ iniciada nesta conversa. Não se fabrica resposta,
desconto ou contagem de merchants.

Somente Autorizar envia accept com o identificador/token apresentados. O
backend revalida validade, orçamento, prazo, capacidade e estoque, usando
a transação/idempotência já existentes. Recusar revoga o mandato. Após envio
de accept, falha de resposta é tratada como confirmação incerta: não se
promete ausência de pedido nem se oferece recusa; orienta-se consulta aos
pedidos ou reenvio da mesma autorização. Não há pagamento implementado.

Estados: IDLE, UNDERSTANDING, SEARCHING, NEGOTIATING, PROPOSAL_READY,
AWAITING_APPROVAL, CONFIRMED, NO_MATCH, ERROR e DECLINED. PROPOSAL_READY é
uma transição interna imediata para AWAITING_APPROVAL. LISTENING tem tipo e
rótulo reservados à futura voz, mas não é emitido pelo caminho textual.

A futura transcrição do VoiceAdapter/Agora poderá alimentar ConversationInput
após revisão dos limites; a saída pura proposalMessage poderá alimentar a
fala. AgoraAdapter, BrowserCapture e InferenceAdapter foram inspecionados e
preservados. Não foram adicionados SDK, TTS, STT, LLM ou persistência de conversa.

Preços, negociação, RFQ, reservas e pedidos executam o domínio real sobre
dados de demonstração. Intenção canônica e avatar são explicitamente demo.
O simulador de pressão permanece independente e não entra nesta transação.

## Validação final

| Comando | Resultado |
|---|---|
| `pnpm lint` | Aprovado, saída 0 |
| `pnpm typecheck` | Aprovado, saída 0 |
| `pnpm test` | 37/37 aprovados; 33 anteriores + 4 novos |
| `pnpm build` | Aprovado, saída 0; cinco etapas Vinext |
| `git diff --check` | Aprovado |

Exatamente quatro testes novos em `tests/buyer-conversation.test.ts`:

1. Mapeamento público e ausência de campos econômicos privados.
2. Negociação sem compra antecipada; autorização, cliques duplicados, recusa
   e condição mantida sem contraproposta aceita.
3. Texto derivado da cotação, expiração e resposta perdida após accept persistido.
4. NO_MATCH e isolamento do simulador/market-pressure da transação.

Os testes usam os comandos e projeções reais em memória. Os testes anteriores
de concorrência e idempotência também passaram. Não equivalem a uma execução
HTTP/D1 ponta a ponta nesta sessão.

## Revisão visual e limites

`pnpm design:context` e `pnpm design:audit` não executaram: `sh` ausente no
Windows. Contexto PRODUCT.md/DESIGN.md lido diretamente. O launcher Windows
da skill executou a auditoria após instalação autorizada de seu engine.
Escopo: appetite.css e buyer-experience.tsx. Resultado final: dois warnings e
299 advisories em código preexistente; nenhum achado na nova superfície ou
no bloco CSS novo. Cinco advisories de tipografia novos foram corrigidos.

Comparação documental feita diretamente com DESIGN.md, appetite.css e o novo
componente: paleta cerâmica/tomate; Fraunces/DM Sans; raios de 14 px; controles
existentes; layout empilhado em telas estreitas. DESIGN.md preservado. A revisão
documental foi feita pelo agente principal, sem alterar o sistema visual.

Revisão independente por leitura identificou o caso de confirmação incerta;
correção revisada e teste incluído. Não houve inspeção renderizada desktop/mobile
nem teste de navegador nesta sessão. Os 401/503 conhecidos de autenticação/API
não foram investigados ou corrigidos. Ensaio visual/HTTP permanece pendente.
O build avisa sobre classificação estática incompleta de rotas; isso não
impediu sua conclusão. Não há alegação de homologação comercial, voz ou A2A.

Próxima etapa recomendada: tratar autenticação separadamente e então ensaiar
o fluxo visual completo antes de conectar um contrato Agora verificado.
