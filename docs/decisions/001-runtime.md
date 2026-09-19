# ADR-001 · runtime da release 0.1.0

Data: 2026-09-19. Status: IMPLEMENTADO PARA REVISÃO. Aprovador humano: pendente de revisão; não atribuído automaticamente.

O guia propõe Python/FastAPI/PostgreSQL como baseline técnica. O pedido atual autoriza construir a primeira release e deixar NeuraLake/Agora em mock. A especificação admite outra estrutura por ADR, preservando contratos.

A primeira entrega utiliza React + TypeScript + Vinext/Vite, Worker ESM e D1/SQLite. Isso permite disponibilizar a aplicação inteira em um único ambiente privado, com persistência real e sem instalar um backend externo. As regras de produto continuam no servidor. Não há dependência de framework multiagente.

Dinheiro permanece em centavos inteiros. Quantidades entram como decimais textuais e os cálculos usam frações `BigInt`, incluindo arredondamento conservador da quantidade consumida até seis casas. A precisão racional substitui o `Decimal` proposto sem depender de float binário. Valores formatados na interface podem usar números de exibição; não autorizam preços.

A fronteira transacional desta demonstração é o cenário de um operador: três merchants, comprador, inventário, mandatos, idempotência e eventos. Tudo está em um agregado JSON com uma revisão no D1. A transação lê o agregado, aplica regras em uma cópia e grava `UPDATE ... WHERE owner_id = ? AND revision = ?`. Uma atualização de revisão bem-sucedida compromete todos os efeitos; disputa causa releitura e revalidação. Falhas de domínio não gravam a cópia. Uma chave repetida devolve o resultado anterior; corpo diferente conflita.

Esse modelo atende atomicidade na demo, mas não é a arquitetura relacional final. Não há concorrência comercial entre cenários de diferentes usuários, compartilhamento de restaurantes reais entre compradores, locks por lote ou índices sobre eventos. O histórico não é compactado automaticamente. Volume alto de eventos aumenta o custo de escrita; preservar a operação em sandbox.

Antes do piloto: decompor em agregados relacionais, medir contenção, implementar orçamento por principal real e estoque compartilhado, endurecer autenticação/escopos, agendamento persistente, recuperação, retenção e transação com outbox. PostgreSQL/FastAPI é uma opção compatível com os contratos; nenhuma migração automática foi prometida.

Acesso: a publicação é privada. O dispatcher encaminha identidade autenticada estável; o servidor ignora tenant IDs de corpo. O mesmo operador pode representar cozinha e comprador do seu cenário. Isso é intencional e identificado; não é uma autorização de contas comerciais compartilhadas. Em desenvolvimento há um operador local, removido do bundle de produção por `import.meta.env.DEV`.
