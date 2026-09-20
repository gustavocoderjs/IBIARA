---
name: i.byara
description: Refeição com presença física; operação com clareza.
colors:
  primary: "#bd351e"
  background: "#f5f5f7"
  foreground: "#202124"
  card: "#fff"
  secondary: "#eeeef0"
  muted-foreground: "#62636b"
  accent: "#fcece7"
  accent-foreground: "#a72c18"
  border: "#e1e1e6"
  input: "#c9c9d0"
  sidebar-foreground: "#5d5e65"
  stage: "#252529"
  success: "#326147"
  success-bg: "#eaf4ed"
  warning: "#7b5311"
  warning-bg: "#fff0d7"
  error: "#a32c21"
  error-bg: "#fce5e1"
typography:
  display:
    fontFamily: "'DM Sans Variable', Arial, sans-serif"
    fontSize: "clamp(36px,4vw,56px)"
    fontWeight: 650
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'DM Sans Variable', Arial, sans-serif"
    fontSize: "clamp(32px,3.4vw,48px)"
    fontWeight: 650
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'DM Sans Variable', Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "'DM Sans Variable', Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  label:
    fontFamily: "'DM Sans Variable', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
rounded:
  tag: "6px"
  control: "10px"
  ticket: "12px"
  photo: "14px"
  panel: "16px"
spacing:
  compact: "12px"
  field-gap: "16px"
  inset: "20px"
  section: "24px"
  panel: "28px"
  intent: "30px"
  column-gap: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
  button-ghost:
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "44px"
  navigation-active:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "12px 14px"
  tag-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.tag}"
    padding: "6px 10px"
  panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
---

# Design System: i.byara

## Overview

**Creative North Star: "Refeição com presença física; operação com clareza."**

A inspiração Apple aparece nas superfícies claras, na tipografia sans forte e na profundidade contida. Tomate mantém a assinatura da i.byara; a fotografia gastronômica aproxima a refeição, enquanto controles diretos sustentam compra e serviço.

A experiência continua sendo um aplicativo de trabalho. O movimento acompanha a intenção e as mudanças de estado, com conteúdo e controles disponíveis desde o primeiro desenho.

**Key Characteristics:**
- Branco e cinza frio com grafite estrutural e ações tomate.
- DM Sans local em títulos, formulários e operação.
- Profundidade fotográfica pontual; superfícies de trabalho leves.
- Estados e limites compreensíveis por texto, além da cor.

Registro da revisão 0.4.0, reconciliado com o sistema anterior. A cascata efetiva é `app/globals.css`, `app/operations.css`, `app/appetite.css`; este último define os overrides finais. Fontes complementares: `components/motion-surface.tsx`, `components/marketplace.tsx`, `components/workspace.tsx`, `PRODUCT.md` e `docs/design/MOTION.md`. Este registro foi conferido por inspeção de código; não certifica redução de movimento em dispositivo.

## Colors

A base é fria e luminosa; o acento quente orienta a ação sem competir com a comida. Os valores normativos estão no frontmatter.

### Primary

Tomate (`primary`) marca ação principal, foco e assinatura. Pêssego (`accent`) acompanha seleções e mensagens; tomate profundo (`accent-foreground`) sustenta seu texto.

### Neutral

Cinza frio (`background`) separa os painéis brancos (`card`). Grafite (`foreground`, `stage`) organiza leitura e cenas escuras. Cinza de apoio (`muted-foreground`) cobre descrições e unidades; `sidebar-foreground` identifica navegação inativa. `secondary`, `border` e `input` distinguem agrupamentos, divisórias e campos.

Verde, âmbar e vermelho são estados semânticos de sucesso, atenção e erro, acompanhados de suas superfícies claras. Não constituem acentos concorrentes.

**The Estados legíveis Rule.** Cor acompanha rótulos, ícones ou mensagens; não comunica estado sozinha.

## Typography

DM Sans Variable é carregada localmente; Arial e sans-serif são contingências. Títulos usam peso forte e espaçamento compacto; o corpo mantém leitura direta. A escala registra papéis existentes, sem impor uma progressão matemática.

Display corresponde ao título da compra; headline, aos títulos gerais; title, ao formulário. No mobile, o título da compra usa 38px e os títulos gerais 34px. Descrições usam 15–16px, rótulos 14px e notas 12–13px. O orçamento e o prazo recebem números de 23px; valores financeiros e quantidades usam numerais tabulares. Descrições de página limitam-se a 68ch.

**The Controles claros Rule.** Preserve sans nos controles, unidades legíveis e numerais tabulares nos valores.

## Layout

