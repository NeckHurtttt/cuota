// Matemática financiera pura: tasas, sistemas de amortización, TIR y ahorro.

// Tasa efectiva anual → tasa efectiva del período (m períodos por año)
export const effPeriod = (tea, m = 12) => (1 + tea) ** (1 / m) - 1;
// Tasa nominal anual capitalizable k veces → efectiva anual
export const nominalToTea = (j, k = 12) => (1 + j / k) ** k - 1;
export const teaToNominal = (tea, k = 12) => k * ((1 + tea) ** (1 / k) - 1);

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Tabla de amortización.
 * sistema: 'frances' (cuota fija), 'aleman' (amortización fija), 'americano' (solo intereses y capital al final)
 * opts: { seguro: tasa mensual de desgravamen sobre saldo, comision: monto fijo por cuota, gracia: meses solo intereses }
 */
export function schedule(P, i, n, sistema = 'frances', opts = {}) {
  const { seguro = 0, comision = 0, gracia = 0 } = opts;
  const rows = [];
  let saldo = P;
  const nAm = n - gracia;
  const cuotaFr = i === 0 ? P / nAm : P * i / (1 - (1 + i) ** -nAm);
  for (let k = 1; k <= n; k++) {
    const interes = saldo * i;
    let amort;
    if (k <= gracia) amort = 0;
    else if (sistema === 'frances') amort = cuotaFr - interes;
    else if (sistema === 'aleman') amort = P / nAm;
    else amort = k === n ? saldo : 0;
    if (k === n) amort = saldo; // cierra redondeos
    const seg = saldo * seguro;
    const cuota = interes + amort;
    rows.push({ k, saldoIni: saldo, interes, amort, cuota, seguro: seg, comision, total: cuota + seg + comision, saldo: saldo - amort });
    saldo -= amort;
  }
  return rows;
}

export function summary(rows, P) {
  const s = (f) => rows.reduce((a, r) => a + r[f], 0);
  const flows = [P, ...rows.map((r) => -r.total)];
  const irrM = irr(flows);
  return {
    primera: rows[0]?.total ?? 0, ultima: rows.at(-1)?.total ?? 0, maxima: Math.max(...rows.map((r) => r.total)),
    intereses: s('interes'), seguros: s('seguro'), comisiones: s('comision'), totalPagado: s('total'),
    costo: s('total') - P, tceaMensual: irrM, tcea: irrM === null ? null : (1 + irrM) ** 12 - 1,
  };
}

// TIR por bisección + Newton (flujos del período)
export function irr(flows, lo = -0.99, hi = 1) {
  const npv = (r) => flows.reduce((a, f, t) => a + f / (1 + r) ** t, 0);
  let flo = npv(lo), fhi = npv(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;
  for (let it = 0; it < 200; it++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (fm * flo < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// ---------- Ahorro ----------
// Aporte mensual para llegar a una meta (anualidad vencida), con capital inicial
export function aporteParaMeta(meta, i, n, inicial = 0) {
  const fvIni = inicial * (1 + i) ** n;
  const falta = meta - fvIni;
  if (falta <= 0) return 0;
  return i === 0 ? falta / n : falta * i / ((1 + i) ** n - 1);
}

/**
 * Simula un plan de ahorro flexible mes a mes.
 * plan: { inicial, aporte, i, n, saltos: [meses sin aporte (1..n)], extraMes: 12 (diciembre) , extra: monto extra ese mes, mesInicio: 1..12 }
 */
export function savings({ inicial = 0, aporte = 0, i = 0, n = 12, saltos = [], extra = 0, extraMes = 12, mesInicio = 1 }) {
  const rows = []; let saldo = inicial, aportado = inicial, interesTot = 0;
  const skip = new Set(saltos);
  for (let k = 1; k <= n; k++) {
    const mesCal = ((mesInicio - 1 + k - 1) % 12) + 1;
    const interes = saldo * i;
    let ap = skip.has(k) ? 0 : aporte;
    if (extra && mesCal === extraMes) ap += extra;
    saldo += interes + ap; aportado += ap; interesTot += interes;
    rows.push({ k, mesCal, aporte: ap, interes, saldo, aportado, interesTot });
  }
  return { rows, final: saldo, aportado, intereses: interesTot };
}

// Meses para llegar a la meta con un aporte dado (null si no llega en 600 meses)
export function mesesParaMeta(meta, aporte, i, inicial = 0) {
  let s = inicial;
  for (let k = 1; k <= 600; k++) { s = s * (1 + i) + aporte; if (s >= meta - 1e-9) return k; }
  return null;
}

export { round2 };
