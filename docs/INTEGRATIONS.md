# Integrações pendentes · contratos internos

Não basta preencher `.env` para ativar integração. Nenhuma variável habilita silenciosamente um fornecedor nesta release.

## NeuraLake

Arquivo: `lib/adapters/neuralake.ts`. O parser local é um mock explícito. `NeuraLakeAdapter.complete()` falha com `PROVIDER_UNAVAILABLE` até a implementação real. A interface interna aceita principal, finalidade, texto, referência de contexto e limite de chamadas. Não presume que esses campos existam na API do provedor.

- **NEURALAKE-01:** validar autenticação, URL/modelo efetivamente disponíveis e contrato HTTP. Credenciais somente no servidor.
- **NEURALAKE-02:** implementar extração de patches com schema estrito, timeout, limites de chamadas/tokens e reparo limitado. Nunca escrever livremente em política, estoque ou banco.
- **NEURALAKE-03:** contexto por principal/finalidade. Cross Memory somente após provar isolamento e recuperação em sessões distintas.
- **NEURALAKE-04:** telemetria real de modelo, tokens e cobrança. Ausência é `null`; custo estimado exige tabela datada.
- **NEURALAKE-05:** smoke tests reais: português, ambiguidade dos bifes, erro/timeout, streaming, parser, quotas, separação entre merchants e buyer.

Gramática do mock: catálogo de patinho, frango, ovo, batata, arroz, feijão, dose medida de óleo/temperos e embalagem. Quantidades numéricas ou um/dois/três, unidades explícitas, rendimentos diretos como `arroz rende 2,5`, `rende 1 porção`, `outros custos variáveis: R$ 0,80`. Não compreende linguagem natural arbitrária. Fragmentos de ingredientes não reconhecidos e alternativas ficam pendentes; o operador precisa corrigir/reformular. Não é permitido declarar compreensão por LLM.

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
