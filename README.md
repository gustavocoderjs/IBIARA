# i.byara · release 0.3.0

Marketplace alimentício bilateral com agentes de restaurante e consumidor. Monólito modular executável para análise do produto e da implementação, **somente em sandbox**. O documento original está em `docs/IBYARA_GUIDE.md`.

## Fundação dos quatro agentes (branch de integração)

Análise e decisões: [docs/MVP-FOUNDATION.md](docs/MVP-FOUNDATION.md).
O monólito existente foi preservado. O fluxo começa pelo input da pessoa na conversa
vazia do comprador e produz um rascunho revisável. Três agentes de restaurante recebem
somente RFQ pública e suas próprias ofertas. O roteador bloqueia restaurante→restaurante.
Preço, negociação, estoque e pedido permanecem no domínio determinístico.

No primeiro input válido, o backend prepara 12 pratos (quatro por restaurante) e 16
insumos no D1 existente. São três conjuntos lógicos independentes de fichas, custos e
estoques, dentro do cenário privado do operador. Não há três bancos físicos. A
preparação preserva dados anteriores e não repõe saldos em novas conversas. Detalhes:
[docs/DEMO-MARKET.md](docs/DEMO-MARKET.md).

Para desenvolvimento, crie `.dev.vars` a partir de `.env.example` se ainda não existir
(no Windows: `if (!(Test-Path .dev.vars)) { Copy-Item .env.example .dev.vars }`).
Preserve um arquivo já configurado. O padrão `mock` não consulta LLM. Para homologar,
configure `NEURALAKE_MODE=live` e as quatro chaves autorizadas nos bindings do servidor:
`NEURALAKE_CUSTOMER_API_KEY`, `NEURALAKE_NIKO_API_KEY`, `NEURALAKE_CASA_API_KEY`,
`NEURALAKE_PANELA_API_KEY`. Nunca cole chaves em código, Trello ou frontend.
As chaves atuais podem ser utilizadas conforme decisão do responsável; não é
necessário substituí-las para executar a integração. `.dev.vars` fica no `.gitignore`;
este repositório mantém somente os nomes das variáveis e valores vazios de exemplo.

Use a conversa do cliente → enviar intenção → revisar no formulário → autorizar compra.
Perguntar pelo cardápio mostra até três opções filtradas, com ingredientes, disponibilidade,
preços calculados e notas simuladas. “Mais opções” continua a lista; “a segunda” escolhe
somente entre as últimas opções exibidas. Explorar um ingrediente não confirma um prato.
A lista de pratos escolhe a refeição. A pessoa também pode pedir uma lista de restaurantes,
escolher um pelo nome ou pela posição apresentada e então consultar seus pratos.
O restaurante explicitamente escolhido acompanha revisão, mandato, busca e aceite;
se ele não puder atender, a compra não muda silenciosamente de cozinha. Sem escolha
fixa, o domínio compara restaurantes elegíveis pelo critério autorizado.
Nenhuma dessas consultas cria pedido.

A aplicação abre na visão do consumidor. Pedidos de comida reconhecidos na gestão
do restaurante são bloqueados antes de alterar fichas ou histórico. A interface
oferece continuar como consumidor com a mensagem recuperada, sem enviá-la automaticamente
nem transferir dados privados da cozinha. Se já existir uma conversa de compra, o usuário
precisa iniciar explicitamente um novo pedido antes de enviar a mensagem recuperada.
“Como assim?” explica a pergunta pendente; a sessão guarda o assunto e a origem textual
dos campos alterados, sem depender de reconstruir esse contexto pela frase exibida.

