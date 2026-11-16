// Comunicação com o Supabase. Todo acesso passa por funções protegidas por sessão.
const Api = (() => {
  const cfg = window.APP_CONFIG, K = 'go_token';
  const getToken = () => sessionStorage.getItem(K);

  async function rpc(fn, args) {
    if (!cfg || /COLE_AQUI/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY))
      throw new Error('Sistema não configurado: preencha js/config.js com a URL e a chave do Supabase.');
    const headers = { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_ANON_KEY };
    if (cfg.SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.SUPABASE_ANON_KEY;
    const r = await fetch(cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn,
      { method: 'POST', headers, body: JSON.stringify(args || {}) });
    const txt = await r.text(); let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
    if (!r.ok) {
      const m = (j && (j.message || j.hint)) || String(j);
      if (/sessao_invalida/.test(m)) { sessionStorage.removeItem(K); location.href = 'index.html?expirou=1'; }
      throw new Error(m);
    }
    return j;
  }

  return {
    async login(senha) {
      const t = await rpc('app_login', { p_senha: senha });
      if (!t) return false;
      sessionStorage.setItem(K, t); return true;
    },
    async logout() { try { await rpc('app_logout', { p_token: getToken() }); } catch (e) {} sessionStorage.removeItem(K); location.href = 'index.html'; },
    requireAuth() { if (!getToken()) { location.href = 'index.html'; return false; } return true; },
    logado: () => !!getToken(),
    list: (t) => rpc('app_list', { p_token: getToken(), p_tabela: t }),
    save: (t, d) => rpc('app_save', { p_token: getToken(), p_tabela: t, p_dados: d }),
    async saveLote(t, arr, tam = 200) { let out = []; for (let i = 0; i < arr.length; i += tam) out = out.concat(await this.save(t, arr.slice(i, i + tam))); return out; },
    del: (t, ids) => rpc('app_delete', { p_token: getToken(), p_tabela: t, p_ids: [].concat(ids) }),
    trocarSenha: (a, n) => rpc('app_change_password', { p_token: getToken(), p_atual: a, p_nova: n }),
    async log(entidade, entidade_id, obra_id, acao, descricao) {
      try { await this.save('historico', { entidade, entidade_id, obra_id, acao, descricao }); } catch (e) {}
    }
  };
})();
