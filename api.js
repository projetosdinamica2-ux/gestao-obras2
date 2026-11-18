// Comunicação com o Google Apps Script (dados em um arquivo JSON no Drive).
// Mesma interface usada pelas telas: list / save / saveLote / del / log / login ...
const Api = (() => {
  const cfg = window.APP_CONFIG, KC = 'go_chave';
  const getChave = () => sessionStorage.getItem(KC) || localStorage.getItem(KC);
  const limpar = () => { sessionStorage.removeItem(KC); localStorage.removeItem(KC); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  const TABELAS = ['colaboradores', 'obras', 'etapas', 'atividades', 'alocacoes', 'diario_obra', 'comentarios', 'documentos', 'historico'];
  const PADRAO = { obras: { status: 'nao_iniciada', dados_extras: {} }, etapas: { ordem: 0, percentual: 0, status: 'pendente', dados_extras: {} },
    colaboradores: { situacao: 'ativo', dados_extras: {} }, atividades: { prioridade: 'media', percentual: 0, status: 'pendente', dados_extras: {} }, diario_obra: { dados_extras: {} } };
  const MSG = { chave: 'Chave incorreta.', bloqueado: 'muitas_tentativas', defina_a_chave_no_script: 'A chave inicial ainda não foi definida no Apps Script (veja o manual).', chave_curta: 'A nova chave precisa ter ao menos 6 caracteres.' };

  let DB = null, REV = 0, carregando = null, fila = Promise.resolve(), PEND = [], timer = null;

  async function chamar(body) {
    if (!cfg || !cfg.APPS_SCRIPT_URL || /COLE_AQUI/.test(cfg.APPS_SCRIPT_URL))
      throw new Error('Sistema não configurado: preencha js/config.js com a URL do Apps Script.');
    let r, j;
    try { r = await fetch(cfg.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Sem conexão com o servidor. Verifique a internet e o endereço do Apps Script.'); }
    try { j = await r.json(); } catch (e) { throw new Error('Resposta inválida do servidor. Confirme que a implantação está como "Qualquer pessoa" e que a URL termina em /exec.'); }
    if (!j.ok) {
      if (j.erro === 'chave' && !['login', 'trocarChave'].includes(body.action)) { limpar(); location.href = 'index.html?expirou=1'; }
      throw new Error(MSG[j.erro] || j.erro);
    }
    return j;
  }

  function garantir() {
    if (DB) return Promise.resolve();
    if (!carregando) carregando = chamar({ action: 'carregar', chave: getChave() })
      .then((j) => { DB = j.db || {}; TABELAS.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; }); REV = j.rev; }).finally(() => (carregando = null));
    return carregando;
  }

  // Aplica uma alteração e grava. Se alguém gravou antes (conflito), recarrega e refaz a alteração.
  function mutar(fn) { const p = fila.then(() => _mutar(fn)); fila = p.catch(() => {}); return p; }
  async function _mutar(fn) {
    await garantir();
    for (let i = 0; i < 6; i++) {
      const novo = clone(DB), out = fn(novo), logs = PEND.slice();
      if (logs.length) novo.historico = (novo.historico || []).concat(logs);
      const j = await chamar({ action: 'gravar', chave: getChave(), db: novo, rev: REV });
      if (!j.conflito) { DB = novo; REV = j.rev; PEND.splice(0, logs.length); return out; }
      DB = null; await garantir();
    }
    throw new Error('Muitas alterações simultâneas de outras pessoas. Tente salvar novamente.');
  }

  return {
    async login(chave, lembrar) {
      try { await chamar({ action: 'login', chave }); } catch (e) { if (e.message === MSG.chave) return false; throw e; }
      (lembrar ? localStorage : sessionStorage).setItem(KC, chave); return true;
    },
    async logout() { limpar(); location.href = 'index.html'; },
    requireAuth() { if (!getChave()) { location.href = 'index.html'; return false; } return true; },
    logado: () => !!getChave(),
    async list(t) { await garantir(); return clone(DB[t] || []).sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em))); },
    save(t, d) {
      return mutar((db) => {
        db[t] = db[t] || []; const idx = new Map(db[t].map((r, i) => [r.id, i])), agora = new Date().toISOString();
        return (Array.isArray(d) ? d : [d]).map((rec) => {
          rec = { ...rec }; if (!rec.id) rec.id = uuid(); const i = idx.get(rec.id);
          if (i !== undefined) return (db[t][i] = { ...db[t][i], ...rec, atualizado_em: agora });
          const n = { criado_em: agora, ...(PADRAO[t] || {}), ...rec, atualizado_em: agora }; idx.set(n.id, db[t].length); db[t].push(n); return n;
        });
      });
    },
    saveLote(t, arr) { return this.save(t, arr); },
    del(t, ids) {
      ids = [].concat(ids);
      return mutar((db) => {
        const s = new Set(ids), antes = (db[t] || []).length, sem = (k, f) => (db[k] = (db[k] || []).filter((r) => !s.has(r[f])));
        db[t] = (db[t] || []).filter((r) => !s.has(r.id));
        if (t === 'obras') ['etapas', 'atividades', 'alocacoes', 'diario_obra', 'comentarios', 'documentos'].forEach((k) => sem(k, 'obra_id'));
        if (t === 'etapas') { sem('atividades', 'etapa_id'); sem('alocacoes', 'etapa_id'); sem('comentarios', 'etapa_id'); }
        if (t === 'diario_obra') sem('documentos', 'diario_id');
        if (t === 'colaboradores') ['etapas', 'atividades'].forEach((k) => db[k].forEach((r) => { if (s.has(r.responsavel_id)) r.responsavel_id = null; }));
        return antes - db[t].length;
      });
    },
    async trocarSenha(atual, nova) {
      try { await chamar({ action: 'trocarChave', chave: atual, nova }); } catch (e) { if (e.message === MSG.chave) return false; throw e; }
      const st = localStorage.getItem(KC) ? localStorage : sessionStorage; st.setItem(KC, nova); return true;
    },
    // O histórico é enviado junto com a próxima gravação (ou em ~1,5 s), para não gerar chamadas extras.
    log(entidade, entidade_id, obra_id, acao, descricao) {
      const agora = new Date().toISOString(); PEND.push({ id: uuid(), entidade, entidade_id, obra_id, acao, descricao, criado_em: agora, atualizado_em: agora });
      clearTimeout(timer); timer = setTimeout(() => { if (PEND.length) mutar(() => {}).catch(() => {}); }, 1500); return Promise.resolve();
    }
  };
})();
