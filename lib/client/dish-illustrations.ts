// Exact known dishes only. Generated food illustrations never substitute for a recipe.
const illustrations: Record<string, { slug: string; alt: string }> = {
    'bife a cavalo': {
        slug: 'bife-a-cavalo', alt: 'Imagem ilustrativa de bife a cavalo com ovo, arroz, feijão e batatas douradas',
    },
    'frango grelhado com arroz e feijão': {
        slug: 'frango-grelhado-com-arroz-e-feijao', alt: 'Imagem ilustrativa de frango grelhado com arroz, feijão e cenoura',
    },
    'omelete de legumes com arroz': {
        slug: 'omelete-de-legumes-com-arroz', alt: 'Imagem ilustrativa de omelete com cenoura e abobrinha, acompanhada de arroz',
    },
    'macarrão com carne e tomate': {
        slug: 'macarrao-com-carne-e-tomate', alt: 'Imagem ilustrativa de macarrão com pedaços de carne e tomate',
    },
    'frango com legumes e arroz': {
        slug: 'frango-com-legumes-e-arroz', alt: 'Imagem ilustrativa de frango com cenoura, abobrinha e arroz',
    },
    'lentilha com arroz e salada': {
        slug: 'lentilha-com-arroz-e-salada', alt: 'Imagem ilustrativa de lentilha com arroz e salada de tomate e alface',
    },
    'macarrão com tomate e queijo': {
        slug: 'macarrao-com-tomate-e-queijo', alt: 'Imagem ilustrativa de macarrão com molho de tomate e queijo muçarela',
    },
    'frango com brócolis e arroz': {
        slug: 'frango-com-brocolis-e-arroz', alt: 'Imagem ilustrativa de frango grelhado com brócolis e arroz',
    },
    'omelete com tomate e arroz': {
        slug: 'omelete-com-tomate-e-arroz', alt: 'Imagem ilustrativa de omelete com tomate e queijo, acompanhada de arroz',
    },
    'macarrão com frango e brócolis': {
        slug: 'macarrao-com-frango-e-brocolis', alt: 'Imagem ilustrativa de macarrão com frango grelhado e brócolis',
    },
};

export function dishIllustration(dish: string) {
    const name = dish.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
    return Object.hasOwn(illustrations, name) ? illustrations[name] : null;
}
