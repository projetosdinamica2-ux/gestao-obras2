/**
 * Gestão de Obras v2 — API (Google Apps Script)
 * Os dados ficam em "gestao-obras-v2.json" no Drive de quem publicou o script.
 * (Arquivo diferente do sistema antigo: o sistema antigo continua funcionando sem ser tocado.)
 */

const NOME_ARQUIVO = 'gestao-obras-v2.json';
const PASTA_ID = '';                    // opcional: ID de uma pasta do Drive ('' = raiz do Meu Drive)

// >>> DEFINA A CHAVE DE ACESSO DA EQUIPE (troque o texto abaixo; mínimo 6 caracteres) <<<
// Depois de publicada, a chave pode ser alterada pelo próprio sistema (menu Configurações).
const CHAVE_INICIAL = 'TROQUE-ESTA-CHAVE';

const MAX_FALHAS = 10;                  // tentativas erradas permitidas...
const BLOQUEIO_SEG = 900;               // ...a cada 15 minutos
const BACKUPS_MANTER = 14;              // cópias diárias mantidas na pasta "Gestao de Obras - Backups"

function doGet() {
  return json_({ ok: true, msg: 'API Gestão de Obras v2 funcionando' });
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    checarChave_(b.chave);
    switch (b.action) {
      case 'login':    return json_({ ok: true });
      case 'revisao':  return json_({ ok: true, rev: lerArquivo_().rev });
      case 'carregar': { const d = comTrava_(function () { return lerArquivo_(); }); return json_({ ok: true, rev: d.rev, db: d.db }); }
      case 'gravar':   return json_(gravar_(b.db, b.rev, !!b.forcar));
      case 'trocarChave': {
        if (String(b.nova || '').length < 6) throw new Error('chave_curta');
        PropertiesService.getScriptProperties().setProperty('CHAVE', String(b.nova));
        return json_({ ok: true });
      }
    }
    return json_({ ok: false, erro: 'acao_invalida' });
  } catch (err) {
    return json_({ ok: false, erro: String(err.message || err) });
  }
}

function gravar_(db, revBase, forcar) {
  return comTrava_(function () {
    const atual = lerArquivo_();
    if (!forcar && revBase !== atual.rev) return { ok: true, conflito: true, rev: atual.rev };
    if (!db || typeof db !== 'object' || Array.isArray(db)) throw new Error('db_invalido');
    try { backupDiario_(); } catch (e) {}          // falha no backup não impede de salvar
    const novo = { rev: atual.rev + 1, atualizadoEm: new Date().toISOString(), db: db };
    arquivo_().setContent(JSON.stringify(novo));
    return { ok: true, rev: novo.rev };
  });
}

/* ---------- Segurança ---------- */
function chaveAtual_() {
  const p = PropertiesService.getScriptProperties();
  let c = p.getProperty('CHAVE');
  if (!c) {
    if (CHAVE_INICIAL === 'TROQUE-ESTA-CHAVE' || CHAVE_INICIAL.length < 6) throw new Error('defina_a_chave_no_script');
    c = CHAVE_INICIAL; p.setProperty('CHAVE', c);
  }
  return c;
}
function checarChave_(c) {
  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('falhas') || 0);
  if (falhas >= MAX_FALHAS) throw new Error('bloqueado');
  if (String(c || '') !== chaveAtual_()) { cache.put('falhas', String(falhas + 1), BLOQUEIO_SEG); throw new Error('chave'); }
}

/* ---------- Auxiliares ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try { return fn(); } finally { trava.releaseLock(); }
}
function lerArquivo_() {
  const texto = arquivo_().getBlob().getDataAsString('UTF-8');
  try { const j = JSON.parse(texto); if (j && j.db && typeof j.db === 'object') return j; } catch (e) {}
  return { rev: 0, db: {} };
}
function arquivo_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILE_ID');
  if (id) { try { const f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const conteudo = JSON.stringify({ rev: 0, db: {} });
  const f = PASTA_ID ? DriveApp.getFolderById(PASTA_ID).createFile(NOME_ARQUIVO, conteudo, MimeType.PLAIN_TEXT)
                     : DriveApp.createFile(NOME_ARQUIVO, conteudo, MimeType.PLAIN_TEXT);
  props.setProperty('FILE_ID', f.getId());
  return f;
}
function backupDiario_() {
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('ULT_BACKUP') === hoje) return;
  const nome = 'Gestao de Obras - Backups';
  const it = DriveApp.getFoldersByName(nome);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(nome);
  arquivo_().makeCopy(NOME_ARQUIVO.replace('.json', '') + '-backup-' + hoje + '.json', pasta);
  p.setProperty('ULT_BACKUP', hoje);
  const todos = []; const fi = pasta.getFiles(); while (fi.hasNext()) todos.push(fi.next());
  todos.sort(function (a, b) { return b.getName().localeCompare(a.getName()); });
  todos.slice(BACKUPS_MANTER).forEach(function (x) { x.setTrashed(true); });
}
