# Evidências da release 0.1.0

Executado em 19/09/2026. Dados exclusivamente sintéticos. Os comandos abaixo foram efetivamente executados; limitações estão separadas.

## Testes automatizados

`node --experimental-strip-types --experimental-transform-types --test tests/domain.test.ts`

**23 testes passaram; 0 falharam.** Incluem cadastro/ambiguidade/rendimento, revisão de ficha, nota duplicada/recebimento, caso financeiro do guia, orçamento com frete, escolha de concorrente, contagem parcial/conflito, scheduler, produção sem dupla baixa, validade, revogação, prompt injection, projeções privadas, campos extras, bloqueio sanitário, consumo idempotente, grade de propriedades de preço, concorrência pela última porção, orçamento compartilhado por RFQs e XML limitado. Ingredientes desconhecidos e exclusões não verificadas também bloqueiam.

Os testes concorrentes exercitam o protocolo compare-and-swap com um repositório em memória que rejeita revisão obsoleta. Não representam teste de carga ou concorrência do D1 remoto.

`node node_modules/typescript/bin/tsc --noEmit`: passou, sem erros.

Build pelo workflow Sites: passou e gerou Worker ESM com a aplicação e a rota de API. Migração SQL gerada, inspecionada e aplicada com sucesso ao D1 local do preview.

## Jornada executada no navegador

- Página inicial e layout de desktop inspecionados visualmente.
- Fala inicial do guia cadastrou nome/endereço e perguntou pelo prato.
- Descrição com dois bifes manteve peso pendente e gerou pergunta.
- Peso/base, rendimentos e preparo/embalagem/custo variável completaram a ficha.
- Ficha confirmada pela UI e preservada após recarregamento do preview.
- Nota de exemplo importada; compra exibida aguardando recebimento.
- Recebimento confirmado; estoque mostrou 6 kg de patinho e 2 kg de frango.
- Política fictícia confirmada e excedente do patinho declarado.
- Na visão Consumidor, autorização de R$ 35,00 consultou três restaurantes e concluiu negociação automaticamente.
- Oferta inicial do Niko: R$ 31,82 incluindo entrega. Contraproposta: R$ 27,00 + R$ 3,90. Pedido confirmado em sandbox: **R$ 30,90**.
- Eventos observados: RFQ, três propostas, contraproposta aceita e pedido confirmado.
- Na visão Restaurante, pedido apareceu com ingredientes reservados, sem consumo. **Iniciar preparo** mudou para “Em preparo” e registrou consumo.

Uma falha de UUID no contexto HTTP do preview foi encontrada na primeira tentativa. Corrigida usando `crypto.getRandomValues` para chaves do cliente; a jornada acima ocorreu após a correção.

## Não executado / não homologado

- Integrações NeuraLake, Agora, Cross Memory e SEFAZ ao vivo: mocks/pedidos de integração, não testadas.
- Áudio por microfone/síntese em dispositivo real: não homologado. Contingência por texto implementada.
- WebMCP: o navegador de teste informou `modelContext is unavailable`; registro é protegido por detecção de capacidade. Não declarar validação de ferramentas executadas.
- `scripts/verify-api.mjs`: tentado, mas o processo de terminal não alcançou o servidor de preview, isolado em outra rede. A jornada HTTP real foi exercitada pelo navegador; não declarar o script HTTP independente como aprovado.
- Viewport móvel, leitores de tela, 200% de zoom e auditoria WCAG completa: não executados. CSS responsivo e componentes acessíveis implementados, sem claim de conformidade.
- Carga, longa duração, recuperação de desastre, retenção, lotes FEFO, multiusuário comercial e pagamentos/logística: não homologados.

## Números verificados

| Medida | Resultado |
|---|---:|
| Custo variável | 1480 centavos |
| Encargo fixo | 20 centavos |
| K | 1500 centavos |
| Piso analítico | 2308 centavos |
| Piso efetivo | 2618 centavos |
| Proposta de excedente | 2792 centavos |
| Subtotal negociado | 2700 centavos |
| Contribuição negociada | 930 centavos |
| Total com entrega | 3090 centavos |

Custo/tokens de inferência não disponíveis. Nenhuma taxa, economia ou métrica operacional deste cenário representa resultado comercial medido.
