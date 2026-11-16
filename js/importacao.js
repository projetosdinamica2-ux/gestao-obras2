const TABELAS = ['colaboradores', 'obras', 'etapas', 'atividades', 'alocacoes', 'diario_obra', 'comentarios', 'documentos', 'historico'];
let R = null, ATUAL = null;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
// Mescla: valores vazios do arquivo NÃO apagam dados já existentes.
const mescla = (ex, novo) => { const r = { ...ex }; for (const k in novo) { const v = novo[k]; if (k === 'dados_extras') r[k] = { ...(ex[k] || {}), ...v }; else if (v !== null && v !== '' && v !== undefined) r[k] = v; } return r; };
const lerArquivo = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => { try { ok(JSON.parse(r.result)); } catch (e) { no(new Error('O arquivo não é um JSON válido.')); } }; r.onerror = () => no(new Error('Falha ao ler o arquivo.')); r.readAsText(f, 'utf-8'); });

function achaObra(o) { return ATUAL.obras.find((x) => (o.legacy_id && x.legacy_id === o.legacy_id) || (norm(x.nome) === norm(o.nome) && norm(x.cliente) === norm(o.cliente))); }

function desenhar() {
  const t = R.totais, dup = R.obras.filter((o) => o.existente).length;
  $('#p-kpis').innerHTML = [['Obras identificadas', t.obras], ['Etapas identificadas', t.etapas], ['Responsáveis identificados', t.responsaveis], ['Já existentes no sistema', dup],
    ['Avisos', R.avisos.length]].map(([a, b]) => `<div class="card kpi"><b>${b}</b><span>${a}</span></div>`).join('');
  const cor = { erro: 'verm', aviso: 'amar', info: 'azul' };
  $('#p-avisos').innerHTML = R.avisos.map((a) => `<div class="alerta al-${cor[a.nivel]}"><b>${esc(a.obra)}:</b> ${esc(a.msg)}</div>`).join('') || '<div class="alerta al-verde">Nenhuma inconsistência encontrada.</div>';
  $('#p-tab').innerHTML = R.obras.map((o, i) => `<tr><td><input type="checkbox" data-i="${i}" class="sel" ${o.importar ? 'checked' : ''} style="width:auto"></td><td><b>${esc(o.nome)}</b></td><td>${esc(o.cliente || '—')}</td>
    <td>${badge(o.status)}</td><td>${o.etapas.length}</td><td>${o.existente ? '<span class="badge b-pausada">Sim</span>' : 'Não'}</td>
    <td>${o.existente ? `<select data-i="${i}" class="acao"><option value="ignorar" ${o.acao === 'ignorar' ? 'selected' : ''}>Manter atual (ignorar)</option><option value="atualizar" ${o.acao === 'atualizar' ? 'selected' : ''}>Atualizar com o arquivo</option></select>` : '—'}</td></tr>`).join('');
  $$('.sel').forEach((c) => (c.onchange = () => (R.obras[c.dataset.i].importar = c.checked)));
  $$('.acao').forEach((c) => (c.onchange = () => (R.obras[c.dataset.i].acao = c.value)));
  avisoModo();
}
function avisoModo() {
  const modo = $('input[name=modo]:checked').value, a = $('#aviso-modo');
  if (modo === 'inicial' && ATUAL.obras.length) { a.style.display = ''; a.innerHTML = `O sistema já possui <b>${ATUAL.obras.length}</b> obra(s). Para não duplicar, na importação inicial as obras já existentes serão sempre ignoradas. Para atualizá-las, escolha "Atualização de dados".`; }
  else a.style.display = 'none';
}