Os campos do pedido exigem evidência na mensagem ou resposta à pergunta pendente;
a saída da IA não pode fornecer números ausentes como orçamento, quantidade ou prazo.
Uma preocupação alimentar declarada ou uma quantidade incompatível também bloqueiam
o caminho manual e o aceite pelo backend. **Novo pedido** reinicia conversa e descoberta,
preservando estoque, pedidos e quota; mantém uma preocupação alimentar ainda não
retratada explicitamente e suas exclusões.
Cada resultado identifica modo real ou mock. Não há fallback silencioso quando o provedor falha.
O cadastro da cozinha continua usando parser local; Agora/Cross Memory continuam desconectados.
Evidência histórica da fundação: [VALIDATION-AGENTS.md](docs/evidence/VALIDATION-AGENTS.md)
(40 testes e fluxo com mocks). Na ampliação anterior, 51 testes passaram e o fluxo real dos
quatro agentes passou no Worker/D1 local: frango do Niko por R$ 37,90, reserva e
repetição idempotente. Veja [VALIDATION-LIVE-MARKET.md](docs/evidence/VALIDATION-LIVE-MARKET.md).
Backlog: https://trello.com/b/YNokvONE/ibyara-hackathon.

As evidências das releases 0.1–0.3 permanecem históricas. Esta seção e o documento de
fundação registram as alterações atuais, sem afirmar novo deploy ou homologação externa.

## Equipe e colaboração

