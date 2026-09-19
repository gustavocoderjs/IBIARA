# API 0.1.0

Prefixo `/api/v1`. As rotas do guia eram propostas; esta release concentra comandos tipados em uma rota, com validação Zod estrita. Não declarar a superfície FastAPI/OpenAPI proposta como implementada.

| Método/rota | Contrato |
|---|---|
| GET `/healthz` | Saúde do Worker, sem dados privados |
| GET `/readyz` | Identidade e persistência disponíveis |
| GET `/state?role=merchant\|buyer` | Projeção autorizada da visão da demo |
| GET `/events?role=...&after=N` | SSE finito, `id`, `event: change`, retry 3 s, retomada por Last-Event-ID |
| POST `/commands` | JSON validado + `Idempotency-Key` obrigatória |

Private Sites verifica o acesso e encaminha `oai-authenticated-user-id`. A aplicação usa esse identificador no predicado de toda leitura/escrita. Em hospedagem alternativa é obrigatório substituir essa confiança em header por autenticação verificada; nunca expor o Worker diretamente aceitando headers arbitrários.

Mutações exigem JSON, corpo limitado, origem compatível quando enviada e uma chave de 8–100 caracteres `[A-Za-z0-9_-]`. Schemas executáveis: `commandSchema` em `lib/domain/commands.ts`. Campos não previstos são rejeitados. `scope` seleciona um personagem autorizado do cenário do próprio operador; não concede acesso a outro cenário.

Comandos de restaurante: `turn`, `seed_demo`, `new_recipe`, `revise_recipe`, `confirm_recipe`, `policy`, `purchase`, `receive`, `count`, `confirm_count`, `surplus`, `eligibility`, `schedule`, `tick`, `produce`, `order`.

Comandos de consumidor: `mandate`, `revoke`, `rfq`, `negotiate`, `counter`, `accept`, `order` (somente cancelamento elegível). Mandato atual: uma porção, uma compra, 15 minutos. `negotiate` executa a seleção automaticamente; não há clique manual no vencedor.

```json
{"type":"mandate","scope":"buyer","description":"Bife a cavalo com arroz e feijão","maxCents":3500,"maxMinutes":40,"zone":"demo_butanta","excluded":[],"confirmed":true}
```

```json
{"type":"accept","scope":"buyer","offerId":"ID_RETORNADO","quoteToken":"TOKEN_RETORNADO"}
```

O aceite não recebe preço do cliente. Usa somente a oferta persistida e seu token opaco, valida validade, mandato, capacidade e todos os componentes, e compromete orçamento/reserva/pedido/eventos na mesma revisão. O custo/política da oferta permanecem congelados; estoque/condição são revalidados. Atualizar a política não altera silenciosamente uma oferta emitida ainda válida.

Resposta de comando: `{result, replayed, state}`. Erro: `{error:{code,message,retryable,correlationId}}`. Mensagens do consumidor não expõem custo, piso, saldo exato ou snapshot privado. A RFQ contém composição reconhecida, região e prazo; o texto bruto do comprador, que poderia conter seu orçamento, não é encaminhado.

O SSE usa respostas finitas e reconexão nativa, não WebSocket. Os eventos são gerados e persistidos no backend; não são linhas animadas inventadas pelo frontend. Limitações: sem broker externo, sem stream de inferência, sem retenção/compactação e sem rate limit distribuído nesta release.
