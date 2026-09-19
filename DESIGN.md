---
name: i.byara
description: Cerâmica clara, comida em destaque e controles de cozinha.
colors:
  primary: "#b9361e"
  saffron: "#f3bf52"
  sage: "#426248"
  background: "#faf6ef"
  foreground: "#342720"
  card: "#fffdf9"
  secondary: "#f5ead9"
  secondary-foreground: "#513323"
  muted: "#f3ece2"
  muted-foreground: "#756253"
  accent: "#fce4d8"
  accent-foreground: "#9a301d"
  border: "#e5d9ca"
  input: "#d7c7b5"
  sidebar: "#f4ede2"
typography:
  display:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "49px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "39px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Fraunces Variable', Georgia, serif"
    fontSize: "26px"
    fontWeight: 550
    lineHeight: 1.25
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
  control: "8px"
  ticket: "10px"
  panel: "14px"
spacing:
  compact: "12px"
  field-gap: "16px"
  card: "20px"
  section: "24px"
  panel: "27px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.control}"
  panel:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.panel}"
---

# Sistema visual da i.byara

## Direção

Cardápio de cozinha brasileira: cerâmica clara, tomate nas ações e açafrão nos destaques. Fotografia gastronômica aproxima a compra da comida; controles diretos sustentam a operação.

Registro extraído do código: `appetite.css` prevalece sobre `operations.css`, que prevalece sobre `globals.css`. Componentes amostrados: marketplace, fotografias, workspace, pedidos e ajustes. Não há comp aprovado nem verificação visual desta revisão: o navegador retornou `ERR_BLOCKED_BY_CLIENT`.

## Cores e tipografia

Tomate identifica ações principais, foco, marca e seleção. Açafrão destaca a refeição e a interação de voz. Sálvia identifica sucesso, disponibilidade e preparo concluído. Estados sempre combinam texto e cor.

Fraunces Variable dá expressão aos títulos. DM Sans Variable mantém formulários, navegação e dados operacionais claros. As fontes são locais. A hierarquia acima registra usos concretos, não uma escala matemática. No mobile, o título da compra passa a 39px e o título geral a 32px. Descrições de página usam 15px; formulários mobile usam pelo menos 16px. Valores financeiros e quantidades usam numerais tabulares.

## Composição

Sidebar desktop de 246px; conteúdo central com largura máxima de 1500px. Margens laterais usuais: 38px, 26px entre 768–1200px, 18px no mobile e 14px até 360px.

Compra usa duas colunas com intervalo de 30px; até 970px, o formulário ocupa uma linha própria. Até 767px, foto e descrição empilham. Pedidos usam três colunas no desktop e uma etapa selecionável no mobile. Navegação inferior fixa reserva espaço para a área segura. Botões mobile têm mínimo de 44px; autorização usa mínimo de 54px.

## Superfícies e movimento

Painéis e tickets não têm sombra. Bordas, preenchimentos e hierarquia criam separação. Componentes de formulário herdados conservam sombras discretas e anéis de foco.

O indicador de voz usa anéis concêntricos: `0 0 0 12px #fae7d3, 0 0 0 24px #fdf2e2`. A animação responde à escuta/fala. Redução de movimento desativa animações e transições. Controles têm transições cromáticas de 160ms e deslocamento de 1px ao pressionar.

## Componentes

- Botão primário tomate, outline claro com borda, ghost com preenchimento no hover. Peso 600, raio 8px. Foco geral: contorno tomate de 2px, afastado 4px.
- Inputs com fundo `card`, borda `input`, raio 8px e rótulo visível. Orçamento e prazo usam números maiores; orçamento recebe superfície amarela suave.
- Painéis claros com borda fina e raio 14px. Formulário de compra tem borda superior tomate de 3px e padding de 27px. Oferta escolhida recebe borda tomate de 2px.
- Navegação desktop com itens de 46px e preenchimento pêssego na seleção. Navegação mobile com itens de 54px, `aria-current`, ícone e texto.
- Tags de sucesso, aviso, erro e contexto neutro combinam texto, preenchimento e borda; raio 6px.
- Fotografias geradas mantêm aviso de origem. Somente o nome exato normalizado `bife a cavalo` corresponde à imagem atual. Outros pratos recebem fallback explícito. Recortes usam `object-fit: cover`.
- Tickets priorizam prato, horário, total com entrega e próxima ação. Cabeçalhos distinguem a preparar, em preparo e pronto.

## Continuidade

Preservar identificação de imagens ilustrativas, contexto de sandbox, foco e redução de movimento. Não apresentar avaliações, escassez ou preços inventados como fatos. Verde não deve voltar a dominar a interface. Estilos residuais de kicker/eyebrow não são regras reutilizáveis da identidade.

Esta documentação descreve o código e não certifica composição ou comportamento renderizado em dispositivos.
