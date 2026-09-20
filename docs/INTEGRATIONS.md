# Integrações pendentes · contratos internos

Fundação atual: `NEURALAKE_MODE=mock` não faz chamadas externas. `live` ativa o novo
transporte HTTP para comprador e três restaurantes somente com secrets do servidor.
O adapter de receita e o Agora abaixo permanecem mocks. Ver `docs/MVP-FOUNDATION.md`.

## NeuraLake

Implementação adicionada em `lib/agents/shared/neuralake.ts`, baseada no contrato
chat completions fornecido nos quatro exemplos. System próprio por agente; sem
histórico de exemplo, Cross Memory, native tools ou response_format presumidos.
Uma chamada por decisão, timeout 15 s por chamada, 512 tokens máximos e JSON validado
por Zod. O comprador pode fazer uma segunda tentativa para corrigir JSON/schema
inválido, dentro da quota. Ambas são contabilizadas quando o turno é persistido.
Credenciais separadas: CUSTOMER, NIKO, CASA, PANELA. O fallback NEURALAKE_API_KEY
vale somente para o comprador. Respostas de erro do provedor nunca vão ao cliente.
Tokens/modelo ausentes são null; custo não é inventado. Contadores persistidos contam
somente chamadas bem-sucedidas que tiveram gravação confirmada, não fatura do provedor.
Usar as chaves atuais autorizadas pelo responsável, somente em `.dev.vars` ignorado
pelo Git ou em secrets do servidor. Rotação não é pré-requisito desta integração.

Validação: 51 testes aprovados e quatro chamadas reais integradas no Worker/D1 local,
com pedido sandbox, reserva e repetição idempotente. O modelo informado foi `text`;
custos permaneceram null. Evidência: `docs/evidence/VALIDATION-LIVE-MARKET.md`.
O contexto de restaurante é criado por chamada com RFQ pública e ofertas próprias.
Não há memória global; a conversa do comprador é persistida por operador no D1.

O primeiro input humano válido inicializa uma única vez o mercado fictício com
12 fichas e 16 insumos. Cada restaurante tem seu próprio estoque/custo/política no
agregado D1; não há três bancos físicos. O cliente começa com conversa vazia e
precisa revisar e autorizar antes de qualquer pedido. `consult_menu` projeta somente
cardápio público com preço e disponibilidade calculados; `reset` não repõe estoque,
não remove pedidos e não reinicia a quota de inferência. Ver `docs/DEMO-MARKET.md`.

Arquivo: `lib/adapters/neuralake.ts`. O parser local é um mock explícito. `NeuraLakeAdapter.complete()` falha com `PROVIDER_UNAVAILABLE` até a implementação real. A interface interna aceita principal, finalidade, texto, referência de contexto e limite de chamadas. Não presume que esses campos existam na API do provedor.

- **NEURALAKE-01:** validar autenticação, URL/modelo efetivamente disponíveis e contrato HTTP. Credenciais somente no servidor.
- **NEURALAKE-02:** implementar extração de patches com schema estrito, timeout, limites de chamadas/tokens e reparo limitado. Nunca escrever livremente em política, estoque ou banco.
- **NEURALAKE-03:** contexto por principal/finalidade. Cross Memory somente após provar isolamento e recuperação em sessões distintas.
- **NEURALAKE-04:** telemetria real de modelo, tokens e cobrança. Ausência é `null`; custo estimado exige tabela datada.
- **NEURALAKE-05:** smoke tests reais: português, ambiguidade dos bifes, erro/timeout, streaming, parser, quotas, separação entre merchants e buyer.

Gramática do mock de receita: catálogo de 16 insumos (os oito originais mais cenoura,
abobrinha, brócolis, macarrão, tomate, queijo, lentilha e alface). Quantidades numéricas
ou um/dois/três, unidades explícitas, rendimentos diretos como `arroz rende 2,5`,
`rende 1 porção`, `outros custos variáveis: R$ 0,80`. Não compreende linguagem natural
arbitrária. Fragmentos não reconhecidos e alternativas ficam pendentes; o operador
precisa corrigir/reformular. Não é permitido declarar compreensão por LLM.

