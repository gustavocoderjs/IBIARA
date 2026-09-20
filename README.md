# i.byara · release 0.4.0

Marketplace alimentício bilateral com agentes de restaurante e consumidor. Monólito modular executável para análise do produto e da implementação, **somente em sandbox**. O documento original está em `docs/IBYARA_GUIDE.md`.

## Equipe e colaboração

Repositório: [gustavocoderjs/IBIARA](https://github.com/gustavocoderjs/IBIARA), com código enviado e execução remota do fluxo existente verificada. Veja [CONTRIBUTING.md](CONTRIBUTING.md) e a [divisão para 3–4 pessoas](docs/TEAM.md). Convites e proteções de branch dependem do administrador.

Para o hackathon, seguir o [plano de infraestrutura gratuita](docs/HACKATHON_FREE.md): aproveitar a hospedagem e o D1 atuais; Supabase Free é a opção de próximo estágio para banco e login externos, ainda sem integração. Não é necessário ampliar o pipeline para a demonstração.

## Mobile, desktop e voz

- **Desktop:** quadro de pedidos A preparar / Em preparo / Prontos, busca, histórico, detalhes e cancelamento confirmado. Pedidos ativos mais antigos aparecem primeiro.
- **Mobile:** navegação inferior, Ajustes rápidos como entrada da cozinha configurada, disponibilidade/excedente por insumo, contagem parcial com revisão e edição compacta de preço, desconto e capacidade.
- **Voz em ambos:** captura por turnos, transcrição revisável, envio explícito, resposta em texto e leitura pelo navegador. A integração Agora permanece mock; suporte de áudio depende do navegador. Não há escuta contínua nem full-duplex.
- Sem cozinha configurada, a entrada continua sendo a conversa de onboarding. Rascunhos de mensagem acompanham a troca texto/voz durante a sessão; não sobrevivem a recarga/fechamento da aba.

## Executar

Node **24.19.0** foi usado na validação (o projeto exige Node >=22.13). Use a versão de pnpm fixada em `package.json`.

```sh
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_pink_freak.sql
pnpm dev
```

A migração local deve ser aplicada **uma única vez** por banco vazio. `pnpm dev` imprime a origem local utilizada. O preview gerenciado e a publicação usam o workflow Sites. O estado fica no D1, nunca em `localStorage`.

```sh
pnpm check # lint + tipos + testes
# Com o servidor local ativo, configure a origem informada por ele:
IBYARA_TEST_ORIGIN=http://127.0.0.1:5173 pnpm test:api
```

`test:api` só aceita localhost. Ele cria identidades descartáveis no banco de desenvolvimento; não roda contra produção. O adaptador D1 é isolado e o protocolo transacional é testado com compare-and-swap.

## Primeira avaliação

1. Na conversa, use **Preencher uma fala de exemplo**, revise e envie. Repita para o prato, peso/base, rendimentos e preparo/embalagem. Confirme a ficha.
2. Em **Estoque e compras → Compras**, importe a nota de exemplo e confirme recebimento e elegibilidade.
3. Em **Limites do agente**, revise e confirme os parâmetros fictícios.
4. Em **Estoque**, declare excedente do patinho. O preço do prato passa de R$ 34,90 para R$ 27,92, respeitando o piso de R$ 26,18.
5. Alterne para **Consumidor** e autorize a intenção padrão, com R$ 35,00 já incluindo entrega. O agente consulta três restaurantes, negocia e seleciona automaticamente. No cenário padrão o pedido fecha em R$ 30,90.
6. Volte a **Restaurante → Pedidos** e inicie o preparo. A reserva vira consumo uma única vez.
7. Em **Contagem e rotina**, informe `1 kg de frango cru, contagem exata, estoque principal, agora.` Revise e confirme. Os outros itens ficam preservados.

Para entrar diretamente no cenário completo, **Ou carregar a cozinha pronta** carrega fixtures identificadas, sem apagar dados existentes. O cadastro conversacional é a abertura padrão; esse atalho não comprova compreensão por LLM.

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
| NeuraLake | Mock local baseado em gramática; conectado |
| Agora | Não conectado |
| Cross Memory | Desativada |
| QR fiscal | Não conectado |
| Restaurantes, preços de insumos, taxas, elegibilidade e validades iniciais | Fixtures fictícias |
| Pagamento/entrega | Nenhuma movimentação financeira ou entrega real |
| Autenticação | Private Sites + identidade encaminhada; operador pode alternar os dois personagens da própria demo |
| Multi-tenant comercial | Não homologado: cada operador possui um cenário completo privado |
| Scheduler | Avaliado nas mutações e pelo relógio de teste; sem tarefa contínua/notificação externa |
| Protocolo | `ibyara.exchange.v1`, interno; não declara conformidade com A2A público |

## Arquitetura e revisão

- `lib/domain`: modelos, aritmética, preço, orquestração comercial, comandos e transações.
- `lib/adapters`: fronteiras NeuraLake, Agora e fiscal.
- `lib/server/repository.ts`: implementação D1; uma linha por operador com revisão otimista.
- `app/api/v1/[...path]/route.ts`: autenticação, limites, schemas, comandos e eventos.
- `components/workspace.tsx`: shell de navegação e sincronização; nenhuma autoridade financeira no cliente.
- `components/quick-adjustments.tsx`, `order-board.tsx`, `voice-conversation.tsx`: fluxos separados para colaboração.
- `lib/client`: contratos de projeção e formatação; `lib/adapters/browser-voice.ts`: captura por turnos.
- `.github/workflows/ci.yml`: lint, tipos, testes e build em PRs/push em main, sem deploy automático de produção.
- `db/schema.ts`, `drizzle/`: schema e migração versionada.
- `tests/domain.test.ts`, `tests/browser-voice.test.ts`: domínio, contratos, concorrência e ciclo de captura de voz.
- `docs/API.md`, `docs/INTEGRATIONS.md`, `docs/RELEASE_NOTES.md`, `docs/evidence/VALIDATION.md`: contrato e evidências.

A escolha da stack, o isolamento da demo e os limites do agregado transacional estão descritos em `docs/decisions/001-runtime.md`. A 0.3.0 **não equivale ao MVP completo homologado do guia**, pois as integrações reais foram explicitamente deixadas como mocks e há limitações documentadas.

Evidências da experiência mobile/voz e limitações de execução: `docs/evidence/VALIDATION-0.2.0.md`.

## Frontend e Impeccable

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

## Interface 0.4.0

Revisão visual inspirada na referência Apple indicada pelo usuário: superfícies claras, grafite, tipografia sans e tomate nas ações. O prato usa planos fotográficos em perspectiva CSS 3D, reagindo ao cursor e à rolagem; a navegação tem transições curtas. Não há modelo 3D/WebGL nem novas dependências. No toque e com redução de movimento, a apresentação é estática.

Funções, autorizações e integrações da demonstração permanecem. Veja `docs/design/MOTION.md`, `DESIGN.md` e `docs/evidence/VALIDATION-0.4.0.md`.
