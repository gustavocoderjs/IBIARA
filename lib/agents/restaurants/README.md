# Agentes de restaurantes — fundação do MVP

IDs existentes: `niko`, `casa`, `panela`. Não substituir pelos IDs ilustrativos dos prompts.
Os três anexos foram recebidos nesta rodada. `prompts.ts` registra as identidades;
`service.ts` valida publicação de uma oferta própria ou recusa. `mock` é explícito;
`live` depende de credenciais novas e de smoke real. Serviços determinísticos de
`lib/domain/commerce.ts` continuam responsáveis pelo comércio.

As chaves não são copiadas dos exemplos. A fronteira executável
está em `../shared/contracts.ts`: `RestaurantRequest` contém composição, exclusões,
região, prazo e validade; não contém teto, mandato privado ou texto bruto do comprador.
`RestaurantOffer` não contém custo, piso, margem, estoque exato ou token de aceite.

Cada implementação recebe apenas seu `Restaurant`, a requisição pública e ferramentas
restritas. Preço e disponibilidade continuam em `pricing.ts`; reserva e pedido continuam
em `commerce.ts` + `transaction.ts`. Não duplicar backend, banco ou SDK por restaurante.
