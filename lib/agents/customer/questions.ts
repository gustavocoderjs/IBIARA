import type { CustomerDraft, CustomerQuestion } from './schemas.ts';

export const locationQuestion = (): CustomerQuestion => ({ kind: 'location', field: 'deliveryPointId',
    text: 'Em qual ponto da demonstração será a entrega: Butantã, USP ou Vila Indiana? Usamos locais fictícios para comparar proximidade.',
    options: ['Butantã', 'USP', 'Vila Indiana'] });

/** Question identity is chosen before rendering, never parsed back from the reply. */
export function nextDraftQuestion(draft: CustomerDraft): CustomerQuestion | null {
    const fields: [keyof CustomerDraft, string][] = [
        ['description', 'Qual refeição você quer?'],
        ['budget', 'Qual seu limite total em reais, com entrega?'],
        ['portions', 'É para uma porção?'],
        ['maxMinutes', 'Em quantos minutos precisa receber?'],
        ['zone', 'A entrega será no Butantã?'],
    ];
    for (const [field, text] of fields) if (draft[field] == null) return { kind: 'field', field, text };
    if (draft.selectionPreference === 'NEAREST' && !draft.deliveryPointId) return locationQuestion();
    if (draft.excluded === null || draft.foodSafetyConcern === null) return { kind: 'field', field: 'foodSafetyConcern',
        text: 'Há ingredientes a excluir, alergias ou risco de contaminação cruzada?' };
    return null;
}

export function explainQuestion(question: CustomerQuestion | null | undefined) {
    if (!question) return 'Estamos montando seu pedido de comida. Você pode pedir sugestões, comparar restaurantes, mudar uma escolha ou revisar os dados antes de autorizar uma compra simulada.';
    const descriptions: Partial<Record<CustomerQuestion['kind'], string>> = {
        location: 'Para dizer qual restaurante fica perto, preciso de um ponto de referência. Esta demo usa três pontos fictícios; não acessa GPS nem calcula uma rota real.',
        restaurant_choice: 'Os números desta lista representam restaurantes. Escolha pelo nome ou número; depois veremos os pratos dessa cozinha. Isso ainda não autoriza uma compra.',
        dish_choice: 'Os números desta lista representam pratos. Você pode escolher pelo nome ou número, ou pedir mais opções. Nada será comprado antes da revisão e autorização.',
        meal_style: 'Quero entender o tipo de refeição que você procura. “Leve” ou “reforçada” não definem calorias ou tamanho extra; posso comparar os ingredientes e preparos cadastrados.',
        portion_meaning: '“Pouco” pode ser menos comida ou menos dinheiro. O orçamento e a quantidade são informações separadas. A demo vende uma porção padrão por compra.',
    };
    const fields: Partial<Record<keyof CustomerDraft, string>> = {
        budget: 'É o máximo que você aceita pagar pelo pedido inteiro, incluindo entrega. Um preço mostrado no cardápio não define esse limite.',
        portions: 'Quero confirmar a quantidade de refeições. A demo suporta uma porção padrão por compra; não preciso de pesos de ingredientes.',
        maxMinutes: 'É o máximo de minutos que você aceita esperar. Se pedir apenas rapidez, posso priorizar o menor prazo, mas não vou inventar seu limite.',
        zone: 'Preciso saber a região da entrega para conferir atendimento. Nesta demo, os pontos disponíveis ficam na região simulada do Butantã.',
        foodSafetyConcern: 'Quero saber se há algum ingrediente a evitar e se existe alergia ou risco de contaminação. A demo não verifica segurança alimentar.',
        description: 'Você pode dizer um prato, um ingrediente que gosta ou pedir sugestões de restaurantes. Não precisa informar uma receita nem pesar alimentos.',
    };
    return `${descriptions[question.kind] ?? (question.field ? fields[question.field] : '') ?? 'Vamos completar somente a informação que falta.'}\n${question.text}`;
}
