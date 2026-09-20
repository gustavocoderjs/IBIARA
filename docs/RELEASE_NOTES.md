# 0.4.0 · profundidade e movimento

Data: 20/09/2026. SANDBOX. Redesign solicitado pelo usuário com referência Apple.

- Superfícies claras e grafite, tipografia sans local, maior hierarquia e tomate nas ações. Revisão aplicada à compra e às telas da cozinha.
- Prato em camadas fotográficas CSS 3D: resposta limitada ao cursor e à rolagem, sem loop contínuo nem dependência nova. Não é um modelo 3D navegável.
- Transições curtas entre áreas, confirmação de pedido e entrada de tickets. Controles permanecem disponíveis durante a animação.
- Apresentação estática no toque e com redução de movimento. Cabeçalho e navegação mobile mantêm contexto durante a rolagem.
- Compra em sandbox validada no navegador: teto R$ 35,00, total R$ 30,90, preparo e conclusão na cozinha.
- Fotografias existentes mantêm identificação de origem. Nenhuma alteração nas regras de preço, reserva, autenticação ou integrações.
- Evidências e limites em `docs/evidence/VALIDATION-0.4.0.md`.

---

# Pós-0.3.0 · correção de versões e plano gratuito

Data: 20/09/2026. SANDBOX.

- Novas RFQs consideram a última ficha confirmada antes de verificar ingredientes e exclusões. Uma revisão incompatível não reativa uma versão antiga.
- Propostas já emitidas preservam composição e valor até expirar; aceite mantém as verificações de mandato e disponibilidade.
- Dois testes de regressão adicionados. 31 testes, TypeScript, lint e build aprovados.
- `HACKATHON_FREE.md` documenta infraestrutura sem novas contratações e a opção Supabase Free. Cadastro aberto; conta, projeto e integração ainda pendentes.
- GitHub habilitado e documentação de equipe atualizada. Mantidos monólito, D1 e integrações em mock.

---

# 0.3.0 · identidade gastronômica e compra

Data: 19/09/2026. SANDBOX. Alteração visual solicitada pelo usuário.

- Substituição da apresentação predominantemente verde por cerâmica, tomate, açafrão e cores semânticas nas etapas de pedidos.
- Fotografia gastronômica gerada, identificada como ilustrativa e servida localmente em WebP responsivo.
- Experiência do consumidor com destaque para o prato, intenção, limite com entrega e autorização explícita de uma compra.
- Fontes locais, contraste dos controles, estilos de foco e redução de movimento. Fotografias nas fichas e visão compacta da cozinha.
- Impeccable CLI/skill versionadas com origem e checksums; auditoria manual disponível à equipe.
- Nenhuma migração, alteração das regras de cálculo, integração NeuraLake/Agora ou cobrança real.
- Lint, tipos, 29 testes e build aprovados. A validação visual em navegador desta revisão não pôde ser executada: acesso ao preview bloqueado pelo ambiente. Veja `docs/evidence/VALIDATION-0.3.0.md`.

---

# 0.2.0 · operação mobile, voz e colaboração

Data: 19/09/2026. SANDBOX. Monólito mantido conforme solicitação explícita.

- Navegação mobile com Ajustes, Pedidos, Voz e Mais; margens para safe areas, controles de toque e texto de formulário a 16 px.
- Ajustes rápidos de elegibilidade/excedente, contagem parcial com revisão e edição versionada de preço, descontos e capacidade. Margem e taxas são preservadas.
- Quadro desktop com etapas, busca, histórico, tempo desde a entrada e detalhes. Mobile apresenta as etapas em abas.
- Modo de voz no desktop e mobile, transcrição editável, envio explícito e leitura de respostas. Captura só começa por gesto; permissão negada, silêncio, rede e cancelamento mantêm a contingência de texto.
- Escuta e síntese encerradas ao sair da tela ou colocar a aba em segundo plano. Rascunho compartilhado entre texto/voz somente na sessão.
- SSE conserva atualização por eventos; leitura a cada 15 s e ao retomar a aba cobre interrupções. Indicador reflete conexão/última sincronização observada.
- Módulos de UI separados, TypeScript estrito, lint sem avisos, CI, templates de PR/issues, CODEOWNERS inicial e roteiro de colaboração para 3–4 pessoas.
- Nenhuma alteração de schema; nenhuma integração real com NeuraLake/Agora. Voz real em dispositivos físicos e CI remoto permanecem pendentes, conforme evidências.

O acesso GitHub retornou 404 durante esta entrega. `origin` foi configurado para o endereço solicitado; isso não equivale a um push concluído, a convites aceitos ou à ativação das proteções descritas.

---

# 0.1.0 · primeira implementação para revisão

Data: 19/09/2026. Modo exclusivo: SANDBOX.

Entrega: experiência bilateral, onboarding por conversa com mock local, fichas versionadas, custeio determinístico, XML/recebimento, inventário/reconciliação, política, três merchants, mandato, negociação automática, reservas e pedido. Inclui produção de lote de teste, avanço do relógio e trilha de eventos.

## Decisões e limites relevantes

- React/TypeScript/Vinext e D1 substituem a stack técnica proposta Python/FastAPI/PostgreSQL nesta entrega. ADR registra motivo e limites. Banco é autoridade; memória da IA não é banco.
- Os agentes comerciais são serviços determinísticos isolados por parâmetros/projeções. Interpretação de LLM e voz Agora são mocks pedidos pelo usuário. Não há claim de autonomia de modelos reais.
- Um cenário privado por operador. Alternar Restaurante/Consumidor é representação explícita dos personagens sintéticos. Isolamento entre operadores existe; marketplace multiusuário compartilhado não é homologado.
- Custos médios e quantidades decimais exatos; estoque agregado por insumo nesta demo, sem múltiplos lotes FEFO. Validades de fixtures são sintéticas. Critérios sanitários reais não são deduzidos.
- Rotina persistida é acionada em mutações/relógio de teste, sem notificações fora do aplicativo.
- XML de um subconjunto validado; QR e consulta fiscal ao vivo não implementados. Quantidades originais normalizadas e dados de linha preservados no registro de compra; arquivo bruto não armazenado.
- O mock suporta um catálogo limitado. Fichas fora desse vocabulário ficam pendentes; interpretação livre depende de NeuraLake.
- Política da demo é por restaurante, aplicável às fichas ativas. Política por prato, múltiplas regiões, tarifa real de entrega e múltiplas porções por mandato são evolução.
- Pagamento e entrega reais não existem. O protótipo pode avançar para preparo/pronto, sempre em sandbox.
- A UI registra ferramentas WebMCP de leitura/navegação somente quando o navegador oferece o contexto. A extensão opcional não substitui autenticação.

## Prioridade da próxima revisão

1. Validar linguagem da conversa, composição da ficha e os termos da política com Cristiano.
2. Integrar NeuraLake e Agora pelos TODOs já separados, com smoke tests de contrato e isolamento.
3. Decidir PostgreSQL/backend de piloto, auth de usuários comerciais, lotes, scheduler resiliente e fonte fiscal real.
4. Só então homologar pagamentos, logística e execução fora de sandbox.

Esta release é implementada e testável; não é uma declaração de conclusão de todos os gates externos P0 do guia.
