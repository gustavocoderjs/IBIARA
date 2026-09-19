# Contribuindo com a i.byara

Este projeto é um **monólito modular**: uma aplicação, um deploy e uma autoridade transacional. As fronteiras internas permitem dividir o trabalho entre 3 ou 4 pessoas.

Leia `AGENTS.md`, `docs/TEAM.md` e o contrato afetado antes de começar. O nome do repositório é **IBIARA**; a marca do produto continua **i.byara**.

## Rotina de trabalho

1. Abra uma tarefa com resultado verificável e combine quem cuida dela.
2. Atualize `main` com `git pull --ff-only` e crie uma branch curta: `feat/voz-mobile`, `fix/reserva-estoque` ou `docs/onboarding`.
3. Trabalhe na sua área. Combine alterações em tipos compartilhados, API, schema, dependências e lockfile com quem estiver nessas áreas.
4. Faça commits no formato `feat:`, `fix:`, `refactor:`, `test:`, `docs:` ou `chore:`. Explique o motivo no corpo quando necessário.
5. Execute `pnpm check` e `pnpm build`; verifique o fluxo afetado no navegador. Registre o que não foi possível executar.
6. Abra um PR pequeno para `main`, usando o template. Outra pessoa revisa. Faça squash merge quando o CI passar e as conversas estiverem resolvidas.
7. Apague a branch após o merge. Release usa versão semântica, notas e evidências verificáveis.

`main` deve permanecer utilizável. Não use force push em branches compartilhadas. Não há branch `develop` de longa duração nem microserviços separados.

## Convenções

- TypeScript estrito; tipos explícitos nas fronteiras; validação de entrada com Zod.
- Componentes de interface não calculam ou autorizam preços, reservas e pagamentos.
- Dinheiro em centavos inteiros; rendimentos e quantidades por aritmética exata do domínio.
- Toda mutação comercial é idempotente e passa pela transação do servidor.
- Componentes pequenos por fluxo; mantenha `components/ui` como primitivas reutilizáveis.
- Labels acessíveis, foco visível, formulários utilizáveis a partir de 360 px, controles de toque e texto legível.
- Migrações são adicionadas; nunca reescreva uma migração aplicada.
- Testes cobrem comportamento e riscos, não cópias da implementação.
- Não inclua `node_modules`, builds, bancos locais, segredos ou `.env` reais em commits.
- NeuraLake e Agora permanecem mocks até integração explicitamente implementada e validada.

## Preparação local

Siga o README. Cada pessoa usa seu próprio clone, banco local e `.env`. O clone funciona em modo portátil; `.sites-runtime` é específico da máquina e não é versionado. O workflow CI não precisa de credenciais de NeuraLake, Agora ou produção.

O arquivo `CODEOWNERS` começa com o dono do repositório. Os responsáveis das áreas só serão adicionados quando seus logins e acessos forem conhecidos. As proteções remotas precisam ser ativadas no GitHub; arquivos no repositório não as ativam sozinhos.
