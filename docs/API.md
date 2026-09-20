# API do MVP

Prefixo `/api/v1`. As rotas do guia eram propostas; esta release concentra comandos tipados em uma rota, com validação Zod estrita. Não declarar a superfície FastAPI/OpenAPI proposta como implementada.

| Método/rota | Contrato |
|---|---|
| GET `/healthz` | Saúde do Worker, sem dados privados |
| GET `/readyz` | Identidade e persistência disponíveis |
| GET `/state?role=merchant\|buyer` | Projeção autorizada da visão da demo |
| GET `/events?role=...&after=N` | SSE finito, `id`, `event: change`, retry 3 s, retomada por Last-Event-ID |
| POST `/commands` | JSON validado + `Idempotency-Key` obrigatória |
| GET `/customer-agent` | Sessão privada do comprador, rascunho, descoberta e pergunta pendente |
| POST `/customer-agent` | `{message, expectedVersion}` ou `{reset: true, expectedVersion}` + `Idempotency-Key`; não compra |

Private Sites verifica o acesso e encaminha `oai-authenticated-user-id`. A aplicação usa esse identificador no predicado de toda leitura/escrita. Em hospedagem alternativa é obrigatório substituir essa confiança em header por autenticação verificada; nunca expor o Worker diretamente aceitando headers arbitrários.

Mutações exigem JSON, corpo limitado, origem compatível quando enviada e uma chave de 8–100 caracteres `[A-Za-z0-9_-]`. Schemas executáveis: `commandSchema` em `lib/domain/commands.ts`. Campos não previstos são rejeitados. `scope` seleciona um personagem autorizado do cenário do próprio operador; não concede acesso a outro cenário.

Comandos de restaurante: `turn`, `seed_demo`, `new_recipe`, `revise_recipe`, `confirm_recipe`, `policy`, `purchase`, `receive`, `count`, `confirm_count`, `surplus`, `eligibility`, `schedule`, `tick`, `produce`, `order`.

Comandos de consumidor: `mandate`, `revoke`, `rfq`, `negotiate`, `counter`, `accept`, `order` (somente cancelamento elegível). Mandato atual: uma porção, uma compra, 15 minutos. `negotiate` executa a seleção automaticamente; não há clique manual no vencedor.

A nova UI usa `agent_negotiate` com `scope: "buyer"` e `rfqId` após criar a RFQ.
Esse comando consulta três contextos NeuraLake separados (ou mock explícito), valida
ofertas próprias/recusas e chama o domínio existente. Não aceita remetente/destinatário,
prompt, credencial, preço ou ownerId enviados pelo cliente. Falha live não ativa mock.
O comando determinístico `negotiate` anterior permanece disponível para compatibilidade.

Os schemas de comunicação estão em `lib/agents/shared/contracts.ts` e `router.ts`.
Não existe endpoint de mensagem direta restaurante→restaurante.
`POST /customer-agent` retorna `{result:{session,readiness,offers},replayed}`.
GET retorna `{session,readiness,mode}`. Conflitos 409 exigem recarga do estado;
resposta inválida do modelo é 502, indisponibilidade/timeout é 503, limite de chamadas é 429.

O primeiro turno válido de mensagem prepara o mercado simulado na mesma gravação:
12 fichas, 16 insumos e estoques lógicos por restaurante. O marcador `demoMarketVersion`
evita repetir essa preparação. Uma leitura GET, um reset ou uma falha de inferência
não inicializam o mercado expandido. Cenários existentes preservam saldos e transações.

Ferramentas permitidas ao comprador: `propose_request`, `consult_menu` e `inspect_offers`.
As consultas também aceitam `patch` opcional com os mesmos campos de rascunho.
Assim, uma mensagem pode responder à pergunta anterior e consultar o cardápio.
Uma saída válida no schema ainda é uma proposta: `grounding.ts` confere a origem
textual dos campos antes de aplicá-los. Orçamento, quantidade e prazo vêm de valores
e unidades informados na mensagem; números curtos só respondem ao campo indicado por
`pendingQuestion`. Termos como “leve”, “barato”, “rápido” ou “pouco” não criam valores.
Valores conflitantes ficam pendentes, e números negados, exemplos e preços citados
não se tornam limites do comprador. Região, preferência e exclusões também exigem
evidência atual. “Não” só completa a declaração de restrições na pergunta correspondente;
uma preocupação alimentar já declarada exige correção e negação explícitas, sem ressalva.

`consult_menu` mostra no máximo três opções por vez, filtradas por ingredientes,
exclusões, orçamento, prazo e disponibilidade conhecidos. “Mais opções” avança a lista;
“a segunda” ou um número refere-se somente à última lista exibida. O backend revalida
essa referência e pede uma nova escolha se ela não for identificável ou compatível.
Preferências por ingredientes são filtros de descoberta, não confirmação de um prato.
A escolha pelo nome ou pela lista define o prato; não fixa o restaurante exibido.
O restaurante é escolhido depois, na busca autorizada, conforme o critério do mandato.

A resposta apresenta ingredientes, preço total de referência com entrega, prazo e
avaliação simulada; não revela custos, margem, piso, política ou saldo exato.
A projeção de composição usada nos filtros contém nomes e IDs públicos de ingredientes,
sem quantidades de estoque ou dados de ficha técnica privada. Consulta não equivale a reserva.
`inspect_offers` sem busca vigente e mandato válido retorna o cardápio público,
sem usar propostas de compras encerradas. O próximo passo considera os dados já informados.