async function importar() {
  const modo = $('input[name=modo]:checked').value, sel = R.obras.filter((o) => o.importar);
  if (!sel.length) return toast('Nenhuma obra selecionada.', 'erro');
  const prog = (m) => ($('#prog').textContent = m); $('#importar').disabled = true;
  try {
    prog('Cadastrando responsáveis...');
    const cols = {}; ATUAL.colaboradores.forEach((c) => (cols[norm(c.nome)] = c.id));
    const novosC = R.responsaveis.filter((r) => !cols[norm(r.nome)]).map((r) => ({ nome: r.nome, dados_extras: { origem: 'sistema_antigo', variacoes: r.variacoes } }));
    (await Api.saveLote('colaboradores', novosC)).forEach((c) => (cols[norm(c.nome)] = c.id));

    const obrasSave = [], etapasSave = []; let nNovas = 0, nAtual = 0, nIgn = 0;
    for (const o of sel) {
      const ex = o.existente; if (ex && (modo === 'inicial' || o.acao === 'ignorar')) { nIgn++; continue; }
      const id = ex ? ex.id : uuid();
      const { etapas, existente, importar, acao, ...dados } = o;
      obrasSave.push(ex ? { ...mescla(ex, dados), id, legacy_id: ex.legacy_id || dados.legacy_id } : { ...dados, id });
      ex ? nAtual++ : nNovas++;
      const exEt = ex ? ATUAL.etapas.filter((e) => e.obra_id === ex.id) : [];
      etapas.forEach((e) => {
        const m = exEt.find((x) => (e.legacy_id && x.legacy_id === e.legacy_id) || norm(x.nome) === norm(e.nome));
        const reg = { ...e, obra_id: id, responsavel_id: e.responsavel_nome ? cols[norm(e.responsavel_nome)] || null : null };
        etapasSave.push(m ? { ...mescla(m, reg), id: m.id, legacy_id: m.legacy_id || reg.legacy_id } : { ...reg, id: uuid() });
      });
    }
    prog(`Gravando ${obrasSave.length} obras...`); await Api.saveLote('obras', obrasSave);
    prog(`Gravando ${etapasSave.length} etapas...`); await Api.saveLote('etapas', etapasSave);
    await Api.log('importacao', null, null, 'importacao', `Importação do sistema antigo: ${nNovas} obras novas, ${nAtual} atualizadas, ${nIgn} ignoradas, ${etapasSave.length} etapas gravadas.`);
    prog(''); modal({ titulo: 'Importação concluída', corpo: `<p>✅ <b>${nNovas}</b> obras novas · <b>${nAtual}</b> atualizadas · <b>${nIgn}</b> ignoradas</p><p><b>${etapasSave.length}</b> etapas gravadas · <b>${novosC.length}</b> colaboradores novos.</p>`,
      botoes: [{ txt: 'Ir ao Dashboard', onClick: () => (location.href = 'dashboard.html') }] });
    $('#previa').style.display = 'none'; $('#arq').value = '';
  } catch (e) { prog(''); erro(e); } finally { $('#importar').disabled = !$('#ok').checked; }
}

async function exportar(tipo) {
  const T = {}; for (const t of TABELAS) T[t] = await Api.list(t);
  let nome = 'backup-completo', dados = T;
  if (tipo === 'obras') { dados = { obras: T.obras, etapas: T.etapas, atividades: T.atividades, colaboradores: T.colaboradores }; nome = 'obras-etapas-atividades'; }
  if (tipo === 'uma') { const id = $('#x-obra').value; if (!id) return toast('Selecione uma obra.', 'erro'); const o = T.obras.find((x) => x.id === id);
    dados = { obras: [o], etapas: T.etapas.filter((e) => e.obra_id === id), atividades: T.atividades.filter((e) => e.obra_id === id), alocacoes: T.alocacoes.filter((e) => e.obra_id === id),
      diario_obra: T.diario_obra.filter((e) => e.obra_id === id), comentarios: T.comentarios.filter((e) => e.obra_id === id), documentos: T.documentos.filter((e) => e.obra_id === id), historico: T.historico.filter((e) => e.obra_id === id) };
    const ids = new Set([...dados.etapas, ...dados.atividades].map((x) => x.responsavel_id).concat(dados.alocacoes.map((x) => x.colaborador_id)).filter(Boolean)); dados.colaboradores = T.colaboradores.filter((c) => ids.has(c.id));
    nome = 'obra-' + norm(o.nome).replace(/[^a-z0-9]+/g, '-'); }
  const d = hojeISO(), arq = { formato: 'gestao-obras', versao: 1, exportado_em: new Date().toISOString(), tabelas: dados };
  if (tipo === 'antigo') { baixar(`formato-antigo-${d}.json`, JSON.stringify(Legado.paraFormatoAntigo(T.obras, T.etapas), null, 2)); return toast('Arquivo gerado.', 'ok'); }
  baixar(`${nome}-${d}.json`, JSON.stringify(arq, null, 2)); toast('Arquivo gerado.', 'ok');
}

