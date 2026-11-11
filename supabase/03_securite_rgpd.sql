-- Étape 1 : limites de tentatives, plafond, RGPD, export, autotest

-- ---------- Réglages ----------
create table if not exists public.atelier_settings (
  key text primary key,
  value text not null
);
alter table public.atelier_settings enable row level security;
revoke all on public.atelier_settings from anon, authenticated;
insert into public.atelier_settings values ('contact_email',''), ('retention_months','12') on conflict (key) do nothing;

alter table public.atelier_sessions add column if not exists max_participants int not null default 30;
alter table public.atelier_participants add column if not exists contact_consent boolean not null default false;

-- ---------- Tentatives d'accès ----------
create table if not exists public.atelier_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists atelier_attempts_ip_idx on public.atelier_attempts(ip, at);
alter table public.atelier_attempts enable row level security;
revoke all on public.atelier_attempts from anon, authenticated;

create or replace function public.atelier_client_ip() returns text
language sql stable set search_path to '' as $$
  select nullif(btrim(split_part(coalesce(
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for'), ''), ',', 1)), '');
$$;

-- Rejoindre : renvoie {error} au lieu de lever une exception, pour que l'échec soit bien enregistré
create or replace function public.atelier_join(p_code text, p_name text, p_business text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s public.atelier_sessions; t text; n text := btrim(coalesce(p_name,'')); v_ip text := public.atelier_client_ip();
begin
  if v_ip is not null and (select count(*) from public.atelier_attempts a where a.ip = v_ip
        and a.at > now() - interval '15 minutes') >= 20 then
    return jsonb_build_object('error','trop_de_tentatives');
  end if;
  select * into s from public.atelier_sessions
   where active and lower(code) = lower(btrim(coalesce(p_code,''))) order by created_at desc limit 1;
  if s.id is null then
    if v_ip is not null then
      delete from public.atelier_attempts where at < now() - interval '1 day';
      insert into public.atelier_attempts(ip) values (v_ip);
    end if;
    return jsonb_build_object('error','code_invalide');
  end if;
  if length(n) < 2 or length(n) > 80 then return jsonb_build_object('error','nom_invalide'); end if;
  if (select count(*) from public.atelier_participants where session_id = s.id) >= s.max_participants then
    return jsonb_build_object('error','session_complete');
  end if;
  t := public.atelier_new_token();
  insert into public.atelier_participants(session_id, name, business, token)
  values (s.id, n, left(btrim(coalesce(p_business,'')),120), t);
  return jsonb_build_object('token', t);
end $$;

-- ---------- Sessions : code de 6 caractères minimum, plafond réglable ----------
drop function if exists public.atelier_admin_session(text,uuid,text,text,boolean);
create or replace function public.atelier_admin_session(p_key text, p_id uuid, p_label text, p_code text, p_active boolean, p_max int default 30)
returns uuid language plpgsql security definer set search_path to '' as $$
declare c text := btrim(coalesce(p_code,'')); l text := btrim(coalesce(p_label,'')); rid uuid;
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  if length(c) < 6 or length(c) > 40 then raise exception 'code_trop_court'; end if;
  if c !~ '^[A-Za-z0-9_-]+$' then raise exception 'code_caracteres'; end if;
  if length(l) < 1 then raise exception 'nom_session_vide'; end if;
  if coalesce(p_max,30) < 1 or coalesce(p_max,30) > 500 then raise exception 'plafond_invalide'; end if;
  if coalesce(p_active,true) and exists (select 1 from public.atelier_sessions
      where active and lower(code) = lower(c) and id is distinct from p_id) then raise exception 'code_deja_utilise'; end if;
  if p_id is null then
    insert into public.atelier_sessions(label, code, active, max_participants) values (l, c, coalesce(p_active,true), coalesce(p_max,30)) returning id into rid;
  else
    update public.atelier_sessions set label = l, code = c, active = coalesce(p_active,true), max_participants = coalesce(p_max,30)
     where id = p_id returning id into rid;
  end if;
  return rid;
end $$;

-- ---------- RGPD ----------
create or replace function public.atelier_purge() returns void
language plpgsql security definer set search_path to '' as $$
declare m int := coalesce((select value::int from public.atelier_settings where key='retention_months'), 12);
begin
  delete from public.atelier_participants where created_at < now() - make_interval(months => m);
  delete from public.atelier_messages where created_at < now() - make_interval(months => m);
  delete from public.atelier_attempts where at < now() - interval '1 day';
end $$;

create or replace function public.atelier_privacy() returns jsonb
language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'contact_email', (select value from public.atelier_settings where key='contact_email'),
    'retention_months', (select value::int from public.atelier_settings where key='retention_months'));
$$;

create or replace function public.atelier_forget(p_token text) returns void
language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  delete from public.atelier_messages where participant_id = p.id;
  delete from public.atelier_participants where id = p.id;
end $$;

create or replace function public.atelier_feedback(p_token text, p_answers jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants; consent boolean := coalesce((p_answers->>'consent')::boolean, false);
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 10000 then raise exception 'donnees_invalides'; end if;
  if coalesce(btrim(p_answers->>'contact'),'') <> '' and not consent then raise exception 'consentement_requis'; end if;
  update public.atelier_participants
     set feedback = (case when consent then p_answers else p_answers - 'contact' end) || jsonb_build_object('sent_at', now()),
         contact_consent = consent, last_seen = now()
   where id = p.id;
end $$;

create or replace function public.atelier_admin_settings(p_key text, p_contact text, p_retention int)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  if coalesce(p_retention,12) < 1 or coalesce(p_retention,12) > 36 then raise exception 'duree_invalide'; end if;
  if coalesce(btrim(p_contact),'') <> '' and btrim(p_contact) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email_invalide'; end if;
  update public.atelier_settings set value = coalesce(btrim(p_contact),'') where key = 'contact_email';
  update public.atelier_settings set value = coalesce(p_retention,12)::text where key = 'retention_months';
end $$;

-- Vue d'ensemble : purge au passage, plafond et réglages inclus
create or replace function public.atelier_admin_overview(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  perform public.atelier_purge();
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'code',s.code,'active',s.active,
        'max_participants',s.max_participants,'created_at',s.created_at,
        'participants', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'business',p.business,
            'progress',p.progress,'current_module',p.current_module,'feedback',p.feedback,'contact_consent',p.contact_consent,
            'created_at',p.created_at,'last_seen',p.last_seen) order by p.created_at)
          from public.atelier_participants p where p.session_id = s.id), '[]'::jsonb))
      order by s.created_at desc) from public.atelier_sessions s), '[]'::jsonb),
    'modules', public.atelier_modules_json(),
    'settings', public.atelier_privacy());