Saída JSON inválida do comprador permite **uma** tentativa de correção de formato,
respeitando o saldo de chamadas. A segunda saída passa pelo mesmo schema estrito;
nada autoriza compra. Em sucesso, ambas as chamadas/tokens são contabilizadas; se
não houver resultado válido, o estado anterior é preservado. Os logs registram só
categorias do erro, sem conteúdo de conversa ou resposta do provedor.
O limite contabiliza turnos persistidos, não é um teto de faturamento do provedor:
tentativas que falham inteiramente ou perdem uma disputa CAS não entram no contador.
A sessão mantém `draft`, `discovery` e `pendingQuestion`, além de versão, turnos e uso.
`discovery` guarda filtros de ingredientes, preferências descritivas, última lista de
opções e posição da página; sessões antigas recebem valores iniciais compatíveis.
A extração do comprador recebe `currentDraft`, `discovery`, `pendingQuestion`, a mensagem
atual, a última pergunta e o cardápio público. Esse contexto é privado do comprador:
os agentes de restaurante continuam recebendo apenas a RFQ pública e suas próprias ofertas,
sem orçamento, conversa ou contexto de descoberta do cliente.
Perguntas de esclarecimento são feitas uma por vez. Consultas puras de cardápio não
reescrevem limites; correções de região não podem abreviar o prato já escolhido.

O rascunho e o comando `mandate` aceitam `selectionPreference`: `LOWEST_PRICE`
(padrão compatível com dados antigos) ou `BEST_RATED`. A melhor nota tem precedência
sobre preço e espera, mas apenas entre ofertas que atendem orçamento, prazo,
composição, estoque e capacidade. Empates usam preço, prazo e ID do restaurante.
Ofertas/cardápio/projeção pública incluem `ratingTenths` (0–50 ou null), `ratingCount`
e `ratingIsDemo`. Todas as notas atuais são fixtures simuladas, sem coleta de reviews.
Sem avaliações, a oferta fica depois das avaliadas. Valores ausentes em cenários
legados recebem defaults de leitura; nenhum estoque ou pedido é reinicializado.

`reset: true` exige a versão atual da conversa e reinicia rascunho, turnos e descoberta.
Preserva pedidos, mandatos, estoques, histórico comercial e contagem de chamadas.
Se `foodSafetyConcern` era `true`, mantém essa preocupação e as exclusões correspondentes:
começar outro pedido não equivale a retratar uma declaração alimentar. A liberação exige
correção e negação explícitas pelo cliente. Reset não faz inferência nem autoriza compra.

O domínio verifica as restrições conhecidas do rascunho também no caminho manual:
preocupação alimentar pendente ou quantidade diferente da única porção suportada
bloqueiam novo mandato, RFQ, negociação, contraproposta e aceite. `agent_negotiate`
verifica o bloqueio antes de consultar os restaurantes. Uma preocupação declarada
após a RFQ também impede o aceite; omitir a flag no corpo do mandato não elimina a
restrição persistida. Repetições idempotentes de operações já confirmadas devolvem o
resultado anterior, sem nova compra. Revisão humana e mandato continuam obrigatórios.

RFQs podem conter `dishName`, derivado de um prato reconhecido nas versões atuais
das fichas. Nesse caso, ofertas precisam corresponder ao prato; uma receita com
ingredientes semelhantes não pode substituí-lo. Lotes pré-produzidos do mesmo prato
continuam elegíveis. `meal-intent.ts` rejeita termos fora do vocabulário conservador
da demo com `INTENT_UNSUPPORTED`, em vez de apagar a parte desconhecida da intenção.
Exemplo: **pizza de queijo** não deve virar uma compra de macarrão com queijo.

```json
{"type":"mandate","scope":"buyer","description":"Bife a cavalo com arroz e feijão","maxCents":3500,"maxMinutes":40,"zone":"demo_butanta","excluded":[],"confirmed":true}
```

```json
{"type":"accept","scope":"buyer","offerId":"ID_RETORNADO","quoteToken":"TOKEN_RETORNADO"}
```

O aceite não recebe preço do cliente. Usa somente a oferta persistida e seu token opaco, valida validade, mandato, capacidade e todos os componentes, e compromete orçamento/reserva/pedido/eventos na mesma revisão. O custo/política da oferta permanecem congelados; estoque/condição são revalidados. Atualizar a política não altera silenciosamente uma oferta emitida ainda válida.

Resposta de comando: `{result, replayed, state}`. Erro: `{error:{code,message,retryable,correlationId}}`. Mensagens do consumidor não expõem custo, piso, saldo exato ou snapshot privado. A RFQ contém composição reconhecida, região e prazo; o texto bruto do comprador, que poderia conter seu orçamento, não é encaminhado.

O SSE usa respostas finitas e reconexão nativa, não WebSocket. Os eventos são gerados e persistidos no backend; não são linhas animadas inventadas pelo frontend. Limitações: sem broker externo, sem stream de inferência, sem retenção/compactação e sem rate limit distribuído nesta release.

Evidências e limites desta rodada: [validação do atendimento guiado](evidence/VALIDATION-GUIDED-CUSTOMER.md).
