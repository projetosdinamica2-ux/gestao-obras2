let D = { obras: [], etapas: [], colaboradores: [] }, charts = {};
const SIT = { em_andamento: 'Em andamento', concluida: 'Concluída', atrasada: 'Atrasada', pausada: 'Pausada', nao_iniciada: 'Não iniciada' };

function respObra(o, es) { if (o.responsavel) return o.responsavel; const c = {}; es.filter((e) => e.obra_id === o.id && e.responsavel_nome).forEach((e) => (c[e.responsavel_nome] = (c[e.responsavel_nome] || 0) + 1));
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map((x) => x[0]).join(', ') || '—'; }

function opts(sel, itens, todos) { const v = sel.value; sel.innerHTML = `<option value="">${todos}</option>` + itens.map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join(''); sel.value = v; }

function montarFiltros() {
  opts($('#f-obra'), D.obras.map((o) => [o.id, o.nome]).sort((a, b) => a[1].localeCompare(b[1])), 'Todas');
  opts($('#f-cliente'), [...new Set(D.obras.map((o) => o.cliente).filter(Boolean))].sort().map((c) => [c, c]), 'Todos');
  const nomes = new Set([...D.colaboradores.map((c) => c.nome), ...D.etapas.map((e) => e.responsavel_nome).filter(Boolean)]);
  opts($('#f-resp'), [...nomes].sort().map((n) => [n, n]), 'Todos');
  opts($('#f-sit'), Object.entries(SIT), 'Todas');
}

function filtrar() {
  const de = $('#f-de').value, ate = $('#f-ate').value, fo = $('#f-obra').value, fc = $('#f-cliente').value, fr = $('#f-resp').value, fs = $('#f-sit').value;
  const obras = D.obras.filter((o) => {
    const sit = efetivo(o.status, o.data_conclusao_prevista);
    if (fo && o.id !== fo) return false; if (fc && o.cliente !== fc) return false; if (fs && sit !== fs) return false;
    if (de && o.data_conclusao_prevista && o.data_conclusao_prevista < de) return false;
    if (ate && o.data_inicio_prevista && o.data_inicio_prevista > ate) return false;
    if (fr && !D.etapas.some((e) => e.obra_id === o.id && norm(e.responsavel_nome) === norm(fr)) && norm(o.responsavel) !== norm(fr)) return false;
    return true;
  });
  const ids = new Set(obras.map((o) => o.id));
  const etapas = D.etapas.filter((e) => ids.has(e.obra_id) && (!fr || norm(e.responsavel_nome) === norm(fr)));
  return { obras, etapas };
}


function porTipo(obras, etapas) {
  const fase = $('#f-fase').value, nomeObra = (id) => (D.obras.find((o) => o.id === id) || {}).nome || '—';
  const E = etapas.filter((e) => fase === 'Todas' || faseEtapa(e.nome) === fase).map((e) => ({ ...e, tipo: tipoEtapa(e.nome), sit: efetivo(e.status, e.data_fim) }));
  const tipos = [...new Set(E.map((e) => e.tipo))].sort((a, b) => (a === 'Outros') - (b === 'Outros') || E.filter((e) => e.tipo === b).length - E.filter((e) => e.tipo === a).length);
  const leg = ['concluida', 'em_andamento', 'pendente', 'atrasada'].map((k) => `<span><i style="background:${COR[k]}"></i>${ST_ETAPA[k]}</span>`).join('');
  $('#leg').innerHTML = $('#leg2').innerHTML = leg;
  $('#tipos').innerHTML = tipos.map((t) => { const ex = E.filter((e) => e.tipo === t), ids = [...new Set(ex.map((e) => e.obra_id))];
    const chips = ids.map((id) => { const ss = ex.filter((e) => e.obra_id === id).map((e) => e.sit);
      const s = ss.every((v) => v === 'concluida') ? 'concluida' : ss.includes('atrasada') ? 'atrasada' : ss.includes('em_andamento') ? 'em_andamento' : 'pendente';
      return `<span class="chip lnk" data-obra="${esc(id)}" title="Abrir obra" style="border-color:${COR[s]}">${esc(nomeObra(id))}</span>`; }).join('');
    return `<div class="tp"><div class="th"><b>${esc(t)}</b><span>${ids.length} obra(s) · ${ex.length} etapa(s)</span></div><div class="chips">${chips}</div></div>`; }).join('') || '<p class="mut">Nenhuma etapa para os filtros.</p>';
  const ks = ['concluida', 'em_andamento', 'pendente', 'atrasada'];
  $('#andtipo').innerHTML = tipos.map((t) => { const ex = E.filter((e) => e.tipo === t), c = {};
    ks.forEach((k) => (c[k] = ex.filter((e) => (k === 'pendente' ? ['pendente', 'pausada', 'nao_iniciada'].includes(e.sit) : e.sit === k)).length));
    return `<div class="sr"><b>${esc(t)}</b><div class="t">${ks.map((k) => (c[k] ? `<i style="width:${c[k] / ex.length * 100}%;background:${COR[k]}">${c[k]}</i>` : '')).join('')}</div>
      <small><b>${c.concluida}</b> ${c.concluida === 1 ? 'pronta' : 'prontas'} · <b>${c.em_andamento}</b> em andamento<br>${Math.round(c.concluida / ex.length * 100)}% concluído (${ex.length} etapas)</small></div>`; }).join('');
}

