# Cardápios e bancos simulados dos restaurantes

O cenário usa o D1 já existente. Cada operador tem um agregado persistido, e cada
restaurante tem seu próprio `restaurants[id]` com fichas, custos, estoque, política
e histórico. Não são três servidores nem três conexões de banco. O backend entrega
a cada agente somente o contexto da sua identidade (`niko`, `casa` ou `panela`).

## Entrada e persistência

`ensureDemoMarket(state, at)`, em `lib/domain/demo-market.ts`, prepara os dados na
transação do primeiro input válido enviado ao agente do cliente. Abrir uma página
ou ler o estado não deve executar essa preparação nem criar uma compra.

O marcador opcional `demoMarketVersion: 1` fica no JSON do D1; não exige alterar a
tabela. Depois da preparação, novas chamadas são no-op: não repõem estoque, não
renovam validade, não removem reservas ou pedidos e não alteram preços autorizados.

Em cenários anteriores, a preparação acrescenta somente insumos e fichas ausentes.
Saldos, custos, políticas e receitas existentes são preservados. Niko recebe o
cenário completo automaticamente apenas quando ainda está no estado inicial
intocado. Um cadastro parcial continua parcial; por exemplo, a política ausente
continua bloqueando a venda. Esse cuidado evita sobrescrever trabalho da equipe.

## Cardápios de exemplo

| Restaurante | Fichas de uma porção |
|---|---|
| Marmita Quentinha do Seu Niko (`niko`) | Bife a cavalo; Frango grelhado com arroz e feijão; Omelete de legumes com arroz; Macarrão com carne e tomate |
| Sabor de Casa (`casa`) | Bife a cavalo; Frango com legumes e arroz; Lentilha com arroz e salada; Macarrão com tomate e queijo |
| Cozinha Expressa (`panela`) | Bife a cavalo; Frango com brócolis e arroz; Omelete com tomate e arroz; Macarrão com frango e brócolis |

Cada ficha inclui componentes, quantidades, unidades, base cru/pronto/comprado,
rendimento, preparo, embalagem, uma dose medida de óleo/temperos e R$ 0,80 de
outros custos variáveis. Esses valores são fixtures fictícias identificadas, não
dados obtidos dos restaurantes nem receitas nutricionais ou garantias alimentares.

O catálogo contém 16 itens: patinho, frango, ovo, batata, arroz, feijão, óleo/temperos,
embalagem, cenoura, abobrinha, brócolis, macarrão, tomate, queijo, lentilha e alface.
O item tem o mesmo ID de catálogo nas cozinhas, mas seu saldo, custo e reserva são
objetos distintos, localizados sob a identidade do restaurante.

## Estoque e dinheiro

As fichas convertem quantidade pronta para quantidade de estoque usando rendimento
racional: 250 g de macarrão pronto / 2,5 = 100 g de massa seca; 160 g de lentilha
pronta / 2 = 80 g de lentilha seca. O motor existente usa BigInt e centavos inteiros.

A política continua por restaurante. Não se inventou preço por prato nem uma
política nova escolhida por IA. `quote` calcula o custo e aplica os limites do
restaurante; `accept` reserva somente o estoque do restaurante vencedor; iniciar
preparo realiza a baixa. Estoque insuficiente ou inelegível impede uma oferta.

O cenário canônico de bife a cavalo do Niko permanece com custo de R$ 15,00,
contraproposta de R$ 27,00 e entrega de R$ 3,90: total sandbox de R$ 30,90.

As quantidades e validades são sintéticas. Não há integração com inventário real,
pagamento real ou entrega real. Expirar estoque não o renova automaticamente.

## Verificação

`tests/demo-market.test.ts` cobre completude das 12 fichas, custo determinístico,
rendimentos, isolamento dos estoques, bloqueio por falta de insumos, reserva do
vencedor, compatibilidade com o cenário canônico, repetição sem reposição e
preservação de cenários antigos ou parcialmente configurados.
