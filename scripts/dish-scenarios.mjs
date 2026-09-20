/**
 * Read-only conversation matrix: 10 distinct dishes × 10 semantic situations.
 * All prices, locations, availability and restaurants belong to the local demo.
 * This module declares inputs and intended outcomes; it never calls a provider,
 * creates an authorization, changes stock or purchases food.
 */
export const restaurantNames = {
    niko: 'Marmita Quentinha do Seu Niko',
    casa: 'Sabor de Casa',
    panela: 'Cozinha Expressa',
};

// Ten distinct names, twelve recipes: Bife a cavalo exists in all three kitchens.
// ingredientIds are the public food components; packaging and seasoning are omitted.
export const dishCatalog = [
    { id: 'bife_a_cavalo', name: 'Bife a cavalo', restaurantId: 'niko', restaurants: ['niko', 'casa', 'panela'],
        ingredientIds: ['patinho', 'ovo', 'batata', 'arroz', 'feijao'], conflict: 'ovo',
        alternate: 'Frango grelhado com arroz e feijão' },
    { id: 'frango_grelhado', name: 'Frango grelhado com arroz e feijão', restaurantId: 'niko', restaurants: ['niko'],
        ingredientIds: ['frango', 'arroz', 'feijao', 'cenoura'], conflict: 'frango',
        alternate: 'Omelete de legumes com arroz' },
    { id: 'omelete_legumes', name: 'Omelete de legumes com arroz', restaurantId: 'niko', restaurants: ['niko'],
        ingredientIds: ['ovo', 'cenoura', 'abobrinha', 'arroz'], conflict: 'ovo',
        alternate: 'Macarrão com carne e tomate' },
    { id: 'macarrao_carne', name: 'Macarrão com carne e tomate', restaurantId: 'niko', restaurants: ['niko'],
        ingredientIds: ['macarrao', 'patinho', 'tomate'], conflict: 'patinho', alternate: 'Bife a cavalo' },
    { id: 'frango_legumes', name: 'Frango com legumes e arroz', restaurantId: 'casa', restaurants: ['casa'],
        ingredientIds: ['frango', 'cenoura', 'abobrinha', 'arroz'], conflict: 'abobrinha',
        alternate: 'Lentilha com arroz e salada' },
    { id: 'lentilha_arroz', name: 'Lentilha com arroz e salada', restaurantId: 'casa', restaurants: ['casa'],
        ingredientIds: ['lentilha', 'arroz', 'tomate', 'alface'], conflict: 'arroz',
        alternate: 'Macarrão com tomate e queijo' },
    { id: 'macarrao_queijo', name: 'Macarrão com tomate e queijo', restaurantId: 'casa', restaurants: ['casa'],
        ingredientIds: ['macarrao', 'tomate', 'queijo'], conflict: 'queijo', alternate: 'Bife a cavalo' },
    { id: 'frango_brocolis', name: 'Frango com brócolis e arroz', restaurantId: 'panela', restaurants: ['panela'],
        ingredientIds: ['frango', 'brocolis', 'arroz'], conflict: 'brocolis',
        alternate: 'Omelete com tomate e arroz' },
    { id: 'omelete_tomate', name: 'Omelete com tomate e arroz', restaurantId: 'panela', restaurants: ['panela'],
        ingredientIds: ['ovo', 'tomate', 'queijo', 'arroz'], conflict: 'queijo',
        alternate: 'Macarrão com frango e brócolis' },
    { id: 'macarrao_frango', name: 'Macarrão com frango e brócolis', restaurantId: 'panela', restaurants: ['panela'],
        ingredientIds: ['macarrao', 'frango', 'brocolis'], conflict: 'frango', alternate: 'Bife a cavalo' },
];

export const scenarioKinds = [
    'complete_request', 'short_then_complete', 'budget_correction', 'deadline_correction',
    'restaurant_negation_and_ambiguity', 'replace_dish', 'conflicting_ingredient_exclusion',
    'allergy_and_preservation', 'unsupported_quantity', 'proximity_rating_and_ordinal',
];

const noReadyReply = ['Seu rascunho está pronto'];
const untouched = { budget: null, portions: null, maxMinutes: null, zone: null,
    excluded: null, foodSafetyConcern: null, restaurantId: null, deliveryPointId: null,
    selectionPreference: 'LOWEST_PRICE' };

function draftFor(dish, patch = {}) {
    return { description: dish.name, budget: '75.00', portions: 1, maxMinutes: 60,
        zone: 'demo_butanta', excluded: [], foodSafetyConcern: false,
        restaurantId: dish.restaurantId, deliveryPointId: 'usp', selectionPreference: 'LOWEST_PRICE', ...patch };
}
function fullMessage(dish, portions = 'uma') {
    return `Quero ${portions} ${portions === 'uma' ? 'porção' : 'porções'} de ${dish.name} no ${restaurantNames[dish.restaurantId]}. ` +
        'Meu limite total é 75 reais com entrega. Preciso receber em até 60 minutos, na USP. ' +
        'Não tenho alergias. Nenhum ingrediente para excluir.';
}
function completeStep(dish, patch = {}, suffix = '') {
    return { message: fullMessage(dish) + suffix, expectedDraft: draftFor(dish, patch), expectedReady: true };
}
const negations = [
    'Não quero trocar de restaurante.',
    'Não troque para a Cozinha Expressa.',
    'Não mude para o Sabor de Casa.',
    'Não prefiro a Cozinha Expressa.',
    'Não escolha o Seu Niko.',
    'Não quero outro restaurante.',
    'Não troque para o Seu Niko.',
    'Não mude para o Sabor de Casa.',
    'Não prefiro o Seu Niko.',
    'Não escolha Sabor de Casa.',
];

