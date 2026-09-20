# Validação do mercado simulado e dos agentes

Rodada iniciada em 19/09/2026 (America/Sao_Paulo). Branch
`feature/customer-agent-foundation`, base `f5d3b67`. Execução local em Windows,
Node 24.19.0, Vinext/Vite e Worker/D1. Sem push ou implantação nesta rodada.

## Escopo

- Entrada pelo texto do usuário ao agente comprador; revisão e autorização explícitas antes da compra.
- Três restaurantes com contextos e credenciais independentes; comunicação somente com o comprador.
- 12 fichas e 16 insumos, com estoques separados logicamente no D1 existente.
- Preços, disponibilidade, reserva, limites e pedido continuam no código determinístico.
- As chaves autorizadas ficam no `.dev.vars` ignorado pelo Git; não são incluídas neste relatório.

## Verificações automatizadas

- 51 testes aprovados, incluindo todos os testes anteriores de domínio e novos testes de cardápio, persistência, isolamento e reset.
- TypeScript e ESLint aprovados.
- Build de produção aprovada.
- O adaptador HTTP rejeita redirecionamentos sem encaminhar a credencial. O runtime local exige `redirect: manual`; a opção `error` provocava TypeError antes da chamada ao provedor.
- A primeira chamada real isolada do comprador via Node retornou um patch válido, modelo informado `text`, 519 tokens. Isso comprova apenas aquela chamada.

## Validação integrada

`node scripts/verify-live-api.mjs --live` passou no Worker/D1 local, com quatro chamadas reais:

| Agente | Resultado | Modelo informado | Tokens informados |
|---|---|---|---|
| Comprador | Rascunho completo a partir do input | text | 1859 |
| Niko | Publicou sua oferta válida | text | 859 |
| Sabor de Casa | Recusou: prato solicitado ausente | text | 633 |
| Cozinha Expressa | Recusou: prato solicitado ausente | text | 636 |

Pedido: **Frango grelhado com arroz e feijão**, Niko, **R$ 37,90** com entrega,
`SANDBOX`. Nenhum pedido existia antes da revisão/autorização explícita do teste.
A reserva persistida foi de **180 g de frango** no Niko. Repetir a requisição com
a mesma chave devolveu o resultado anterior; reiniciar a conversa apagou somente
o rascunho, preservando o pedido. O teste cria um operador descartável local.

Antes da correção, um restaurante com lista de ofertas vazia retornou um ID inventado
e mais de uma decisão. O backend rejeitou a saída e não criou pedido. O prompt passou
a exigir execução da decisão atual: lista vazia gera recusa literal, lista preenchida
exige copiar um `offerId` recebido. O parser estrito e o vínculo da oferta foram mantidos.
O diagnóstico isolado dos três restaurantes também passou após esse ajuste.

O teste de conversa parcial após o cardápio encontrou um campo `ingredients` fora
do contrato do comprador. A requisição foi rejeitada, com texto preservado e sem
compra. O prompt passou a usar exemplo JSON válido, listar exclusivamente as sete
chaves permitidas e extrair somente os campos informados. O smoke real desse caso
retornou apenas `description: Bife a cavalo` e `portions: 1`; faltas continuam gerando
perguntas pelo backend, sem presumir orçamento, prazo ou restrições.

A projeção do comprador preserva o vínculo entre sua RFQ e seu mandato para
retomar uma autorização depois de recarregar. As mensagens enviadas aos restaurantes
continuam sem mandato ou orçamento privado; o teste de projeção cobre essa diferença.

### Navegador

Conferido no navegador integrado em `http://127.0.0.1:5173`:

1. A visão Consumidor abriu com conversa vazia e envio desabilitado sem mensagem.
2. “Quais pratos posso pedir?” retornou os 12 pratos e os preços calculados.
3. “Quero uma porção de Bife a cavalo.” gerou perguntas de orçamento e prazo,
   sem preencher valores ausentes e sem liberar revisão prematura.
4. Uma segunda mensagem informou R$ 35,00, 40 minutos, Butantã e ausência de
   exclusões/alergias. O formulário de revisão refletiu esses dados.
5. Após o clique explícito em autorizar, os três restaurantes publicaram ofertas
   via NeuraLake. A negociação confirmou bife do Niko por **R$ 30,90** em sandbox.
6. Recarregar preservou conversa e pedido. “Começar novo pedido” abriu conversa
   vazia e manteve o pedido anterior visível. O console final não apresentou erros.

O Vite dev/HMR não concluiu o hook de inicialização do plugin Cloudflare nesta
máquina Windows. Remover o scan de dependências em diagnóstico não resolveu;
nenhuma configuração Vite ou dependência foi alterada. A versão compilada foi
validada usando `pnpm start --port 4173` e `pnpm preview:demo`. O preview é um
proxy restrito a loopback com identidade fictícia local; Host/Origin externos
retornaram 403. Ele não modifica a autenticação da aplicação publicada.

## Limites da demonstração

O Trello foi relido e atualizado: seis cards receberam evidências e cinco passaram
para Em validação (fundação, restaurantes, cliente, estoque e pedido). Os 16 cards
foram preservados; não houve arquivamento nem conclusão automática do ensaio.

Uma porção por autorização, região de teste Butantã e vocabulário conservador do cardápio.
Pedidos e estoque são fictícios; não houve pagamento ou entrega real. Custos de inferência
ficam `null` quando o provedor não informa o valor. Os estoques não são repostos ao abrir
uma conversa. Voz em equipamento físico e implantação pública não foram homologadas.

`VALIDATION-AGENTS.md` registra a rodada anterior com 40 testes e inferência simulada;
não deve ser lido como o resultado desta validação.