Repositório de destino: [gustavocoderjs/IBIARA](https://github.com/gustavocoderjs/IBIARA). GitHub Flow, revisão por outra pessoa e CI em cada PR. Veja [CONTRIBUTING.md](CONTRIBUTING.md) e a [divisão para 3–4 pessoas](docs/TEAM.md). Convites e proteções de branch devem ser configurados pelo administrador; veja os passos em `docs/TEAM.md`.

## Mobile, desktop e voz

- **Desktop:** quadro de pedidos A preparar / Em preparo / Prontos, busca, histórico, detalhes e cancelamento confirmado. Pedidos ativos mais antigos aparecem primeiro.
- **Mobile:** navegação inferior, Ajustes rápidos como entrada da cozinha configurada, disponibilidade/excedente por insumo, contagem parcial com revisão e edição compacta de preço, desconto e capacidade.
- **Voz em ambos:** captura por turnos, transcrição revisável, envio explícito, resposta em texto e leitura pelo navegador. A integração Agora permanece mock; suporte de áudio depende do navegador. Não há escuta contínua nem full-duplex.
- A entrada do fluxo de compra é a conversa do cliente. O onboarding da cozinha continua disponível na visão Restaurante. Rascunhos locais de texto/voz acompanham a troca de modalidade durante a sessão; mensagens já enviadas pelo cliente ficam persistidas no D1.

## Executar

Node **24.19.0** foi usado na validação (o projeto exige Node >=22.13). Use a versão de pnpm fixada em `package.json`.

```sh
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
test -f .dev.vars || cp .env.example .dev.vars
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_freak.sql
pnpm dev
```

A migração local deve ser aplicada **uma única vez** por banco vazio. `pnpm dev` imprime a origem local utilizada. O preview gerenciado e a publicação usam o workflow Sites. O estado fica no D1, nunca em `localStorage`.

Nesta máquina Windows, o HMR do Vite ficou preso na inicialização do plugin Cloudflare.
A demo compilada funciona com dois terminais, após o build e a migração:

```sh
pnpm start --port 4173
# Em outro terminal:
pnpm preview:demo
```

Abra `http://127.0.0.1:5173`. `start` carrega o `.dev.vars` da raiz, se existir.
`preview:demo` usa identidade fictícia fixa e aceita somente conexões locais; serve
para desenvolvimento, sem HMR. Após alterar código, encerre `start`, refaça o build
e inicie novamente. A autenticação da aplicação publicada permanece inalterada.

```sh
pnpm check # lint + tipos + testes
# Em outro terminal, inicie o Worker compilado para os testes HTTP:
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 4173 --inspector-port 0
# Em um terceiro terminal, com NEURALAKE_MODE=mock no servidor:
IBYARA_TEST_ORIGIN=http://127.0.0.1:4173 pnpm test:api
```

`test:api` só aceita localhost. Ele cria identidades descartáveis no banco de desenvolvimento; não roda contra produção. O adaptador D1 é isolado e o protocolo transacional é testado com compare-and-swap.
No PowerShell, use `$env:IBYARA_TEST_ORIGIN='http://127.0.0.1:4173'` antes de `pnpm test:api`.
Use o Worker compilado para esse teste: o servidor de UI em 5173 remove headers de identidade
enviados pelo visitante e usa sua sessão local, portanto não serve para simular dois operadores.

Para repetir o teste real, mantenha as quatro credenciais e `NEURALAKE_MODE=live`
no servidor, execute `pnpm start --port 4173` e depois:

```sh
node scripts/verify-live-api.mjs --live
```

O opt-in `--live` faz quatro chamadas ao provedor, cria um pedido sandbox em um
operador descartável e verifica reserva, persistência, repetição e reset. Pode consumir
a quota da NeuraLake. Nunca utiliza pagamento real.

Para testar ambiguidades, mudanças de ideia e respostas indevidas do modelo:

```sh
# Sem rede: respostas controladas para testar as proteções do backend.
node --experimental-strip-types --experimental-transform-types scripts/verify-adversarial-guards.ts
# Worker local em modo live: conversas sintéticas, sem autorizar compras.
node scripts/verify-adversarial-conversation.mjs --live
```

Os diagnósticos salvam evidências em `outputs/` e retornam código 1 quando encontram
falhas. As chamadas reais usam operadores separados no banco local e consomem quota
do provedor. Veja os resultados e limitações na
[validação disruptiva](docs/evidence/VALIDATION-ADVERSARIAL.md); aprovação dos testes
unitários existentes não significa que o atendimento livre está validado.

## Primeira avaliação

1. Abra a conversa vazia do cliente e envie **Quais pratos posso pedir?** O primeiro turno válido prepara o mercado simulado; nenhum pedido é criado.
2. Informe a refeição, uma porção, limite com entrega, prazo, região Butantã e eventuais exclusões. Exemplo: **Quero uma porção de Bife a cavalo, até R$ 35 com entrega, em até 40 minutos no Butantã. Não excluo ingredientes e não tenho alergias.**
3. Responda às pendências, revise o rascunho no formulário e autorize uma compra sandbox. Só então o comprador consulta os restaurantes e o motor negocia/reserva. No cenário inicial, o bife do Niko fecha em R$ 30,90.
4. Recarregue a página para verificar persistência. **Novo pedido** reinicia conversa e descoberta sem apagar transações, repor estoque ou retirar uma preocupação alimentar não retratada.
5. Para demonstrar consumo, entre em **Restaurante → Pedidos** e inicie o preparo de um pedido do Niko. A reserva vira consumo uma única vez.
6. Para demonstrar reconciliação, use **Contagem e rotina**, informe `1 kg de frango cru, contagem exata, estoque principal, agora.`, revise e confirme. Os outros itens ficam preservados.

O onboarding conversacional e o carregamento manual da cozinha continuam disponíveis
na visão Restaurante para cenários sem cadastro. O parser desse onboarding é mock e
não comprova compreensão por LLM. Em `NEURALAKE_MODE=mock`, a conversa do cliente
identifica a contingência local e orienta o preenchimento manual; ela não finge extração real.

## O que executa de verdade

- Máquina de estados de conversa com parser local explícito, pendências, confirmação, múltiplas fichas e revisão por versão.
- Custeio por quantidades e rendimentos, preço/piso/taxas com `BigInt` racional e centavos inteiros.
- Políticas confirmadas e versionadas; excedente altera o preço de forma determinística.
- Importação de XML NF-e/NFC-e do subconjunto suportado; deduplicação; compra separada de recebimento; custo médio ponderado.
- Estoque, reservas, consumo, produção de lote sintético, contagem parcial, conflito com reservas e rotina por relógio de teste.
- Buyer e Merchant services com contextos separados, descoberta, ofertas calculadas, contraproposta limitada, ranking e pedido sandbox.
- Mandato de uma compra, expiração, revogação, orçamento total com entrega, idempotência e atualização atômica por revisão.
- Persistência D1, eventos observacionais SSE com retomada e projeções separadas por contexto.

## O que é mock ou depende de integração

| Área | Estado |
|---|---|
| NeuraLake comprador/restaurantes | Transporte HTTP configurável em `mock` ou `live`; o fluxo local dos quatro agentes tem evidência em `VALIDATION-LIVE-MARKET.md`; resultados e limites da conversa guiada em `VALIDATION-GUIDED-CUSTOMER.md` |
| Parser de onboarding | Mock local baseado em gramática; integração de receita com LLM permanece pendente |
| Agora | Adapter mock que falha explicitamente; ditado/leitura do navegador opcionais |
| Cross Memory | Desativada e não validada |
| QR fiscal | Não conectado; links são rejeitados, nunca buscados automaticamente |
| Restaurantes, preços de insumos, taxas, elegibilidade e validades iniciais | Fixtures fictícias |
| Proximidade e cobertura | Três pontos e posições/raios de restaurantes fictícios; distância aproximada em linha reta, sem GPS, rota ou cálculo de ETA |
| Pagamento/entrega | Nenhuma movimentação financeira ou entrega real |
| Autenticação | Private Sites + identidade encaminhada; operador pode alternar os dois personagens da própria demo |
| Multi-tenant comercial | Não homologado: cada operador possui um cenário completo privado |
| Scheduler | Avaliado nas mutações e pelo relógio de teste; sem tarefa contínua/notificação externa |
| Protocolo | `ibyara.exchange.v1`, interno; não declara conformidade com A2A público |

## Arquitetura e revisão

O comprador pode priorizar **menor preço**, **melhor avaliação**, **mais próximo** ou
**menor prazo**, pela conversa ou na revisão. Proximidade exige um ponto de entrega
simulado: Butantã Centro, USP ou Vila Indiana. O sistema filtra cobertura e limites antes
de ordenar; distância não significa tempo de entrega. Notas, contagens e localizações
são simuladas e identificadas na interface. Maior nota pode vencer com maior espera/preço,
sempre dentro dos limites autorizados. Evidências
da rodada anterior, com 69 testes, conversa real e compra por avaliação: [validação](docs/evidence/VALIDATION-CONVERSATION.md).
O atendimento guiado anterior está registrado na
[validação da conversa guiada](docs/evidence/VALIDATION-GUIDED-CUSTOMER.md).
A revisão de entrada, descoberta de restaurantes e preservação da escolha tem resultados
e limites em [validação da jornada](docs/evidence/VALIDATION-RESTAURANT-JOURNEY.md).
Continuamos com quatro agentes: o comprador coordena as consultas no backend; não há
uma quinta IA intermediária. Restaurante escolhido recebe a consulta sozinho; na
comparação, cada restaurante elegível recebe apenas seu próprio contexto.
Para verificar a interface sem mexer na conversa local habitual, use
`node scripts/preview-demo.mjs --isolated` (porta 5174, Worker na 4173).

- `lib/domain`: modelos, aritmética, preço, orquestração comercial, comandos e transações.
- `lib/domain/demo-market.ts`: preparação idempotente dos cardápios/estoques; `meal-intent.ts`: vocabulário conservador que rejeita termos fora do catálogo.
- `lib/domain/delivery.ts`: pontos, posições e raios fictícios, distância em linha reta e validação da cobertura; `conversation-entry.ts`: proteção da entrada de conversa na gestão do restaurante.
- `lib/agents`: conversa, descoberta de pratos/restaurantes e validação da origem dos campos do cliente; três contextos de restaurante, schemas, roteador e transporte NeuraLake. `currentDraft`, `discovery`, `question`, `pendingQuestion` e `fieldSources` são dados privados do comprador e não entram na RFQ dos restaurantes.
- `lib/adapters`: fronteiras NeuraLake, Agora e fiscal.
- `lib/server/repository.ts`: implementação D1; uma linha por operador com revisão otimista.
- `app/api/v1/[...path]/route.ts`: autenticação, limites, schemas, comandos e eventos.
- `components/workspace.tsx`: shell de navegação e sincronização; nenhuma autoridade financeira no cliente.
- `components/quick-adjustments.tsx`, `order-board.tsx`, `voice-conversation.tsx`: fluxos separados para colaboração.
- `lib/client`: contratos de projeção e formatação; `lib/adapters/browser-voice.ts`: captura por turnos.
- `.github/workflows/ci.yml`: lint, tipos, testes e build em PRs/push em main, sem deploy automático de produção.
- `db/schema.ts`, `drizzle/`: schema e migração versionada.
- `tests/domain.test.ts`, `tests/browser-voice.test.ts`, `tests/agents.test.ts`, `tests/demo-market.test.ts`: domínio, contratos, concorrência, isolamento dos agentes, mercado simulado e ciclo de captura de voz.
- `docs/API.md`, `docs/INTEGRATIONS.md`, `docs/RELEASE_NOTES.md`, `docs/evidence/VALIDATION.md`: contrato e evidências.

A escolha da stack, o isolamento da demo e os limites do agregado transacional estão descritos em `docs/decisions/001-runtime.md`. A 0.3.0 **não equivale ao MVP completo homologado do guia**, pois as integrações reais foram explicitamente deixadas como mocks e há limitações documentadas.

Evidências da experiência mobile/voz e limitações de execução: `docs/evidence/VALIDATION-0.2.0.md`.

## Frontend e Impeccable

As 12 fichas da demo usam dez imagens de pratos, incluindo nove novas ilustrações
geradas por IA. Assets responsivos e prompts: [registro de imagens](docs/IMAGE_ASSETS.md).
O roteiro de descoberta, recomendação e esclarecimentos da Byara está em
[atendimento guiado](docs/CUSTOMER-SERVICE-FLOWS.md), com dez cenários e 22 critérios
de aceite. A implementação agora mantém filtros, última lista e pergunta pendente,
faz esclarecimentos e exige origem textual para os campos do pedido. Consulte a
[evidência da rodada](docs/evidence/VALIDATION-GUIDED-CUSTOMER.md) para execução e limites;
o roteiro, por si só, não comprova homologação de atendimento livre.

A 0.3.0 traz fotografia gastronômica ilustrativa, paleta tomate/açafrão/cerâmica, fontes locais e hierarquia de compra. O formulário explicita autorização para uma compra e total com entrega; os cálculos continuam no domínio.

- `components/marketplace.tsx`: experiência do consumidor.
- `components/dish-photo.tsx`: imagens responsivas locais e estado sem fotografia para outros pratos.
- `app/appetite.css`: tokens e apresentação da revisão visual.
- `PRODUCT.md`, `DESIGN.md`: produto e sistema visual para a equipe.

Impeccable CLI **4.1.0** está fixada como devDependency. A skill oficial **4.3.1** está versionada em `.agents/skills/impeccable`, com licença e manifesto de origem/checksums em `docs/impeccable-source.json`. Copilot referencia a mesma instalação, sem duplicar arquivos.

```sh
pnpm design:context
pnpm design:audit
```

O comando solicitado `npx impeccable install` foi executado; o download de impeccable.style falhou por DNS no ambiente de desenvolvimento. A instalação foi completada com a CLI do npm e os arquivos oficiais obtidos via conexão GitHub, preservados byte a byte. Hooks automáticos não foram ativados; use a auditoria manual acima. Em outra máquina com rede liberada, `npx impeccable install --providers=codex,github --scope=project` permite gerenciar a instalação pelo assistente oficial.

Validação desta revisão e limitações: `docs/evidence/VALIDATION-0.3.0.md`. Origem das imagens: `docs/IMAGE_ASSETS.md`.
