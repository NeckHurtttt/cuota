import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/fin.js';
const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

test('conversión de tasas', () => {
  near(F.effPeriod(0.12682503, 12), 0.01, 1e-6);       // 1 % mensual ⇔ 12,68 % efectiva anual
  near(F.nominalToTea(0.12, 12), 0.126825, 1e-5);
  near(F.teaToNominal(F.nominalToTea(0.18, 12), 12), 0.18, 1e-9);
});

test('francés: cuota fija conocida (10.000 al 1 % en 12 meses = 888,49)', () => {
  const r = F.schedule(10000, 0.01, 12, 'frances');
  for (const x of r.slice(0, -1)) near(x.cuota, 888.49);
  near(r.at(-1).saldo, 0, 1e-6);
  near(F.summary(r, 10000).intereses, 661.86, 0.02);
});

test('alemán: amortización fija y cuotas decrecientes', () => {
  const r = F.schedule(12000, 0.01, 12, 'aleman');
  for (const x of r) near(x.amort, 1000);
  assert.ok(r[0].cuota > r.at(-1).cuota);
  near(r[0].interes, 120); near(r.at(-1).interes, 10);
});

test('americano: solo intereses y todo el capital al final', () => {
  const r = F.schedule(5000, 0.02, 6, 'americano');
  for (const x of r.slice(0, -1)) { near(x.amort, 0); near(x.cuota, 100); }
  near(r.at(-1).cuota, 5100);
});

test('el alemán paga menos intereses que el francés, y este menos que el americano', () => {
  const s = (k) => F.summary(F.schedule(20000, 0.012, 24, k), 20000).intereses;
  assert.ok(s('aleman') < s('frances') && s('frances') < s('americano'));
});

test('período de gracia: solo intereses al principio', () => {
  const r = F.schedule(10000, 0.01, 12, 'frances', { gracia: 3 });
  for (const x of r.slice(0, 3)) { near(x.amort, 0); near(x.interes, 100); }
  near(r.at(-1).saldo, 0, 1e-6);
});

test('TCEA: sin costos extra coincide con la tasa; con seguro sube', () => {
  const i = F.effPeriod(0.15);
  const a = F.summary(F.schedule(10000, i, 24, 'frances'), 10000);
  near(a.tcea, 0.15, 1e-6);
  const b = F.summary(F.schedule(10000, i, 24, 'frances', { seguro: 0.0005, comision: 5 }), 10000);
  assert.ok(b.tcea > 0.16);
});

test('ahorro: aporte para meta y simulación llegan a la meta', () => {
  const i = F.effPeriod(0.05);
  const A = F.aporteParaMeta(10000, i, 24, 1000);
  const s = F.savings({ inicial: 1000, aporte: A, i, n: 24 });
  near(s.final, 10000, 0.01);
  assert.equal(F.mesesParaMeta(10000, A, i, 1000), 24);
});

test('ahorro flexible: saltos y aguinaldo cambian el total', () => {
  const base = F.savings({ aporte: 500, i: 0, n: 12 });
  const flex = F.savings({ aporte: 500, i: 0, n: 12, saltos: [3, 4], extra: 2000, extraMes: 12, mesInicio: 1 });
  near(base.final, 6000); near(flex.final, 6000 - 1000 + 2000);
});