Sidebar desktop de 246px e conteúdo central de até 1500px. Margens laterais: 38px no desktop, 26px entre 768–1200px, 18px no mobile e 14px até 360px. Barra superior fixa durante a rolagem, com 68px no desktop e 60px no mobile.

Na compra ampla, cena à esquerda e formulário à direita usam proporção 1,08:1, intervalo de 32px e coluna de formulário com mínimo de 360px. Entre 768–1020px, o formulário passa à linha seguinte. Até 767px, a cena fica compacta, sem texto de apoio intermediário, e o formulário segue imediatamente. Essa composição pertence à compra; áreas de cozinha priorizam o conteúdo de trabalho.

Pedidos mantêm três colunas no desktop e etapa selecionável no mobile. A navegação inferior fixa reserva espaço para a área segura. Campos de orçamento e prazo permanecem lado a lado; formulários mantêm rótulos visíveis.

## Elevation & Depth

Painéis brancos usam elevação ambiente suave; as áreas de trabalho combinam preenchimentos e divisórias discretas. Grafite dá contraste às cenas e aos resumos operacionais. Fotografias e a faixa de composição recebem sombras mais fortes somente dentro da cena espacial; os valores estão nas extensões do sidecar.

A cena usa perspectiva CSS de 1100px. A rolagem reduz a inclinação horizontal e vertical; cursor de mouse acrescenta variação discreta. Não há WebGL nem dependência nova. O agendamento por requestAnimationFrame responde a eventos, sem ciclo contínuo; a cena suspende atualização fora da área visível ou em aba oculta.

Transições cromáticas duram 160ms; pressão, 180ms; troca de área, 280ms. A acomodação da cena usa 600ms e sua entrada única, 750ms. Redução de movimento remove as transições CSS e impede a transição de área; a cena fica estática em toque e com redução de movimento. No mobile, a faixa flutuante é ocultada. A voz pode pulsar durante fala/escuta, como estado funcional.

**The Movimento a serviço Rule.** Movimento acompanha contexto e estado sem atrasar o uso dos controles.

## Shapes

Cantos suaves organizam a hierarquia: tags compactas, controles discretos, tickets intermediários e painéis amplos. As medidas normativas estão em `rounded`. Fotografias usam recorte com `object-fit: cover`; círculos ficam reservados a avatares e controles de voz. Painéis principais dispensam borda, mas campos e divisórias a mantêm quando necessária à leitura.

## Components

- **Botões:** primário tomate com texto branco; outline e ghost apoiam ações secundárias. Botões da biblioteca têm mínimo de 44×44px, peso 600 e leve redução ao pressionar. A autorização tem mínimo de 54px, texto completo e quebra de linha. Foco geral usa contorno tomate de 2px, afastado 4px; desabilitado usa opacidade de 55%.
- **Campos:** fundo branco, borda de input, raio de controle e foco com cor de ring. Busca operacional tem 44px; no mobile, inputs usam pelo menos 16px. Intenção usa textarea de 16px sobre cinza muito claro. Orçamento ganha fundo pêssego suave e texto tomate profundo; suas unidades usam o cinza de apoio.
- **Navegação:** itens desktop de 46px, seleção grafite com texto branco. Navegação mobile usa itens de 54px, seleção pêssego e texto tomate, ícones e `aria-current`.
- **Tags:** texto e cor descrevem sucesso, atenção, erro ou contexto. São indicadores, sem simular botões.
- **Painéis e tickets:** branco com cantos suaves. Formulário usa 30px de padding no desktop e 24px 20px no mobile. Tickets priorizam prato, horário, total com entrega e próxima ação.
- **Cena da refeição:** fotografia em planos CSS, legenda de composição e aviso de origem. A imagem existente corresponde somente ao nome normalizado “bife a cavalo”; outros pratos mantêm fallback explícito. O aviso “Imagem ilustrativa · IA” continua visível em modo compacto.

## Do's and Don'ts

### Do:
- **Do** Preservar origem das imagens e contexto de demonstração.
- **Do** Manter foco visível, alvos de toque de pelo menos 44px e redução de movimento.
- **Do** Associar estados a texto compreensível e manter limites de compra próximos à autorização.
- **Do** Usar os dados comerciais existentes, inclusive total com entrega.

### Don't:
- **Don't** Representar imagem ilustrativa como fotografia do produto vendido.
- **Don't** Inventar avaliações, escassez ou preços para sustentar a apresentação.
- **Don't** Transformar verde em acento predominante.
- **Don't** Tornar a compreensão ou a autorização dependente de movimento, voz ou cor.