let RESTAURAR = null;
async function restaurar() {
  const prog = $('#r-prog'); $('#r-go').disabled = true;
  try { for (const t of TABELAS) { const l = RESTAURAR.tabelas[t]; if (l && l.length) { prog.textContent = `Restaurando ${t} (${l.length})...`; await Api.saveLote(t, l, 100); } }
    prog.textContent = ''; toast('Backup restaurado com sucesso.', 'ok'); $('#r-info').innerHTML = '<div class="alerta al-verde">Restauração concluída.</div>';
  } catch (e) { prog.textContent = ''; erro(e); }
}

(async () => {
  if (!montarPagina('importacao.html', 'Importar / Backup')) return;
  $$('.tabs button').forEach((b) => (b.onclick = () => { $$('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); ['imp', 'exp', 'res'].forEach((t) => ($('#t-' + t).style.display = t === b.dataset.t ? '' : 'none')); }));
  try { ATUAL = { obras: await Api.list('obras'), etapas: await Api.list('etapas'), colaboradores: await Api.list('colaboradores') };
    $('#x-obra').innerHTML = '<option value="">Selecione...</option>' + ATUAL.obras.map((o) => `<option value="${o.id}">${esc(o.nome)}</option>`).join(''); } catch (e) { return erro(e); }

  $('#arq').onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return;
    try { const j = await lerArquivo(f); const r = Legado.analisar(j); if (r.erro) { $('#previa').style.display = 'none'; return toast(r.erro, 'erro'); }
      r.obras.forEach((o) => { o.existente = achaObra(o) || null; o.importar = !/^teste?$/i.test(norm(o.nome)); o.acao = 'ignorar'; if (o.existente) o.avisoDup = true; });
      r.obras.filter((o) => o.existente).forEach((o) => r.avisos.push({ nivel: 'aviso', obra: o.nome, msg: 'Já existe no sistema (mesmo ID antigo ou mesmo nome + cliente).' }));
      R = r; $('#arq-info').textContent = `${f.name} — ${(f.size / 1024).toFixed(1)} KB`; $('#previa').style.display = ''; $('#ok').checked = false; $('#importar').disabled = true; desenhar();
    } catch (e) { erro(e); } };
  $$('input[name=modo]').forEach((r) => (r.onchange = avisoModo));
  $('#ok').onchange = () => ($('#importar').disabled = !$('#ok').checked); $('#importar').onclick = importar;
  $('#x-full').onclick = () => exportar('full').catch(erro); $('#x-uma').onclick = () => exportar('uma').catch(erro);
  $('#x-obras').onclick = () => exportar('obras').catch(erro); $('#x-old').onclick = () => exportar('antigo').catch(erro);
  $('#r-arq').onchange = async (ev) => { const f = ev.target.files[0]; if (!f) return;
    try { let j = await lerArquivo(f); if (j && j.db && typeof j.rev === 'number') j = { formato: 'gestao-obras', exportado_em: j.atualizadoEm, tabelas: j.db }; /* cópia diária do Drive */ if (j.formato !== 'gestao-obras' || !j.tabelas) throw new Error('Este arquivo não é um backup do novo sistema (formato "gestao-obras").');
      RESTAURAR = j; $('#r-info').innerHTML = `<div class="alerta al-azul">Backup gerado em <b>${fmtDataHora(j.exportado_em)}</b><br>` + TABELAS.filter((t) => (j.tabelas[t] || []).length).map((t) => `${t}: <b>${j.tabelas[t].length}</b>`).join(' · ') + '</div>';
      $('#r-go').disabled = false; } catch (e) { RESTAURAR = null; $('#r-go').disabled = true; erro(e); } };
  $('#r-go').onclick = async () => { if (await confirmar('Restaurar este backup? Registros com o mesmo identificador serão sobrescritos pelo conteúdo do arquivo.', 'Restaurar')) restaurar(); };
})();
