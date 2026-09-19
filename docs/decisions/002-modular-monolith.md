# ADR 002 · monólito modular e colaboração

Data: 19/09/2026. Estado: **DECIDIDO — monólito solicitado explicitamente pelo usuário**.

## Problema

A equipe terá 3 ou 4 pessoas e precisa evoluir o produto sem coordenar múltiplos serviços ou replicar regras de dinheiro, estoque e autorização.

## Decisão

Manter uma aplicação React/TypeScript com API no mesmo projeto e um banco D1. Interface, domínio, adapters e persistência são módulos internos. O domínio é independente de React e dos provedores. A transação do agregado é a autoridade de reserva e aceite. Um artefato único é publicado.

Frontend usa a API; API valida identidade e comandos; domínio calcula e decide; repository persiste. Integrações NeuraLake/Agora ficam atrás de adapters e continuam mocks nesta release. Separar módulos não cria deploys ou bancos independentes.

GitHub Flow: `main` utilizável, branches curtas, pull requests revisados, um check de qualidade e squash merge. Frentes de trabalho descritas em `docs/TEAM.md`.

## Consequências

- Menor custo de coordenação, contratos internos compartilhados e transação consistente.
- Uma mudança na aplicação exige novo build/deploy do conjunto.
- O agregado D1 por operador é apropriado para o sandbox atual; concorrência e escala comercial continuam dependentes de validação.
- A decisão de monólito não homologa as integrações, o marketplace multiusuário ou a migração futura de banco.
- O ADR 001 conserva o histórico da escolha do runtime; nenhuma migração foi reescrita.

## Validação

Tipos, lint, testes de domínio/concorrência/voz, build e jornadas afetadas. As evidências desta release ficam em `docs/evidence/VALIDATION-0.2.0.md`.
