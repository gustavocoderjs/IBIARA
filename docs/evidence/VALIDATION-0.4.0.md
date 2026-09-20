# Validação da interface 0.4.0

Data: 20/09/2026. Ambiente: preview local supervisionado, dados fictícios em sandbox.

## Escopo e resultado

Revisão visual da compra e das superfícies de operação, com tipografia sans local, superfícies claras/grafite, cena fotográfica em perspectiva CSS 3D e transições. Nenhuma dependência ou serviço contratado; regras comerciais, autenticação e integrações não foram alteradas.

| Verificação | Resultado observado |
| --- | --- |
| Testes automatizados | 31 aprovados: domínio e voz |
| TypeScript | Aprovado, inclusive após os ajustes da revisão |
| Lint | Aprovado |
| Build de produção | Aprovado pelo helper Sites/Vinext |
| Compra e operação | Autorização de R$ 35,00; compra por R$ 30,90; pedido confirmado na cozinha, início e conclusão do preparo |
| Layout responsivo | Sem transbordamento horizontal em desktop e larguras de frame de 320, 390 e 820 px |
| Movimento | Transformação matrix3d e variáveis de cursor/rolagem mudaram no navegador; controles continuaram utilizáveis |
| Revisão visual independente | Quatro capturas desktop/mobile válidas; segunda rodada: `disposition: ship`, sem pendências nos ajustes apontados |

## Correções verificadas na revisão

- Botões compartilhados e envio com dimensões mínimas de 44 × 44 px.
- Rótulos de unidade em `#62636b`: contraste calculado de 5,97:1 sobre branco e 5,65:1 sobre o fundo do orçamento.
- Hierarquia da cena simplificada: nome do prato como título, apoio abaixo; sobre-título redundante da contagem removido.

O navegador de preview, que estava bloqueado na validação 0.3, funcionou nesta rodada. Capturas reais incluíram compra desktop, compra mobile, ajustes rápidos mobile e quadro de pedidos desktop. O frame temporário usado para variar a largura foi removido antes do build.

## Limites da evidência

- A cena usa fotografia e camadas CSS; não é um modelo 3D navegável.
- Redução de movimento, ausência de hover, aba oculta, saída da área visível e limpeza de listeners foram inspecionadas no código. Não houve emulação de preferência do sistema nem teste em aparelhos físicos; a ausência de transbordamento no frame não certifica Safari/iOS ou desempenho de GPU.
- O movimento é acionado por eventos e limitado a um frame pendente por cena. Não foi feita medição formal de FPS, Core Web Vitals ou desempenho em dispositivo de entrada.
- O detector Impeccable foi executado uma vez e produziu alertas consultivos em relação ao DESIGN anterior. Não se declara auditoria automática limpa. A revisão independente e a documentação reconciliada descrevem o que foi efetivamente entregue.
- O fluxo validado é sandbox. Não houve cobrança, entrega, uso de NeuraLake/Agora reais ou homologação de produção comercial.

As evidências de publicação são os resultados nativos do deploy e os commits vinculados no histórico; o navegador desta validação acessou o preview.
