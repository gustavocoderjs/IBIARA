# Correções e validação do atendimento guiado — 20/09/2026

Esta rodada corrige as falhas registradas em [Testes disruptivos](VALIDATION-ADVERSARIAL.md). Os testes reais usam NeuraLake e operadores sintéticos isolados; a conversa habitual do usuário não foi reiniciada nem usada para compras de teste.

## Mudanças verificadas

| Problema anterior | Comportamento corrigido |
|---|---|
| “Leve”, “pouco” e “rápido” viravam números ou prato confirmado. | Guardam preferências de descoberta e geram esclarecimento; valores ausentes permanecem ausentes. |
| JSON válido do modelo podia inventar limites. | O backend confere a mensagem e a pergunta pendente; não aceita números só porque o modelo os propôs. |
| Perguntas sobre opções exibiam todo o catálogo. | Até três pratos disponíveis por lista, com filtros e “mais opções”. |
| Referências como “a segunda” eram frágeis. | A escolha usa os IDs da última lista e revalida disponibilidade e exclusões. O número da opção não vira orçamento. |
| Mudanças de assunto podiam aproveitar um prato antigo. | Uma troca sem novo prato definido invalida a escolha, preservando os demais limites explicitamente informados. |
| Limites em frases negativas e nomes curtos mantinham valores antigos. | “Não quero gastar mais de 30 reais” define o teto; “frango grelhado” resolve o prato e rejeitar o bife invalida a seleção. |
| Região fora da demo dependia de uma extração correta do modelo. | Localização explicitamente informada, como “será no Morumbi”, é validada a partir do texto e marcada fora da região atendida. |
| Correção de região podia apagar uma alergia conhecida. | A preocupação permanece até uma retratação explícita; reset também conserva a preocupação e as exclusões. |
| Formulário manual podia contornar preocupação alimentar ou reduzir duas porções para uma. | Validação central bloqueia mandato, RFQ, contraproposta, negociação e aceite, inclusive ofertas anteriores. A UI não oferece esse desvio. |

A sessão guarda rascunho, descoberta e pergunta pendente separadamente. O modelo recebe esse contexto junto ao cardápio público. Preço, disponibilidade, reserva e autorização continuam no domínio determinístico. A escolha de um prato na lista não fixa o restaurante: a busca autorizada compara os elegíveis pelo critério do comprador.

## Testes automatizados

- Suíte completa final: **106 testes aprovados**, zero falhas e zero ignorados.
- Diagnóstico controlado: **6/6 aprovados**, sem chamadas externas. Inclui extrações inventadas e tentativa de contornar preocupação alimentar pelo caminho manual.
- TypeScript, ESLint e build de produção aprovados.
- Regressões cobrem também isolamento entre restaurantes, idempotência, concorrência, reservas, orçamento, prazo e ordenação por avaliação.

Comandos equivalentes aos scripts do projeto, usando o Node disponível na máquina:

```text
node --experimental-strip-types --experimental-transform-types --test --test-isolation=none tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next
node scripts/run-framework.mjs build
node --experimental-strip-types --experimental-transform-types scripts/verify-adversarial-guards.ts
```

## NeuraLake real

Após a primeira repetição aprovada dos dez cenários originais, a revisão encontrou mais quatro casos e ampliou `node scripts/verify-adversarial-conversation.mjs --live`. Resultado final:

- **14/14 cenários, 39/39 mensagens e 904 verificações aprovadas**; nenhuma falha de comportamento ou do critério de lista curta.
- 40 chamadas persistidas ao provedor, incluindo uma chamada adicional de reparo de formato. Isso não equivale a um limite de cobrança do provedor.
- Três verificações adicionais de repetição/conflito aprovadas.
- Nenhum mandato, busca, oferta ou pedido criado por essas conversas.

Foram repetidos: ovo → leve → pouco → rápido; negação de escolha; ordinal sem lista; avaliação preservando limites; troca de prato e remoção de orçamento; “não” contextual; ressalva de doença celíaca; pizza ausente sem substituição; duas porções sem redução; instruções para comprar sem mandato ou alterar regras. Foram acrescentados: teto de gasto em frase negativa, troca por “frango grelhado”, rejeição do prato anterior e mudança para Morumbi.

O teste natural de oito turnos (`verify-customer-conversation.ts --live`) também foi atualizado para exigir que quantidade e segurança permaneçam pendentes quando não informadas. A primeira execução revelou uma correção para Morumbi ignorada pelo modelo; após a correção no backend, **8/8 turnos passaram**, com nove chamadas (um reparo de formato). Manteve R$ 40 e 50 minutos, corrigiu a região, mostrou três opções e alternou avaliação/preço sem inventar as respostas faltantes. Esse teste usa somente memória; nenhuma compra foi criada. O relatório local está em `outputs/guided-natural-conversation.json`.

O fluxo separado `node scripts/verify-live-api.mjs --live` também passou: comprador e três agentes de restaurante reais, total determinístico de **R$ 37,90**, reserva de 180 g de frango e pedido exclusivamente sandbox. Persistência, repetição idempotente e reset foram verificados nesse cenário sintético.

## Navegador

Na prévia isolada em `127.0.0.1:5174`, a sequência foi:

1. “quero algo com ovo, leve e pouco. o mais rápido possível. ainda não decidi quanto gastar”: exibiu três pratos reais do catálogo, perguntou o sentido de “leve” e não preencheu prato, quantidade, orçamento ou prazo.
2. “A segunda.”: selecionou **Omelete de legumes com arroz** e perguntou o orçamento, mantendo os números ausentes.
3. “Uma porção, até R$ 45 com entrega no Butantã em até 40 minutos. Não tenho alergias e nenhum ingrediente para excluir. Prefiro a melhor avaliação.”: registrou exatamente esses dados e habilitou revisão.
4. “Revisar pedido”: formulário exibiu omelete, R$ 45,00, 40 minutos, Butantã, nenhuma exclusão e melhor avaliação. Não foi autorizada uma compra nessa conversa de navegador.

A consulta da sessão pela API confirmou o mesmo rascunho, com `ready: true`; a recarga da página preservou conversa e dados. Nenhum erro apareceu no console da aba de teste. Evidências locais sintéticas ficam em `outputs/adversarial-conversation.json`, `outputs/adversarial-guards.json` e `outputs/guided-browser.json`, ignoradas pelo Git.

## Limites da validação

Os resultados comprovam os cenários executados, não compreensão universal de português. Extrações ambíguas ou unidades não reconhecidas podem exigir nova pergunta. A demo continua com uma porção por compra e sem verificação de alergênicos ou contaminação cruzada. Cardápios, avaliações, estoque e pedidos são simulados; nenhuma cobrança ou entrega real ocorreu. Rascunhos históricos não são reescritos retroativamente por esta correção.
