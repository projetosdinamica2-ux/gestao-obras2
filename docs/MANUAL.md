# Manual — Gestão de Obras (Etapa 1, versão Google Drive)

Este manual leva você do zero até o sistema funcionando na internet, com vários computadores usando os mesmos dados. Não é preciso saber programar. Siga na ordem.

**O que você vai usar (tudo gratuito):**
- **Google Apps Script + Drive** — guardam os dados num arquivo JSON, como o seu sistema atual.
- **GitHub Pages** — coloca as telas do sistema no ar, como o seu sistema atual.

---

## ETAPA 1 — Preparação dos arquivos

1. Baixe e descompacte o arquivo `gestao-obras.zip`. Dentro dele haverá uma pasta `gestao-obras`.
2. Confira que ela contém exatamente esta estrutura:

```
gestao-obras/
├── index.html            (tela da senha)
├── dashboard.html
├── obras.html
├── importacao.html       (importar JSON, exportar, backup, restaurar)
├── configuracoes.html    (trocar a senha)
├── css/style.css
├── js/  config.js  api.js  app.js  legado.js  dashboard.js  obras.js  importacao.js
├── apps-script/Code.gs   (código do servidor, vai no Google)
├── extras/supabase/      (alternativa opcional; pode ignorar)
└── docs/MANUAL.md
```

3. **Verificação dos caminhos:** os arquivos `.html` ficam na pasta principal e os `.js`/`.css` nas subpastas `js` e `css`, com esses nomes exatos (minúsculas). Se uma pasta ou nome estiver diferente, a tela abre "sem cor" ou sem funcionar.

---

## ETAPA 2 — Configuração do servidor (Google Apps Script + Drive)

É o mesmo tipo de servidor que o seu sistema atual já usa: um pequeno programa do Google que guarda os dados em um arquivo no seu Drive. O sistema novo usa um **arquivo diferente** (`gestao-obras-v2.json`), então o sistema antigo continua funcionando sem ser mexido.

### 2.1 Criar o script
1. Acesse **https://script.google.com** (logado na conta Google que vai guardar os dados) e clique em **Novo projeto**.
2. Clique no nome "Projeto sem título" (no alto) e renomeie para `Gestao de Obras API`.
3. No editor, selecione todo o código que já vem (Ctrl+A) e apague.
4. Abra o arquivo `apps-script/Code.gs` (Bloco de Notas), copie tudo e cole no editor.
5. Procure a linha `const CHAVE_INICIAL = 'TROQUE-ESTA-CHAVE';` e troque o texto entre aspas pela **chave de acesso da equipe**. Use algo difícil de adivinhar (ex.: `Obras@Equipe2026`), com no mínimo 6 caracteres.
6. Clique no ícone de disquete (**Salvar projeto**) ou Ctrl+S.

### 2.2 Publicar (implantar) como aplicativo da Web
1. Clique em **Implantar** (canto superior direito) > **Nova implantação**.
2. Clique na engrenagem ⚙ ao lado de "Selecionar tipo" e escolha **App da Web**.
3. Preencha:
   - **Descrição:** `v1`
   - **Executar como:** **Eu** (seu e-mail)
   - **Quem pode acessar:** **Qualquer pessoa**
4. Clique em **Implantar**. Na primeira vez, clique em **Autorizar acesso**, escolha sua conta; se aparecer "O Google não verificou este app", clique em **Avançado** > **Acessar Gestao de Obras API (não seguro)** > **Permitir** (o app é seu).
5. Copie o **URL do app da Web** (termina em `/exec`). Guarde-o.
6. **Testar:** cole esse URL numa aba do navegador. Deve aparecer: `{"ok":true,"msg":"API Gestão de Obras v2 funcionando"}`.

> O arquivo de dados (`gestao-obras-v2.json`) é criado sozinho no seu **Meu Drive** no primeiro acesso. **Não apague nem mova para a lixeira.** O Drive guarda também o histórico de versões dele.

### 2.3 Como a segurança funciona
- "Qualquer pessoa" significa que o endereço do script é público, mas **nenhum dado é entregue sem a chave** correta. A chave é conferida no servidor e **não está** nos arquivos do site.
- Após **10 chaves erradas** o acesso fica bloqueado por 15 minutos (vale para todos).
- Cada pessoa digita a chave uma vez; com "Lembrar neste aparelho" marcado, o aparelho guarda até sair do sistema.
- A chave pode ser trocada pelo menu **Configurações** do sistema.

