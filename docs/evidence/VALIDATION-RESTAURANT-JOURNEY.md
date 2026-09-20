# Jornada do consumidor e escolha de restaurante — 20/09/2026

## Problema e mudança

A conversa relatada estava na gestão de receitas do restaurante. A intenção de pedir uma refeição estava sendo interpretada como cadastro de prato e ingredientes. Agora a área identifica essa entrada, bloqueia a alteração da ficha e oferece **Continuar como consumidor**, preservando a mensagem. Havendo um rascunho anterior do consumidor, a interface exige a decisão explícita de começar outro pedido; reset e envio são ações separadas.

A Byara compradora mantém uma pergunta estruturada, listas distintas de pratos e restaurantes e a origem dos campos alterados. “Como assim?” explica o assunto pendente sem preencher valores. “Parrudo” pede uma preferência de refeição, sem perguntas de ficha técnica ou promessa de tamanho extra. O restaurante escolhido acompanha revisão, mandato, RFQ, negociação e aceite. Negar uma troca conserva essa escolha; consultar quem oferece um prato considera o prato já selecionado.

Proximidade usa três pontos e posições fictícias, com distância aproximada em linha reta e cobertura determinística. Os critérios são preço, avaliação, distância e prazo; todos respeitam os limites autorizados. Continuam **quatro agentes**, com coordenação no backend e isolamento dos restaurantes. Os campos opcionais ficam no agregado JSON existente, sem alteração da estrutura SQL ou reescrita de migração aplicada.

## Validação automatizada

- Suíte completa: **261 testes aprovados**, sem falhas ou testes ignorados, incluindo a regressão final de negação da troca de prato.
- TypeScript, ESLint e build aprovados.
- Regressões de entrada errada, esclarecimento, listas e ordinais, origem dos campos, negações, troca de restaurante, cobertura, ranking e manutenção da escolha no pedido.
- Mantidas as verificações de autoridade, orçamento, prazo, estoque, isolamento, concorrência, validade e idempotência.

Comandos usados com o Node disponível na máquina:

```text
node --experimental-strip-types --experimental-transform-types --test --test-isolation=none --test-reporter=spec tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next
node scripts/run-framework.mjs build
```

## Integração real com NeuraLake

Todos os testes usam operadores sintéticos independentes no Worker local. As credenciais permanecem no backend e os relatórios locais não entram no Git.

| Execução | Resultado |
|---|---|
| `verify-adversarial-conversation.mjs --live` | 14 cenários, 39 mensagens, 902 verificações aprovadas; 39 chamadas persistidas. |
| `verify-guided-journey.mjs --live` — três cenários originais | 3 cenários, 15 mensagens, 317 verificações aprovadas; 15 chamadas persistidas. |
| `verify-guided-journey.mjs --live --scenario=denied-dish-changes-preserve-selection` | Cenário adicional após a correção final: seis mensagens, 132 verificações aprovadas e seis chamadas persistidas. |
| `verify-selected-restaurant-api.mjs --live` | 38 verificações aprovadas; comprador e somente o agente Casa chamados. Bife a cavalo de R$ 39,90, exclusivamente sandbox. |
| `verify-live-api.mjs --live` | Comprador e três restaurantes reais; Frango grelhado com arroz e feijão de R$ 37,90, exclusivamente sandbox; quatro chamadas. |

Na compra exclusiva, as ofertas e o pedido pertencem à Casa, sua reserva foi registrada e os estoques de Niko e Cozinha Expressa não mudaram. Repetir a conversa ou a compra com a mesma chave não duplica pedido, estoque reservado ou chamadas. No fluxo de quatro agentes, foram confirmados persistência D1, reserva de 180 g de frango e reset somente do rascunho.

As conversas de descoberta, sem autorização comercial, não criaram mandato, oferta, RFQ ou pedido.

