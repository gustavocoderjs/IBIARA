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

O `turn` da gestão aplica uma proteção de entrada antes do scheduler ou de qualquer
alteração de ficha, conversa ou evento. Pedidos de comida reconhecidos retornam
`CUSTOMER_FLOW_REQUIRED` (422); uma pergunta de esclarecimento nessa área retorna
`CONVERSATION_CLARIFICATION_REQUIRED` com a explicação de seu contexto, sem alterar
a receita. É uma regra local conservadora, não um classificador universal.
A UI oferece continuar como consumidor com o texto digitado, sem enviá-lo automaticamente
nem copiar contexto privado do restaurante. Se há uma conversa de compra anterior,
o usuário inicia explicitamente um novo pedido; só depois envia a mensagem recuperada.

Comandos de consumidor: `mandate`, `revoke`, `rfq`, `negotiate`, `counter`, `accept`, `order` (somente cancelamento elegível). Mandato atual: uma porção, uma compra, 15 minutos. `negotiate` executa a seleção automaticamente; não há clique manual no vencedor.

A nova UI usa `agent_negotiate` com `scope: "buyer"` e `rfqId` após criar a RFQ.
Esse comando consulta os contextos NeuraLake elegíveis separados (ou mock explícito), valida
ofertas próprias/recusas e chama o domínio existente. Não aceita remetente/destinatário,
prompt, credencial, preço ou ownerId enviados pelo cliente. Falha live não ativa mock.
O comando determinístico `negotiate` anterior permanece disponível para compatibilidade.
Com `restaurantId` fixado no mandato, somente esse restaurante é consultado. Com ponto
de entrega, a cobertura também limita os destinatários. A coordenação continua no backend
do comprador: quatro agentes, sem uma IA orquestradora adicional.

Os schemas de comunicação estão em `lib/agents/shared/contracts.ts` e `router.ts`.
Não existe endpoint de mensagem direta restaurante→restaurante.
`POST /customer-agent` retorna `{result:{session,readiness,offers},replayed}`.
GET retorna `{session,readiness,mode}`. Conflitos 409 exigem recarga do estado;
resposta inválida do modelo é 502, indisponibilidade/timeout é 503, limite de chamadas é 429.

O primeiro turno válido de mensagem prepara o mercado simulado na mesma gravação:
12 fichas, 16 insumos e estoques lógicos por restaurante. O marcador `demoMarketVersion`
evita repetir essa preparação. Uma leitura GET, um reset ou uma falha de inferência
não inicializam o mercado expandido. Cenários existentes preservam saldos e transações.

Ferramentas permitidas ao comprador: `propose_request`, `consult_menu`, `inspect_offers`,
`discover_restaurants` e `explain_question`. Consultas de menu, ofertas e restaurantes
aceitam `patch` opcional com os mesmos campos de rascunho. `explain_question` aceita
`patch` ausente ou estritamente vazio: explica o assunto estruturado pendente sem
modificar os campos do pedido; qualquer campo dentro desse patch é rejeitado.
Assim, uma mensagem pode responder à pergunta anterior e consultar o cardápio.
Uma saída válida no schema ainda é uma proposta: `grounding.ts` confere a origem
textual dos campos antes de aplicá-los. Orçamento, quantidade e prazo vêm de valores
e unidades informados na mensagem; números curtos só respondem ao campo indicado por
`pendingQuestion`. Termos como “leve”, “barato”, “rápido” ou “pouco” não criam valores.
Valores conflitantes ficam pendentes, e números negados, exemplos e preços citados
não se tornam limites do comprador. Região, preferência e exclusões também exigem
evidência atual. “Não” só completa a declaração de restrições na pergunta correspondente;
uma preocupação alimentar já declarada exige correção e negação explícitas, sem ressalva.
Quantidade fora do intervalo, negativa ou fracionada invalida a quantidade antiga.
`location.ts` interpreta região e ponto juntos: endereço do restaurante não vira
destino do comprador, e dois pontos alternativos não escolhem automaticamente um deles.
Excluir um componente da receita escolhida bloqueia a revisão como pronta até uma
correção explícita de prato ou restrição; a receita não é editada pela conversa.

`consult_menu` mostra no máximo três opções por vez, filtradas por ingredientes,
exclusões, orçamento, prazo e disponibilidade conhecidos. “Mais opções” avança a lista;
“a segunda” ou um número refere-se somente à última lista exibida. O backend revalida
essa referência e pede uma nova escolha se ela não for identificável ou compatível.
Preferências por ingredientes são filtros de descoberta, não confirmação de um prato.
A escolha pela lista de pratos define a refeição. `discover_restaurants` apresenta
até três restaurantes com opções compatíveis com composição, exclusões, orçamento,
prazo, disponibilidade e cobertura conhecidos. A sessão distingue uma lista de pratos
de uma lista de restaurantes (`choiceKind`); a posição resolve somente a lista vigente.
Escolher um restaurante pelo nome ou pela lista fixa `draft.restaurantId`; as sugestões
de pratos seguintes respeitam essa escolha. Sem restaurante fixo, o vencedor continua
sendo definido na busca autorizada pelo critério do mandato.