const cnt = (arr, f) => arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});
function grafico(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($('#' + id), { ...cfg, options: { responsive: true, maintainAspectRatio: false, ...(cfg.options || {}) } }); }

function render() {
  const { obras, etapas } = filtrar(), hoje = hojeISO();
  const so = cnt(obras, (o) => efetivo(o.status, o.data_conclusao_prevista));
  const se = cnt(etapas, (e) => efetivo(e.status, e.data_fim));
  const k = (t, v, c) => `<div class="card kpi" style="border-color:${c}"><b>${v}</b><span>${t}</span></div>`;
  $('#kpis').innerHTML = k('Total de obras', obras.length, '#3c454e') + k('Em andamento', so.em_andamento || 0, COR.em_andamento) + k('Concluídas', so.concluida || 0, COR.concluida) +
    k('Atrasadas', so.atrasada || 0, COR.atrasada) + k('Pausadas', so.pausada || 0, COR.pausada) + k('Não iniciadas', so.nao_iniciada || 0, COR.nao_iniciada) +
    k('Total de etapas', etapas.length, '#3c454e') + k('Etapas pendentes', se.pendente || 0, COR.pendente) + k('Etapas em andamento', se.em_andamento || 0, COR.em_andamento) +
    k('Etapas concluídas', se.concluida || 0, COR.concluida) + k('Etapas atrasadas', se.atrasada || 0, COR.atrasada) + k('Colaboradores', D.colaboradores.length, '#3c454e');

  const ordem = ['em_andamento', 'concluida', 'atrasada', 'pausada', 'nao_iniciada'];
  grafico('g1', { type: 'doughnut', data: { labels: ordem.map((s) => ST_OBRA[s]), datasets: [{ data: ordem.map((s) => so[s] || 0), backgroundColor: ordem.map((s) => COR[s]) }] }, options: { plugins: { legend: { position: 'bottom' } } } });
  const oe = ['pendente', 'em_andamento', 'concluida', 'atrasada', 'pausada'];
  grafico('g2', { type: 'doughnut', data: { labels: oe.map((s) => ST_ETAPA[s]), datasets: [{ data: oe.map((s) => se[s] || 0), backgroundColor: oe.map((s) => COR[s]) }] }, options: { plugins: { legend: { position: 'bottom' } } } });

  const prog = obras.map((o) => ({ o, p: progressoObra(o, D.etapas) })).sort((a, b) => b.p - a.p);
  grafico('g3', { type: 'bar', data: { labels: prog.map((x) => x.o.nome.slice(0, 28)), datasets: [{ label: '% concluído', data: prog.map((x) => x.p), backgroundColor: '#e5a900' }] },
    options: { indexAxis: 'y', scales: { x: { max: 100 } }, plugins: { legend: { display: false } } } });

  const pl = obras.filter((o) => o.status !== 'concluida' && o.data_inicio_prevista && o.data_conclusao_prevista).map((o) => {
    const tot = Math.max(1, dias(o.data_inicio_prevista, o.data_conclusao_prevista)), dec = dias(o.data_inicio_prevista, hoje);
    return { n: o.nome.slice(0, 22), plan: Math.round(Math.min(100, Math.max(0, (dec / tot) * 100))), real: progressoObra(o, D.etapas) }; });
  grafico('g4', { type: 'bar', data: { labels: pl.map((x) => x.n), datasets: [{ label: 'Planejado', data: pl.map((x) => x.plan), backgroundColor: '#94a3b8' }, { label: 'Realizado', data: pl.map((x) => x.real), backgroundColor: '#16a34a' }] },
    options: { scales: { y: { max: 100 } }, plugins: { legend: { position: 'bottom' } } } });

  const porR = {}; etapas.forEach((e) => { const n = e.responsavel_nome || '(sem responsável)'; porR[n] = porR[n] || { c: 0, a: 0 }; e.status === 'concluida' ? porR[n].c++ : porR[n].a++; });
  const rn = Object.keys(porR).sort();
  grafico('g5', { type: 'bar', data: { labels: rn, datasets: [{ label: 'Concluídas', data: rn.map((n) => porR[n].c), backgroundColor: '#16a34a' }, { label: 'Em aberto', data: rn.map((n) => porR[n].a), backgroundColor: '#f59e0b' }] },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } } });

  porTipo(obras, etapas);

  // Alertas
  const al = [], add = (c, t, oid) => al.push(`<div class="alerta al-${c}${oid ? ' lnk' : ''}"${oid ? ` data-obra="${esc(oid)}" title="Abrir obra"` : ''}>${t}</div>`);
  obras.filter((o) => efetivo(o.status, o.data_conclusao_prevista) === 'atrasada').forEach((o) => add('verm', `<b>Obra atrasada:</b> ${esc(o.nome)} — previsão ${fmtData(o.data_conclusao_prevista)} (${dias(o.data_conclusao_prevista, hoje)} dias)`, o.id));
  const em = (e) => D.obras.find((o) => o.id === e.obra_id);
  etapas.filter((e) => efetivo(e.status, e.data_fim) === 'atrasada').slice(0, 15).forEach((e) => add('verm', `<b>Etapa vencida:</b> ${esc(e.nome)} (${esc((em(e) || {}).nome)}) — venceu em ${fmtData(e.data_fim)}`, e.obra_id));
  const em7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  etapas.filter((e) => e.status !== 'concluida' && e.data_fim && e.data_fim >= hoje && e.data_fim <= em7).forEach((e) => add('amar', `<b>Vence em breve:</b> ${esc(e.nome)} (${esc((em(e) || {}).nome)}) — ${fmtData(e.data_fim)}`, e.obra_id));
  const h30 = Date.now() - 30 * 864e5;
  obras.filter((o) => o.status === 'em_andamento').forEach((o) => { const ult = Math.max(new Date(o.atualizado_em), ...D.etapas.filter((e) => e.obra_id === o.id).map((e) => new Date(e.atualizado_em)));
    if (ult < h30) add('amar', `<b>Sem atualização há mais de 30 dias:</b> ${esc(o.nome)}`, o.id); });
  const sr = etapas.filter((e) => !e.responsavel_nome && e.status !== 'concluida'); if (sr.length) add('amar', `<b>${sr.length} etapa(s) em aberto sem responsável.</b>`);
  Object.entries(porR).filter(([n, v]) => n[0] !== '(' && v.a >= 8).forEach(([n, v]) => add('azul', `<b>Carga alta:</b> ${esc(n)} tem ${v.a} etapas em aberto.`));
  $('#alertas').innerHTML = al.join('') || '<div class="alerta al-verde">Nenhum alerta no momento.</div>';

  $('#tab').innerHTML = obras.length ? obras.slice().sort((a, b) => (a.data_conclusao_prevista || '9').localeCompare(b.data_conclusao_prevista || '9')).map((o) => {
    const p = progressoObra(o, D.etapas); return `<tr class="lnk" data-obra="${esc(o.id)}" title="Abrir obra"><td><b>${esc(o.nome)}</b></td><td>${esc(o.cliente || '—')}</td><td>${esc(respObra(o, D.etapas))}</td>
      <td>${badge(efetivo(o.status, o.data_conclusao_prevista))}</td><td>${barra(p)}<small class="mut">${p}%</small></td><td>${fmtData(o.data_conclusao_prevista)}</td></tr>`; }).join('')
    : '<tr><td colspan="6" class="vazio">Nenhuma obra para os filtros selecionados.</td></tr>';
}

// Clique em qualquer obra do dashboard leva para ela na página de obras.
document.addEventListener('click', (ev) => { const a = ev.target.closest('[data-obra]'); if (a) location.href = 'obras.html?abrir=' + encodeURIComponent(a.dataset.obra); });

(async () => {
  if (!montarPagina('dashboard.html', 'Dashboard')) return;
  try { D = await carregarTudo(); montarFiltros(); render();
    $$('.filtros input,.filtros select').forEach((el) => (el.onchange = render)); $('#f-fase').onchange = render;
    $('#limpar').onclick = () => { $$('.filtros input,.filtros select').forEach((el) => (el.value = '')); render(); };
    if (!D.obras.length) toast('Nenhuma obra cadastrada ainda. Use "Importar / Backup" para importar o JSON do sistema antigo.');
  } catch (e) { erro(e); }
})();