O executor da jornada agora contém quatro cenários e 21 mensagens. A validação acima foi feita em duas execuções: os três cenários originais e, após a última correção, o cenário direcionado de negação do prato. O filtro `--scenario` mantém evidências próprias em `outputs/guided-journey-runs/`. No último caso, as três negações mantiveram Bife; a troca afirmativa escolheu Macarrão sem criar exclusões; excluir tomate preservou esse prato e bloqueou a revisão.

## Matriz adicional: 100 cenários para dez pratos

O pedido de ampliação foi executado como **100 cenários no total: dez situações para cada um dos dez pratos distintos**, com 220 mensagens previstas. A matriz inclui pedidos completos e incompletos, correções de orçamento/prazo, negações e alternativas de restaurante, troca de prato, exclusão de ingredientes, alergia, quantidade não suportada e seleção por proximidade/avaliação/posição da lista.

Os pratos cobertos são Bife a cavalo; Frango grelhado com arroz e feijão; Omelete de legumes com arroz; Macarrão com carne e tomate; Frango com legumes e arroz; Lentilha com arroz e salada; Macarrão com tomate e queijo; Frango com brócolis e arroz; Omelete com tomate e arroz; Macarrão com frango e brócolis. O catálogo possui doze fichas, pois Bife a cavalo aparece nas três cozinhas.

| Etapa com NeuraLake real | Resultado |
|---|---|
| Primeira execução dos 100, concorrência 2 | 84 aprovados e 16 falharam; 212 mensagens executadas, oito interrompidas; 6.504 verificações aprovadas e 32 falharam. |
| Repetição dos 16 após correções, sequencial | 14 aprovados e dois falharam; 34 mensagens, duas interrompidas; 1.059 verificações aprovadas e três falharam. |
| Repetição dos dois restantes após novos ajustes | Dois aprovados; cinco mensagens e 156 verificações aprovadas. |

**Os 100 cenários possuem execução aprovada somando a primeira rodada e as repetições direcionadas: 220 mensagens e 6.900 verificações aprovadas. Isso não representa uma rodada única de 100 sem falhas.** O manifesto local `outputs/dish-scenarios/cumulative-100-2026-09-20.json` aponta a evidência de cada cenário, sem descartar os relatórios originais. Todas as tentativas somadas tiveram 251 mensagens, 7.719 verificações aprovadas e 35 falhas históricas. A mesma matriz também roda como cem testes locais determinísticos, incluídos na suíte acima; esses testes não fazem chamadas ao provedor.

Na primeira execução, nove cenários detectaram perda do prato ao excluir ingrediente; dois tiveram resposta inválida do provedor, quatro tiveram indisponibilidade e um timeout. A repetição expôs `ovo`/`Ovo` duplicados e outra resposta inválida, com erro de tipo no campo `patch.maxMinutes`. Não foi registrado o corpo bruto dessa resposta. Indisponibilidade e timeout continuam possíveis; os testes comprovaram preservação do estado nos casos executados, não uma correção da disponibilidade da NeuraLake.

O executor `scripts/verify-dish-scenarios.mjs` usa uma identidade sintética por cenário, verifica estado persistido, contratos, privacidade e repetição de chave, sem enviar comandos de compra. Relatórios completos ficam em diretórios imutáveis de `outputs/dish-scenarios/`; execuções direcionadas não substituem o histórico da rodada completa. Não há retry HTTP automático. O backend permite apenas uma tentativa adicional de reparo de formato.

```text
node scripts/verify-dish-scenarios.mjs --live --concurrency=2
node scripts/verify-dish-scenarios.mjs --live --scenario=bife_a_cavalo__conflicting_ingredient_exclusion
node scripts/verify-dish-scenarios.mjs --live --scenario=frango_brocolis__allergy_and_preservation
```

## Falhas encontradas durante a rodada