end $$;

-- ---------- Sauvegarde complète ----------
create or replace function public.atelier_admin_export(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'version', 1,
    'settings', public.atelier_privacy(),
    'modules', public.atelier_modules_json(),
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from public.atelier_sessions s), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(to_jsonb(p) - 'token' order by p.created_at) from public.atelier_participants p), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.atelier_messages m), '[]'::jsonb));
end $$;

-- ---------- Autotest : rejoue le parcours complet puis annule tout ----------
create or replace function public.atelier_admin_selftest(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare res jsonb := '[]'::jsonb; sid uuid; tok text; me jsonb; chat jsonb; ov jsonb; j jsonb;
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  begin
    insert into public.atelier_sessions(label, code, active) values ('__autotest__', 'AUTOTEST-' || substr(md5(random()::text),1,8), true)
      returning id into sid;
    j := public.atelier_join((select code from public.atelier_sessions where id = sid), 'Autotest', 'Test');
    tok := j->>'token';
    res := res || jsonb_build_object('etape','Inscription avec le code','ok', tok is not null);
    me := public.atelier_me(tok);
    res := res || jsonb_build_object('etape','Chargement des modules','ok', jsonb_array_length(me->'modules') > 0);
    perform public.atelier_save(tok, '{"done":{"x":"1"},"plan":["a","",""]}'::jsonb, 'x');
    res := res || jsonb_build_object('etape','Enregistrement de la progression','ok',
      (public.atelier_me(tok)->'participant'->'progress'->'done'->>'x') = '1');
    perform public.atelier_send(tok, null, null, 'autotest');
    chat := public.atelier_chat(tok, null, null, 0);
    res := res || jsonb_build_object('etape','Envoi et lecture du chat','ok', jsonb_array_length(chat) = 1);
    perform public.atelier_feedback(tok, '{"note":"9"}'::jsonb);
    ov := public.atelier_admin_overview(p_key);
    res := res || jsonb_build_object('etape','Avis visible dans le tableau de bord','ok', exists (
      select 1 from jsonb_array_elements(ov->'sessions') s, jsonb_array_elements(s->'participants') p
       where s->>'id' = sid::text and p->'feedback'->>'note' = '9'));
    j := public.atelier_join('code-qui-n-existe-pas', 'X', '');
    res := res || jsonb_build_object('etape','Refus d''un mauvais code','ok', j->>'error' = 'code_invalide');
    raise exception 'autotest_rollback';
  exception when others then
    if sqlerrm <> 'autotest_rollback' then
      res := res || jsonb_build_object('etape','Erreur : ' || sqlerrm,'ok', false);
    end if;
  end;
  return res;
end $$;

-- ---------- Droits ----------
revoke execute on function public.atelier_client_ip(), public.atelier_purge() from public, anon, authenticated;
grant execute on function
  public.atelier_join(text,text,text), public.atelier_privacy(), public.atelier_forget(text),
  public.atelier_feedback(text,jsonb), public.atelier_admin_settings(text,text,int),
  public.atelier_admin_overview(text), public.atelier_admin_export(text), public.atelier_admin_selftest(text),
  public.atelier_admin_session(text,uuid,text,text,boolean,int)
  to anon;
