-- =====================================================================
-- GESTÃO DE OBRAS - ESQUEMA DO BANCO (Supabase / PostgreSQL)
-- ANTES DE EXECUTAR: troque TROQUE-ESTA-SENHA (linha marcada) pela senha
-- geral que você quer usar para entrar no sistema.
-- Pode ser executado mais de uma vez sem apagar dados.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- Configuração e sessões (inacessíveis pelo navegador) ----------
create table if not exists public.config (chave text primary key, valor text not null);
create table if not exists public.sessoes (
  token uuid primary key default gen_random_uuid(),
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '12 hours');
create table if not exists public.tentativas_login (
  id bigserial primary key, criada_em timestamptz not null default now());

-- >>>>>>>>>>  TROQUE A SENHA ABAIXO (entre aspas simples)  <<<<<<<<<<
insert into public.config(chave, valor)
values ('senha_hash', extensions.crypt('TROQUE-ESTA-SENHA', extensions.gen_salt('bf')))
on conflict (chave) do nothing;

-- ---------- Tabelas de negócio ----------
create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null, cargo text, especialidade text, telefone text, email text,
  situacao text not null default 'ativo' check (situacao in ('ativo','inativo','afastado')),
  dados_extras jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,                       -- id do sistema antigo
  codigo text, nome text not null, cliente text, endereco text, responsavel text,
  data_inicio_prevista date, data_conclusao_prevista date,
  data_inicio_real date, data_conclusao_real date,
  descricao text, observacoes text,
  status text not null default 'nao_iniciada'
    check (status in ('nao_iniciada','em_andamento','pausada','concluida','atrasada')),
  dados_extras jsonb not null default '{}'::jsonb,   -- campos antigos sem correspondência
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.etapas (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  obra_id uuid not null references public.obras(id) on delete cascade,
  ordem int not null default 0,
  nome text not null, descricao text,
  responsavel_id uuid references public.colaboradores(id) on delete set null,
  responsavel_nome text,
  data_inicio date, data_fim date,
  percentual numeric(5,2) not null default 0 check (percentual between 0 and 100),
  status text not null default 'pendente'
    check (status in ('pendente','em_andamento','pausada','concluida','atrasada')),
  observacoes text,
  dados_extras jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  obra_id uuid not null references public.obras(id) on delete cascade,
  etapa_id uuid references public.etapas(id) on delete cascade,
  nome text not null, descricao text,
  responsavel_id uuid references public.colaboradores(id) on delete set null,
  responsavel_nome text,
  data_inicio date, data_fim date, data_conclusao_real date,
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  percentual numeric(5,2) not null default 0 check (percentual between 0 and 100),
  status text not null default 'pendente'
    check (status in ('pendente','em_andamento','pausada','concluida','atrasada')),
  comentarios text,
  dados_extras jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.alocacoes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  etapa_id uuid references public.etapas(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete cascade,
  data_inicio date, data_fim date, observacoes text,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.diario_obra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null default current_date,
  responsavel_nome text, servicos_executados text, etapas_relacionadas text,
  percentual_avanco numeric(5,2), problemas text, observacoes text,
  dados_extras jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id) on delete cascade,
  etapa_id uuid references public.etapas(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete cascade,
  autor text, texto text not null,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id) on delete cascade,
  diario_id uuid references public.diario_obra(id) on delete cascade,
  nome text not null, tipo text, caminho_storage text, tamanho bigint,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table if not exists public.historico (
  id uuid primary key default gen_random_uuid(),
  entidade text not null, entidade_id uuid, obra_id uuid,
  acao text not null, descricao text, dados jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

-- ---------- Atualiza "atualizado_em" automaticamente ----------
create or replace function public.set_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['colaboradores','obras','etapas','atividades','alocacoes',
                           'diario_obra','comentarios','documentos','historico'] loop
    execute format('drop trigger if exists trg_atualizado on public.%I', t);
    execute format('create trigger trg_atualizado before insert or update on public.%I
                    for each row execute function public.set_atualizado()', t);
  end loop; end $$;

create index if not exists ix_etapas_obra on public.etapas(obra_id);
create index if not exists ix_atividades_obra on public.atividades(obra_id);
create index if not exists ix_atividades_etapa on public.atividades(etapa_id);
create index if not exists ix_diario_obra on public.diario_obra(obra_id, data);
create index if not exists ix_historico_obra on public.historico(obra_id, criado_em);

-- ---------- SEGURANÇA: ninguém acessa tabelas direto pelo navegador ----------
do $$ declare t text; begin
  foreach t in array array['config','sessoes','tentativas_login','colaboradores','obras','etapas',
     'atividades','alocacoes','diario_obra','comentarios','documentos','historico'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop; end $$;
-- (RLS ligado SEM políticas = bloqueio total para a chave pública.
--  Todo acesso passa pelas funções app_* abaixo, que exigem sessão válida.)

-- ---------- Funções internas ----------
create or replace function public._tabelas() returns text[] language sql immutable as $$
  select array['colaboradores','obras','etapas','atividades','alocacoes',
               'diario_obra','comentarios','documentos','historico'] $$;

create or replace function public._auth(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or not exists (select 1 from sessoes where token = p_token and expira_em > now()) then
    raise exception 'sessao_invalida';
  end if;
end $$;

-- ---------- Funções chamadas pelo sistema ----------
create or replace function public.app_login(p_senha text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare h text; t uuid;
begin
  delete from sessoes where expira_em < now();
  delete from tentativas_login where criada_em < now() - interval '15 minutes';
  if (select count(*) from tentativas_login) >= 10 then raise exception 'muitas_tentativas'; end if;
  select valor into h from config where chave = 'senha_hash';
  if h is null or crypt(coalesce(p_senha,''), h) <> h then
    insert into tentativas_login default values;
    return null;                                   -- senha incorreta
  end if;
  insert into sessoes default values returning token into t;
  return t;
end $$;

create or replace function public.app_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from sessoes where token = p_token $$;

create or replace function public.app_change_password(p_token uuid, p_atual text, p_nova text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  perform _auth(p_token);
  select valor into h from config where chave = 'senha_hash';
  if crypt(coalesce(p_atual,''), h) <> h then return false; end if;
  if length(coalesce(p_nova,'')) < 6 then raise exception 'senha_curta'; end if;
  update config set valor = crypt(p_nova, gen_salt('bf')) where chave = 'senha_hash';
  delete from sessoes where token <> p_token;       -- derruba os outros acessos
  return true;
end $$;

create or replace function public.app_list(p_token uuid, p_tabela text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform _auth(p_token);
  if not (p_tabela = any(_tabelas())) then raise exception 'tabela_invalida'; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em), ''[]''::jsonb) from public.%I t', p_tabela) into r;
  return r;
end $$;

-- Insere ou atualiza (por id) um registro ou uma lista de registros.
-- Atenção: substitui os campos enviados; campos obrigatórios ausentes recebem o valor padrão.
create or replace function public.app_save(p_token uuid, p_tabela text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare arr jsonb; cols text[]; colsql text; selsql text; setsql text; res jsonb;
begin
  perform _auth(p_token);
  if not (p_tabela = any(_tabelas())) then raise exception 'tabela_invalida'; end if;
  arr := case when jsonb_typeof(p_dados) = 'array' then p_dados else jsonb_build_array(p_dados) end;
  select jsonb_agg(case when coalesce(e->>'id','') = '' then (e - 'id') || jsonb_build_object('id', gen_random_uuid())
                        else e end)
    into arr from jsonb_array_elements(arr) e;
  if arr is null then return '[]'::jsonb; end if;
  select array_agg(distinct k) into cols
    from jsonb_array_elements(arr) e, jsonb_object_keys(e) k
   where k in (select column_name from information_schema.columns
                where table_schema = 'public' and table_name = p_tabela);
  select string_agg(quote_ident(c.column_name), ','),
         string_agg(case when c.is_nullable = 'NO' and c.column_default is not null and c.column_name <> 'id'
                         then format('coalesce(%I, %s)', c.column_name, c.column_default)
                         else quote_ident(c.column_name) end, ','),
         string_agg(quote_ident(c.column_name) || '=excluded.' || quote_ident(c.column_name), ',')
           filter (where c.column_name <> 'id')
    into colsql, selsql, setsql
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_tabela and c.column_name = any(cols);
  execute format(
    'with s as (insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) '
    || 'on conflict (id) do %s returning *) select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from s',
    p_tabela, colsql, selsql, p_tabela,
    case when setsql is null then 'nothing' else 'update set ' || setsql end)
  into res using arr;
  return res;
end $$;

create or replace function public.app_delete(p_token uuid, p_tabela text, p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform _auth(p_token);
  if not (p_tabela = any(_tabelas())) then raise exception 'tabela_invalida'; end if;
  execute format('with d as (delete from public.%I where id = any($1) returning 1) select count(*) from d', p_tabela)
    into n using p_ids;
  return n;
end $$;

-- ---------- Permissões de execução ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.app_login(text), public.app_logout(uuid),
  public.app_change_password(uuid,text,text), public.app_list(uuid,text),
  public.app_save(uuid,text,jsonb), public.app_delete(uuid,text,uuid[]) to anon, authenticated;
