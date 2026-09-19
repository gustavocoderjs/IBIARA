import { DomainError, type PurchaseLine } from '../domain/types.ts';
import { identify, normalize } from './neuralake.ts';
import { cents, decimal, mul, rational, compare } from '../domain/money.ts';
// Bounded importer for supplied NF-e/NFC-e XML. No URLs, DTDs or external entities.
export function importXml(xml: string) {
    if (xml.length > 250000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new DomainError('FISCAL_SOURCE_UNSUPPORTED', 'XML inválido, muito grande ou com entidades externas.');
    const tag = (s: string, t: string) => s.match(new RegExp(`<${t}(?:\\s[^>]*)?>([^<]*)<\\/${t}>`))?.[1]?.trim();
    const key = xml.match(/Id=["']NFe(\d{44})["']/)?.[1];
    if (!key || !/<(?:nfeProc|NFe)[\s>]/.test(xml))
        throw new DomainError('FISCAL_SOURCE_UNSUPPORTED', 'Envie um XML NF-e/NFC-e com chave de 44 dígitos. QR e consulta online ainda não estão integrados.');
    const environment = tag(xml, 'tpAmb');
    if (!['1', '2'].includes(environment ?? ''))
        throw new DomainError('FISCAL_SOURCE_UNSUPPORTED', 'Ambiente fiscal ausente.');
    const products = [...xml.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/g)];
    if (!products.length || products.length > 200)
        throw new DomainError('FISCAL_SOURCE_UNSUPPORTED', 'XML sem itens suportados.');
    const lines: PurchaseLine[] = products.map(m => { const description = tag(m[1], 'xProd') ?? ''; const item = identify(description); if (!item)
        throw new DomainError('FISCAL_ITEM_UNMAPPED', `Vincule o insumo antes de importar: ${description}`); let quantity = tag(m[1], 'qCom') ?? ''; const unit = normalize(tag(m[1], 'uCom') ?? ''); if (unit === 'kg' && item.unit === 'g')
        quantity = decimal(mul(rational(quantity), rational('1000')));
    else if (!([item.unit, item.unit === 'un' ? 'und' : item.unit].includes(unit as never)))
        throw new DomainError('AMBIGUOUS_QUANTITY', `Unidade ${unit} exige conversão confirmada para ${description}.`); if (compare(quantity, '0') <= 0)
        throw new DomainError('AMBIGUOUS_QUANTITY', 'Quantidade deve ser positiva.'); const totalCents = cents(tag(m[1], 'vProd') ?? '') - cents(tag(m[1], 'vDesc') ?? '0') + cents(tag(m[1], 'vFrete') ?? '0') + cents(tag(m[1], 'vOutro') ?? '0'); if (totalCents < 0)
        throw new DomainError('INVALID_COST', 'Custo negativo.'); return { item: item.id, description, quantity, unit: item.unit, totalCents }; });
    return { key, environment: environment === '2' ? 'HOMOLOGACAO' : 'PRODUCAO', issuer: tag(xml.match(/<emit>([\s\S]*?)<\/emit>/)?.[1] ?? '', 'xNome') ?? 'Emissor informado no XML', lines };
}
