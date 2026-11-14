// Comisión de la máquina de tarjetas (POS): el porcentaje que el proveedor (Transbank, Getnet, SumUp, Mercado Pago
// Point…) descuenta de cada pago con débito o crédito. Se resta de lo que le queda al negocio en Inicio y Reportes.

export type CardFees = { debit: number; credit: number }

export const NO_CARD_FEES: CardFees = { debit: 0, credit: 0 }

/** Tope razonable: ninguna máquina cobra más de esto. */
export const MAX_CARD_FEE = 15

export const hasCardFees = (f: CardFees) => f.debit > 0 || f.credit > 0

export function cardFeeRate(method: string, f: CardFees) {
  return method === "DEBIT" ? f.debit : method === "CREDIT" ? f.credit : 0
}

/** Lo que la máquina se queda de un pago, en pesos enteros. */
export function cardFeeFor(total: number, method: string, f: CardFees) {
  const rate = cardFeeRate(method, f)
  return rate > 0 && total > 0 ? Math.round((total * rate) / 100) : 0
}

/** "1,79 %" */
export const formatRate = (rate: number) => `${rate.toLocaleString("es-CL", { maximumFractionDigits: 2 })} %`
