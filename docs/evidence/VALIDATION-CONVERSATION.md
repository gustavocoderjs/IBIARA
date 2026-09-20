# Correção da conversa após o teste do usuário

Base: `707346e`. A compra canônica anterior passou, mas não cobriu adequadamente
mensagens com mais de uma intenção e perguntas de cardápio durante o preenchimento.

## Causas verificadas

- Consultas sobre pratos disponíveis foram tratadas como inspeção de ofertas de
  uma compra antiga, retornando uma instrução impossível de cumprir naquele momento.
- A ferramenta de consulta não podia aplicar um patch. Uma negativa à pergunta de
  restrições seguida de pedido de cardápio deixou as restrições sem resposta.
- Três requisições posteriores retornaram HTTP 502. Seus textos não foram persistidos;
  não se afirma conhecer o conteúdo nem a violação exata desses três resultados.
- Repetições sintéticas revelaram respostas JSON inválidas e reextração de campos
  antigos: a correção de região abreviava o prato; a consulta podia substituir a região.
  Esses resultados falhos foram usados para corrigir o fluxo, não contabilizados como sucesso.

## Correções

- Consultas aceitam o mesmo patch validado do rascunho e o aplicam antes de responder.
- Uma negativa curta à pergunta exata de restrições é reconhecida no contexto;
  ressalvas sobre alergias ou contaminação continuam prevalecendo.
- Sem RFQ vigente e mandato válido, a consulta retorna o cardápio calculado, sem
  recuperar ofertas antigas ou pedir autorização antes de o rascunho estar pronto.
- O próximo passo pergunta apenas dados faltantes. O formulário de contingência
  preserva os campos já extraídos e não usa perguntas como descrição de refeição.
- Há uma tentativa limitada de corrigir saída JSON inválida. O schema continua
  estrito, a quota é respeitada e os logs registram somente categorias do erro.
- Falha inicial de carregamento oferece nova tentativa; falhas mantêm texto e rascunho.
- Extração recebe mensagem atual, última pergunta e cardápio; o rascunho autoritativo
  fica no backend. Uma pergunta por turno evita negativas ambíguas. Consultas puras
  não reescrevem preferências, correções não renomeiam pratos e null exige retirada
  explícita. Escolha de outro prato sem referência confiável volta a pedir o nome.
- Quantificador singular explícito pode preencher uma porção; pedidos com múltiplas
  refeições não são reduzidos silenciosamente a uma.
- Notas simuladas: Niko 4,6/128, Casa 4,9/86, Expressa 4,3/214. O critério de melhor
  avaliação usa ranking determinístico, respeitando orçamento, prazo e disponibilidade.
  O critério pode ser informado na conversa ou no seletor da revisão.

## Verificação

69 testes automatizados passaram, incluindo o diálogo com negativa e consulta,
RFQ encerrada/revogada, preservação do pedido, ressalvas alimentares, rejeição de
campos financeiros, reparo limitado, contagem de tokens/chamadas comprometidas,
ranking por avaliação, empates, ausência de reviews, orçamento/prazo e estoque/capacidade.

## Execução real em 20/09/2026

- Build Vinext/Worker concluída; TypeScript e ESLint passaram.
- Script `verify-customer-conversation.ts --live`: oito turnos, oito chamadas reais,
  modelo `text`, 20.321 tokens, nenhum reparo. Sequência original até consulta de
  cardápio, seguida de BEST_RATED e LOWEST_PRICE. Final pronto: Bife a cavalo,
  uma porção, R$40, 50 minutos, Butantã, sem exclusões ou preocupação declarada.
  Nenhum mandato, busca, reserva ou pedido nesse teste em memória.
- API/D1 com mock isolado: 13 verificações passaram, incluindo concorrência,
  idempotência, isolamento por operador, SSE, rejeição de campos indevidos e baixa única.
- API/D1 com quatro agentes reais: pedido de frango por R$37,90, 180g reservados,
  repetição idempotente e reset preservando o pedido. Tokens: comprador 2.423,
  Niko 868, Casa 634, Expressa 637. Sem fallback para mock.
- Navegador em identidade separada (`preview-demo.mjs --isolated`, porta 5174):
  repetida a sequência de seis mensagens do usuário; cardápio e botão de revisão
  disponíveis, campos preservados. Sétima mensagem mudou a prioridade para avaliação.
  Seletor manual alternou entre os dois critérios. Autorização gerou, via três
  agentes reais, **Bife a cavalo no Sabor de Casa por R$39,90 / 30min / nota4,9**,
  vencendo Niko R$30,90 / 25min / nota4,6 dentro do limite R$40 / 50min.
  Recarga preservou pedido e critério. Console do navegador sem erros.

Os testes usam cenários isolados; o pedido e a conversa habituais do usuário não
foram confirmados nem apagados. Notas, preços, estoque e compras são de demonstração.
Não houve pagamento, entrega real ou publicação remota. O limite de inferência é
de chamadas persistidas; falhas completas/CAS descartado não medem faturamento total.
Estas evidências cobrem os caminhos executados e não garantem toda frase possível
nem disponibilidade futura da API. O formulário continua como contingência.
