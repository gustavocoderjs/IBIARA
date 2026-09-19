# Trabalho em equipe · 3 ou 4 pessoas

## Divisão proposta

| Frente | Responsabilidade | Arquivos principais | Revisão em par |
|---|---|---|---|
| Interface | Navegação, mobile, quadro de pedidos, acessibilidade e experiência de voz | `components/`, `app/*.css`, `lib/client/` | Integrações revisa voz; domínio revisa comandos |
| Domínio | Receitas, custeio, estoque, política, negociação e transações | `lib/domain/`, `tests/domain.test.ts` | Qualidade ou integrações |
| Integrações | NeuraLake, Agora, API e persistência | `lib/adapters/`, `lib/server/`, `app/api/` | Domínio revisa autorização e dados |
| Qualidade e entrega | Testes de jornada, CI, migrações, releases e documentação | `tests/`, `scripts/`, `.github/`, `drizzle/`, `docs/` | Responsável da área afetada |

Com três pessoas, qualidade e entrega são compartilhadas; escolha um responsável por cada release. Esta tabela define papéis, não atribui pessoas sem acordo.

Uma issue deve ter um responsável e um revisor. O contrato de uma mudança que cruza áreas é combinado primeiro. Evite duas pessoas editando `components/workspace.tsx`, `lib/domain/types.ts` ou `pnpm-lock.yaml` ao mesmo tempo. Os novos fluxos mobile, voz e pedidos já ficam em componentes separados.

## Acesso ao repositório

Destino informado: `git@github.com:gustavocoderjs/IBIARA.git`.

O proprietário deve adicionar os outros 2 ou 3 participantes como colaboradores com permissão **Write**. Cada pessoa aceita o convite e usa sua própria conta e chave SSH. O acesso ao código e o acesso ao ambiente privado publicado são independentes.

O ambiente privado atual continua com a audiência original. Compartilhar o código não compartilha automaticamente credenciais, dados ou acesso à publicação. O desenvolvimento local com fixtures permite trabalhar sem depender dela.

## Configuração recomendada no GitHub

Ativar em `main` depois do primeiro push:

- Pull request obrigatório, pelo menos **1 aprovação** de outra pessoa, aprovação invalidada quando novos commits relevantes entrarem e conversas resolvidas.
- Check obrigatório **quality** do workflow **CI**, com a branch atualizada antes do merge.
- Bloquear exclusão e force push de `main`.
- Squash merge habilitado e exclusão automática de branches após merge.
- Revisão dos CODEOWNERS para contratos compartilhados; atualizar o arquivo com logins reais depois dos convites.

**Estado desta entrega:** configurações e convites remotos ainda não aplicados. A conexão GitHub devolveu `404` para o repositório informado; sem acesso não é possível verificar sua existência, conteúdo, permissões ou proteção. CI preparado no código, execução remota pendente do envio.

## Rotina curta

No início do trabalho, cada pessoa informa a issue e os arquivos compartilhados que vai alterar. Integre PRs pequenos diariamente. O revisor valida o resultado, riscos e evidências; o autor acompanha o CI. A pessoa responsável pela release confirma versão, migrations, teste de fumaça e plano de reversão.

Voz real deve ser validada em Android e iPhone com o navegador e a rede do uso final. Emulação de tamanho não substitui teclado, áudio, permissões e comportamento do sistema operacional.
