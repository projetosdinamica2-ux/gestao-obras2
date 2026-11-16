let D = { obras: [], etapas: [], colaboradores: [] };

async function recarregar() { D = await carregarTudo(); $('#dl-resp').innerHTML = D.colaboradores.map((c) => `<option value="${esc(c.nome)}">`).join(''); listar(); }

function listar() {
  const q = norm($('#busca').value), fs = $('#fs').value;
  const l = D.obras.filter((o) => (!fs || efetivo(o.status, o.data_conclusao_prevista) === fs) && (!q || norm([o.nome, o.cliente, o.endereco, o.codigo].join(' ')).includes(q)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  $('#tab').innerHTML = l.map((o) => { const p = progressoObra(o, D.etapas);
    return `<tr><td><b>${esc(o.nome)}</b>${o.codigo ? `<br><small class="mut">${esc(o.codigo)}</small>` : ''}</td><td>${esc(o.cliente || '—')}</td><td>${esc(o.endereco || '—')}</td>
    <td>${badge(efetivo(o.status, o.data_conclusao_prevista))}</td><td>${barra(p)}<small class="mut">${p}%</small></td><td>${fmtData(o.data_inicio_prevista)}</td><td>${fmtData(o.data_conclusao_prevista)}</td>
    <td class="row"><button class="btn sm" data-a="abrir" data-id="${o.id}">Abrir</button><button class="btn sm sec" data-a="edit" data-id="${o.id}">Editar</button><button class="btn sm verm" data-a="del" data-id="${o.id}">Excluir</button></td></tr>`; }).join('')
    || '<tr><td colspan="8" class="vazio">Nenhuma obra encontrada.</td></tr>';
}

const campo = (id, rot, v = '', tipo = 'text', cls = '') => `<div class="${cls}"><label>${rot}</label><input id="${id}" type="${tipo}" value="${esc(v)}"></div>`;
const area = (id, rot, v = '', cls = 'full') => `<div class="${cls}"><label>${rot}</label><textarea id="${id}" rows="2">${esc(v)}</textarea></div>`;
const selStatus = (id, mapa, v) => `<div><label>Situação</label><select id="${id}">${Object.entries(mapa).filter(([k]) => k !== 'atrasada' || v === 'atrasada').map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;

function formObra(o) {
  o = o || { status: 'nao_iniciada' };
  const m = modal({ titulo: o.id ? 'Editar obra' : 'Nova obra', corpo: `<div class="form">
    ${campo('o-nome', 'Nome da obra *', o.nome)}${campo('o-codigo', 'Código de identificação', o.codigo)}
    ${campo('o-cliente', 'Cliente', o.cliente)}${campo('o-resp', 'Responsável geral', o.responsavel)}
    ${campo('o-end', 'Endereço', o.endereco, 'text', 'full')}
    ${campo('o-ip', 'Início previsto', o.data_inicio_prevista, 'date')}${campo('o-cp', 'Conclusão prevista', o.data_conclusao_prevista, 'date')}
    ${campo('o-ir', 'Início real', o.data_inicio_real, 'date')}${campo('o-cr', 'Conclusão real', o.data_conclusao_real, 'date')}
    ${selStatus('o-st', ST_OBRA, o.status)}<div></div>${area('o-desc', 'Descrição', o.descricao)}${area('o-obs', 'Observações', o.observacoes)}</div>`,
    botoes: [{ txt: 'Cancelar', cls: 'sec', onClick: ({ fechar }) => fechar() }, { txt: 'Salvar', onClick: async ({ el, fechar }) => {
      const v = (i) => ($('#' + i, el).value.trim() || null); if (!v('o-nome')) return toast('Informe o nome da obra.', 'erro');
      const ip = v('o-ip'), cp = v('o-cp'); if (ip && cp && ip > cp) return toast('A conclusão prevista não pode ser anterior ao início.', 'erro');
      const reg = { ...(o.id ? o : {}), nome: v('o-nome'), codigo: v('o-codigo'), cliente: v('o-cliente'), responsavel: v('o-resp'), endereco: v('o-end'),
        data_inicio_prevista: ip, data_conclusao_prevista: cp, data_inicio_real: v('o-ir'), data_conclusao_real: v('o-cr'),
        descricao: v('o-desc'), observacoes: v('o-obs'), status: $('#o-st', el).value };
      const [s] = await Api.save('obras', reg); await Api.log('obra', s.id, s.id, o.id ? 'edicao' : 'criacao', `Obra "${s.nome}" ${o.id ? 'editada' : 'criada'}.`);
      fechar(); toast('Obra salva.', 'ok'); await recarregar(); } }] });
}

function abrirObra(id) {
  const o = D.obras.find((x) => x.id === id), es = D.etapas.filter((e) => e.obra_id === id).sort((a, b) => a.ordem - b.ordem), p = progressoObra(o, D.etapas);
  const m = modal({ titulo: o.nome, largo: true, corpo: `
    <div class="form" style="margin-bottom:12px"><div><b>Cliente:</b> ${esc(o.cliente || '—')}<br><b>Endereço:</b> ${esc(o.endereco || '—')}<br><b>Responsável:</b> ${esc(o.responsavel || '—')}</div>
    <div><b>Situação:</b> ${badge(efetivo(o.status, o.data_conclusao_prevista))}<br><b>Previsto:</b> ${fmtData(o.data_inicio_prevista)} a ${fmtData(o.data_conclusao_prevista)}<br><b>Real:</b> ${fmtData(o.data_inicio_real)} a ${fmtData(o.data_conclusao_real)}</div>
    <div class="full">${barra(p)}<small>Progresso geral: <b>${p}%</b></small></div>${o.observacoes ? `<div class="full"><b>Observações:</b> ${esc(o.observacoes)}</div>` : ''}</div>
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Etapas (${es.length})</h3><button class="btn sm" id="ne">+ Nova etapa</button></div>
    <div class="tw"><table><thead><tr><th>Nº</th><th>Etapa</th><th>Responsável</th><th>Início</th><th>Término</th><th style="width:120px">Conclusão</th><th>Situação</th><th>Observações</th><th></th></tr></thead><tbody>
    ${es.map((e) => `<tr><td>${e.ordem}</td><td><b>${esc(e.nome)}</b></td><td>${esc(e.responsavel_nome || '—')}</td><td>${fmtData(e.data_inicio)}</td><td>${fmtData(e.data_fim)}</td>
      <td>${barra(Number(e.percentual))}<small>${Number(e.percentual)}%</small></td><td>${badge(efetivo(e.status, e.data_fim), ST_ETAPA)}</td><td>${esc(e.observacoes || '')}</td>
      <td class="row"><button class="btn sm sec" data-e="edit" data-id="${e.id}">Editar</button><button class="btn sm verm" data-e="del" data-id="${e.id}">Excluir</button></td></tr>`).join('') || '<tr><td colspan="9" class="vazio">Nenhuma etapa cadastrada.</td></tr>'}
    </tbody></table></div>` });
  $('#ne', m.el).onclick = () => { m.fechar(); formEtapa(null, id); };
  m.el.addEventListener('click', async (ev) => { const b = ev.target.closest('[data-e]'); if (!b) return; const e = D.etapas.find((x) => x.id === b.dataset.id);
    if (b.dataset.e === 'edit') { m.fechar(); formEtapa(e, id); }
    else if (await confirmar(`Excluir a etapa "${esc(e.nome)}"?`, 'Excluir')) { await Api.del('etapas', e.id); await Api.log('etapa', e.id, id, 'exclusao', `Etapa "${e.nome}" excluída.`); m.fechar(); await recarregar(); abrirObra(id); } });
}

function formEtapa(e, obraId) {
  e = e || { status: 'pendente', percentual: 0 };
  modal({ titulo: e.id ? 'Editar etapa' : 'Nova etapa', corpo: `<div class="form">
    ${campo('e-nome', 'Nome da etapa *', e.nome, 'text', 'full')}${area('e-desc', 'Descrição', e.descricao)}
    <div><label>Responsável</label><input id="e-resp" list="dl-resp" value="${esc(e.responsavel_nome || '')}" placeholder="Digite ou escolha um colaborador"></div>
    ${selStatus('e-st', ST_ETAPA, e.status)}${campo('e-di', 'Data inicial', e.data_inicio, 'date')}${campo('e-df', 'Data final', e.data_fim, 'date')}
    ${campo('e-pct', 'Percentual de conclusão (0–100)', e.percentual, 'number')}${campo('e-ord', 'Nº da etapa (ordem)', e.ordem || D.etapas.filter((x) => x.obra_id === obraId).length + 1, 'number')}
    ${area('e-obs', 'Observações', e.observacoes)}</div>`,
    botoes: [{ txt: 'Cancelar', cls: 'sec', onClick: ({ fechar }) => { fechar(); abrirObra(obraId); } }, { txt: 'Salvar', onClick: async ({ el, fechar }) => {
      const v = (i) => ($('#' + i, el).value.trim() || null); if (!v('e-nome')) return toast('Informe o nome da etapa.', 'erro');
      const di = v('e-di'), df = v('e-df'); if (di && df && di > df) return toast('A data final não pode ser anterior à inicial.', 'erro');
      let pct = Math.min(100, Math.max(0, Number(v('e-pct')) || 0)), st = $('#e-st', el).value;
      if (st === 'concluida') pct = 100; else if (pct === 100 && st !== 'pausada') st = 'concluida';
      let nome = v('e-resp'), col = nome && D.colaboradores.find((c) => norm(c.nome) === norm(nome));
      if (nome && !col) { if (!(await confirmar(`"${esc(nome)}" não está cadastrado como colaborador. Cadastrar agora?`, 'Cadastrar'))) col = null; else { [col] = await Api.save('colaboradores', { nome }); } }
      const reg = { ...(e.id ? e : {}), obra_id: obraId, nome: v('e-nome'), descricao: v('e-desc'), responsavel_nome: col ? col.nome : nome, responsavel_id: col ? col.id : null,
        data_inicio: di, data_fim: df, percentual: pct, status: st, observacoes: v('e-obs'), ordem: Number(v('e-ord')) || 0 };
      const [s] = await Api.save('etapas', reg); await Api.log('etapa', s.id, obraId, e.id ? 'edicao' : 'criacao', `Etapa "${s.nome}" ${e.id ? 'atualizada' : 'criada'} (${pct}%).`);
      fechar(); toast('Etapa salva.', 'ok'); await recarregar(); abrirObra(obraId); } }] });
}

(async () => {
  if (!montarPagina('obras.html', 'Obras e etapas')) return;
  $('#fs').innerHTML = '<option value="">Todas</option>' + Object.entries(ST_OBRA).map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
  $('#nova').onclick = () => formObra(); $('#busca').oninput = listar; $('#fs').onchange = listar;
  $('#tab').onclick = async (ev) => { const b = ev.target.closest('[data-a]'); if (!b) return; const o = D.obras.find((x) => x.id === b.dataset.id);
    if (b.dataset.a === 'abrir') abrirObra(o.id); else if (b.dataset.a === 'edit') formObra(o);
    else if (await confirmar(`Excluir a obra <b>${esc(o.nome)}</b> e todas as suas etapas? Esta ação não pode ser desfeita (faça um backup antes).`, 'Excluir obra')) {
      try { await Api.del('obras', o.id); await Api.log('obra', o.id, null, 'exclusao', `Obra "${o.nome}" excluída.`); toast('Obra excluída.', 'ok'); await recarregar(); } catch (e) { erro(e); } } };
  try { await recarregar(); } catch (e) { erro(e); }
})();
