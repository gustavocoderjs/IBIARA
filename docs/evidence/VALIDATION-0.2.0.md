# Evidências · 0.2.0

Data: 19/09/2026. Ambiente local de preview, Node 24.19.0, pnpm 11.25.0. Dados exclusivamente fictícios. Continuação da base 0.1.0.

| Verificação | Resultado | Evidência / limite |
|---|---|---|
| `pnpm check` | PASS | ESLint sem erros/avisos, TypeScript e 29 testes aprovados |
| Domínio | PASS | 23 testes existentes: custos, orçamento, estoque, concorrência, idempotência e projeções |
| Captura de voz | PASS | 6 testes com adapter de teste: suporte ausente, permissão, transcrições parciais/finais, cancelamento/eventos tardios, rede e silêncio |
| Build Sites/Vinext | PASS | Cinco estágios concluídos; build de API e interface |
| Desktop, navegador | PASS | Quadro inicial, pedido em preparo movido para Prontos, quantidade ativa reduzida, total R$ 30,90 preservado; modo de voz acessível pelo cabeçalho |
| Mobile, viewport 390 px | PASS | Entrada em Ajustes; política muda capacidade 12→10; bloquear/liberar Frango; contagem 2 kg→1,9 kg proposta, revisada e confirmada |
| Mobile, viewport 360 px | PASS | Navegação inferior, voz/texto, rascunho preservado na troca, envio explícito e resposta persistida; abas de pedidos e Prontos |
| Viewport reduzido a 540 px de altura | PASS | Campo e envio utilizáveis por rolagem; simulação de espaço disponível, não teclado nativo |
| Largura 768 px | PASS limitado | Corpo sem overflow horizontal; não equivale a homologação em tablet físico |
| Negação de microfone no navegador | PASS | Mensagem de permissão negada, captura encerrada, rascunho preservado e envio por texto disponível |
| Áudio real em iOS/Android/desktop | NOT_RUN | Sem hardware/voz reais. Qualidade, TTS audível, Bluetooth, eco, ruído e políticas de reprodução não homologados |
| Agora / NeuraLake reais | NOT_RUN | Permanecem mocks solicitados; nenhuma chamada aos provedores |
| GitHub Actions remoto | NOT_RUN | Repositório retornou 404 à conexão; workflow preparado, execução remota depende do push |
| Convites / proteção de main | NOT_RUN | Não há acesso administrativo confirmado nem logins dos outros colaboradores |

Os viewports foram criados por um harness HTML temporário com iframe da mesma aplicação e APIs; ele foi removido antes do build e não faz parte da release. Não houve emulação de hardware nem alteração de banco por ferramentas de teste no browser. Os ajustes foram feitos pelos controles da aplicação.

O status de sincronização considera respostas reais; reconexões normais do stream SSE finito não são tratadas como indisponibilidade. Leitura a cada 15 s e ao retomar a aba complementa os eventos. Não se promete operação offline nem notificações fora do aplicativo.

## Limitações preservadas

O interpretador local conversa sobre cadastro e fichas dentro de um catálogo limitado. Voz não cria compreensão livre, execução financeira automática ou full-duplex. Rascunhos não enviados existem somente na sessão atual. Contagem continua bloqueando conflitos de reserva; políticas são versionadas. Pagamento, entrega, autenticação comercial multiusuário e integrações reais não foram homologados.

## Referências de CI

Configuração baseada nos contratos oficiais consultados: [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node) e [pnpm/action-setup](https://github.com/pnpm/action-setup). CI tem somente `contents: read`, cancela execuções redundantes e não publica produção.
