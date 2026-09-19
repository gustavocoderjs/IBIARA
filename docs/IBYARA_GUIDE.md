---
title: "i.byara — Guia mestre de produto e engenharia"
version: "1.0.0"
date: "2026-09-19"
language: "pt-BR"
status: "baseline de produto consolidada; implementação técnica proposta"
canonical_path: "docs/IBYARA_GUIDE.md"
---

# i.byara

## Guia mestre de produto e engenharia

**Marketplace alimentício agent-to-agent.**

**You describe your kitchen. Your agent runs your commerce.**

Versão 1.0.0 · 19 de setembro de 2026 · Hackathon NeuraLake

Este documento orienta produto, contratos, experiência, arquitetura, implementação, testes e demonstração. Não declara que os recursos já foram implementados, que integrações foram homologadas ou que resultados de negócio foram medidos.

**Regra central:** humanos descrevem objetivos, dados e limites; agentes conduzem o comércio; motores determinísticos calculam e fazem cumprir os limites.

## Índice

1. [Autoridade do documento e decisões congeladas](#sec-01)
2. [Produto, proposta de valor e limites](#sec-02)
3. [Marca e identidade visual](#sec-03)
4. [Escopo de construção e definição de pronto](#sec-04)
5. [Onboarding conversacional e ficha técnica](#sec-05)
6. [Compras, notas fiscais e custo dos insumos](#sec-06)
7. [Quantidades, rendimento, estoque e reconciliação](#sec-07)
8. [Política econômica e motor determinístico](#sec-08)
9. [Mercado A2A, descoberta e negociação](#sec-09)
10. [Arquitetura, stack e limites de responsabilidade](#sec-10)
11. [Contratos de domínio e mensagens](#sec-11)
12. [APIs, ferramentas e estados transacionais](#sec-12)
13. [NeuraLake, memória e eficiência de inferência](#sec-13)
14. [Segurança, privacidade e operação responsável](#sec-14)
15. [Testes de aceite e evidências](#sec-15)
16. [Cenário canônico da demonstração](#sec-16)
17. [Pitch: abrir com funcionamento, não com promessa](#sec-17)
18. [Aderência ao hackathon e ponto de atenção](#sec-18)
19. [Plano de entrega e roadmap](#sec-19)
20. [Repositório e desenvolvimento agêntico](#sec-20)
21. [Riscos, pendências e validação de negócio](#sec-21)
22. [Referências, evidência e histórico](#sec-22)

<a id="sec-01"></a>

# 01 · Autoridade do documento e decisões congeladas

## Como interpretar a especificação

**CONFIRMADO** identifica decisões expressas pela equipe na conversa, especialmente as correções finais de Cristiano. **PROPOSTA TÉCNICA** identifica mecanismos aqui recomendados para implementar essas decisões. **PENDENTE** identifica dependências externas, escolhas de negócio não autorizadas e pontos que exigem validação. Uma proposta técnica não autoriza alteração do produto.

Este Markdown é a fonte canônica sugerida para o repositório. O PDF é sua edição de leitura. Ao modificar a especificação, atualizar a versão, o registro de decisões e regenerar o PDF; não editar os dois conteúdos independentemente.

Precedência: correções finais do responsável pelo produto > decisões anteriores explicitamente aceitas > esta especificação técnica > sugestões antigas do assistente. Exemplos anteriores de preços, margens, tokens, desperdício e receitas não constituem resultados nem parâmetros aprovados. A seção 08 substitui as contas ilustrativas anteriores por uma referência consistente. [S01–S02]

## Contrato de produto — CONFIRMADO

| ID | Decisão que deve ser preservada |
|---|---|
| PROD-01 | i.byara é um marketplace alimentício bilateral, com agentes compradores e agentes de restaurantes. |
| PROD-02 | Cada restaurante é representado por um agente que consulta suas informações operacionais autorizadas. |
| PROD-03 | Cadastro e ficha técnica são construídos conversacionalmente, por voz ou texto, com perguntas e respostas incrementais. |
| PROD-04 | Notas fiscais, inclusive acessadas a partir de QR Codes compatíveis, alimentam a ingestão de compras e custos. |
| PROD-05 | Preços, custos, pisos, descontos, taxas, orçamento e baixa de estoque obedecem a regras determinísticas. LLMs não inventam valores. |
| PROD-06 | O dono define objetivos e política; o agente decide como atuar dentro desses limites. |
| PROD-07 | Agentes de consumidores procuram e negociam conforme intenção, preferências, prazo e orçamento autorizado. |
| PROD-08 | O estado de estoque pode alterar ofertas para baixo ou para cima dentro da política; excesso elegível pode motivar maior competitividade. |
| PROD-09 | O dono escolhe a periodicidade de reconciliação física e informa quantidades por texto ou conversa em voz. |
| PROD-10 | Memória, custos, políticas e limites privados permanecem com o respectivo representado. O mercado recebe apenas o necessário. |
| PROD-11 | A apresentação começa diretamente com o cadastro conversacional de Marmita Quentinha do Seu Niko e a criação de um ou dois pratos. |
| PROD-12 | A marca é i.byara; a assistente se apresenta como Byara. Não renomear ou pivotar sem autorização. |

**Invariantes:** nenhum preço fora do motor; nenhuma compra sem mandato; nenhum ingrediente ou peso preenchido como fato por inferência silenciosa; nenhuma disputa resolvida ultrapassando restrições; nenhuma transação duplicada por repetição de mensagem; nenhum dado privado enviado à contraparte sem necessidade e autorização.

## O que este documento não aprova

Não aprova comissão, assinatura, taxa definitiva, margem universal, expansão geográfica, integração comercial com terceiros, lançamento público, registro de marca ou enquadramento final em uma trilha do hackathon. Também não aprova substituições alimentares silenciosas, venda de alimento impróprio ou uso de dados pessoais para estimar disposição máxima a pagar.

A arquitetura recomendada pode ser implementada como baseline, mas alterações que afetem produto, autoridade dos agentes, dinheiro, privacidade ou escopo de demonstração precisam de decisão registrada do responsável pelo produto.

<a id="sec-02"></a>

# 02 · Produto, proposta de valor e limites

## Definição operacional

A i.byara recebe intenções de alimentação e permite que agentes de restaurantes apresentem ofertas executáveis, negociadas por agentes compradores. O agente do restaurante usa ficha técnica, custos, estoque, capacidade e política comercial; o agente comprador usa preferências, experiência anterior, orçamento e restrições autorizadas.

**Quem decide a transação deixa de ser a interface de delivery e passa a ser o par de agentes.** A interface continua importante para informar, acompanhar, corrigir e revogar; não precisa ser operada a cada etapa comercial.

O ciclo proposto é: conversa de cadastro → ficha técnica validada → compras e custos → estoque e política → solicitação de propostas → negociação → reserva → pedido → produção/consumo → reconciliação → próximas ofertas.

## Dois lados, uma transação

Para o restaurante, a hipótese de valor é reduzir esforço de cadastro e atualização, tornar custos utilizáveis na negociação, proteger contribuição e direcionar demanda a estoque elegível. Para o consumidor, é reduzir busca e comparação, respeitar preferências e obter uma oferta adequada ao objetivo. São hipóteses a validar; não prometer economia ou redução de desperdício antes de medir.

O mercado deve permitir que qualquer agente comprador autorizado solicite ofertas pela mesma interface. O aplicativo próprio é a primeira experiência, não uma exigência estrutural de navegação por cardápio.

## Autonomia com fronteiras

“Comércio 100% agêntico” significa que, depois de receber dados suficientes e um mandato válido, a negociação e a execução comercial podem ocorrer sem escolhas manuais intermediárias. Não significa que a IA dispense o dono de informar receitas, contar estoque, confirmar uma política ambígua, preparar alimentos ou cumprir suas responsabilidades operacionais.

Autonomia inclui não negociar, recusar uma contraproposta, encerrar uma RFQ sem vencedor e interromper a compra quando não há solução elegível. O sistema não pode comprar qualquer coisa apenas para terminar a demonstração com sucesso.

## Não confundir com outros produtos

Não é um nutricionista automatizado, um sistema contábil completo, um ERP universal, uma frota de entregadores ou um agregador de scraping. Apoio nutricional pode existir como capacidade futura delimitada, mas não integra prescrição clínica nem autoriza deduzir calorias, alergênicos ou adequação médica pela descrição de um prato.

Receitas dinâmicas só podem usar combinações e substituições previamente autorizadas, com composição e custos recalculados. A proposta anterior de “inventar um prato fora do cardápio” não é requisito confirmado do MVP.

<a id="sec-03"></a>

# 03 · Marca e identidade visual

## Nome, voz e narrativa — CONFIRMADO / PROPOSTA VISUAL

Escrever **i.byara**, em minúsculas, com um ponto entre “i” e “byara”. Usar **Byara** na conversa. Identificadores técnicos usam `ibyara`, por exemplo `ibyara.exchange.v1`; não usar pontos em nomes de pacotes onde isso altere namespaces inadvertidamente.

A equipe associou o nome a “ibaiara”, frutos/pomar e inteligência artificial, com uma referência criativa à Bia. **A tradução exata para o tupi não foi confirmada nesta pesquisa.** Tratar essa explicação como intenção criativa dos fundadores, não como etimologia comprovada. Não imprimir “mãe dos frutos em tupi” como fato antes de validação linguística. A referência criativa também não constitui vínculo, patrocínio ou autorização de uso de marca de um banco. [S01]

Assinatura principal: **You describe your kitchen. Your agent runs your commerce.**

Assinatura descritiva proposta: **Sua cozinha. Seus limites. Agentes negociando.**

A voz da Byara deve ser brasileira, direta e acolhedora, sem caricatura. Perguntar com linguagem de cozinha; explicar consequências comerciais com clareza. Preferir “Preciso do peso dos dois bifes juntos” a “Informe o parâmetro de massa da proteína”. Preferir “Não consegui confirmar o custo do óleo” a “Erro de contexto”.

## Sistema visual proposto

A direção combina alimento e confiança técnica: fundo claro quente, verde profundo, verde suave e um acento coral. O ponto do nome funciona como sinal visual de intenção/transação, sem imitar a identidade de instituições citadas pela equipe.

| Token | Cor | Aplicação |
|---|---|---|
| `brand.forest` | `#173F35` | Marca, cabeçalhos, superfícies institucionais. |
| `brand.leaf` | `#DCECCF` | Destaques suaves, áreas informativas. |
| `brand.fruit` | `#E57451` | Acento, marcador de intenção e chamadas pontuais. |
| `surface.paper` | `#F7F6F0` | Fundo de leitura e onboarding. |
| `surface.white` | `#FFFFFF` | Cards, inputs e áreas de conteúdo. |
| `text.ink` | `#182A25` | Texto principal. |
| `text.muted` | `#586660` | Legendas e metadados. |
| `status.error` | `#A52E34` | Bloqueios; sempre acompanhados de texto. |

Tipografia proposta: **Inter** para interface e documento; **DejaVu Sans Mono** ou equivalente do sistema para contratos e logs. Não redistribuir fontes junto deste kit. No aplicativo, fixar dependências e verificar licenças antes de hospedar arquivos de fontes.

Espaçamento em múltiplos de 4 px; cards de 12–16 px de raio; alvos de interação de pelo menos 44 px como meta de design; texto base de 16 px no app. Não usar coral claro para texto pequeno sobre branco. Validar contraste e navegação por teclado na implementação; não declarar conformidade de acessibilidade sem teste.

## Experiência visual do produto

A conversa é a superfície principal. Cards laterais mostram dados que acabaram de ser estruturados: prato, porções, pendências, custo validado e política vigente. Esses cards não substituem o diálogo por um formulário obrigatório.

O painel de negociação é observacional. Deve exibir eventos, propostas e justificativas estruturadas, não exigir que o apresentador clique no vencedor. Na demonstração, visões de consumidor e restaurante devem ter contextos visuais separados; a projeção pode usar dados fictícios, mas essa conveniência não autoriza acesso cruzado em produção.

<a id="sec-04"></a>

# 04 · Escopo de construção e definição de pronto

## Recorte de demonstração — PROPOSTA DE EXECUÇÃO

Preservar as capacidades confirmadas, reduzindo quantidade de dados e variedade de integrações: um restaurante cadastrado ao vivo, dois restaurantes de cenário identificados como fictícios, um consumidor, um ou dois pratos criados conversacionalmente e um ciclo completo de negociação.

A voz é parte do requisito, não um efeito visual. Texto também é uma modalidade oficial e um caminho de contingência. Se o mecanismo de voz falhar, declarar a troca de modalidade; não reproduzir uma gravação fingindo que a compreensão ocorreu ao vivo.

| Faixa | Entrega |
|---|---|
| P0 / fluxo principal | Conversa de onboarding, resolução de ambiguidades, ficha técnica, ingestão de uma fonte fiscal suportada, política confirmada, custo e preço determinísticos. |
| P0 / comércio | Agente comprador + três agentes de restaurante, descoberta filtrada, propostas, contraproposta limitada, seleção, reserva e pedido em sandbox. |
| P0 / operação | Estoque por eventos, declaração de excedente, contagem conversacional com periodicidade configurável e reconciliação auditada. |
| P0 / confiança | Mandatos, separação de contextos, autenticação de demo, idempotência, orçamento, bloqueios, logs e custos de inferência reais quando disponíveis. |
| P1 / piloto | Mais emissores fiscais, receitas/batches mais complexos, agendamento persistente resiliente, pagamentos e logística homologados, observabilidade de produção. |
| P2 / evolução | Integrações de PDV, modelos de demanda validados, agentes externos interoperáveis e capacidades alimentares adicionais aprovadas. |

No P0, o lembrete de inventário pode ser disparado por um relógio de teste identificado na demonstração. A periodicidade escolhida deve estar persistida e ser realmente avaliada pelo scheduler, não somente desenhada na tela. Suporte operacional contínuo, notificações fora do aplicativo e recuperação de indisponibilidade pertencem ao endurecimento do piloto.

## O que pode ser simulado, explicitamente

Restaurantes concorrentes, saldos financeiros, execução de pagamento, entrega, demanda esperada, custos de insumos e lotes de teste podem ser fixtures. Um pedido em sandbox deve aparecer como **pedido confirmado em sandbox**, nunca como pagamento real ou entrega realizada.

A interpretação de uma fala nova, a estruturação da receita, o cálculo, a decisão e a troca de mensagens devem executar código real. Uma nota em fixture pode testar o pipeline, mas não comprova integração fiscal ao vivo. Se o conector real não funcionar, marcar a entrega correspondente como não demonstrada e exibir o modo utilizado.

## Critério de conclusão do MVP

O MVP só está pronto quando um teste ponta a ponta demonstra o cadastro, a validação dos dados, a negociação e a reserva dentro dos limites; repetir a mesma solicitação não duplica pedido; um estoque insuficiente bloqueia a operação; atualizar uma contagem altera o estado consultado nas próximas ofertas; e os eventos exibidos são derivados do backend.

Reduções de escopo devem ser registradas com impacto e aprovação. Não eliminar voz, conversa de ficha técnica, motor de preço ou reconciliação física para compensar atrasos sem autorização do responsável pelo produto.

<a id="sec-05"></a>

# 05 · Onboarding conversacional e ficha técnica

## Máquina de estados

`START → RESTAURANT_DRAFT → DISH_DRAFT → CLARIFYING → RECIPE_CONFIRMED → COST_READY → POLICY_CONFIRMED → ACTIVE`

Os estados são por agregado: um restaurante pode ter uma receita ativa e outra em rascunho. `ACTIVE` exige ao menos uma oferta operacionalmente elegível; cadastro concluído não significa que todos os pratos já possam ser vendidos. Custos ou dados críticos ausentes mantêm a receita em `DRAFT` ou `BLOCKED_FOR_SALE`.

A sessão deve persistir cada turno, os campos extraídos, sua origem e as perguntas pendentes. Retomar uma conversa não recomeça o cadastro nem perde confirmações anteriores.

## Abertura obrigatória do pitch

> “Byara, quero cadastrar meu restaurante na plataforma. O nome dele é Marmita Quentinha do Seu Niko. Estamos localizados na Avenida Corifeu de Azevedo Marques, 488.”

Essa fala foi definida pelo responsável pelo produto. Nome e endereço são dados do cenário de demonstração fornecido pela equipe; este documento não verifica a existência, a titularidade ou a operação comercial desse restaurante. [S01]

Resposta proposta da Byara: “Vou cadastrar a Marmita Quentinha do Seu Niko nesse endereço. Qual é o primeiro prato?”

Dono: “Bife a cavalo. São dois bifes de patinho, um ovo, 150 gramas de batata frita, 250 gramas de arroz e 80 gramas de feijão.”

A Byara não pode converter “dois bifes” em uma massa arbitrária. Deve perguntar: “Quanto pesam os dois bifes juntos? Esse peso é antes ou depois do preparo? Arroz, feijão e batata estão pesados prontos?”

Resposta ilustrativa de ensaio: “Os dois bifes juntos pesam 200 gramas, crus e limpos. Os acompanhamentos estão pesados prontos.”

Depois, perguntar por preparo, óleo, temperos, embalagem, porções por receita e conversões ainda necessárias. Não apresentar um piso definitivo enquanto dados críticos não tiverem sido fornecidos ou vinculados a uma ficha de preparo validada.

## Estratégia de perguntas

Perguntar primeiro o que impede cadastro e custeio: nome, rendimento, quantidades, unidades e base de medição. Agrupar duas ou três perguntas relacionadas quando isso reduzir o esforço, sem transformar o diálogo em interrogatório extenso. Campos opcionais podem ficar pendentes; os essenciais não podem ser substituídos por média inventada.

Para acompanhamentos cozidos, perguntar por uma receita de preparo: “Quanto arroz cru você usa e quanto arroz pronto esse preparo rende?” A resposta constrói a conversão ou sub-receita. Não exigir que o dono conheça o termo “fator de rendimento”.

Ao final, apresentar um resumo curto: composição, quantidade por porção, base de medição, preparo associado e pendências. A confirmação do dono publica uma versão da ficha. Correções posteriores criam nova versão; não alteram silenciosamente a receita que fundamentou uma oferta anterior.

## Extração é proposta de mutação

O LLM devolve `RecipeDraftPatch`, nunca uma escrita livre no banco. Cada campo contém valor proposto, unidade, base, trecho de origem e status. O serviço valida o patch, resolve referências e grava somente o que é permitido. Um número transcrito com dúvida, como “quinze” versus “cento e cinquenta”, gera pergunta de confirmação.

O canal de entrada pode variar sem mudar o domínio: voz → transcrição → extração estruturada; texto → extração estruturada. A voz sintetizada comunica a mesma resposta que aparece em texto. Permissão de microfone, falha de transcrição e dados enviados ao provedor precisam ser visíveis.

<a id="sec-06"></a>

# 06 · Compras, notas fiscais e custo dos insumos

## Pipeline proposto

`QR/link/arquivo autorizado → validação de origem → obtenção do documento → parsing → linhas fiscais normalizadas → correspondência de insumos → confirmação de exceções → registro da compra → atualização de custo`

Um QR Code é uma porta de entrada para uma consulta/documento; não se deve assumir que todo documento fiscal possui o mesmo formato ou que todo link expõe uma API estável. A consulta paulista examinada mostra informações de itens em um exemplo de homologação, enquanto a consulta por chave exige caracteres de uma imagem. Isso sustenta a necessidade de adaptadores e falhas explícitas, não uma promessa de acesso universal. [S06–S07]

Para o MVP, suportar uma fonte conhecida e testada. Importação de XML fornecido pelo restaurante e lançamento conversacional autorizado são rotas alternativas de dados; não devem ser anunciadas como leitura automática de QR quando não forem.

## Contrato mínimo de uma linha de compra

Conservar chave/identificador da nota, emissor, ambiente fiscal, data, número da linha, descrição original, código do produto, quantidade comercial, unidade, total, descontos, encargos e vínculo ao insumo interno. Normalizar custo para uma unidade-base sem perder o original.

“Caixa de ovos” exige fator de unidades por caixa. “Fardo de arroz” exige quantidade e peso de cada pacote. Se essa informação não estiver na nota nem no cadastro confirmado do fornecedor, perguntar. Não assumir que uma caixa sempre tem 30 ovos ou um pacote sempre pesa 5 kg.

Idempotência: a combinação de tenant, ambiente, chave fiscal e linha deve impedir dupla contabilização. Importar novamente a nota não cria entrada duplicada; correções e cancelamentos geram eventos de reversão ou revisão auditável.

## Compra não é necessariamente recebimento

A emissão da nota não prova que a mercadoria chegou. Separar `PurchaseRecorded` de `GoodsReceived`. O dono pode autorizar a regra “notas que envio manualmente já correspondem a mercadorias recebidas”; sem essa política, a Byara confirma o recebimento antes de aumentar disponibilidade física.

Não inferir validade, condição de conservação ou lote pela data de emissão. Lote e elegibilidade sanitária são dados operacionais distintos. A nota também não prova que o item ainda está disponível depois de perdas e consumo.

## Custeio — PROPOSTA TÉCNICA

Adotar custo médio ponderado móvel de insumos para a primeira versão, com uma política de custeio identificada. FEFO para lotes elegíveis é uma política de alocação física diferente; não confundir custo médio com ordem de consumo.

`custo_médio_novo = (quantidade_antiga × custo_antigo + custo_recebido) / quantidade_total`

Quando não houver saldo anterior, usar o custo unitário da entrada confirmada. Estoque negativo, denominador zero e custo ausente bloqueiam a atualização ou a venda correspondente. Tributos recuperáveis, frete de compra e critérios contábeis dependem do regime do restaurante; não deduzi-los por LLM. No MVP, usar custos explicitamente fornecidos e identificar o critério adotado.

<a id="sec-07"></a>

# 07 · Quantidades, rendimento, estoque e reconciliação

## Base física correta

Cada componente da receita distingue quantidade, unidade e estado: `AS_PURCHASED`, `RAW_EDIBLE` ou `COOKED_EDIBLE`. As unidades-base propostas são `g`, `ml` e `un`. Não converter massa em volume sem fator específico confirmado; não converter peça em gramas sem peso ou padrão validado.

Definir `yield_factor = quantidade_final_utilizável / quantidade_comprada`. Assim, `quantidade_comprada_equivalente = quantidade_servida / yield_factor`. O fator pode ser maior que 1 para preparações que incorporam água. Não tratar 250 g de arroz cozido como 250 g de arroz comprado cru.

O rendimento precisa ter origem: informado e confirmado pelo dono, medido em um lote ou obtido de uma ficha previamente validada. Valores do cenário de testes são sintéticos, não recomendações culinárias.

## Dois modos de consumo, sem dupla baixa

**Preparo sob pedido:** os componentes convertidos para a base de estoque são reservados no aceite. A baixa de matéria-prima ocorre quando o preparo começa, uma única vez por pedido e componente.

**Pré-produzido:** um evento de produção consome matéria-prima e gera saldo de preparação pronta, com custo e rendimento associados. A venda reserva e consome essa preparação; não baixa novamente os ingredientes crus. Quantidades prontas declaradas pelo dono devem ser vinculadas a um item preparado, não somadas ao saldo cru.

O domínio deve suportar ambos. A demonstração pode usar um fluxo de preparo e uma preparação já cadastrada para limitar duração. Não reduzir “sobra de arroz pronto” a “estoque de arroz cru” para simplificar a implementação.

## Ledger de estoque

| Evento | Efeito |
|---|---|
| `GoodsReceived` | Aumenta saldo recebido elegível após validação. |
| `StockReserved` | Aumenta reservado; não altera saldo físico/teórico. |
| `ReservationReleased` | Libera reserva expirada ou cancelada. |
| `IngredientConsumed` | Reduz saldo e encerra a reserva correspondente no preparo. |
| `ProductionCompleted` | Registra consumo dos insumos e entrada do lote preparado em uma operação consistente. |
| `WasteRecorded` | Baixa perda declarada com motivo; não atribui culpa. |
| `StockCountConfirmed` | Gera ajuste para reconciliar saldo no instante da contagem. |
| `StockEligibilityChanged` | Bloqueia ou libera lote conforme evidência operacional autorizada. |

`disponível = saldo_elegível - reservado_ativo - estoque_de_segurança`

A reserva deve considerar todos os componentes e a capacidade da cozinha. Não reservar só a proteína e descobrir depois que faltam embalagem ou acompanhamentos.

## Contagem conversacional — CONFIRMADO

O dono escolhe periodicidade, por exemplo 1, 3, 5 ou 7 dias, horário e fuso. A Byara abre uma sessão de contagem e pergunta: “O que temos hoje? Pode me dizer as quantidades.” O dono pode responder: “Temos 6 kg de bife e 2 kg de frango.”

A Byara esclarece corte/item, estado cru ou pronto, unidade, local e se a contagem é exata ou aproximada. Mostra o resumo e solicita confirmação da observação. Informar um item não zera os itens omitidos. Uma contagem parcial atualiza somente seu escopo.

`divergência = quantidade_contada - quantidade_teórica_no_instante_da_contagem`

Registrar `counted_at`, `recorded_at`, autor, local, base, nível de precisão e sequência do ledger. Se a contagem se referir a um instante anterior, reconciliar movimentos posteriores antes de gravar o ajuste. O MVP pode restringir contagens ao instante atual com confirmação explícita; não aplicar um saldo antigo sobre vendas novas.

Se a contagem tornar impossível atender reservas existentes, marcar conflito e replanejar/cancelar conforme contrato. Não manter disponibilidade negativa silenciosamente. Para estimativas aproximadas, usar buffer configurado ou pedir contagem mais precisa antes de comprometer saldo crítico.

## Excedente não é perda comprovada

“Temos muito frango” abre uma declaração de excedente, mas não define massa nem prazo sanitário. O agente pede o dado necessário, vincula a um saldo elegível e decide sua estratégia. Um sinal de excedente pode existir por declaração do dono, mesmo sem modelo de previsão.

Vender 200 g reduz estoque e pode reduzir exposição estimada a excedente; não comprova que 200 g seriam descartados. O produto deve separar `excedente_declarado`, `exposição_estimada`, `perda_observada` e `consumo_realizado`. Divergência de inventário não é evidência automática de furto ou falha de um funcionário.

<a id="sec-08"></a>

# 08 · Política econômica e motor determinístico

## Autoridade de cada componente

O dono declara objetivo e limites. O agente interpreta a intenção, esclarece conflitos e propõe uma política tipada para confirmação. Depois, escolhe entre ações permitidas: participar ou não de uma RFQ, selecionar oferta elegível, consultar estoque, solicitar a estratégia aplicável ao motor e enviar a proposta retornada por ele.

**O LLM não escolhe números livres nem coeficientes ocultos.** Todos os preços, pisos, aumentos, descontos e contrapropostas são emitidos pelo motor a partir de políticas versionadas e dados validados. Traduzir “mais agressivo” em um novo desconto exige confirmação de um limite ou uso de um perfil já autorizado.

“Maximizar lucro” não é uma regra executável suficiente. Esclarecer horizonte, métrica e prioridades: contribuição por pedido, contribuição diária, giro de estoque elegível ou redução de exposição, com restrições de margem e capacidade. Não afirmar otimização global sem um modelo e dados que a sustentem.

## Política mínima proposta

`objective`, `priority_order`, `min_contribution_margin_bps`, `min_contribution_cents`, `max_discount_bps`, `max_markup_bps`, `reference_price_cents`, `max_rounds`, `offer_ttl_seconds`, `safety_stock`, `allowed_strategies`, `count_schedule`, `fee_rules`, `effective_at`, `version`, `confirmed_by`.

As estratégias propostas são `BALANCED`, `SURPLUS_FIRST` e `CAPACITY_PROTECTION`. A estratégia ativa de preço também é selecionada deterministicamente conforme estado e prioridades da política; o LLM não escolhe um perfil numérico para alterar o valor. A intensidade de um desconto vem de tabelas/coordenadas da política, não de um valor inventado pelo modelo. Excesso físico inelegível não habilita desconto.

## Dinheiro, margem e taxas

Transportar preços em **centavos inteiros**. Usar `Decimal` internamente para custos e rendimentos; nunca `float` binário como autoridade financeira. Taxas são inteiros em pontos-base ou decimais explicitamente validados. A biblioteca Decimal oferece aritmética decimal e modos de arredondamento que podem ser escolhidos explicitamente. [S08]

No modelo simplificado, `P` é o subtotal de produtos recebido como base comercial do restaurante; `C` são os custos variáveis atribuídos ao pedido; `F` são encargos fixos por pedido; `r` é a soma de taxas proporcionais sobre a mesma base; `m` é a margem mínima de contribuição sobre `P`.

```text
K = C + F
contribuição = P × (1 - r) - K
margem_contribuição = contribuição / P
piso_analítico = teto_em_centavos(K / (1 - r - m))
```

Exigir `P > 0`, custos não negativos e `r + m < 1`. A fórmula vale para taxas sobre a mesma base e custos conhecidos. Quando a base ou a incidência divergir, calcular cada regra explicitamente. Depois do piso analítico, validar novamente as taxas arredondadas e aumentar centavos até satisfazer todas as restrições.

**Margem de contribuição não é markup nem lucro líquido.** Aluguel, folha fixa e outras despesas podem não estar incluídos. Não comunicar “lucro garantido”. A política protege a métrica definida, não toda a saúde financeira do restaurante.

## Limites e negociação

```text
piso_desconto = teto(reference_price × (1 - max_discount))
piso_efetivo = max(piso_custeio, piso_desconto, piso_absoluto)
teto_efetivo = piso_em_centavos(reference_price × (1 + max_markup))
preço_alvo = função_determinística(estado, objetivo, política)
preço_ofertado = clamp(preço_alvo, piso_efetivo, teto_efetivo)
```

Se `piso_efetivo > teto_efetivo`, devolver `POLICY_INFEASIBLE`; não ignorar um limite. O preço de referência não deve ser aumentado artificialmente apenas para produzir uma narrativa de desconto. Cada proposta guarda versão da política, snapshot de custo e estado usado.

Uma contraproposta do comprador é um valor solicitado, não uma ordem. O motor do restaurante aceita, rejeita ou devolve outro preço permitido. A alta por escassez/capacidade também obedece ao teto autorizado. Mudança material de prato, porção, taxa ou prazo cria nova oferta; nunca altera uma oferta aceita silenciosamente.

## Caso numérico de referência — todos os dados são fictícios

| Componente do bife a cavalo | Conversão confirmada no cenário | Custo |
|---|---|---|
| Dois bifes de patinho | 200 g crus; rendimento 1,00; R$ 40/kg | R$ 8,00 |
| Ovo | 1 unidade a R$ 0,90 | R$ 0,90 |
| Batata frita | 150 g pronta / 0,75 = 200 g comprada; R$ 10/kg | R$ 2,00 |
| Arroz | 250 g pronto / 2,50 = 100 g cru; R$ 6/kg | R$ 0,60 |
| Feijão | 80 g pronto / 2,00 = 40 g cru; R$ 8/kg | R$ 0,32 |
| Óleo e temperos | Parcela de sub-receita medida no cenário | R$ 0,68 |
| Embalagem | 1 unidade | R$ 1,50 |
| Outros custos variáveis | Regra explícita do cenário | R$ 0,80 |
| Encargo fixo por pedido | Não somar novamente em outra linha | R$ 0,20 |

Resultado: `C = R$ 14,80`, `F = R$ 0,20`, `K = R$ 15,00`. Com `r = 10%` e `m = 25%`, o piso analítico é `15 / 0,65 = R$ 23,0769…`, arredondado para **R$ 23,08**. Com preço de referência de R$ 34,90 e desconto máximo de 25%, o piso comercial é **R$ 26,18**. Portanto, o piso efetivo é **R$ 26,18**.

Uma estratégia de excedente com desconto de 20% produz **R$ 27,92**. Uma contraproposta de **R$ 27,00** pode ser aceita: está acima do piso efetivo. Com taxa de 10%, a contribuição é `27 - 2,70 - 15 = R$ 9,30`, ou **34,44%** do subtotal. Com entrega de R$ 3,90 cobrada separadamente e taxa ao comprador igual a zero no cenário, o total do consumidor é **R$ 30,90**.

Essa decomposição é obrigatória. Frete ou taxa não podem aparecer depois da decisão. Os percentuais são parâmetros de teste, não tributação, comissão ou política comercial aprovadas.

<a id="sec-09"></a>

# 09 · Mercado A2A, descoberta e negociação

## Mecanismo comercial — PROPOSTA TÉCNICA

Implementar uma **solicitação de propostas com disputa reversa e negociação limitada**. O termo “leilão” pode ser usado no pitch como explicação, mas não afirmar que existe um mecanismo ótimo, incentivo à revelação verdadeira de custos ou garantia de menor preço de todo o mercado.

O Exchange encontra restaurantes elegíveis por área de atendimento, horário, capacidade declarada e categorias/receitas compatíveis. Não envia toda intenção para todos os restaurantes indiscriminadamente. No cenário de demonstração, três agentes bastam para mostrar competição.

Os agentes representam partes distintas mesmo quando executam no mesmo processo. Cada um tem identidade, contexto, política, ferramentas e memória próprios. Uma chamada a três prompts com acesso irrestrito ao mesmo histórico não comprova isolamento nem representação bilateral.

## Ciclo proposto

1. O Buyer Agent interpreta a intenção e verifica o mandato privado de compra.
2. O Exchange consulta o registro de capacidades e entrega a RFQ mínima aos restaurantes elegíveis.
3. Cada Merchant Agent avalia participação, consulta seus serviços privados e solicita uma oferta ao motor.
4. O Buyer Agent elimina violações duras, compara as ofertas e pode enviar contrapropostas permitidas.
5. O motor de cada restaurante decide a resposta numérica; o agente a transmite.
6. O Buyer Agent escolhe a oferta elegível; o serviço transacional reserva orçamento, insumos e capacidade.
7. A operação em sandbox confirma o pedido e registra os eventos; falhas liberam as reservas pertinentes.

O objetivo não é manter agentes conversando indefinidamente. Baseline proposta: no máximo três restaurantes por RFQ de demo, uma rodada inicial e até duas rodadas de contraproposta, com prazo total e orçamento de inferência. A configuração deve ser testada no ambiente real; esses números não são resultados medidos.

## Restrições antes da preferência

Preço total dentro do mandato, composição exigida, restrições alimentares verificáveis, área, validade da oferta, capacidade e prazo são filtros duros. Um score alto nunca compensa uma violação. Ingrediente obrigatório não pode ser removido para caber no orçamento sem que essa flexibilidade já tenha sido autorizada.

Após os filtros, um ranking determinístico compara preço total, prazo e atributos autorizados. Modo “menor preço” usa ordenação lexicográfica: total crescente, prazo crescente, identificador estável. Modo “equilibrado” pode usar pesos confirmados e features normalizadas; pesos, método e tratamento de dados ausentes devem estar versionados. Não exibir notas como “0,93” sem fórmula e evidência de entrada.

Preferências inferidas do histórico são sugestões revisáveis; a intenção atual prevalece. Reputação só entra com fonte e quantidade de avaliações. Ausência de avaliações não equivale a reputação perfeita, e dados fictícios não podem aparecer como avaliação real de clientes.

## Informação mínima para negociar

O teto máximo do comprador fica no Buyer Agent. A RFQ padrão não expõe esse teto, a renda, o histórico de gastos ou o perfil completo. Uma contraproposta pode revelar o valor que o comprador oferece naquela rodada, não todo o seu mandato. Essa proteção reduz compartilhamento; não elimina toda inferência possível a partir das próprias ofertas.

Custos, preço piso, estoque exato e política de margem permanecem no Merchant Agent. A contraparte recebe preço total, composição, prazo, condições, validade e identificadores verificáveis. Propostas de concorrentes não são abertas entre restaurantes por padrão.

O Exchange não repassa instruções contidas em descrições de pratos como comandos de sistema. Catálogos, documentos fiscais e mensagens de terceiros são dados não confiáveis. Nenhum texto de contraparte pode modificar política, identidade, autorização ou ferramentas.

## Sem vencedor é um resultado válido

Se não houver oferta elegível, encerrar com razões estruturadas, como `NO_ELIGIBLE_OFFER`, `BUDGET_EXCEEDED` ou `DELIVERY_WINDOW_UNAVAILABLE`. O agente pode sugerir ao humano uma mudança de objetivo, mas não a executar sem autorização. Esse ponto deve aparecer em pelo menos um teste, ainda que não seja a cena principal do pitch.

<a id="sec-10"></a>

# 10 · Arquitetura, stack e limites de responsabilidade

## Arquitetura recomendada para o hackathon

**Monólito modular**, com agentes isolados logicamente e serviços de domínio independentes dos LLMs. Evitar microserviços, Kubernetes, barramento distribuído e framework multiagente complexo sem necessidade demonstrada.

```text
Web / voz / texto
        |
API + autenticação + sessões
        |
  Byara de onboarding         Buyer Agent
        |                         |
  Serviços do restaurante     Exchange
        |                         |
  Receitas / compras /       Merchant Agents
  política / inventário        A / B / C
        |                         |
        +---- Motores determinísticos ----+
             custo / preço / elegibilidade
             reserva / orçamento / pedido
                         |
                   PostgreSQL
                         |
                Outbox + eventos de UI

LLM Provider Adapter: NeuraLake
Memory Adapter: contexto privado por principal
Voice Adapter: transcrição / síntese desacopladas
Fiscal Adapter: fontes explicitamente suportadas
Execution Adapter: sandbox; integrações reais depois
```

A Byara é uma identidade de experiência. O contexto que cadastra o restaurante não se mistura com o contexto que representa o consumidor. “Principal” significa a pessoa ou organização representada pelo agente; não é um papel que o próprio modelo pode alterar.

## Stack proposta

| Camada | Escolha | Motivo / restrição |
|---|---|---|
| Web | React + TypeScript + Vite | Conversa, cards de estado e observação do mercado; não renderizar decisões fictícias no cliente. |
| API | Python + FastAPI | Contratos tipados e especificação OpenAPI gerada a partir do backend. [S09] |
| Validação | Pydantic, com validação estrita nos limites críticos | Rejeitar campos extras e valores inválidos; validar escopo além do schema. [S10] |
| Domínio | Python puro + Decimal | Cálculos reproduzíveis, sem dependência do provedor de IA. [S08] |
| Persistência | PostgreSQL + SQLAlchemy + migrações | Transações, reservas concorrentes e histórico versionado. |
| Agentes | Serviços Python com loop limitado e ferramentas permitidas | Autonomia nos passos; domínio controla efeitos. |
| Inferência | Adapter HTTP para NeuraLake | Isolar contrato do fornecedor, timeout, custo e modalidades. |
| Atualizações de UI | SSE, comandos via HTTP | Observação de eventos; reconexão por último evento recebido. |
| Testes | pytest + testes de propriedade + Playwright | Domínio, contratos, concorrência e jornada real no navegador. |
| Empacotamento | Docker Compose e lockfiles | Ambiente reproduzível, banco e execução local para contingência. |

Não afirmar que essa é a stack já existente do time: nenhum repositório foi inspecionado para este documento. Se houver stack pronta, avaliar sua aderência aos contratos antes de reescrever.

Baseline de runtime sugerida: Python 3.12 e Node 22 com versão compatível com a release de Vite escolhida. A documentação consultada exige Node 20.19+ ou 22.12+ para o Vite atual; fixar a versão efetivamente testada em lockfile e imagem, em vez de usar `latest`. [S11]

## Voz: contrato e contingência

`VoiceAdapter.transcribe(audio, locale) → Transcript` e `VoiceAdapter.speak(text, locale) → AudioResult`. O fornecedor de voz ainda deve ser escolhido e testado. Não assumir que uma API rotulada “multimodal” suporta áudio bidirecional ou baixa latência suficiente para conversa ao vivo.

Reconhecimento de fala do navegador pode servir ao protótipo, mas tem disponibilidade limitada e pode depender de serviços externos. Validar navegador, rede, permissão, português e consentimento antes de adotar; manter texto como modalidade oficial. [S12]

No MVP, conversa por turnos com microfone e resposta falada é um mínimo defensável para voz. Full-duplex, interrupção de fala e cancelamento de eco são uma decisão técnica adicional, não capacidades presumidas. Se a equipe demonstrar apenas push-to-talk, chamar de conversa por voz, não de full-duplex.

## Persistência e isolamento

PostgreSQL é a autoridade para receitas, políticas, custos, orçamento, reservas, pedidos e ledger. Memória de LLM não substitui banco nem transação. Cada agregado tem tenant, versão e timestamps; consultas sempre recebem escopo autenticado. A política é verificada no servidor, não pela confiança em campos enviados pelo cliente.

O modelo relacional mínimo inclui: `principals`, `agents`, `restaurants`, `conversations`, `recipe_versions`, `recipe_components`, `purchase_documents`, `purchase_lines`, `inventory_items`, `lots`, `stock_events`, `count_sessions`, `policy_versions`, `purchase_mandates`, `rfqs`, `offers`, `reservations`, `orders`, `outbox_events` e `inference_calls`.

<a id="sec-11"></a>

# 11 · Contratos de domínio e mensagens

## Convenções obrigatórias

Protocolos internos usam a versão `ibyara.exchange.v1`. A2A aqui descreve a interação entre agentes. O protocolo público A2A possui especificação própria; usar HTTP/JSON entre agentes não autoriza declarar compatibilidade com essa especificação sem implementar e testar seus contratos. Um adapter de interoperabilidade pode ser incluído após decisão técnica. [S13]

IDs são opacos. Timestamps são ISO 8601 com timezone, persistidos em UTC; horários comerciais e contagens usam `America/Sao_Paulo` no cenário. Moeda do MVP: `BRL`. Quantidades decimais trafegam como strings; dinheiro como centavos inteiros. Valores desconhecidos são `null` ou pendências explícitas, nunca zero substituto.

Todo comando tem identidade autenticada, `idempotency_key`, `correlation_id`, versão do schema e escopo. `tenant_id` do corpo não concede acesso; o servidor deriva e confronta o tenant com a sessão/token. Campos extras em comandos financeiros devem ser rejeitados.

## Envelope de comunicação

```json
{
  "schema_version": "ibyara.exchange.v1",
  "message_id": "msg_001",
  "correlation_id": "rfq_001",
  "causation_id": null,
  "sender_agent_id": "buyer_001",
  "recipient_agent_id": "merchant_001",
  "sent_at": "2026-09-19T18:30:00Z",
  "expires_at": "2026-09-19T18:31:30Z",
  "message_type": "RFQ_CREATED",
  "payload": {}
}
```

O envelope não substitui autenticação, autorização nem assinatura quando necessária. Eventos persistidos usam um ID único e sequência; mensagens recebidas com o mesmo ID não devem causar um novo efeito.

## Contratos mínimos

| Contrato | Campos essenciais | Invariante |
|---|---|---|
| `RecipeDraftPatch` | sessão, prato, campos propostos, origem, pendências, versão esperada | Não publica receita por si só. |
| `RecipeVersion` | componentes, unidades, base, rendimento, porções, preparos associados, confirmação | Sem quantidade crítica ambígua. |
| `PurchaseLine` | chave, ambiente, linha, quantidade, unidade, total, insumo, recebimento | Não duplicar compra/entrada. |
| `StockCount` | itens contados, estado, local, precisão, instante e confirmação | Omitidos não são zerados. |
| `MerchantPolicy` | objetivo, limites, estratégias, taxas, rotina, versão e confirmação | LLM não amplia os limites. |
| `PurchaseMandate` | principal, total máximo, prazo, escopo, restrições, uso máximo e expiração | Limite privado e revogável. |
| `MealIntent` | descrição, porções, preferências, restrições, destino operacional | Não equivale a autorização de gastar. |
| `RFQ` | intenção pública mínima, região, prazo, requisitos e expiração | Não contém orçamento privado por padrão. |
| `Offer` | receita/versão, composição, valores, total, prazo, termos e validade | Valor deve vir do motor. |
| `CounterOffer` | oferta original, valor pedido e condições invariantes | Não altera contrato em silêncio. |
| `Reservation` | oferta, orçamento, lotes/componentes, capacidade e expiração | Tudo ou nada no domínio local. |
| `Order` | aceite, reservas, valores congelados, modo e estado | Um efeito por mandato/aceite idempotente. |
| `DecisionRecord` | decisão, entradas por referência, policy version, reason codes | Não exige nem publica chain-of-thought. |

## Receita: exemplo de componente após esclarecimento

```json
{
  "recipe_id": "recipe_bife_cavalo",
  "version": 1,
  "servings": 1,
  "status": "CONFIRMED",
  "components": [
    {
      "ingredient_id": "patinho_cru",
      "quantity": "200",
      "unit": "g",
      "measurement_basis": "RAW_EDIBLE",
      "yield_factor": "1.00",
      "source": "owner_confirmed"
    },
    {
      "ingredient_id": "arroz_cru",
      "quantity": "250",
      "unit": "g",
      "measurement_basis": "COOKED_EDIBLE",
      "yield_factor": "2.50",
      "source": "validated_prep_recipe"
    }
  ]
}
```

Esse exemplo mostra somente dois componentes para explicar o contrato. Não é a ficha completa e não pode ser usado para precificar o prato completo omitindo ovo, batata, feijão, óleo, temperos e embalagem.

## RFQ pública mínima

```json
{
  "rfq_id": "rfq_001",
  "buyer_agent_id": "buyer_001",
  "description": "Bife a cavalo com acompanhamentos",
  "servings": 1,
  "required_components": ["bife", "ovo", "arroz", "feijao"],
  "excluded_ingredients": [],
  "delivery_zone_id": "demo_zone_01",
  "delivery_deadline": "2026-09-19T19:15:00Z",
  "substitutions_allowed": false,
  "expires_at": "2026-09-19T18:31:30Z"
}
```

O endereço exato do consumidor pode ser resolvido por um serviço de cotação restrito e liberado ao executor após contratação. A região não basta para prometer frete preciso em produção; antes do aceite, a cotação precisa corresponder ao destino real autorizado. A demo usa uma zona e uma tarifa explicitamente sintéticas.

## Oferta pública e recibo privado

```json
{
  "offer_id": "offer_001",
  "rfq_id": "rfq_001",
  "merchant_agent_id": "merchant_niko",
  "recipe_id": "recipe_bife_cavalo",
  "recipe_version": 1,
  "quantity": 1,
  "currency": "BRL",
  "subtotal_cents": 2792,
  "delivery_cents": 390,
  "buyer_fee_cents": 0,
  "total_cents": 3182,
  "eta_minutes": 25,
  "expires_at": "2026-09-19T18:31:30Z",
  "terms_version": "demo-v1",
  "execution_mode": "SANDBOX",
  "quote_token": "opaque_server_issued_token"
}
```

Internamente, `PricingReceipt` registra custo, policy version, snapshots, taxas, piso, teto, estratégia e decisão. Esse recibo pertence ao restaurante e ao serviço de auditoria autorizado, não ao consumidor. O `quote_token` vincula os valores ao estado autorizado no backend; uma string escrita pelo LLM não cria uma oferta válida.

## Erros e semântica

Formato: `code`, `message`, `retryable`, `correlation_id`, `field_errors`, `safe_details`. Códigos mínimos: `AMBIGUOUS_QUANTITY`, `RECIPE_INCOMPLETE`, `COST_UNAVAILABLE`, `POLICY_INFEASIBLE`, `STOCK_INSUFFICIENT`, `STOCK_COUNT_CONFLICT`, `OFFER_EXPIRED`, `MANDATE_EXPIRED`, `BUDGET_EXCEEDED`, `NO_ELIGIBLE_OFFER`, `UNAUTHORIZED_SCOPE`, `IDEMPOTENCY_CONFLICT`, `PROVIDER_UNAVAILABLE`, `INFERENCE_BUDGET_EXCEEDED` e `FISCAL_SOURCE_UNSUPPORTED`.

Erros públicos não revelam preço piso nem custo. “Não posso atender a esse valor” é permitido; “minha margem mínima é 25% e meu custo é R$ 15” não é a resposta padrão.

<a id="sec-12"></a>

# 12 · APIs, ferramentas e estados transacionais

## Superfície HTTP proposta

Os contratos Pydantic geram OpenAPI e tipos de cliente. Exemplos deste documento são ilustrativos; a implementação precisa materializar schemas testados e rejeitar divergências. Toda mutação exige autenticação e chave de idempotência quando houver efeito persistente.

| Método / rota | Responsabilidade |
|---|---|
| `POST /v1/conversations` | Criar conversa com papel autorizado e escopo. |
| `POST /v1/conversations/{id}/turns` | Processar texto/transcrição e produzir resposta + patches validados. |
| `POST /v1/audio/transcriptions` | Executar adapter de voz; não confirmar dado comercial automaticamente. |
| `POST /v1/restaurants` | Criar rascunho a partir de campos validados. |
| `POST /v1/recipes/{id}/confirmations` | Publicar versão confirmada com `expected_version`. |
| `POST /v1/purchase-documents` | Ingerir fonte fiscal suportada e tratar duplicidade. |
| `POST /v1/stock-counts` | Abrir contagem parcial/total no escopo autorizado. |
| `POST /v1/stock-counts/{id}/confirmations` | Registrar reconciliação auditada. |
| `POST /v1/policies/{id}/confirmations` | Confirmar versão e vigência da política. |
| `POST /v1/mandates` | Criar mandato de compra explicitamente autorizado. |
| `POST /v1/rfqs` | Abrir procura e roteamento automático. |
| `POST /v1/offers` | Publicar somente oferta emitida pelo motor autorizado. |
| `POST /v1/offers/{id}/counteroffers` | Solicitar nova condição, dentro do mandato. |
| `POST /v1/acceptances` | Verificar oferta e reservar recursos atomicamente. |
| `POST /v1/orders/{id}/cancellations` | Cancelar conforme estado/termos; evitar devolução fictícia de insumo consumido. |
| `GET /v1/events` | SSE de eventos filtrados pelo papel; suportar retomada. |
| `GET /healthz` e `GET /readyz` | Saúde do processo e prontidão das dependências. |

As rotas são a especificação proposta, não endpoints já existentes. Operações administrativas de reset/seed devem existir apenas em ambiente de demonstração, protegidas e nunca acessíveis ao LLM.

## Ferramentas por agente

**Byara de onboarding:** propor patch de restaurante/receita, buscar unidade/correspondência de insumo, listar pendências, registrar confirmação vinculada a um turno do dono e consultar política. Não confirmar em nome do humano um campo que ele não confirmou.

**Merchant Agent:** ler apenas seu restaurante, avaliar elegibilidade, solicitar quote determinístico, submeter oferta, processar contraproposta e consultar resultado. Não acessar mandato privado do comprador ou preços pisos de concorrentes.

**Buyer Agent:** ler memória e mandato do comprador, criar RFQ, consultar ofertas, solicitar contraproposta, pedir aceite e informar resultado. Não acessar custos do restaurante ou ampliar mandato.

**Exchange/serviços:** descobrir, rotear, validar contratos, ordenar eventos, aplicar rate limits e coordenar reservas. Não precisam ser LLMs. **Verifier:** serviço determinístico de política, total, prazo, disponibilidade, escopo e idempotência; um LLM pode explicar o resultado, mas não sobrepor a decisão.

## Estados

RFQ: `DRAFT → OPEN → EVALUATING → NEGOTIATING → SELECTED → CLOSED`, com saídas `NO_MATCH`, `EXPIRED` e `CANCELLED`.

Oferta: `ISSUED → ACCEPTED` ou `EXPIRED / WITHDRAWN / REJECTED`. Uma contraproposta produz uma oferta nova, ligada à anterior; não modifica valores retroativamente.

Pedido: `RESERVED → PAYMENT_PENDING → CONFIRMED → PREPARING → READY → FULFILLED`. Falhas e cancelamentos têm transições específicas. Em sandbox, cada evento de pagamento/entrega deve indicar sua natureza simulada. O protótipo pode encerrar em `CONFIRMED`; não simular entrega sem rotulá-la.

## Reserva e concorrência

No aceite, bloquear ou atualizar condicionalmente mandato, saldo disponível, capacidade e oferta; verificar expiração; reservar o total exato; inserir pedido; marcar oferta aceita e publicar evento na outbox na mesma transação local. Adotar ordem estável de locks para reduzir deadlocks. PostgreSQL oferece bloqueios de linha para coordenar operações concorrentes; a estratégia concreta deve ter testes. [S14]

RFQs paralelas do mesmo comprador devem consumir o mesmo controle de orçamento, e não cópias isoladas. A mesma oferta não pode ser aceita duas vezes. Uma repetição com a mesma chave e mesmo corpo retorna o resultado anterior; a mesma chave com corpo diferente retorna conflito.

Pagamentos externos não são atomicamente confirmados junto ao banco local. No piloto, usar máquina de estados/saga, webhooks idempotentes, expiração e reconciliação. Timeout não é prova de falha: consultar estado antes de reenviar uma cobrança. Essa integração permanece pendente de escolha e homologação do provedor.

<a id="sec-13"></a>

# 13 · NeuraLake, memória e eficiência de inferência

## O que foi verificado na documentação pública

A página oficial apresenta endpoint compatível com chat completions, base `https://api.neuralake.cloud/v1`, seleção por capacidades e `model="auto"`. Descreve Cross Memory como continuidade do estado da tarefa entre trocas de modelos. Isso não comprova, por si só, contratos de áudio, isolamento por tenant, retenção, structured output ou campos de sessão disponíveis para o time. Confirmar esses pontos com o suporte do evento e smoke tests. [S04–S05]

```dotenv
# Exemplo de configuração; nunca colocar a chave real no repositório.
NEURALAKE_BASE_URL=https://api.neuralake.cloud/v1
NEURALAKE_API_KEY=<secret>
NEURALAKE_MODEL=auto
CROSS_MEMORY_ENABLED=false
EXECUTION_MODE=sandbox
```

`CROSS_MEMORY_ENABLED` só deve ser ativado depois de validar contrato, escopo, isolamento e recuperação. Não inventar headers, parâmetros `memory_id` ou SDKs inexistentes. Manter `provider_capabilities.json` com recurso, teste executado, resultado, data e limitações.

## Adapter e critérios de prontidão

A interface interna proposta é `complete(messages, schema, context_ref, limits) → ValidatedModelResult`. `schema` e `context_ref` são conceitos internos; o adapter decide como mapeá-los para recursos efetivamente suportados. A API do fornecedor não deve ser inferida a partir da assinatura interna.

Smoke tests obrigatórios: autenticação; uma resposta em português; timeout e erro; streaming utilizado pela UI; extração de receita com ambiguidade; contagem de tokens; campos de cobrança/modelo retornados; comportamento de uma nova sessão; isolamento entre restaurante A, restaurante B e comprador; continuidade de contexto quando Cross Memory for habilitada.

Se não houver structured output nativo, validar saída estruturada no servidor e permitir uma tentativa limitada de reparo. Persistir dados só após validação. Não fazer parsing permissivo que converta texto defeituoso em uma política de preço.

## Memória privada

Separar memória de preferências do comprador, conhecimento operacional do restaurante, estado da conversa e transcript público mínimo da transação. Cross Memory não significa “um contexto global para todos os agentes”. Somente tarefas do mesmo principal e finalidade compatível podem compartilhar contexto autorizado.

O banco mantém dados canônicos; a memória fornece contexto resumido e referências a versões. Um resumo antigo não pode restaurar uma política revogada nem superar saldo atual. Preferências do usuário são revisáveis e expiram conforme configuração; dados de saúde não devem ser coletados sem necessidade.

## Limites e métricas

Definir máximos por fluxo: chamadas, tokens, duração, rodadas e custo estimado. Valores iniciais propostos para ensaio: até 12 chamadas de LLM por jornada comercial, até 2 reparos no total, timeout por chamada e teto de custo configurável. O onboarding é medido separadamente; não esconder seu custo para melhorar o indicador do mercado.

Se o fornecedor não expuser custo real, registrar tokens conhecidos e estimar com tabela tarifária identificada e datada; rotular **estimado**. Se nem os tokens estiverem disponíveis, usar `null`, não zero. Separar valores em BRL de alimentação, custo de voz, custo de inferência e serviços externos.

Comparar eficiência apenas mantendo cenário e critérios de sucesso: histórico completo versus resumo/contexto autorizado; uso de LLM em todas as etapas versus domínio determinístico. Não reutilizar percentuais de marketing do provedor como resultados da i.byara.

<a id="sec-14"></a>

# 14 · Segurança, privacidade e operação responsável

## Mandatos, papéis e revogação

A compra automática exige mandato válido com titular, total máximo, prazo, categorias/restrições, destino autorizado e limite de utilizações. O humano pode revogar; o serviço deve verificar revogação no momento do aceite. “Escolha algo para mim” sem autorização de compra não basta para executar pagamento real.

No restaurante, separar dono/administrador, operador de estoque e agente comercial. O operador pode informar contagem sem alterar margem; o agente pode oferecer preço sem modificar a política confirmada. Definir credenciais de demo e isolamento real desde o primeiro teste; “é só hackathon” não justifica expor chaves.

## Superfícies hostis

Notas, links, textos de consumidores, receitas importadas e mensagens de outros agentes podem conter instruções maliciosas. Interpretá-los como dados; aplicar lista de ferramentas por papel, validação de schema, filtros de saída e controles no domínio. Não pedir ao modelo que “seja seguro” como única defesa.

QR/link fiscal: aceitar esquemas e domínios permitidos; bloquear endereços internos, loopback e metadata; validar DNS e cada redirect; limitar tempo e tamanho; isolar parsing; não executar conteúdo remoto. Não contornar captcha, autenticação ou restrições de acesso. Logs não devem conter documento fiscal completo ou identificadores pessoais desnecessários.

A UI de auditoria deve mostrar `reason_codes`, referências e fatos de entrada relevantes. Não registrar prompts privados ou raciocínio interno integral em um painel público. Uma explicação gerada pelo LLM não é evidência se contradiz o recibo determinístico.

## Dados pessoais e revisão jurídica

A LGPD distingue dados pessoais sensíveis, estabelece princípios como necessidade e segurança e prevê direitos relacionados a decisões automatizadas. A adequação concreta depende das finalidades, papéis e operações do produto; este guia define requisitos de engenharia, não uma certificação jurídica. [S15]

Antes do piloto, definir controlador/operador, bases legais, retenção, acesso, exclusão, portabilidade, subprocessadores e transferências pertinentes com revisão especializada. Alergias e outras informações de saúde exigem tratamento específico. Não usar um aceite genérico como justificativa para qualquer processamento.

No repositório, usar somente fixtures fictícias ou devidamente anonimizadas. O nome/endereço do roteiro são dados de demo informados pela equipe; não enriquecer esse cadastro com informações de pessoas reais sem necessidade. Separar dados públicos do restaurante e informações privadas do dono.

## Alimentos e risco operacional

Preço baixo nunca torna um item inelegível seguro. O sistema deve bloquear lotes marcados como impróprios, vencidos ou sem a confirmação operacional exigida. LLM não verifica conservação nem certifica ausência de alergênicos. “Temos sobras” significa um evento a esclarecer, não autorização automática de revenda.

Restrições críticas alimentares exigem informação verificável do restaurante. “Não contém ingrediente X na receita” não comprova ausência de contaminação cruzada. O piloto precisa de validação sanitária aplicável e processo humano responsável; este guia não estabelece parâmetros clínicos ou prazos sanitários universais.

## Acordos comerciais a preparar antes de produção — PENDENTE

Termos do restaurante: mandato de representação, responsabilidade pelos dados e preparo, composição dos preços, limites autorizados, repasse, cancelamento, indisponibilidade e contestação. Termos do consumidor: escopo da compra delegada, total, substituições, prazo, reembolso, revisão e revogação. Acordos com pagamento/logística: estados, responsabilidades, evidências e reconciliação. Política de privacidade: finalidades e tratamento real, não texto genérico.

Este documento não contém contratos jurídicos prontos para assinatura. Os contratos aqui especificados são principalmente contratos técnicos e operacionais; minutas comerciais precisam da definição do modelo de negócio e revisão competente.

<a id="sec-15"></a>

# 15 · Testes de aceite e evidências

## Matriz de rastreabilidade

Nenhum ticket é concluído somente porque a tela está pronta ou o LLM respondeu. Vincular requisito, teste, evidência e commit. Os testes abaixo são especificação a implementar, não resultados já obtidos.

| Teste | Cenário | Resultado exigido |
|---|---|---|
| AT-01 | Cadastro com a fala inicial do pitch | Nome e endereço corretos em rascunho; pergunta pelo primeiro prato. |
| AT-02 | “Dois bifes” sem peso | Pergunta pelo peso/base; não inventa massa. |
| AT-03 | 250 g de arroz pronto | Usa rendimento confirmado ou mantém pendência; não custa como 250 g crus. |
| AT-04 | Correção posterior da receita | Nova versão, sem alterar pedidos e ofertas anteriores. |
| AT-05 | Mesma nota importada duas vezes | Uma compra/entrada, resposta idempotente. |
| AT-06 | Nota emitida mas não recebida | Não aumenta disponibilidade sem política/recebimento válido. |
| AT-07 | Preço no caso de referência | Piso analítico 2308; piso efetivo 2618; oferta de excedente 2792 centavos. |
| AT-08 | Contraproposta de 2500 centavos | Recusa por piso comercial; não aumenta desconto por insistência. |
| AT-09 | Contraproposta de 2700 centavos | Elegível no cenário; contribuição 930 centavos. |
| AT-10 | Frete faz total exceder o mandato | Oferta eliminada antes da seleção/compra. |
| AT-11 | Duas compras disputam a última porção | Só uma reserva bem-sucedida; saldo não negativo. |
| AT-12 | RFQs simultâneas do mesmo comprador | Soma de comprometimentos não ultrapassa o mandato. |
| AT-13 | Retry de aceite e de webhook | Um pedido e um efeito financeiro/contábil. |
| AT-14 | Preço é adulterado no frontend | Backend rejeita ou usa apenas o quote imutável válido. |
| AT-15 | Contagem informa só frango | Apenas frango é reconciliado; demais itens preservados. |
| AT-16 | Contagem antiga ou inferior a reservas | Reconciliação temporal correta ou conflito explícito. |
| AT-17 | Rotina a cada três dias | Próxima ocorrência persistida e disparo único pelo relógio de teste. |
| AT-18 | Item pronto foi produzido de matéria-prima | Venda não baixa a matéria-prima pela segunda vez. |
| AT-19 | Oferta fora do prazo ou sem estoque | Recusada; não aparece como pedido confirmado. |
| AT-20 | Prompt malicioso em nota/cardápio | Não altera limites, identidade ou ferramentas autorizadas. |
| AT-21 | Merchant A tenta ler Merchant B | Acesso negado independentemente do texto do prompt. |
| AT-22 | Telemetria sem token/custo disponível | Exibe desconhecido/estimado, nunca um número fabricado. |
| AT-23 | Nenhuma oferta compatível | `NO_ELIGIBLE_OFFER`; nada é comprado. |
| AT-24 | Falha de voz/rede | Estado preservado e contingência identificada; não simula conversa ao vivo. |
| AT-25 | LLM varia a redação/seed | Mesmos dados e política produzem o mesmo preço no motor. |
| AT-26 | Mandato revogado antes do aceite | Transação bloqueada, sem ampliação tácita de autoridade. |

## Testes de propriedade

Para todas as combinações válidas: total = subtotal + entrega + taxa do comprador; contribuição satisfaz o piso; valor emitido pertence ao intervalo permitido; nenhuma taxa pode ficar negativa; estoque reservado não excede disponibilidade; consumo ocorre no máximo uma vez por referência; toda decisão financeira referencia uma política e um snapshot; nenhuma resposta pública contém campos privados.

Testar bordas de arredondamento, margem + taxas igual ou superior a 100%, rendimento zero/negativo, unidade incompatível, expiração exatamente no instante do aceite, timezone ausente e contagem concorrente. Não depender somente de exemplos felizes.

## Critérios não funcionais propostos

Metas de ensaio, não garantias: jornada comercial em até 20 segundos no ambiente de demo; resposta conversacional perceptível em até 4 segundos quando a infraestrutura permitir; dez repetições consecutivas sem intervenção técnica; retomada de sessão após refresh; nenhuma chave no bundle web; nenhuma mensagem financeira sem correlação.

Medir os tempos reais e ajustar a duração do pitch. Se a meta não for atingida, registrar resultado e plano; não trocar o relógio da UI por um tempo fictício. O painel deve distinguir chamada de LLM, decisão determinística e mensagem A2A, sem inflar “autonomia” contando cada linha de código.

## Pacote de evidências

Gerar logs redigidos, relatório de testes, vídeo de jornada, matriz de recursos reais versus simulados, versão do cenário, hash/identificador do commit e captura dos recursos efetivamente utilizados no provedor. Esse pacote documenta a execução; screenshots isolados não provam negociação nem isolamento.

<a id="sec-16"></a>

# 16 · Cenário canônico da demonstração

## Massa de dados

Um tenant do restaurante Niko será cadastrado ao vivo. Dois outros restaurantes de teste têm capacidades e dados sintéticos separados. Um comprador tem preferência por refeição brasileira, prazo e um mandato de **R$ 35,00 no total** para uma compra. Esses parâmetros pertencem ao cenário, não ao produto universal.

O Niko usa a ficha completa e os custos da seção 08. Seu estoque inicial, lotes e condições de elegibilidade vêm de fixture identificada, exceto os dados explicitamente coletados ao vivo. Concorrentes devem ter seus próprios custos e políticas; suas ofertas são calculadas, não retornadas como respostas hardcoded só para perder.

O cenário precisa ser reinicializável por comando de operador fora do fluxo do agente. Reset não pode ocorrer por endpoint público nem apagar evidências do ensaio sem autorização.

## Transação de referência

| Etapa | Saída esperada no cenário |
|---|---|
| Onboarding | Nome/endereço, receita e esclarecimento de “dois bifes”. |
| Custo | Ficha completa gera K de R$ 15,00; piso efetivo R$ 26,18. |
| Estado de excedente | Estoque elegível de patinho habilita desconto de 20% pela regra do cenário. |
| Oferta inicial Niko | Subtotal R$ 27,92; entrega R$ 3,90; total R$ 31,82. |
| Contraproposta | Buyer solicita subtotal R$ 27,00 mantendo composição e entrega. |
| Resposta do motor | Aceita R$ 27,00; total R$ 30,90; contribuição R$ 9,30. |
| Aceite | Reserva componentes, capacidade e R$ 30,90 do mandato. |
| Sandbox | Pedido confirmado em sandbox; nada é debitado de uma conta real. |
| Estoque | Aceite aumenta reservado; consumo só aparece quando iniciar preparo. |

O vencedor é resultado do ranking e do estado, não uma constante escondida. Configurar cenários alternativos: concorrente ganha por menor total; Niko recusa por estoque; teto privado impede a compra; oferta expira. O cenário principal pode favorecer o Niko por condições explicitamente configuradas, mas a lógica precisa continuar funcionando quando elas mudarem.

## Demonstração de causalidade operacional

A mesma RFQ com dados e política iguais deve produzir o mesmo resultado de preço. Ao alterar uma contagem/excedente confirmado, o snapshot muda e a oferta pode mudar. Mostrar essa diferença é mais convincente do que uma lista de agentes trocando mensagens sem efeito sobre o pedido.

No painel do dono, mostrar o saldo contado e o ajuste. No painel do comprador, mostrar apenas oferta e motivos permitidos. Na visão pública, não exibir preço piso nem limite máximo privado.

## Inventário de realidade

Antes de cada ensaio, preencher:

```text
Conversa LLM: real / indisponível
Voz: provedor ou recurso utilizado / texto de contingência
Fiscal: conector ao vivo / documento de fixture identificado
Preços e reservas: código real / teste falhou
Restaurantes e custos: dados sintéticos de demonstração
Pagamento: sandbox
Entrega: não executada / simulada explicitamente
Cross Memory: validada e usada / não usada
Tokens: retornados / estimados / indisponíveis
Custo: medido / estimado com tabela / indisponível
```

Uma integração indisponível não invalida todo o projeto, mas limita o que se pode afirmar que a demonstração comprovou.

<a id="sec-17"></a>

# 17 · Pitch: abrir com funcionamento, não com promessa

## Roteiro de quatro minutos — PROPOSTA

O briefing informa pitches de quatro minutos e dá peso relevante à execução ao vivo. A ordem abaixo preserva a abertura exigida por Cristiano. Cronometrar com a latência real; um segundo prato é opcional no palco, não uma justificativa para retirar suporte a múltiplos pratos do sistema. [S03, pp. 2 e 11]

| Tempo | Cena | Evidência |
|---|---|---|
| 0:00–0:55 | Cadastro conversacional direto e primeiro prato | Extração, pergunta de esclarecimento e ficha sendo construída. |
| 0:55–1:15 | Transição e problema | Menos cadastro manual; informações da cozinha alimentam a negociação. |
| 1:15–2:35 | Intenção do consumidor, propostas e contraproposta | Buyer e Merchant Agents atuando com mandatos diferentes. |
| 2:35–3:10 | Política, excedente e reserva | Preço calculado, margem protegida e pedido sandbox consistente. |
| 3:10–3:40 | Por que é A2A e como limita risco/custo | Memória privada, APIs, motor determinístico e telemetria real. |
| 3:40–4:00 | Encerramento | Tese, próximo teste de negócio e assinatura. |

## Primeira fala — literal

> “Byara, quero cadastrar meu restaurante na plataforma. O nome dele é Marmita Quentinha do Seu Niko. Estamos localizados na Avenida Corifeu de Azevedo Marques, 488.”

Não abrir com apresentação dos integrantes, definição de IA ou slide de mercado. A resposta da Byara deve iniciar a conversa de cadastro. Em seguida, o apresentador fornece o prato, responde ao peso dos bifes e esclarece a base dos acompanhamentos.

Frase de transição definida pela equipe: **“E assim será o cadastro de qualquer restaurante na nossa plataforma.”** Para não prometer automação universal de qualquer documento ou cozinha, complementar: “A Byara pergunta o que falta, confirma a ficha e usa esses dados na operação.” Não retirar a frase original do roteiro sem autorização.

## Texto proposto para a tese

“Agora o dono não precisa definir cada negociação. Ele define o objetivo e os limites. O agente do restaurante consulta custo, estoque e capacidade. Do outro lado, o agente do cliente conhece o que ele quer e quanto está autorizado a gastar. Eles negociam entre si; os cálculos e os limites são determinísticos.”

“Na i.byara, quem decide a transação deixa de ser a interface de delivery e passa a ser o par de agentes. Cada agente preserva as informações privadas de quem representa. O mercado recebe só o que precisa para executar o acordo.”

Encerramento proposto: **“You describe your kitchen. Your agent runs your commerce.”**

## Como não encenar uma capacidade inexistente

Se preços aparecerem antes do onboarding completo, exibir “custos de cenário já carregados” ou “ficha ainda em rascunho”, conforme o caso. Não omitir perguntas críticas apenas para a IA parecer onisciente. Preparos auxiliares e notas pré-carregadas podem acelerar o palco, desde que essa condição seja identificada.

Vídeo de contingência é permitido como contingência, não como substituto disfarçado do ao vivo. Texto digitado é uma modalidade oficial, não uma falha conceitual do produto. A gravação de 60 segundos pedida no briefing deve estar pronta independentemente da apresentação. [S03, p. 12]

## Perguntas difíceis da banca

**“Isso é só um chatbot?”** A conversa produz dados estruturados; os agentes têm identidades, mandatos e ferramentas separadas; a negociação termina em reserva e pedido verificáveis, não em uma recomendação de texto.

**“O LLM escolhe preços?”** Não. Um motor determinístico calcula preços e elegibilidade; os agentes solicitam, interpretam e comunicam os resultados.

**“Como sabem o estoque real?”** Compras e receitas mantêm um saldo teórico; contagens conversacionais escolhidas pelo dono reconciliam o físico. Não se promete inventário físico perfeito sem contagem.

**“E os descontos, sempre fazem bem?”** Não. O agente pode recusar uma venda. O piso protege contribuição definida, e redução de perda é uma hipótese a medir.

**“Quem entrega ou cobra?”** A demo usa sandbox. A arquitetura prevê adapters; pagamentos e logística reais exigem integração homologada. Não afirmar que existe uma operação de delivery completa quando ela não foi construída.

<a id="sec-18"></a>

# 18 · Aderência ao hackathon e ponto de atenção

## Critérios documentados

| Critério do briefing | Peso | Evidência que a i.byara deve apresentar |
|---|---|---|
| Autonomia A2A | 30% | Agentes com mandatos distintos descobrem, propõem, negociam e aceitam sem seleção manual intermediária. |
| Demo funcionando | 25% | Jornada executável ao vivo, dados persistidos e pedido em sandbox. |
| Eficiência por token | 15% | Domínio determinístico, limites de chamadas e uso verificado da infraestrutura. |
| Valor de negócio | 15% | Hipóteses claras para consumidor e restaurante, com próximo experimento definido. |
| Pitch e clareza | 10% | Abertura funcionando, transação compreensível e limites honestos. |
| Confiança e explicabilidade | 5% | Mandatos, validação, razão estruturada, logs e bloqueios. |

Pesos retirados do briefing, não uma pontuação atribuída ao projeto. O texto também indica desempate pelo grau de autonomia A2A. [S03, p. 11]

## Correção necessária sobre a trilha 04

A sugestão anterior de enquadrar automaticamente o produto na trilha **Agent-First Product** ignorava uma tensão literal: a página 9 pede ausência de dashboards, formulários ou onboarding para humanos e que o humano não toque na interface depois de definir o objetivo. A abertura conversacional de cadastro é requisito confirmado do produto e não deve ser removida para caber nessa sugestão. [S03, p. 9]

**PENDENTE:** solicitar aos mentores uma interpretação explícita sobre cadastro conversacional como configuração inicial de dados/política. Se não admitirem esse enquadramento, a trilha **The Autonomous Business**, que permite humanos definirem o objetivo e agentes executarem o fluxo de negócio, é uma alternativa a avaliar. A escolha final é da equipe; este guia não muda a trilha nem o produto. [S03, p. 6]

A trilha **Agent Marketplace** descreve contratação de outros agentes para capacidades que faltam, e a trilha **Agent-to-Agent Economy** enfatiza orçamento de serviços/inferência. Negociar refeições por si só não demonstra integralmente essas exigências. Não afirmar aderência perfeita a todas as trilhas apenas por haver vários agentes. [S03, pp. 7–8]

## Prazo e entregáveis do documento-base

O cronograma do briefing registra code freeze em **20/09 às 11h**, com repositório, vídeo de 60 segundos e short deck; também mostra envio final de GitHub às **12h30** e demoday às **13h30**. Confirmar a orientação operacional final no evento em caso de atualização. Este guia usa 11h como limite conservador de construção. [S03, p. 12]

O local informado pela equipe é inovabra. A identidade i.byara não deve apresentar logos, endosso ou vínculo institucional com sede, banco ou fornecedor sem autorização. As referências a patrocinadores no briefing não equivalem a parceria comercial do projeto.

<a id="sec-19"></a>

# 19 · Plano de entrega e roadmap

## Plano de construção até o freeze — PROPOSTA

Tomar o horário de elaboração, 19/09 às 15h em São Paulo, como referência de planejamento; não como declaração de progresso já realizado. Se esse horário tiver passado quando a equipe adotar o documento, replanejar a partir do tempo restante, preservando o fluxo principal.

| Marco | Resultado necessário | Gate |
|---|---|---|
| M0 / primeira hora | Resolver trilha, fechar contratos, testar API/voz e criar cenário | Um smoke test e uma decisão de interfaces registrados. |
| M1 / próximas 2–3 h | Domínio de custo/estoque + UI conversacional vertical | Uma receita com pergunta de ambiguidade e preço calculado. |
| M2 / restante da noite | Agentes, Exchange, negociação e reserva | Uma transação completa em sandbox, sem escolher vencedor manualmente. |
| M3 / antes do ensaio da manhã | Contagem, periodicidade, QR suportado e falhas | Atualização operacional muda proposta; modos reais/simulados claros. |
| M4 / 20/09, até 09h30 | Testes críticos, ensaios e gravação de contingência | Dez execuções, relatório de falhas e pitch cronometrado. |
| M5 / 09h30–10h30 | Estabilização e pacote final | Sem novas features; commit e evidências congelados internamente. |
| M6 / até 11h | Entrega conforme instrução final do evento | Repositório, vídeo de 60 s, short deck e documentação. |

Não gastar a primeira metade do tempo criando uma interface extensa desconectada dos contratos. Fazer primeiro uma linha vertical: fala → receita → custo → oferta → pedido. Expandir depois, mantendo dados e eventos reais.

## Cinco frentes paralelas sugeridas

| Frente | Responsabilidade | Interface de saída |
|---|---|---|
| A / experiência e produto | Conversa, voz, identidade, abertura do pitch | Conversation API e componentes de estado. |
| B / economia | Custos, política, preços e testes numéricos | Pricing Engine + PricingReceipt. |
| C / operação | Compras, itens, lotes, contagens, reservas | Inventory Service e eventos. |
| D / agentes e integração | Adapter NeuraLake, Buyer/Merchant, Exchange | Contratos A2A e tracing. |
| E / integração e qualidade | Banco, E2E, CI, evidências e pacote de demo | Jornada reproduzível e gates. |

Papéis, não atribuições pessoais já decididas. Uma pessoa integra os contratos e resolve conflitos; cada frente tem propriedade de arquivos definida antes do trabalho paralelo. Integração contínua desde M1, não merge de cinco projetos no último momento.

## Backlog inicial

| Ticket | Dependência | Entrega verificável |
|---|---|---|
| IBY-001 | Nenhuma | ADRs iniciais, monorepo, lockfiles, banco e configuração. |
| IBY-002 | 001 | Modelos de domínio, Money/Quantity e schema de mensagens. |
| IBY-003 | 002 | Motor de custo/preço e caso numérico da seção 08. |
| IBY-004 | 002 | Ledger, reservas, produção e contagem parcial. |
| IBY-005 | 001–002 | Adapter NeuraLake, capabilities e isolamento de contexto. |
| IBY-006 | 002, 005 | Onboarding conversacional com patches e confirmação. |
| IBY-007 | 006 | Voz e experiência visual com contingência de texto. |
| IBY-008 | 002, 004 | Ingestão fiscal de uma fonte, deduplicação e recebimento. |
| IBY-009 | 003–005 | Merchant Agent, Buyer Agent e descoberta. |
| IBY-010 | 009 | RFQ, ofertas, contrapropostas e ranking. |
| IBY-011 | 004, 010 | Mandato, aceite atômico e pedido sandbox. |
| IBY-012 | 004, 006 | Rotina configurável de inventário e disparo testável. |
| IBY-013 | 005, 011 | Eventos SSE, telemetria e redação de dados privados. |
| IBY-014 | 007–013 | Testes ponta a ponta, concorrência e segurança. |
| IBY-015 | 014 | Pitch, vídeo, short deck, evidências e release. |

## Após o hackathon — condicionado à validação

**Piloto supervisionado:** operar com restaurantes voluntários, medir completude de fichas, esforço de correção, cobertura fiscal, divergência de inventário, cumprimento de ofertas e contribuição. Homologar fluxo financeiro e logística antes de cobrar ou prometer entrega real.

**Operação ampliada:** integrar PDV e múltiplas fontes, endurecer scheduler, observabilidade, recuperação, multi-tenant e suporte. Só adicionar previsão de demanda após obter dados e baseline de regras para comparação.

**Interoperabilidade:** abrir contratos a agentes externos, implementar protocolo padronizado quando necessário e testar autenticação federada/escopos. Capacidades nutricionais, novas categorias e modelos de monetização entram mediante aprovação e avaliação própria.

<a id="sec-20"></a>

# 20 · Repositório e desenvolvimento agêntico

## Estrutura proposta

```text
ibyara/
  AGENTS.md
  README.md
  .env.example
  compose.yaml
  docs/
    IBYARA_GUIDE.md
    IBYARA_GUIDE.pdf
    decisions/
    evidence/
  apps/
    web/
    api/
      domain/
        costing/
        pricing/
        inventory/
        commerce/
      agents/
        onboarding/
        buyer/
        merchant/
      adapters/
        neuralake/
        voice/
        fiscal/
        execution/
      contracts/
      infrastructure/
  tests/
    unit/
    contract/
    integration/
    e2e/
  fixtures/
    demo_v1/
  scripts/
```

A árvore é uma proposta, não uma descrição de arquivos já criados. O guia deve entrar em `docs/IBYARA_GUIDE.md`; o time pode adotar outra estrutura por ADR, preservando limites e testes. O PDF é documentação, não a fonte de contratos executáveis.

## Regras para agentes de desenvolvimento

Todo agente deve ler esta baseline e o ticket antes de alterar código. Deve explicitar dependências, arquivos afetados, contrato, critérios de aceite e possíveis mudanças de comportamento. Não inventar estado atual do repositório, comando que não executou ou resultado de teste.

Não mudar produto, marca, onboarding conversacional, privacidade, piso de margem, autorização de compra, quantidade de porção ou política de dados sob pretexto de “simplificar”. Otimizações sem alteração de comportamento podem ser propostas com teste de equivalência; mudanças de comportamento exigem decisão.

Paralelizar por fronteira de módulo. Contratos compartilhados têm um responsável; mudanças precisam de compatibilidade ou bump de versão. Não permitir que dois agentes regenerem interfaces conflitantes silenciosamente. Cada branch ou worktree deve ter escopo e dependências registrados.

## Bloco para o futuro AGENTS.md

```text
# i.byara — instruções obrigatórias

Leia docs/IBYARA_GUIDE.md e o ticket antes de editar.
Prioridade: requisitos confirmados > contratos > implementação.
Não altere produto ou marca sem aprovação registrada.

Preços e dinheiro: motores determinísticos; nunca LLM/float.
Receitas: preserve unidades, base cru/pronto e rendimento.
Ambiguidade: pergunte ou mantenha pendência; não invente.
Privacidade: escopo por principal; não publique custos ou teto privado.
Comércio: mandato, total integral, validade e reserva idempotente.
Estoque: eventos; contagem parcial não zera itens omitidos.
LLM: patches e tools permitidas, sem escrita arbitrária no banco.
Mocks: somente fixtures de teste/demo, identificadas como tal.

Antes do PR: rode testes afetados e registre comandos/resultados.
Não declare teste executado se apenas escreveu o arquivo.
Atualize contratos/docs/ADRs quando houver alteração autorizada.
Entregue: resumo, arquivos, evidências, limitações e próximo bloqueio.
Nunca inclua chaves, documentos fiscais reais ou dados pessoais em fixtures.
```

## Definition of done de um ticket

Código integrado, contrato compatível, testes relevantes executados, eventos úteis à auditoria, erros tratados, documentação atualizada, dependências fixadas e nenhuma pendência de segurança encoberta. Quando um teste não puder ser executado, marcar `NOT_RUN` com motivo; não converter ausência de execução em aprovação.

O CI deve cobrir lint, tipos, testes de domínio/contratos, build web e teste E2E com adapters de teste. Manter smoke test separado para infraestrutura real, sem vazar segredo nem exigir saldo pago em todo PR. O teste de integração real não deve ser substituído por mocks no relatório de demo.

## Controle de mudança

Formato de ADR: problema, fonte do requisito, opções, decisão, consequências, restrições, aprovador, data e testes afetados. Mudanças propostas ficam `PROPOSED`; só usar `ACCEPTED` com decisão real. Não preencher nomes de aprovadores automaticamente.

ADRs iniciais sugeridos: 001 monólito modular; 002 contratos de dinheiro e rendimento; 003 protocolo interno e fronteiras A2A; 004 ingestão fiscal e recebimento; 005 memória por principal; 006 estratégia de voz; 007 semântica de reserva/consumo; 008 trilha e interpretação do onboarding.

<a id="sec-21"></a>

# 21 · Riscos, pendências e validação de negócio

## Pendências que não devem ser escondidas

| ID | Questão | Ação / responsável sugerido |
|---|---|---|
| OPEN-01 | A trilha 04 admite o onboarding conversacional solicitado? | Mentores + responsável por produto; obter interpretação explícita. |
| OPEN-02 | Que recursos de NeuraLake estão disponíveis na conta do time? | Frente D; smoke tests e capabilities verificadas. |
| OPEN-03 | Qual solução de voz funciona no local e no navegador da demo? | Frente A; medir antes de prometer full-duplex. |
| OPEN-04 | Qual fonte fiscal será realmente suportada? | Frente C; testar um documento autorizado e registrar limites. |
| OPEN-05 | Qual política numérica será usada no produto real? | Dono/operador + produto; fixture não é política universal. |
| OPEN-06 | Quem executa entrega e pagamento no piloto? | Produto/operação; homologação antes de sair do sandbox. |
| OPEN-07 | Como lidar com itens prontos sem origem/custo confirmado? | Operação + domínio; impedir comercialização automática até conciliar. |
| OPEN-08 | Qual é a etimologia comprovada e disponibilidade da marca? | Fundadores + especialistas adequados; não afirmar validação já feita. |
| OPEN-09 | Qual modelo de receita e quais taxas? | Fundadores; hipótese, ainda sem valores aprovados. |
| OPEN-10 | Quais termos, responsabilidades e dados sensíveis serão necessários? | Produto + revisão jurídica e operacional do piloto. |

## Riscos e respostas

Dependência fiscal: adaptadores, timeout e modo de contingência identificado. Ambiguidade culinária: perguntas e dados de preparo confirmados. Margem errada: fórmula explícita e testes de arredondamento. Venda sem estoque: reserva transacional. Contexto cruzado: ferramentas e memória por principal. Alimento inelegível: bloqueio anterior ao pricing. Voz instável: ensaio no ambiente e texto oficial. Excesso de escopo: linha vertical e congelamento de features, sem eliminar requisitos unilateralmente.

## Hipóteses comerciais — não decisões aprovadas

O produto pode gerar valor de gestão para restaurantes e valor transacional para consumidores. Assinatura de gestão, taxa por transação ou combinação são hipóteses; não fixar uma comissão neste guia. Antes de escolher, medir custo de inferência/voz, suporte, pagamentos, logística e disposição a pagar em pilotos reais.

O problema de aquisição bilateral permanece: agentes não criam oferta, confiança ou demanda automaticamente. O módulo de restaurante pode ter valor antes de um marketplace líquido, mas transformá-lo no único produto seria mudança de estratégia que exige autorização.

Não apresentar “sem intermediários”, “sem taxas” ou “acima de todas as plataformas” como fatos. A i.byara também é uma infraestrutura intermediária e precisa de um modelo de operação. O diferencial proposto é a negociação delegada, alimentada por dados operacionais, com contratos executáveis.

## Métricas de validação

Tempo e número de correções para completar uma ficha; percentual de insumos com custo confirmado; notas suportadas/importadas sem intervenção; divergência teórico versus físico; proporção de RFQs elegíveis e concluídas; contribuição por pedido segundo o modelo declarado; cancelamentos por falta de estoque; custo total de automação por pedido; tempo poupado reportado; satisfação e recompra.

Redução de desperdício exige comparação com uma referência coerente e perdas observadas, não apenas queda no estoque. Economia do consumidor deve usar oferta comparável no mesmo momento, composição e taxas; não comparar preço com frete contra preço sem frete.

## Critério para seguir

Continuar depois da demo quando restaurantes consigam manter dados com esforço aceitável, o sistema preserve limites e compradores recebam ofertas executáveis. Não confundir uma demonstração bem executada com validação comercial concluída.

<a id="sec-22"></a>

# 22 · Referências, evidência e histórico

## Fontes da especificação

As decisões do produto derivam da conversa e das correções finais, não de pesquisa de mercado. Fontes externas sustentam somente as capacidades, limitações e referências técnicas indicadas. Consulta pública realizada em 19/09/2026. Links e documentação podem mudar; registrar as versões efetivamente utilizadas na implementação.

**[S01] Equipe i.byara / Cristiano.** Mensagens de concepção e correções finais nesta conversa, em 19/09/2026. Fonte dos requisitos congelados, nome, assinatura e fala de abertura. Não é pesquisa independente sobre demanda, marca ou localização do restaurante.

**[S02] Áudio da discussão da equipe.** Arquivo `audio.mp3.mp3`, fornecido nesta conversa. A transcrição disponível fundamenta a intenção de competir por pedidos, reduzir trabalho de ficha técnica e usar compras/estoque na negociação. Correções finais em [S01] prevalecem sobre hipóteses da discussão. Não atribuir falas a pessoas específicas sem identificação confirmada.

**[S03] NeuraLake.** `2026.09.19 NeuraLake_Launch_Hackathon_Challenges_vfinal (PT).pdf`, fornecido pela equipe. Páginas 3–4: tese; 6–10: desafios; 11: pesos; 12: cronograma. Documento do evento, sujeito a orientação operacional atualizada dos organizadores.

**[S04] NeuraLake — página oficial.** Compatibilidade da API e descrição de capacidades. Fonte: `https://www.neuralake.com.br/`. Não utilizar alegações promocionais de desempenho como benchmark da i.byara.

**[S05] NeuraLake — API.** Base URL, capacidades, `auto` e descrição de Cross Memory. Fonte: `https://www.neuralake.com.br/api`. Falta validar o contrato operacional completo e recursos habilitados para a conta do time.

**[S06] Secretaria da Fazenda de São Paulo — consulta pública de NFC-e em homologação.** Exemplo público de consulta por QR Code com linhas de itens, quantidades e valores. Fonte: [consulta por QR em homologação](https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35201256794084001109658870000016481000922883%7C2%7C2%7C1%7C4F949DC82C6CE5930849A9B8F0E96AC35936B9C2). Ambientes e exemplos de homologação não têm validade fiscal e não representam todos os emissores.

**[S07] Secretaria da Fazenda de São Paulo — consulta por chave.** A interface consultada solicita chave e caracteres de imagem. Fonte: `https://www.homologacao.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/`. Esse comportamento não deve ser contornado por automação.

**[S08] Python — Decimal.** Aritmética decimal e modos de arredondamento. Fonte: `https://docs.python.org/3/library/decimal.html`.

**[S09] FastAPI — documentação oficial.** APIs tipadas e documentação OpenAPI. Fonte: `https://fastapi.tiangolo.com/`.

**[S10] Pydantic — Strict Mode.** Validação estrita e limites de conversão. Fonte: `https://pydantic.dev/docs/validation/latest/concepts/strict_mode/`.

**[S11] Vite — Getting Started.** Requisitos de runtime da versão documentada. Fonte: `https://vite.dev/guide/`.

**[S12] MDN — SpeechRecognition.** Disponibilidade limitada e observações de execução por serviços de reconhecimento. Fonte: `https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition`.

**[S13] A2A Protocol — especificação oficial.** Referência para eventual adapter interoperável; não constitui alegação de conformidade do protocolo interno. Fonte: `https://a2a-protocol.org/latest/specification/`.

**[S14] PostgreSQL — Explicit Locking.** Bloqueios e coordenação de operações concorrentes. Fonte: `https://www.postgresql.org/docs/current/explicit-locking.html`.

**[S15] Brasil — Lei Geral de Proteção de Dados Pessoais.** Texto consolidado consultado no Planalto; referência de requisitos, não parecer de adequação. Fonte: `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm`.

## Limitações da pesquisa

Não foi confirmada a tradução etimológica proposta para “ibaiara”. A pesquisa encontrou uma descrição pública da API da NeuraLake, mas não validou credenciais, latência real, áudio, isolamento ou contratos de sessão da conta da equipe. Nenhuma integração fiscal, pagamento, voz ou entrega foi executada para produzir este documento. Nenhum repositório foi inspecionado ou alterado. O guia especifica o que construir e como verificar.

## Histórico

**1.0.0 — 19/09/2026.** Consolidação da concepção, áudio e correções finais. Preservados onboarding conversacional, política definida pelo dono, comércio bilateral, reconciliação física e abertura do pitch. Explicitados contratos, matemática, estados, isolamento, stack proposta, testes, entregas e pendências. Corrigidas ambiguidades de peso cru/pronto, margem, dupla baixa, orçamento privado e enquadramento automático na trilha 04.

**Princípio de fechamento:** a i.byara não precisa aparentar onisciência. Precisa fazer perguntas corretas, manter dados consistentes, respeitar os limites de cada parte e executar acordos que possam ser verificados.