1. “Como assim?” recebeu duas saídas com chaves não reconhecidas pelo contrato. O esclarecimento passou a admitir também o envelope `patch: {}`, estritamente vazio; campos de negócio continuam proibidos. A repetição real passou. O corpo bruto não foi registrado, portanto não se atribui uma chave específica à falha inicial.
2. Uma sugestão “rápida” recebeu duas saídas com tipo inválido. O reparo antes repetia instruções sem receber sua resposta anterior e os erros específicos. Agora recebe esses dados para corrigir o formato, com o mesmo limite de duas tentativas e o mesmo schema estrito. A regressão de 39 mensagens passou após o ajuste.
3. A revisão encontrou negação de troca removendo o restaurante e recomendações que ignoravam o prato escolhido. Foram adicionados casos de regressão e corrigidos os filtros.
4. A checagem no navegador mostrou que negar a troca ainda podia abrir outra lista de restaurantes, apesar de preservar o pedido. A resposta foi ajustada para manter a escolha e seguir o pedido, sem repetir a pergunta de restaurante.
5. “Agora quero excluir…” acionava a regra de mudança de refeição. A exclusão agora preserva o prato, explica a incompatibilidade e bloqueia a revisão. Nomes equivalentes de ingredientes são normalizados antes de remover duplicidades.
6. Quantidades inválidas podiam ser rejeitadas no contrato de extração antes de o backend explicar o problema. A proposta admite o número extraído; a validação determinística usa a mensagem original e limpa quantidades negativas, fracionadas, zero ou fora do contrato. O rascunho persistido continua estrito. Minutos numéricos em string são normalizados na proposta, ainda sujeitos aos limites e à evidência textual; o modelo não pode criar um prazo ausente.
7. A revisão final encontrou “Não troque/mude/remova meu prato” apagando a escolha. Essas negações passam a preservar o pedido; uma troca afirmativa em outra oração continua válida. A negação de remoção também não cria exclusões de ingredientes mencionados em uma escolha posterior. Há regressões para manter tanto a recusa da edição quanto a troca e exclusão realmente solicitadas.

As primeiras falhas preservaram o rascunho e ficaram registradas em relatórios locais separados. Uma tentativa intermediária da jornada guiada também teve timeout no primeiro cenário, antes da execução aprovada de quinze mensagens; o relatório foi preservado. As chamadas de tentativas inteiramente rejeitadas não entram no contador de chamadas persistidas; esse contador não é um teto de cobrança do provedor.

## Navegador

Na prévia isolada, foi criada uma conversa sintética anterior e depois reproduzida a mensagem “quero um unico prato, algo mais parrudo, qestou com muita fome” na gestão de receitas. A interface bloqueou o cadastro, manteve o texto e ofereceu a passagem ao consumidor. A conversa anterior só foi substituída após clicar em **Começar novo pedido com esta mensagem**; a nova mensagem ainda exigiu envio explícito.

Depois foram testados carne vermelha → restaurante próximo e melhor avaliado → “como assim?” → Butantã → Sabor de Casa e Bife a cavalo. O formulário exibiu uma porção, R$ 45,00, 40 minutos, melhor avaliação, Casa e ponto Butantã Centro simulado. A recarga preservou conversa e rascunho. A conversa habitual do usuário não foi reiniciada, alterada nem usada para compras de teste.

“Não troque para a Cozinha Expressa” manteve Sabor de Casa sem reabrir a pergunta de restaurante. “Agora são 0 porções” deixou a quantidade pendente, manteve os outros campos e removeu a ação de revisão. A primeira tentativa de quantidade havia falhado no formato do provedor; passou após separar proposta de extração e rascunho válido.

## Limites

Os testes comprovam os casos executados, não compreensão universal de linguagem natural. Localizações, cardápios, notas, estoques, pagamentos e entregas continuam simulados; não há GPS real. A demo atende uma porção por compra e não verifica alergênicos ou contaminação cruzada. Rascunhos históricos não são reescritos automaticamente. As evidências detalhadas ficam em `outputs/`, ignorado pelo Git; este documento registra os resultados sem credenciais ou dados privados do usuário.