A seleção comercial usa `meal-intent.ts` para rejeitar termos desconhecidos e
`dishName` quando identifica uma ficha, sempre considerando versões atuais.
Esse contrato evita que um prato nomeado seja trocado por outro só porque compartilha
um ingrediente; não é um interpretador universal de cardápios.

`docs/evidence/VALIDATION-AGENTS.md` conserva a evidência histórica de 40 testes com
mocks. A execução real desta rodada deve ser registrada separadamente, com o
ambiente efetivamente testado e suas limitações.

Validação adicional em 20/09/2026: a NeuraLake aceitou `response_format: {type:
"json_object"}` com HTTP 200; o adapter usa esse formato e continua validando schema
estrito. O diálogo de oito turnos passou sem reparo, incluindo alteração da região
e dos critérios de seleção. Isso não é garantia universal de formato ou semântica
do provedor. Detalhes: `docs/evidence/VALIDATION-CONVERSATION.md`.

## Agora

Arquivo: `lib/adapters/agora.ts`. Métodos `transcribe` e `speak` devolvem erro explícito. Não há SDK, App ID, certificado ou token fabricado.

- **AGORA-01:** escolher produto/SDK e verificar contrato de áudio em português; não presumir full-duplex.
- **AGORA-02:** emitir tokens de curta duração no servidor, vinculados a principal/canal; validar revogação e expiração.
- **AGORA-03:** conectar eventos de transcrição/síntese, consentimento de microfone, reconexão, interrupção e telemetria.
- **AGORA-04:** testar navegador/rede reais do pitch, ruído, números ambíguos e perda de áudio. Falha mantém texto e estado.

O modo de voz usa o fallback `lib/adapters/browser-voice.ts` (SpeechRecognition/webkitSpeechRecognition) e speechSynthesis do navegador quando disponíveis. O componente `components/voice-conversation.tsx` mantém captura, revisão, envio e leitura separados. Isso é identificado como ditado/leitura do navegador, não Agora. A transcrição fica editável e exige envio humano; uma fala não confirma dados automaticamente. Disponibilidade e eventuais serviços externos dependem do navegador.

## Fiscal

Fonte suportada: XML enviado pelo operador, sem DTD ou entidades externas, limite de 250 KB e 200 linhas. Exige chave NF-e de 44 dígitos e ambiente. Insumos são vinculados ao catálogo reconhecido, `kg→g` é normalizado e unidades desconhecidas bloqueiam o documento inteiro. `vProd - vDesc + vFrete + vOutro` é o critério explícito por linha; não é cálculo tributário. XML de exemplo em `fixtures/nfe-example.xml`.

Importação não aumenta estoque; recebimento/condição precisam de confirmação. Duplicidade por ambiente/chave e corpo divergente gera conflito. QR consulta online, rate limiting por emissor, XML assinado/autenticado, cancelamentos fiscais e reconciliação contábil permanecem pendentes. Não chamar este importador de integração SEFAZ ao vivo.

## Antes de substituir um mock

Manter contratos tipados e testes do domínio. Repetir o cenário numérico, negativas, falhas do provedor e isolamento. Adicionar evidência na matriz de capabilities. Não alterar política financeira como efeito de resposta do modelo. Pagamento e logística ficam em sandbox até nova decisão e homologação.


## Contrato de UX para o adapter Agora

Preservar os estados `idle`, `requesting`, `listening`, `finishing`, envio e síntese. Somente o evento real de início ativa o indicador de escuta. Parciais não são enviados; a transcrição final permanece revisável. Cancelamento deve desconectar callbacks e impedir eventos atrasados, envio duplicado e síntese após sair da tela. A captura termina ao ocultar a aba e por limite de 60 segundos no fallback atual.

**TODO(AGORA-05):** substituir o fallback por uma sessão com contrato de eventos tipado e tokens efêmeros, mantendo esses comportamentos. Homologar interrupção, alternância áudio/texto, iOS, Android, Bluetooth, teclado, permissões e rede antes de anunciar voz pronta para produção.

Referências consultadas em 19/09/2026: [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [erros de reconhecimento](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/error_event) e [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). O serviço de reconhecimento pode processar áudio fora do dispositivo; não é prometido funcionamento offline.
