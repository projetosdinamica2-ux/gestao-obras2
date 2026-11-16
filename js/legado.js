// Conversor do JSON exportado pelo sistema antigo.
// Estrutura real analisada: { obras: [ { id, nome, cliente, endereco, inicio, fim, situacao,
//   etapas: [ { id, nome, resp, inicio, fim, pct, status, obs } ] } ] }
(function (root) {
  const CAMPOS_OBRA = ['id', 'nome', 'cliente', 'endereco', 'inicio', 'fim', 'situacao', 'etapas'];
  const CAMPOS_ETAPA = ['id', 'nome', 'resp', 'inicio', 'fim', 'pct', 'status', 'obs'];

  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const limpa = (s) => { const t = String(s == null ? '' : s).trim(); return t === '' ? null : t; };
  const titulo = (s) => String(s).trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());

  const MAP_OBRA = { andamento: 'em_andamento', emandamento: 'em_andamento', concluida: 'concluida', concluido: 'concluida',
    finalizada: 'concluida', pausada: 'pausada', pausado: 'pausada', paralisada: 'pausada', atrasada: 'atrasada',
    atrasado: 'atrasada', naoiniciada: 'nao_iniciada', naoiniciado: 'nao_iniciada', pendente: 'nao_iniciada' };
  const MAP_ETAPA = { andamento: 'em_andamento', emandamento: 'em_andamento', concluida: 'concluida', concluido: 'concluida',
    pendente: 'pendente', naoiniciada: 'pendente', aguardando: 'pendente', pausada: 'pausada', atrasada: 'atrasada' };
  const chave = (s) => norm(s).replace(/[\s_-]/g, '');

  function data(v, av, ctx) {
    const s = limpa(v); if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    av.push({ nivel: 'aviso', obra: ctx, msg: `Data não reconhecida "${s}" (campo ficou vazio; valor original preservado).` });
    return null;
  }

  function analisar(json) {
    const avisos = [], resp = new Map();
    const lista = Array.isArray(json) ? json : (json && Array.isArray(json.obras) ? json.obras : null);
    if (!lista) return { erro: 'Arquivo não reconhecido: não foi encontrada a lista "obras".', obras: [], avisos, responsaveis: [] };
    const extrasRaiz = json && !Array.isArray(json) ? Object.keys(json).filter((k) => k !== 'obras') : [];
    if (extrasRaiz.length) avisos.push({ nivel: 'info', obra: '(arquivo)', msg: `Campos extras na raiz do arquivo serão preservados no backup: ${extrasRaiz.join(', ')}.` });

    const vistos = new Set(), obras = [];
    lista.forEach((o, i) => {
      const rot = limpa(o && o.nome) || `(obra #${i + 1} sem nome)`;
      if (!o || typeof o !== 'object' || !limpa(o.nome)) {
        avisos.push({ nivel: 'erro', obra: rot, msg: 'Obra sem nome: será ignorada.' }); return;
      }
      if (o.id != null && vistos.has(String(o.id))) avisos.push({ nivel: 'erro', obra: rot, msg: `ID repetido no arquivo (${o.id}).` });
      if (o.id != null) vistos.add(String(o.id));

      const extras = { origem: 'sistema_antigo' };
      Object.keys(o).filter((k) => !CAMPOS_OBRA.includes(k)).forEach((k) => (extras[k] = o[k]));
      let st = MAP_OBRA[chave(o.situacao)];
      if (!st) { st = 'nao_iniciada'; extras.situacao_original = o.situacao;
        avisos.push({ nivel: 'aviso', obra: rot, msg: `Situação desconhecida "${o.situacao}": importada como "Não iniciada".` }); }

      const obra = {
        legacy_id: o.id != null ? String(o.id) : null,
        nome: String(o.nome).trim(), cliente: limpa(o.cliente), endereco: limpa(o.endereco),
        data_inicio_prevista: data(o.inicio, avisos, rot), data_conclusao_prevista: data(o.fim, avisos, rot),
        status: st, dados_extras: extras, etapas: []
      };
      if (!obra.legacy_id) avisos.push({ nivel: 'aviso', obra: rot, msg: 'Obra sem ID: a detecção de duplicados usará nome + cliente.' });
      if (!obra.cliente) avisos.push({ nivel: 'aviso', obra: rot, msg: 'Cliente não informado.' });
      if (!obra.data_inicio_prevista || !obra.data_conclusao_prevista) avisos.push({ nivel: 'aviso', obra: rot, msg: 'Datas previstas incompletas.' });
      if (obra.data_inicio_prevista && obra.data_conclusao_prevista && obra.data_inicio_prevista > obra.data_conclusao_prevista)
        avisos.push({ nivel: 'aviso', obra: rot, msg: 'Data inicial posterior à data final da obra.' });
      if (/^teste?$/i.test(norm(o.nome))) avisos.push({ nivel: 'aviso', obra: rot, msg: 'Parece um registro de teste. Desmarque se não quiser importar.' });

      const et = Array.isArray(o.etapas) ? o.etapas : [];
      et.forEach((e, j) => {
        const ex = {}; Object.keys(e || {}).filter((k) => !CAMPOS_ETAPA.includes(k)).forEach((k) => (ex[k] = e[k]));
        const nome = limpa(e && e.nome);
        if (!nome) { avisos.push({ nivel: 'erro', obra: rot, msg: `Etapa #${j + 1} sem nome: ignorada.` }); return; }
        let es = MAP_ETAPA[chave(e.status)];
        if (!es) { es = 'pendente'; ex.status_original = e.status;
          avisos.push({ nivel: 'aviso', obra: rot, msg: `Etapa "${nome}": status "${e.status}" desconhecido, importada como Pendente.` }); }
        let pct = Number(e.pct); if (!isFinite(pct)) { pct = 0; if (e.pct != null) ex.pct_original = e.pct; }
        pct = Math.min(100, Math.max(0, pct));
        const r = limpa(e.resp);
        if (r) { const k = norm(r); if (!resp.has(k)) resp.set(k, { nome: titulo(r), variacoes: new Set() }); resp.get(k).variacoes.add(r.trim()); }
        else avisos.push({ nivel: 'aviso', obra: rot, msg: `Etapa "${nome}" sem responsável.` });
        const et2 = {
          legacy_id: e.id != null ? String(e.id) : null, ordem: j + 1, nome,
          responsavel_nome: r ? resp.get(norm(r)).nome : null,
          data_inicio: data(e.inicio, avisos, rot), data_fim: data(e.fim, avisos, rot),
          percentual: pct, status: es, observacoes: limpa(e.obs), dados_extras: ex
        };
        if (et2.data_inicio && et2.data_fim && et2.data_inicio > et2.data_fim) avisos.push({ nivel: 'aviso', obra: rot, msg: `Etapa "${nome}": início posterior ao fim.` });
        if (obra.data_inicio_prevista && et2.data_inicio && (et2.data_inicio < obra.data_inicio_prevista || (obra.data_conclusao_prevista && et2.data_fim > obra.data_conclusao_prevista)))
          avisos.push({ nivel: 'info', obra: rot, msg: `Etapa "${nome}" fora do período previsto da obra.` });
        if (es === 'concluida' && pct < 100) avisos.push({ nivel: 'aviso', obra: rot, msg: `Etapa "${nome}" concluída com ${pct}%.` });
        obra.etapas.push(et2);
      });
      if (obra.status === 'concluida' && obra.etapas.some((e) => e.status !== 'concluida'))
        avisos.push({ nivel: 'aviso', obra: rot, msg: 'Obra concluída com etapas não concluídas.' });
      if (obra.status === 'em_andamento' && obra.etapas.length && obra.etapas.every((e) => e.status === 'concluida'))
        avisos.push({ nivel: 'info', obra: rot, msg: 'Obra "em andamento" com todas as etapas concluídas.' });
      obras.push(obra);
    });

    const responsaveis = [...resp.values()].map((r) => ({ nome: r.nome, variacoes: [...r.variacoes] }));
    responsaveis.filter((r) => r.variacoes.length > 1).forEach((r) =>
      avisos.push({ nivel: 'info', obra: '(responsáveis)', msg: `"${r.nome}" aparece escrito de formas diferentes (${r.variacoes.join(', ')}): serão unificados.` }));
    return { obras, avisos, responsaveis,
      totais: { obras: obras.length, etapas: obras.reduce((a, o) => a + o.etapas.length, 0), responsaveis: responsaveis.length },
      extrasRaiz: extrasRaiz.reduce((a, k) => ((a[k] = json[k]), a), {}) };
  }

  // Formato antigo (para exportar de volta ao sistema antigo, se necessário)
  function paraFormatoAntigo(obras, etapas) {
    return { obras: obras.map((o) => ({
      id: o.legacy_id || o.id, nome: o.nome, cliente: o.cliente || '', endereco: o.endereco || '',
      inicio: o.data_inicio_prevista || '', fim: o.data_conclusao_prevista || '',
      situacao: ({ em_andamento: 'andamento', nao_iniciada: 'naoiniciada' })[o.status] || o.status,
      etapas: etapas.filter((e) => e.obra_id === o.id).sort((a, b) => a.ordem - b.ordem).map((e) => ({
        id: e.legacy_id || e.id, nome: e.nome, resp: e.responsavel_nome || '', inicio: e.data_inicio || '', fim: e.data_fim || '',
        pct: Number(e.percentual) || 0, obs: e.observacoes || '',
        status: ({ em_andamento: 'andamento', pendente: 'pendente' })[e.status] || e.status }))
    })) };
  }

  const api = { analisar, norm, titulo, paraFormatoAntigo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Legado = api;
})(typeof window !== 'undefined' ? window : globalThis);