A resposta apresenta ingredientes, preço total de referência com entrega, prazo e
avaliação simulada; não revela custos, margem, piso, política ou saldo exato.
A projeção de composição usada nos filtros contém nomes e IDs públicos de ingredientes,
sem quantidades de estoque ou dados de ficha técnica privada. Consulta não equivale a reserva.
`inspect_offers` sem busca vigente e mandato válido retorna o cardápio público,
sem usar propostas de compras encerradas. O próximo passo considera os dados já informados.

Saída JSON inválida do comprador permite **uma** tentativa de correção de formato,
respeitando o saldo de chamadas. A tentativa recebe a resposta anterior e os erros
de validação como dados para correção, sem publicá-los nos logs ou na interface.
A segunda saída passa pelo mesmo schema estrito;
nada autoriza compra. Em sucesso, ambas as chamadas/tokens são contabilizadas; se
não houver resultado válido, o estado anterior é preservado. Os logs registram só
categorias do erro, sem conteúdo de conversa ou resposta do provedor.
O limite contabiliza turnos persistidos, não é um teto de faturamento do provedor:
tentativas que falham inteiramente ou perdem uma disputa CAS não entram no contador.
A sessão mantém `draft`, `discovery`, `question`, `fieldSources` e `pendingQuestion`, além
de versão, turnos e uso. `question = {kind, field?, text, options?}` registra a intenção da
pergunta antes de renderizar o texto; `pendingQuestion` permanece por compatibilidade.
“Como assim?” explica esse assunto, em vez de interpretar a frase como prato ou ingrediente.
`fieldSources` registra `{turn,text}` para cada campo alterado por um turno validado.
Esse registro auxilia rastreabilidade; não substitui a validação determinística nem o mandato.
`discovery` guarda filtros de ingredientes, preferências descritivas, última lista de
opções e posição da página, além de `choiceKind`, `restaurantChoices` e indicação de busca
por proximidade; sessões antigas recebem valores iniciais compatíveis.
A extração do comprador recebe `currentDraft`, `discovery`, `question`, `pendingQuestion`, a mensagem
atual, a última pergunta e o cardápio público. Esse contexto é privado do comprador:
os agentes de restaurante continuam recebendo apenas a RFQ pública e suas próprias ofertas,
sem orçamento, conversa ou contexto de descoberta do cliente.
Perguntas de esclarecimento são feitas uma por vez. Consultas puras de cardápio não
reescrevem limites; correções de região não podem abreviar o prato já escolhido.

O rascunho e o comando `mandate` aceitam `selectionPreference`: `LOWEST_PRICE`
(padrão compatível com dados antigos), `BEST_RATED`, `NEAREST` ou `FASTEST`.
`NEAREST` exige ponto de entrega e prioriza a distância simulada; `FASTEST` prioriza
o prazo da oferta, sem converter distância em ETA. A melhor nota tem precedência
sobre preço e espera, mas apenas entre ofertas que atendem orçamento, prazo,
composição, estoque e capacidade. Empates usam preço, prazo e ID do restaurante.
Ofertas/cardápio/projeção pública incluem `ratingTenths` (0–50 ou null), `ratingCount`
e `ratingIsDemo`. Todas as notas atuais são fixtures simuladas, sem coleta de reviews.
Sem avaliações, a oferta fica depois das avaliadas. Valores ausentes em cenários
legados recebem defaults de leitura; nenhum estoque ou pedido é reinicializado.

`restaurantId` aceita `niko`, `casa`, `panela` ou `null`. `deliveryPointId` aceita
`butanta_centro`, `usp`, `vila_indiana` ou `null`. Ambos são opcionais no mandato:
quando omitidos, herdam a escolha atual da conversa; `null` explícito remove o filtro
na revisão manual. A RFQ copia esses campos da autorização. Emissão, contraproposta
e aceite não podem trocar o restaurante fixado nem o ponto autorizado. Uma busca
incompatível retorna `AUTHORIZATION_MISMATCH`; oferta de outra cozinha retorna
`RESTAURANT_MISMATCH`. Falta de oferta elegível não autoriza substituição de restaurante.

`delivery.ts` contém somente coordenadas e raios fictícios. A distância usa linha reta
aproximada, não GPS, trajeto, endereço real ou tempo de entrega. Os pontos pertencem
à região `demo_butanta`; ponto desconhecido/região incompatível é rejeitado. `NEAREST`
sem ponto retorna `DELIVERY_POINT_REQUIRED`; cozinha sem cobertura para o ponto fixado
retorna `DELIVERY_UNAVAILABLE`. Requests públicos enviados a cada restaurante incluem
`deliveryPointId`, sua própria `distanceMeters` e `locationIsDemo`; ofertas públicas
incluem `distanceMeters` e `locationIsDemo`. Distância ausente permanece `null`.

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

Evidência histórica: [validação do atendimento guiado](evidence/VALIDATION-GUIDED-CUSTOMER.md).
Resultados e limites da revisão de entrada, localização e escolha de restaurante:
[validação da jornada](evidence/VALIDATION-RESTAURANT-JOURNEY.md).