### 2.4 Backups automáticos
Uma vez por dia, no primeiro salvamento, o servidor copia o arquivo para a pasta **Gestao de Obras - Backups** no seu Drive e mantém as últimas 14 cópias.

### 2.5 Fotos e documentos
Serão tratados na **Etapa 2 do projeto** (Diário de Obra), guardando os arquivos numa pasta do Drive.

---

## ETAPA 3 — Configuração do sistema (conectar o site ao servidor)

1. Abra `js/config.js` no Bloco de Notas e troque:

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
NOME_SISTEMA: "Gestão de Obras",
NOME_EMPRESA: "Nome da sua empresa"
```
   Mantenha as aspas. Salve.
2. **Testar a conexão:** depois de publicar (Etapa 4), abra o endereço e digite a chave. Se entrar no Dashboard, está funcionando. Mensagens possíveis:
   - *"Sistema não configurado"* → o `config.js` ainda tem `COLE_AQUI`.
   - *"Senha incorreta"* → chave diferente da definida no script.
   - *"Resposta inválida do servidor"* → a implantação não está como "Qualquer pessoa", ou a URL não termina em `/exec`.
   - *"A chave inicial ainda não foi definida"* → faltou trocar `TROQUE-ESTA-CHAVE` no script (2.1, passo 5) e publicar de novo.

---

## ETAPA 4 — Publicação no GitHub

1. Acesse **https://github.com** e entre na sua conta.
2. Clique em **+** (canto superior direito) > **New repository**.
   - **Repository name:** `gestao-obras` (ou outro nome; ele fará parte do endereço).
   - Marque **Public** (necessário para o GitHub Pages gratuito) ou *Private* se o seu plano permitir Pages privado.
   - Marque **Add a README file** e clique **Create repository**.
3. Na página do repositório: **Add file** > **Upload files**.
4. Abra a pasta `gestao-obras` no seu computador, selecione **todo o conteúdo** (index.html, as pastas css, js, sql, docs, etc.) e **arraste para a janela do GitHub**. Pastas são enviadas com seus arquivos.
   - Confira se na lista aparecem `css/style.css`, `js/config.js` etc. (com a pasta antes do nome).
5. Role até o fim, clique em **Commit changes**.
6. Ative o site: **Settings** (do repositório) > **Pages** (menu da esquerda).
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` e pasta `/ (root)` > **Save**.
7. Aguarde 1–3 minutos e atualize a página. Aparecerá: **Your site is live at `https://SEU-USUARIO.github.io/gestao-obras/`**. Esse é o **link de acesso**.
8. Abra o link: deve aparecer a tela de senha.

---

## ETAPA 5 — Utilização em várias máquinas

1. **Computador principal:** abra o link, digite a senha, entre no Dashboard.
2. **Demais computadores/celulares:** abra o **mesmo link** e digite a mesma senha. Não é preciso instalar nada.
3. **Mesmos dados para todos:** o endereço do servidor está em `js/config.js`, publicado junto com o sistema; por isso todos usam o mesmo arquivo no Drive.
4. **Teste de sincronização:** no computador A, abra *Obras e etapas*, abra uma obra e altere o percentual de uma etapa. No computador B, atualize a página (F5): o novo valor aparece.
   - Os dados **não atualizam sozinhos** na tela: se outra pessoa alterou algo, aperte **F5** para ver.
   - Se duas pessoas salvarem ao mesmo tempo, o sistema detecta, recarrega os dados mais novos e refaz a alteração: as duas ficam gravadas. Só na **mesma etapa/campo** vale a última a salvar.
   - Cada salvamento leva 1–3 segundos (é o tempo do Google); é normal.
5. **Evitar perda de dados:** nunca use "Excluir" sem necessidade; faça backup (Etapa 7) antes de mudanças grandes e pelo menos uma vez por semana.
6. **Sair:** botão **Sair do sistema** no menu lateral. Em computadores compartilhados, sempre saia.

---

## ETAPA 6 — Atualização do sistema

