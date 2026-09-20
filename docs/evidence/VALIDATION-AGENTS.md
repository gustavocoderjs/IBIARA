# Validação da fundação dos agentes

Executada em 19/09/2026 (America/Sao_Paulo), sobre a branch local
`feature/customer-agent-foundation`, base `f5d3b670855c40ecb92ef5953e707a93801d3795`.
Alterações ainda não commitadas/publicadas. Esta evidência não se refere ao deploy antigo.

## Ambiente e verificações

- Windows, Node 24.19.0, pnpm 11.25.0; versões do repositório.
- `pnpm install --frozen-lockfile`: PASS, sem mudança do lockfile. Primeira tentativa teve
  timeout; repetição com concorrência de rede reduzida concluiu.
- `pnpm lint`: PASS.
- `pnpm typecheck`: PASS. Corrigidos os dois erros encontrados na primeira execução.
- `pnpm test`: PASS, 40 testes (29 existentes e 11 novos), sem falhas/skips.
- `pnpm build`: PASS, incluindo revalidação final após nomes/textos atualizados.
- Migração original em D1 **local vazio**: PASS; nenhuma migração nova ou remota aplicada.
- `IBYARA_TEST_ORIGIN=http://127.0.0.1:4173 pnpm test:api`: PASS no Worker compilado local,
  `NEURALAKE_MODE=mock`, identidades descartáveis.
- `git diff --check`: PASS.

Os comandos pnpm foram executados pelos binários Node equivalentes porque o Node não
estava no PATH global. O runtime ficou em `.task-tools` fora do worktree do projeto.
A tentativa de API anterior ao servidor abrir a porta retornou ECONNREFUSED; não foi
contada como sucesso. O teste HTTP usa o Worker em 4173, pois o servidor de UI em 5173
remove headers de identidade de visitantes e utiliza sessão local.

## Cobertura nova relevante

- Extração produz rascunho sem mandato/pedido; patch com campos financeiros extras é rejeitado.
- Contexto do comprador não contém custos privados; operadores não compartilham conversa.
- Replay não faz nova inferência; mudança de corpo conflita; versões concorrentes não sobrescrevem.
- Quatro configurações selecionam credenciais por identidade; restaurante não herda chave do comprador.
- Timeout, erro e saída inválida preservam estado; resposta do provedor não expõe chave nem corpo de erro.
- Todas as rotas restaurante→restaurante são rejeitadas; remetente forjado e oferta alheia também.
- Cada restaurante recebe somente RFQ pública e suas propostas calculadas.
- Roteamento novo preserva o total canônico de 3090 centavos; falha live controlada não vira mock.
- Restrições não suportadas impedem revisão pronta; declaração negativa simples de alergia não gera falso positivo.

## API e persistência

Conversa gravada e recuperada; mesma chave reproduz a resposta; outro operador começa vazio;
rota forjada no corpo é rejeitada. RFQ tem três ofertas; negociações simultâneas com a mesma
chave retornam o mesmo pedido. Total R$ 30,90; reserva de patinho 200 g; início de preparo
consome uma vez e deixa saldo 5800 g e reserva zero. Projeção do comprador/SSE não contém
piso, stockSnapshot ou dados internos. Uso real de provedor não foi alegado pelo mock.

## Navegador local

Verificado pela automação do navegador Codex em `http://localhost:5173/`:

1. Página carregou e cozinha fictícia foi criada pelo botão existente.
2. Visão Consumidor exibiu a nova conversa e a indicação de IA desconectada.
3. Mensagem fictícia foi enviada; retorno do mock orientou usar o formulário.
4. Reload seguido de reabertura da visão preservou mensagem e resposta.
5. Autorização pelo formulário chamou a nova coordenação dos restaurantes.
6. Eventos mostraram respostas separadas de niko, casa e panela ao comprador.
7. Pedido confirmado em sandbox: Niko, R$ 27,00 + R$ 3,90 = R$ 30,90; ingredientes reservados.

O primeiro carregamento levou mais que o timeout do navegador enquanto o Vite preparava
dependências. A aba foi recuperada e a jornada acima terminou. Não houve falha funcional
nesse fluxo. O build em execução não deve ser regenerado com o Worker mantendo `dist`
aberto no Windows; o processo de teste foi encerrado antes da repetição do build.

## Não verificado nesta rodada

- Chamadas reais, comportamento/modelos/quotas, retenção e isolamento interno da NeuraLake.
- Extração conversacional real e botão de revisão com resposta de LLM no navegador:
  service/contrato testados com fake; navegador ensaiado no mock explícito.
- Voz física, rede e equipamento do pitch, Agora, pagamento ou entrega reais.
- Novo deploy, push, PR, proteção comercial de múltiplos tenants ou estoque compartilhado.

As chaves expostas nos anexos não foram utilizadas nem copiadas. Substituir as quatro,
configurar somente no servidor e executar smoke real antes da apresentação. Cross Memory
não é utilizada pela aplicação; configuração e retenção do fornecedor requerem confirmação.

## Trello

Preservados 13 cards existentes, adicionados 3; total 16: 11 P0, 2 P1, 2 P2 e LINKS.
Listas: P0 (8), P1 (2), Em andamento (4), Em validação (0), Concluído (0), P2 (2).
Nenhum card/critério foi declarado concluído por teste mock. Os três cards da integração
ficam em andamento até smoke real e revisão da equipe. Snapshot anterior preservado em
`trello-before-foundation.json`.
