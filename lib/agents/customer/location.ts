import { normalize } from '../../adapters/neuralake.ts';
import { catalog } from '../../domain/fixtures.ts';
import type { CustomerDraft } from './schemas.ts';

/** One interpretation shared by zone and simulated point; a restaurant's address
 * must never replace the customer's delivery destination. */
export function customerLocation(message: string) {
    const result: { zone?: CustomerDraft['zone']; deliveryPointId?: CustomerDraft['deliveryPointId'] } = {};
    for (const clause of normalize(message).split(/[,;!?]|\.\s*|\bmas\b/)) {
        if (/\b(?:talvez|exemplo|hipoteticamente|nao sei|se fosse)\b/.test(clause)) continue;
        if (/\b(?:restaurante|cozinha expressa|sabor de casa|seu niko|niko)\b/.test(clause) && /\b(?:fica|localizado|pode ser|seja|e no|e na)\b/.test(clause)
            && !/\b(?:entrega|moro|estou|meu bairro|meu endereco)\b/.test(clause)) continue;
        const points = ([['vila_indiana', /\bvila indiana\b/], ['usp', /\b(?:usp|cidade universitaria)\b/],
            ['butanta_centro', /\b(?:butanta|butata)\b/]] as const).filter(([, pattern]) => pattern.test(clause));
        if (points.length > 1) { result.zone = 'demo_butanta'; result.deliveryPointId = null; continue; }
        const point = points[0]?.[0];
        if (point) {
            const negativeDestination = /\bnao\s+(?:(?:quero )?(?:(?:a )?entrega|entregar|receber)|e|sera|vai ser|moro|estou)\b/.test(clause) || /\bfora (?:do|da|de)\b/.test(clause);
            result.zone = negativeDestination ? (point === 'butanta_centro' ? 'other' : null) : 'demo_butanta';
            result.deliveryPointId = negativeDestination ? null : point;
            continue;
        }
        const place = clause.match(/\b(?:(?:(?:a )?entrega(?: (?:sera|vai ser))?|sera|vai ser|moro|estou|e) (?:em|no|na)|(?:meu )?(?:bairro|regiao|endereco) (?:e|sera|de))\s+([a-z][a-z -]*)/)?.[1].trim();
        if (!place || /\bnao (?:e|sera|vai ser|moro|estou)\b/.test(clause)) continue;
        if (/^(?:ate|menos|mais|prazo|mesm[oa]|outr[oa]|algum|qualquer|local|lugar|endereco|bairro|regiao|restaurante|prato|pedido|cardapio|horario|dia|momento|inicio|fim|comeco|total|maximo|minimo|que|meu|minha|seu|sua|casa|trabalho|escritorio|empresa|hotel|faculdade|escola|hospital)\b/.test(place)) continue;
        if (catalog.some(item => item.aliases.some(alias => place === alias || place.startsWith(`${alias} `)))) continue;
        result.zone = 'other'; result.deliveryPointId = null;
    }
    return result;
}