function casesFor(dish, index) {
    const make = (kind, steps) => ({ id: `${dish.id}__${kind}`, dish: dish.name,
        restaurantId: dish.restaurantId, category: kind, steps, purchase: false });
    return [
        make('complete_request', [completeStep(dish)]),
        make('short_then_complete', [
            { message: `Quero ${dish.name}.`, expectedDraft: { ...untouched, description: dish.name }, expectedReady: false },
            { message: `Escolho ${restaurantNames[dish.restaurantId]}. É uma porção; tenho 75 reais para o total. ` +
                'Entregue na USP em até 60 minutos. Não tenho alergias e nenhum ingrediente para excluir.',
                expectedDraft: draftFor(dish), expectedReady: true },
        ]),
        make('budget_correction', [
            completeStep(dish),
            { message: 'Corrigindo: meu limite total é 60 reais com entrega. Mantenha o prato, a quantidade e o prazo.',
                expectedDraft: draftFor(dish, { budget: '60.00' }), expectedReady: true },
        ]),
        make('deadline_correction', [
            completeStep(dish),
            { message: 'Preciso corrigir o prazo: no máximo 40 minutos. O restante continua igual.',
                expectedDraft: draftFor(dish, { maxMinutes: 40 }), expectedReady: true },
        ]),
        make('restaurant_negation_and_ambiguity', [
            completeStep(dish),
            { message: negations[index], expectedDraft: draftFor(dish), expectedReady: true,
                forbiddenReply: ['Qual restaurante você prefere?', 'Restaurantes compatíveis'] },
            { message: 'Quero Sabor de Casa ou Cozinha Expressa; ainda não decidi qual.',
                expectedDraft: draftFor(dish), expectedQuestionKind: 'restaurant_choice' },
        ]),
        make('replace_dish', [
            completeStep(dish),
            { message: `Mudei de ideia: troque por ${dish.alternate}. Mantenha meu restaurante e os limites.`,
                expectedDraft: draftFor(dish, { description: dish.alternate }), expectedReady: true },
        ]),
        make('conflicting_ingredient_exclusion', [
            completeStep(dish),
            // No alternative recipe was authorized. Preserve the selected dish,
            // explain the conflict and prevent presenting the draft as ready.
            { message: `Agora quero excluir ${dish.conflict}. Sem ${dish.conflict}, por favor. Não substitua meu prato.`,
                expectedDraft: draftFor(dish, { excluded: [dish.conflict] }), expectedReady: false,
                expectedUnsupported: 'ingrediente', forbiddenReply: noReadyReply },
        ]),
        make('allergy_and_preservation', [
            completeStep(dish),
            { message: `Preciso corrigir: tenho alergia a ${dish.conflict}.`,
                expectedDraft: draftFor(dish, { foodSafetyConcern: true }), expectedReady: false,
                expectedUnsupported: 'alergênicos', forbiddenReply: noReadyReply },
            { message: 'Não quero trocar de restaurante. O orçamento continua 75 reais.',
                expectedDraft: draftFor(dish, { foodSafetyConcern: true }), expectedReady: false,
                expectedUnsupported: 'alergênicos', forbiddenReply: noReadyReply },
        ]),
        make('unsupported_quantity', [
            { message: fullMessage(dish, 'duas'), expectedDraft: draftFor(dish, { portions: 2 }),
                expectedReady: false, expectedUnsupported: 'uma porção', forbiddenReply: noReadyReply },
            { message: 'Não reduza minha quantidade. Quero manter duas porções.',
                expectedDraft: draftFor(dish, { portions: 2 }), expectedReady: false,
                expectedUnsupported: 'uma porção', forbiddenReply: noReadyReply },
        ]),
        make('proximity_rating_and_ordinal', [
            completeStep(dish, { selectionPreference: 'NEAREST' }, ' Prefiro o restaurante mais próximo.'),
            { message: 'Quais restaurantes têm esse prato? Agora prefiro melhor avaliação.',
                expectedDraft: draftFor(dish, { selectionPreference: 'BEST_RATED' }), expectedQuestionKind: 'restaurant_choice' },
            { message: 'A primeira.', expectedDraft: draftFor(dish, {
                selectionPreference: 'BEST_RATED', restaurantId: dish.id === 'bife_a_cavalo' ? 'casa' : dish.restaurantId,
            }), expectedReady: true },
        ]),
    ];
}

export const scenarios = dishCatalog.flatMap(casesFor);
