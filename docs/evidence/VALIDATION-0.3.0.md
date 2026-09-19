# Validação 0.3.0 — revisão gastronômica

Data: 19/09/2026. Ambiente Node 24.19.0. Sandbox.

## Executado

- `pnpm check`: lint sem avisos, TypeScript e 29 testes aprovados (23 domínio + 6 ciclo de voz).
- Build de produção Vinext completo, cinco etapas. Import inicial de fonte incorreto foi corrigido para os arquivos reais `index.css` dos pacotes Fontsource; build aprovado depois da correção.
- Impeccable CLI 4.1.0 instalada; skill 4.3.1 do upstream f2c7051853848826aac2f4646581d62a732155ad. Os 59 arquivos oficiais foram comparados por SHA Git, sem diferenças. Nenhum hook automático ativo.
- Detector Impeccable executado uma vez sobre CSS e componentes alterados: `[]`. Essa verificação estática não substitui acessibilidade no navegador.
- Proveniência: 2 imagens WebP, 0 sem metadados de prompt. Imagens locais otimizadas em 640 e 1280 px.
- Revisão independente do código identificou cinco pontos: associação exata entre prato e imagem, conflitos de grid, identificação de imagens ilustrativas, contraste e redundância de títulos. Correções aplicadas e reavaliadas como resolvidas.
- Contrastes calculados após ajustes: vazio de fila 5,70:1, texto de vazio 6,48:1, rótulo de navegação 5,66:1, pendência 6,55:1. Cálculos sobre cores declaradas, não auditoria de pixels renderizados.
- Mantidos os comandos existentes de mandato/RFQ/negociação, orçamento com entrega, validade, revogação e uma compra por autorização. Sem mudanças no schema ou autoridade financeira.

## Não executado / limites

- O preview supervisionado ficou ativo, mas o navegador recusou a origem suportada com `ERR_BLOCKED_BY_CLIENT` em duas tentativas. Não foi possível inspecionar esta revisão em desktop/mobile nem repetir o fluxo de compra pela UI. As validações de browser da 0.2.0 são históricas, não evidência visual da 0.3.0.
- Não há comp aprovado, screenshots desta revisão, comparação de conversão, avaliação com consumidores ou homologação em dispositivos físicos.
- A revisão independente é estática. Seu parecer cobre apenas os cinco pontos listados, não certifica a superfície inteira.
- NeuraLake/Agora continuam mocks. O modo de voz preserva o fallback do navegador, sem nova homologação de microfone.
- A leitura do repositório GitHub passou, mas a tentativa de criar README via MCP retornou 403 “Resource not accessible by integration”. Isso não comprova permissão de escrita da conexão, mesmo quando o perfil consultado informa push=true. Não houve arquivo escrito por essa chamada.
- Git SSH não resolveu github.com neste ambiente. Git HTTPS conseguiu ler o repositório vazio; o push foi recusado porque não há credencial/username disponível (`terminal prompts disabled`). O ambiente não tem GitHub CLI nem credential helper configurado. Nenhum envio ao GitHub foi confirmado.
