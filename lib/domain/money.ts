import { DomainError } from './types.ts';
// Exact decimal input -> rational BigInt. Never binary floating point for finance.
export type Rational = {
    n: bigint;
    d: bigint;
};
export function rational(value: string): Rational {
    if (!/^-?\d{1,12}(\.\d{1,6})?$/.test(value))
        throw new DomainError('INVALID_DECIMAL', 'Use uma quantidade decimal válida, com até 6 casas.');
    const sign = value.startsWith('-') ? -1n : 1n;
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return { n: sign * BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
}
export const add = (a: Rational, b: Rational): Rational => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
export const mul = (a: Rational, b: Rational): Rational => ({ n: a.n * b.n, d: a.d * b.d });
export function div(a: Rational, b: Rational): Rational { if (b.n <= 0n)
    throw new DomainError('INVALID_YIELD', 'O rendimento deve ser maior que zero.'); return { n: a.n * b.d, d: a.d * b.n }; }
export const ceil = (a: Rational): bigint => a.n >= 0n ? (a.n + a.d - 1n) / a.d : a.n / a.d;
export const round = (a: Rational): bigint => (a.n * 2n + a.d) / (a.d * 2n);
export function integer(n: bigint): number { if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER))
    throw new DomainError('VALUE_TOO_LARGE', 'Valor fora do limite.'); return Number(n); }
export function decimal(a: Rational): string { const scaled = ceil(mul(a, { n: 1000000n, d: 1n })); const neg = scaled < 0n; const digits = (neg ? -scaled : scaled).toString().padStart(7, '0'); const value = `${neg ? '-' : ''}${digits.slice(0, -6)}.${digits.slice(-6)}`; return value.replace(/0+$/, '').replace(/\.$/, ''); }
export function qadd(a: string, b: string) { return decimal(add(rational(a), rational(b))); }
export function qsub(a: string, b: string) { const r = rational(b); return decimal(add(rational(a), { n: -r.n, d: r.d })); }
export function compare(a: string, b: string) { const x = rational(a), y = rational(b); return x.n * y.d < y.n * x.d ? -1 : x.n * y.d > y.n * x.d ? 1 : 0; }
export function cents(value: string): number { return integer(round(mul(rational(value.replace(',', '.')), { n: 100n, d: 1n }))); }
export const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v / 100);
