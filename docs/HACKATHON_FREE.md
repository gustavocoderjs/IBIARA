# Infraestrutura do hackathon — sem novas contratações

Decisão de 20/09/2026: priorizar planos gratuitos e o app que já funciona. O cenário de produção comercial não é requisito para apresentar a demonstração.

## O que usar agora

| Camada | Escolha | Estado e limite |
| --- | --- | --- |
| App e API | Hospedagem Sites existente, monólito TypeScript | Já publicada; manter o acesso atual. Sem contratar outro servidor. |
| Persistência da demonstração | D1 já vinculado ao app | Funciona por operador, com controle de concorrência. Não é um marketplace compartilhado entre contas. |
| Código e colaboração | GitHub existente | Código enviado; nenhuma nova conta é necessária. O fluxo automatizado existente não precisa ser ampliado para o hackathon. |
| Banco e login externos | Supabase Free | Opção para o próximo estágio. Cadastro aberto, mas conta, projeto e integração ainda não concluídos. Não há conexão Supabase no app atual. |
| Voz da demonstração | Recursos de fala do navegador | Já implementados, dependem de suporte e permissão do dispositivo. Testar no aparelho da apresentação. |
| NeuraLake e Agora | Mocks atuais; integração real depende de credenciais e cota confirmada | Não presumir que créditos do evento existam ou sejam ilimitados. Não habilitar chamadas pagas automaticamente. |

Esta escolha evita novas despesas de infraestrutura para a demonstração usando o ambiente já disponível. Não representa promessa de hospedagem gratuita permanente ou de gratuidade dos provedores de IA.

## Supabase Free

Segundo a [página oficial de preços](https://supabase.com/pricing), consultada em 20/09/2026: US$ 0/mês, até 2 projetos ativos, 500 MB de banco por projeto, 50 mil usuários ativos mensais de autenticação, 1 GB de arquivos e 5 GB de tráfego de saída. Projetos gratuitos pausam após uma semana de inatividade; backups automáticos não estão incluídos.

Configuração pretendida após autenticação: reutilizar uma organização Free existente ou criar uma para i.byara; projeto `ibyara-hackathon`; região próxima dos participantes, preferindo São Paulo se disponível no plano. Confirmar preço zero na tela antes de criar. Não selecionar upgrade, domínio personalizado pago ou addons.

O Supabase oferece banco e login, mas o simples cadastro não integra o aplicativo. A migração deve preservar transações, idempotência, reservas e isolamento. A hospedagem atual exige uma interface HTTP para o banco externo; não substituir D1 por uma conexão PostgreSQL TCP direta. O primeiro corte pode manter D1 até banco e autenticação externos estarem validados juntos.

## Próximos passos em ordem

1. Concluir autenticação/cadastro e criar um único projeto Free. Credenciais permanecem em configuração protegida, nunca no repositório ou no chat.
2. Decidir se a apresentação precisa de contas comerciais separadas. A demonstração atual já permite alternar restaurante e consumidor dentro de um cenário privado.
3. Se precisar de contas independentes: integrar autenticação, vínculo do usuário ao restaurante e persistência compartilhada; verificar acesso cruzado e aceites simultâneos. Trocar apenas o banco não resolve autorização.
4. Habilitar NeuraLake/Agora somente com contrato, chave e cota real confirmados. Os mocks continuam identificados até passar um teste de integração real.
5. Ensaiar no dispositivo da apresentação: ficha → estoque → política → autorização do consumidor → negociação → pedido → preparo. Usar texto como contingência da voz.
6. Verificar o acesso dos jurados. O app continua privado; publicação não altera automaticamente sua audiência.

## O que fica para depois do hackathon

Alta disponibilidade, infraestrutura dedicada, filas separadas, observabilidade paga, domínio próprio e expansão do pipeline não são necessários para esta demonstração. Pagamento, entrega, operação sanitária real, lotes FEFO e autorização comercial multiusuário seguem pendentes para uso comercial. A auditoria de produção continua válida para esse estágio.

## Correção entregue nesta revisão

Novas buscas usam primeiro a última versão confirmada da ficha e só então verificam composição e exclusões. Uma revisão incompatível não reativa versões antigas. Propostas já emitidas preservam sua composição e valor durante sua validade, com disponibilidade e mandato revalidados no aceite.
