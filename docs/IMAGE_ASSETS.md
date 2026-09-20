# Imagens da release 0.3.0

`public/images/bife-a-cavalo-1280.webp` (215.206 bytes) e `public/images/bife-a-cavalo-640.webp` (76.198 bytes) derivam da mesma imagem criada com a ferramenta integrada de geração de imagens em 19/09/2026. Redimensionamento e compressão WebP via Sharp, qualidade 84. Não são fotografias de pratos efetivamente vendidos.

Uso: inspiração do consumidor, ficha/offer de bife a cavalo e apresentação ilustrativa da cozinha. A associação original por nome exato foi ampliada em 20/09/2026 para os dez nomes do catálogo de demonstração, conforme o registro abaixo. Formatos preservam proporção original 3:2; o layout faz recorte com object-fit.

Prompt exato usado na geração:

> Use case: ads-marketing. Create a premium, irresistibly appetizing editorial FOOD PHOTOGRAPH for a Brazilian food-ordering web app called i.byara. Single landscape image, no typography whatsoever. Subject: Brazilian bife a cavalo on a rustic ivory ceramic dinner plate, succulent pan-seared beef steak topped with one fried egg with vivid glossy golden orange runny yolk and lightly crisp lacy edges, fluffy distinct white rice grains, small helping glossy brown carioca beans, golden crisp thick french fries, tiny fresh parsley garnish. Authentic generous prato feito, beautifully realistic, not fine dining micro portions. Close three-quarter overhead angle, entire plate mostly visible with realistic food textures prominent, plate central but slightly to the right, camera crops table not food. Warm burnt tomato terracotta table and softly rumpled warm cream linen at lower left, fork partially visible near linen. Strong soft natural side light, delicious specular highlights on yolk and steak, subtle gentle shadows and natural depth. Palette egg-yolk saffron, tomato terracotta, cream, toasted browns and a hint of herb green. Appetizing tactile photography, professionally styled but home-cooked Brazilian character. No people, no text, no logos, no stickers, no price badges, no frames, no watermark. Landscape 3:2 composition, high resolution, photographic detail.

As fontes DM Sans e Fraunces são fornecidas pelos pacotes Fontsource versionados no lockfile, sob licença OFL-1.1, e servidas localmente pelo build. Não há dependência de Google Fonts em tempo de execução.

## Expansão do cardápio — 20/09/2026

Nove novas imagens foram criadas com o **image_gen integrado**, uma por prato único
que não tinha imagem. A ilustração de bife existente foi preservada e atende às três
fichas de bife: agora as 12 fichas da demo têm uma imagem correspondente.

| Prato | Prefixo em `public/images/` | Prompt completo |
|---|---|---|
| Frango grelhado com arroz e feijão | `frango-grelhado-com-arroz-e-feijao` | [niko.json](image-prompts/niko.json) |
| Omelete de legumes com arroz | `omelete-de-legumes-com-arroz` | [niko.json](image-prompts/niko.json) |
| Macarrão com carne e tomate | `macarrao-com-carne-e-tomate` | [niko.json](image-prompts/niko.json) |
| Frango com legumes e arroz | `frango-com-legumes-e-arroz` | [casa.json](image-prompts/casa.json) |
| Lentilha com arroz e salada | `lentilha-com-arroz-e-salada` | [casa.json](image-prompts/casa.json), inclui edição final |
| Macarrão com tomate e queijo | `macarrao-com-tomate-e-queijo` | [casa.json](image-prompts/casa.json) |
| Frango com brócolis e arroz | `frango-com-brocolis-e-arroz` | [expressa.json](image-prompts/expressa.json) |
| Omelete com tomate e arroz | `omelete-com-tomate-e-arroz` | [expressa.json](image-prompts/expressa.json) |
| Macarrão com frango e brócolis | `macarrao-com-frango-e-brocolis` | [expressa.json](image-prompts/expressa.json) |

Cada prefixo tem versões `-640.webp` e `-1280.webp`, redimensionadas com Sharp,
qualidade 84, a partir dos PNGs 1536×1024. Os originais ficam em
`outputs/dish-images/` (ignorado pelo Git); as 18 versões WebP são os arquivos
definitivos consumidos e versionados pelo app.

Direção comum: fotografia culinária natural, prato de cerâmica marfim, mesa terracota,
linho creme, luz lateral suave, sem textos ou marcas. Ingredientes visíveis seguem
as fichas do cenário; não adicionar queijo, guarnições ou proteínas ausentes.
A lentilha recebeu edição pontual para remover cubos indevidos antes da integração.

O registro `lib/client/dish-illustrations.ts` associa somente nomes conhecidos,
normalizando caixa, espaços externos e Unicode NFC. Pratos novos ou nomes diferentes
mantêm o fallback; nenhuma imagem de outro prato é escolhida por semelhança.
O componente preserva texto alternativo específico, carregamento responsivo e
o aviso **Imagem ilustrativa · gerada por IA**. As imagens não comprovam tamanho
da porção, apresentação real, propriedades nutricionais ou disponibilidade.
