import * as F from './fin.js';

const $ = (s) => document.querySelector(s);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const bs = (x, d = 2) => 'Bs ' + Number(x).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 2) => (x * 100).toLocaleString('es-BO', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
const num = (form, name) => { const v = parseFloat(form.elements[name].value); return Number.isFinite(v) ? v : 0; };

const SYS = {
  frances: { name: 'Francés', desc: 'Cuota fija todos los meses. El más usado en Bolivia.' },
  aleman: { name: 'Alemán', desc: 'Pagas igual de capital: la cuota empieza alta y baja.' },
  americano: { name: 'Americano', desc: 'Solo intereses cada mes y todo el capital al final.' },
};
let sel = 'frances';

// ---------------- gráficos ----------------
function niceMax(v) { const m = 10 ** Math.floor(Math.log10(v || 1)); return Math.ceil(v / m) * m; }
function loanChart(rows, P) {
  const W = 760, H = 300, m = { l: 62, r: 56, t: 10, b: 28 };
  const maxC = niceMax(Math.max(...rows.map((r) => r.total)) * 1.05);
  const bw = (W - m.l - m.r) / rows.length;
  const Y = (v) => H - m.b - v / maxC * (H - m.t - m.b);
  const Ys = (v) => H - m.b - v / P * (H - m.t - m.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Capital e interés de cada cuota">`;
  for (let k = 0; k <= 4; k++) {
    const v = maxC * k / 4; s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString('es-BO')}</text>`;
    s += `<text class="tick" x="${W - m.r + 6}" y="${Ys(P * k / 4) + 4}">${Math.round(P * k / 4 / 1000)}k</text>`;
  }
  rows.forEach((r, i) => {
    const x = m.l + i * bw, w = Math.max(1, bw * 0.78);
    const yA = Y(r.amort), yI = Y(r.amort + r.interes), yS = Y(r.total);
    s += `<g class="hover"><title>Mes ${r.k}: capital ${bs(r.amort)} · interés ${bs(r.interes)} · seguro+comisión ${bs(r.seguro + r.comision)}</title>`;
    s += `<rect class="am" x="${x}" y="${yA}" width="${w}" height="${H - m.b - yA}"/><rect class="in" x="${x}" y="${yI}" width="${w}" height="${yA - yI}"/><rect class="se" x="${x}" y="${yS}" width="${w}" height="${yI - yS}"/></g>`;
  });
  const pts = [[m.l, Ys(P)], ...rows.map((r, i) => [m.l + (i + 1) * bw, Ys(r.saldo)])];
  s += `<path class="saldo" d="M${pts.map((p) => p.join(',')).join('L')}"/>`;
  const step = rows.length > 120 ? 24 : rows.length > 48 ? 12 : rows.length > 24 ? 6 : 1;
  rows.forEach((r, i) => { if (r.k % step === 0 || r.k === 1) s += `<text class="tick" x="${m.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${r.k}</text>`; });
  return s + '</svg>';
}
function saveChart(rows, meta, inicial) {
  const W = 760, H = 280, m = { l: 66, r: 14, t: 12, b: 28 };
  const maxV = niceMax(Math.max(meta, ...rows.map((r) => r.saldo)) * 1.05);
  const bw = (W - m.l - m.r) / rows.length;
  const Y = (v) => H - m.b - v / maxV * (H - m.t - m.b);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Crecimiento del ahorro">`;
  for (let k = 0; k <= 4; k++) { const v = maxV * k / 4; s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString('es-BO')}</text>`; }
  rows.forEach((r, i) => {
    const x = m.l + i * bw, w = Math.max(1, bw * 0.8);
    s += `<g class="hover"><title>Mes ${r.k} (${MESES[r.mesCal - 1]}): aportaste ${bs(r.aporte)} · saldo ${bs(r.saldo)}</title><rect class="ap" x="${x}" y="${Y(r.aportado)}" width="${w}" height="${H - m.b - Y(r.aportado)}"/><rect class="in" x="${x}" y="${Y(r.saldo)}" width="${w}" height="${Math.max(0, Y(r.aportado) - Y(r.saldo))}"/></g>`;
  });
  s += `<line class="meta" x1="${m.l}" x2="${W - m.r}" y1="${Y(meta)}" y2="${Y(meta)}"/>`;
  const step = rows.length > 48 ? 12 : rows.length > 24 ? 6 : 3;
  rows.forEach((r, i) => { if (r.k % step === 0) s += `<text class="tick" x="${m.l + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${r.k}</text>`; });
  return s + '</svg>';
}

// ---------------- préstamo ----------------
let last = null;
function loan() {
  const f = $('#f-loan');
  const P = Math.max(0, num(f, 'P')), n = Math.max(1, Math.round(num(f, 'n'))), tasa = num(f, 'tasa') / 100;
  const tea = f.elements.tipo.value === 'nominal' ? F.nominalToTea(tasa, 12) : tasa;
  const i = F.effPeriod(tea, 12);
  const opts = { seguro: num(f, 'seguro') / 100, comision: num(f, 'comision'), gracia: Math.min(n - 1, Math.max(0, Math.round(num(f, 'gracia')))) };
  $('#im').textContent = `${pct(i, 4)} (TEA ${pct(tea)})`;
  const all = Object.keys(SYS).map((k) => { const rows = F.schedule(P, i, n, k, opts); return { k, rows, s: F.summary(rows, P) }; });
  const minInt = Math.min(...all.map((a) => a.s.costo));
  $('#sys-cards').innerHTML = all.map(({ k, s }) => `<button type="button" class="sys ${k === sel ? 'on' : ''}" data-sys="${k}">
      <div class="name">${SYS[k].name}${s.costo === minInt ? '<span class="tag">más barato</span>' : ''}</div>
      <div class="desc">${SYS[k].desc}</div>
      <div class="cuota">${bs(s.primera)}<small>${k === 'frances' && !opts.gracia ? '/ mes' : '1ª cuota'}</small></div>
      <dl><dt>Última cuota</dt><dd>${bs(s.ultima)}</dd><dt>Intereses</dt><dd>${bs(s.intereses)}</dd><dt>Seguro y comisión</dt><dd>${bs(s.seguros + s.comisiones)}</dd>
      <dt>Total pagado</dt><dd>${bs(s.totalPagado)}</dd><dt>Costo real (TCEA)</dt><dd class="${s.costo === minInt ? 'best' : ''}">${s.tcea === null ? '—' : pct(s.tcea)}</dd></dl></button>`).join('');
  const cur = all.find((a) => a.k === sel);
  last = { ...cur, P };
  $('#chart-title').textContent = `Cómo se reparte cada cuota · sistema ${SYS[sel].name.toLowerCase()}`;
  $('#loan-chart').innerHTML = loanChart(cur.rows, P);
  const tot = (fld) => cur.rows.reduce((a, r) => a + r[fld], 0);
  $('#table').innerHTML = '<thead><tr><th>Mes</th><th>Saldo inicial</th><th>Interés</th><th>Capital</th><th>Cuota</th><th>Seguro</th><th>Comisión</th><th>Total a pagar</th><th>Saldo final</th></tr></thead><tbody>'
    + cur.rows.map((r) => `<tr><td>${r.k}</td><td>${bs(r.saldoIni)}</td><td>${bs(r.interes)}</td><td>${bs(r.amort)}</td><td>${bs(r.cuota)}</td><td>${bs(r.seguro)}</td><td>${bs(r.comision)}</td><td>${bs(r.total)}</td><td>${bs(Math.max(0, r.saldo))}</td></tr>`).join('')
    + `</tbody><tfoot><tr><td>Σ</td><td></td><td>${bs(tot('interes'))}</td><td>${bs(tot('amort'))}</td><td>${bs(tot('cuota'))}</td><td>${bs(tot('seguro'))}</td><td>${bs(tot('comision'))}</td><td>${bs(tot('total'))}</td><td></td></tr></tfoot>`;
  save();
}
function csv() {
  if (!last) return;
  const head = 'Mes;Saldo inicial;Interes;Capital;Cuota;Seguro;Comision;Total;Saldo final';
  const fmt = (x) => x.toFixed(2).replace('.', ',');
  const body = last.rows.map((r) => [r.k, fmt(r.saldoIni), fmt(r.interes), fmt(r.amort), fmt(r.cuota), fmt(r.seguro), fmt(r.comision), fmt(r.total), fmt(Math.max(0, r.saldo))].join(';')).join('\n');
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `amortizacion-${last.k}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------- ahorro ----------------
function saving() {
  const f = $('#f-save');
  const meta = num(f, 'meta'), n = Math.max(1, Math.round(num(f, 'n'))), i = F.effPeriod(num(f, 'tasa') / 100, 12), inicial = num(f, 'inicial');
  const saltos = f.elements.saltos.value.split(/[\s,;]+/).map(Number).filter((k) => Number.isInteger(k) && k >= 1 && k <= n);
  const extra = num(f, 'extra'), mesInicio = +f.elements.mesInicio.value;
  // Aporte que llega a la meta con los saltos y el aguinaldo: búsqueda binaria sobre la simulación
  let lo = 0, hi = meta;
  for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (F.savings({ inicial, aporte: mid, i, n, saltos, extra, mesInicio }).final >= meta) hi = mid; else lo = mid; }
  const aporte = Math.ceil(hi * 100) / 100;
  const plan = F.savings({ inicial, aporte, i, n, saltos, extra, mesInicio });
  const simple = F.aporteParaMeta(meta, i, n, inicial);
  $('#s-meta').textContent = bs(meta, 0);
  $('#s-aporte').innerHTML = `${bs(aporte)} <small>al mes</small>`;
  const notes = [];
  if (saltos.length) notes.push(`${saltos.length} mes${saltos.length > 1 ? 'es' : ''} sin aportar`);
  if (extra) notes.push(`${bs(extra, 0)} extra cada diciembre`);
  $('#s-note').textContent = notes.length ? `Con ${notes.join(' y ')}. Sin esos ajustes serían ${bs(simple)} al mes.` : `Durante ${n} meses, empezando en ${MESES[mesInicio - 1]}.`;
  const sinAhorrar = Math.max(0, meta - inicial) / n;
  $('#s-kpis').innerHTML = [
    ['Pones de tu bolsillo', bs(plan.aportado, 0), ''],
    ['Te pagan de intereses', bs(plan.intereses, 0), 'ok'],
    ['Llegas a', bs(plan.final, 0), ''],
    ['Guardando bajo el colchón', bs(sinAhorrar) + '/mes', 'warn'],
  ].map(([a, b, c]) => `<div class="kpi ${c}"><span>${a}</span><b>${b}</b></div>`).join('');
  $('#save-chart').innerHTML = saveChart(plan.rows, meta, inicial);
  save();
}

// ---------------- estado en la URL ----------------
function save() {
  const p = new URLSearchParams();
  for (const f of [$('#f-loan'), $('#f-save')]) for (const el of f.elements) if (el.name && (el.type !== 'radio' || el.checked)) p.set(`${f.id[2]}.${el.name}`, el.value);
  p.set('tab', document.querySelector('.tabs .on').dataset.tab); p.set('sys', sel);
  history.replaceState(null, '', '#' + p);
}
function load() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const [k, v] of p) {
    const [f, name] = k.split('.'); const form = f === 'l' ? $('#f-loan') : f === 's' ? $('#f-save') : null;
    if (!form || !form.elements[name]) continue;
    const el = form.elements[name];
    if (el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === v; } else el.value = v;
  }
  if (SYS[p.get('sys')]) sel = p.get('sys');
  if (p.get('tab')) showTab(p.get('tab'));
}
function showTab(t) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab-pane').forEach((s) => { s.hidden = s.id !== t; });
}

// ---------------- eventos ----------------
$('#f-save').elements.mesInicio.innerHTML = MESES.map((m, i) => `<option value="${i + 1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
$('#f-loan').addEventListener('input', loan);
$('#f-save').addEventListener('input', saving);
$('#f-loan').addEventListener('submit', (e) => e.preventDefault());
$('#f-save').addEventListener('submit', (e) => e.preventDefault());
$('#sys-cards').addEventListener('click', (e) => { const b = e.target.closest('[data-sys]'); if (b) { sel = b.dataset.sys; loan(); } });
$('.tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { showTab(b.dataset.tab); save(); } });
$('#csv').addEventListener('click', csv);
$('#print').addEventListener('click', () => window.print());
$('#theme').addEventListener('click', () => {
  const r = document.documentElement; const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('cuota:theme', r.dataset.theme); } catch { /* */ }
});
try { const th = localStorage.getItem('cuota:theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* */ }
load(); loan(); saving();
window.cuota = { loan, saving, showTab };