**Para atualizar um arquivo:**
1. No GitHub, abra o repositório, clique no arquivo (ex.: `js/obras.js`) > ícone de **lápis (Edit)** para editar ali mesmo, ou **Add file > Upload files** para enviar a versão nova com o mesmo nome (ela substitui a antiga).
2. Clique em **Commit changes**.
3. Em 1–2 minutos o site estará atualizado. Se não mudar, aperte **Ctrl+F5**.

**Seus dados não são afetados:** ficam no Drive, não nos arquivos do site. Atualizar o site nunca apaga obras.

**Atualizar o servidor (`Code.gs`):** cole o código novo no editor do script, salve e depois **Implantar > Gerenciar implantações > ícone de lápis > Versão: Nova versão > Implantar**. O URL continua o mesmo. (Só salvar não basta: sem uma nova versão, o servidor segue rodando o código antigo.) Ao colar o código novo, **refaça a troca de `CHAVE_INICIAL`** — mas, se a chave já foi definida antes, ela é mantida e o valor do código é ignorado.

⚠️ **Ao atualizar `config.js`**, mantenha sua URL — não envie o arquivo modelo por cima.

**Alterar a chave:** menu **Configurações** > informe a chave atual e a nova. Os outros aparelhos pedirão a nova chave no próximo acesso.
**Esqueceu a chave?** No editor do script: **Configurações do projeto** (engrenagem à esquerda) > **Propriedades do script** > edite o valor de **CHAVE** (se não existir, adicione com esse nome).

---

## ETAPA 7 — Backup, restauração e recuperação

### 7.1 Exportar / fazer backup
Menu **Importar / Backup** > aba **Exportar / Backup**:
- **Backup completo** — tudo em um arquivo `.json` (use este para segurança).
- **Exportar uma obra** — só a obra escolhida e o que pertence a ela.
- **Obras, etapas e atividades** — sem diário e histórico.
- **Formato do sistema antigo** — gera JSON no formato que o sistema antigo entendia.

Guarde o arquivo em mais de um lugar (pen drive, Google Drive etc.). Sugestão: backup toda sexta-feira, com a data no nome (o sistema já coloca).

### 7.2 Restaurar um backup
Menu **Importar / Backup** > aba **Restaurar backup** > escolher o arquivo > conferir o resumo > **Restaurar** > confirmar.
- Registros com o mesmo identificador são **atualizados** com o conteúdo do backup; nada é apagado.
- Para restaurar sobre um banco **vazio** (após um desastre), basta fazer exatamente isso.

### 7.3 Importar o JSON do sistema antigo
Aba **Importar JSON do sistema antigo**:
1. Selecione o arquivo exportado pelo sistema antigo.
2. Confira a **prévia**: nº de obras, etapas, responsáveis, avisos e as obras encontradas (desmarque as que não quiser, como registros de teste).
3. Escolha **Importação inicial** (banco novo) ou **Atualização de dados** (banco que já tem obras). Para obras que já existem, escolha por obra: *Manter atual* ou *Atualizar com o arquivo*. Campos vazios no arquivo nunca apagam dados existentes.
4. Marque a confirmação e clique **Importar dados**.

### 7.4 Backups automáticos e recuperação pelo Drive
- Todo dia o servidor copia os dados para **Gestao de Obras - Backups** (últimas 14 cópias). Para voltar a uma delas: baixe o arquivo da pasta e use **Importar / Backup > Restaurar backup** escolhendo esse arquivo (o sistema reconhece os dois formatos).
- Alternativa: no Drive, clique com o botão direito em `gestao-obras-v2.json` > **Gerenciar versões** para recuperar uma versão anterior.
- Mesmo assim, faça o backup completo do sistema (7.1) semanalmente e guarde fora do Drive.
- Limites do Google: o Apps Script tem cotas diárias generosas para uso de equipe, mas é mais lento que um banco de dados profissional.

### 7.5 Se algo der errado
| Sintoma | O que fazer |
|---|---|
| Tela sem cores / links quebrados | Pastas/arquivos enviados fora do lugar (Etapa 1) |
| "Sistema não configurado" | Preencher `js/config.js` (Etapa 3) |
| Cai na tela de senha sozinho | Sessão de 12 h expirou; é normal |
| Dados sumiram da tela | F5; abra `gestao-obras-v2.json` no Drive e veja se os dados estão lá |
| Obra excluída por engano | Restaurar o último backup (7.2) |
