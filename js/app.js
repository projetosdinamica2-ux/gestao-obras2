// Funções compartilhadas: menu lateral, formatação, modais e avisos.
const ST_OBRA = { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída', atrasada: 'Atrasada' };
const ST_ETAPA = { pendente: 'Pendente', em_andamento: 'Em andamento', pausada: 'Pausada', concluida: 'Concluída', atrasada: 'Atrasada' };
const COR = { nao_iniciada: '#94a3b8', pendente: '#94a3b8', em_andamento: '#2563eb', pausada: '#f59e0b', concluida: '#16a34a', atrasada: '#dc2626' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const fmtDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const dias = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const badge = (st, mapa = ST_OBRA) => `<span class="badge b-${st}">${esc(mapa[st] || st)}</span>`;
const barra = (p) => `<div class="bar ${p >= 100 ? 'ok' : ''}" title="${p}%"><i style="width:${Math.min(100, p)}%"></i></div>`;
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// Situação "efetiva": quem está vencido e não concluído aparece como atrasado.
function efetivo(status, fim) {
  if (['em_andamento', 'nao_iniciada', 'pendente'].includes(status) && fim && fim < hojeISO()) return 'atrasada';
  return status;
}
function progressoObra(obra, etapas) {
  const es = etapas.filter((e) => e.obra_id === obra.id);
  if (!es.length) return obra.status === 'concluida' ? 100 : 0;
  return Math.round(es.reduce((a, e) => a + Number(e.percentual || 0), 0) / es.length);
}

function toast(msg, tipo = '') {
  let c = $('#toasts'); if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.className = 'toast ' + tipo; t.textContent = msg; c.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 7000 : 3500);
}
const erro = (e) => { console.error(e); toast(e && e.message ? e.message : String(e), 'erro'); };

// Modal genérico. Retorna {el, fechar}. botoes: [{txt, cls, onClick}]
function modal({ titulo, corpo, largo = false, botoes = [] }) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="modal ${largo ? 'lg' : ''}"><div class="mh"><h2>${esc(titulo)}</h2><button aria-label="Fechar">×</button></div>
    <div class="mb">${corpo}</div>${botoes.length ? '<div class="mf"></div>' : ''}</div>`;
  document.body.appendChild(ov);
  const fechar = () => ov.remove();
  $('.mh button', ov).onclick = fechar;
  botoes.forEach((b) => { const x = document.createElement('button'); x.className = 'btn ' + (b.cls || ''); x.textContent = b.txt;
    x.onclick = async () => { x.disabled = true; try { await b.onClick({ el: ov, fechar }); } catch (e) { erro(e); } x.disabled = false; }; $('.mf', ov).appendChild(x); });
  return { el: ov, fechar };
}
const confirmar = (msg, txt = 'Confirmar') => new Promise((res) => {
  const m = modal({ titulo: 'Confirmação', corpo: `<p>${msg}</p>`, botoes: [
    { txt: 'Cancelar', cls: 'sec', onClick: ({ fechar }) => { fechar(); res(false); } },
    { txt, cls: 'verm', onClick: ({ fechar }) => { fechar(); res(true); } }] });
  $('.mh button', m.el).onclick = () => { m.fechar(); res(false); };
});

function baixar(nome, conteudo, tipo = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo + ';charset=utf-8' }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}

const MENU = [
  ['dashboard.html', '📊', 'Dashboard'], ['obras.html', '🏗️', 'Obras e etapas'], ['relatorios.html', '📄', 'Relatórios'],
  ['importacao.html', '📥', 'Importar / Backup'], ['configuracoes.html', '⚙️', 'Configurações']
];
function montarPagina(ativa, titulo) {
  if (!Api.requireAuth()) return false;
  const cfg = window.APP_CONFIG;
  const side = document.createElement('aside'); side.className = 'side';
  side.innerHTML = `<div class="brand"><img src="assets/logo-icone.png" alt=""><span>${esc(cfg.NOME_SISTEMA)}</span></div><nav>` +
    MENU.map(([h, i, t]) => `<a href="${h}" class="${h === ativa ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('') +
    `</nav><button class="sair">Sair do sistema</button>`;
  document.body.prepend(side);
  $('.sair', side).onclick = () => Api.logout();
  const main = $('main'); main.classList.add('main');
  main.insertAdjacentHTML('afterbegin', `<div class="banner"><img src="assets/banner.webp" alt="${esc(cfg.NOME_EMPRESA)}"></div><div class="top"><div class="row"><button class="burger">☰</button><h1>${esc(titulo)}</h1></div><div id="acoes" class="row"></div></div>`);
  $('.burger', main).onclick = () => side.classList.toggle('open');
  document.title = titulo + ' — ' + cfg.NOME_SISTEMA;
  return true;
}

async function carregarTudo() {
  const [obras, etapas, colaboradores] = await Promise.all([Api.list('obras'), Api.list('etapas'), Api.list('colaboradores')]);
  return { obras, etapas, colaboradores };
}

// Classificação das etapas por TIPO e FASE, a partir de palavras no nome da etapa.
const TIPOS_ETAPA = [['Subestação', /subestac/], ['Quadros', /quadro/], ['Instalação', /instalac/], ['Racks', /rack/], ['SPDA', /spda/], ['Rede elétrica', /agrupamento|deslocamento|\brede\b/]];
function tipoEtapa(nome) { const s = norm(nome); for (const [t, r] of TIPOS_ETAPA) if (r.test(s)) return t; return 'Outros'; }
function faseEtapa(nome) { const s = norm(nome); if (/^(materia|relacao de mater|lista|ferragens)/.test(s)) return 'Materiais'; if (/projeto/.test(s)) return 'Projeto'; return 'Execução'; }
