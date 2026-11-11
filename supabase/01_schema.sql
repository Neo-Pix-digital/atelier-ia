-- Atelier IA NéoPix : tables, sécurité et fonctions
-- Tout passe par des fonctions SECURITY DEFINER ; les tables sont fermées (RLS sans politique).

create table if not exists public.atelier_sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.atelier_modules (
  id text primary key,
  position int not null default 100,
  title text not null,
  duration text not null default '',
  summary text not null default '',
  body text not null default '',
  prompts jsonb not null default '[]'::jsonb,
  image_url text not null default '',
  video_url text not null default '',
  kind text not null default 'lesson' check (kind in ('lesson','feedback')),
  updated_at timestamptz not null default now()
);

create table if not exists public.atelier_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.atelier_sessions(id) on delete cascade,
  name text not null,
  business text not null default '',
  token text not null unique,
  progress jsonb not null default '{}'::jsonb,
  current_module text,
  feedback jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.atelier_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.atelier_sessions(id) on delete cascade,
  participant_id uuid references public.atelier_participants(id) on delete set null,
  author text not null,
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists atelier_messages_session_idx on public.atelier_messages(session_id, id);

create table if not exists public.atelier_upload_tickets (
  ticket text primary key,
  expires_at timestamptz not null
);

alter table public.atelier_sessions enable row level security;
alter table public.atelier_modules enable row level security;
alter table public.atelier_participants enable row level security;
alter table public.atelier_messages enable row level security;
alter table public.atelier_upload_tickets enable row level security;
revoke all on public.atelier_sessions, public.atelier_modules, public.atelier_participants,
  public.atelier_messages, public.atelier_upload_tickets from anon, authenticated;

-- ---------- outils internes ----------
create or replace function public.atelier_new_token() returns text
language sql volatile set search_path to '' as $$
  select replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
$$;

create or replace function public.atelier_modules_json() returns jsonb
language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'position',position,'title',title,'duration',duration,
    'summary',summary,'body',body,'prompts',prompts,'image_url',image_url,'video_url',video_url,'kind',kind)
    order by position, id), '[]'::jsonb) from public.atelier_modules;
$$;

create or replace function public.atelier_participant(p_token text) returns public.atelier_participants
language sql stable security definer set search_path to '' as $$
  select * from public.atelier_participants where p_token is not null and length(p_token) >= 32 and token = p_token;
$$;

-- ---------- participant ----------
create or replace function public.atelier_join(p_code text, p_name text, p_business text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s public.atelier_sessions; t text; n text := btrim(coalesce(p_name,''));
begin
  select * into s from public.atelier_sessions
   where active and lower(code) = lower(btrim(coalesce(p_code,''))) order by created_at desc limit 1;
  if s.id is null then raise exception 'code_invalide'; end if;
  if length(n) < 2 or length(n) > 80 then raise exception 'nom_invalide'; end if;
  t := public.atelier_new_token();
  insert into public.atelier_participants(session_id, name, business, token)
  values (s.id, n, left(btrim(coalesce(p_business,'')),120), t);
  return jsonb_build_object('token', t);
end $$;

create or replace function public.atelier_me(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants; s public.atelier_sessions;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  select * into s from public.atelier_sessions where id = p.session_id;
  if not s.active then raise exception 'session_fermee'; end if;
  update public.atelier_participants set last_seen = now() where id = p.id;
  return jsonb_build_object(
    'participant', jsonb_build_object('id',p.id,'name',p.name,'business',p.business,'progress',p.progress,
                                      'current_module',p.current_module,'feedback',p.feedback),
    'session', jsonb_build_object('id',s.id,'label',s.label),
    'modules', public.atelier_modules_json());
end $$;

create or replace function public.atelier_save(p_token text, p_progress jsonb, p_current text)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  if jsonb_typeof(p_progress) <> 'object' or length(p_progress::text) > 20000 then raise exception 'donnees_invalides'; end if;
  update public.atelier_participants
     set progress = p_progress, current_module = left(p_current,64), last_seen = now()
   where id = p.id;
end $$;

create or replace function public.atelier_feedback(p_token text, p_answers jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 10000 then raise exception 'donnees_invalides'; end if;
  update public.atelier_participants set feedback = p_answers || jsonb_build_object('sent_at', now()), last_seen = now()
   where id = p.id;
end $$;

-- ---------- chat (participant ou animateur) ----------
create or replace function public.atelier_chat(p_token text, p_key text, p_session uuid, p_after bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare sid uuid; p public.atelier_participants;
begin
  if public.is_admin(p_key) then sid := p_session;
  else
    p := public.atelier_participant(p_token);
    if p.id is null then raise exception 'acces_refuse'; end if;
    sid := p.session_id;
    update public.atelier_participants set last_seen = now() where id = p.id and last_seen < now() - interval '20 seconds';
  end if;
  return coalesce((select jsonb_agg(m order by m.id) from (
     select id, author, is_staff, body, created_at, coalesce(participant_id = p.id, false) as mine
       from public.atelier_messages
      where session_id = sid and id > coalesce(p_after,0)
      order by id desc limit 200) m), '[]'::jsonb);
end $$;

create or replace function public.atelier_send(p_token text, p_key text, p_session uuid, p_body text)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants; b text := btrim(coalesce(p_body,''));
begin
  if length(b) < 1 or length(b) > 1000 then raise exception 'message_invalide'; end if;
  if public.is_admin(p_key) then
    if not exists (select 1 from public.atelier_sessions where id = p_session) then raise exception 'session_inconnue'; end if;
    insert into public.atelier_messages(session_id, author, is_staff, body) values (p_session, 'Animateur NéoPix', true, b);
  else
    p := public.atelier_participant(p_token);
    if p.id is null then raise exception 'acces_refuse'; end if;
    if (select count(*) from public.atelier_messages where participant_id = p.id and created_at > now() - interval '1 minute') >= 10 then
      raise exception 'trop_de_messages'; end if;
    insert into public.atelier_messages(session_id, participant_id, author, body) values (p.session_id, p.id, p.name, b);
  end if;
end $$;

-- ---------- animateur ----------
create or replace function public.atelier_admin_overview(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'code',s.code,'active',s.active,
        'created_at',s.created_at,
        'participants', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'business',p.business,
            'progress',p.progress,'current_module',p.current_module,'feedback',p.feedback,
            'created_at',p.created_at,'last_seen',p.last_seen) order by p.created_at)
          from public.atelier_participants p where p.session_id = s.id), '[]'::jsonb))
      order by s.created_at desc) from public.atelier_sessions s), '[]'::jsonb),
    'modules', public.atelier_modules_json());
end $$;

create or replace function public.atelier_admin_session(p_key text, p_id uuid, p_label text, p_code text, p_active boolean)
returns uuid language plpgsql security definer set search_path to '' as $$
declare c text := btrim(coalesce(p_code,'')); l text := btrim(coalesce(p_label,'')); rid uuid;
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  if length(c) < 4 or length(c) > 40 then raise exception 'code_trop_court'; end if;
  if length(l) < 1 then raise exception 'nom_session_vide'; end if;
  if coalesce(p_active,true) and exists (select 1 from public.atelier_sessions
      where active and lower(code) = lower(c) and id is distinct from p_id) then raise exception 'code_deja_utilise'; end if;
  if p_id is null then
    insert into public.atelier_sessions(label, code, active) values (l, c, coalesce(p_active,true)) returning id into rid;
  else
    update public.atelier_sessions set label = l, code = c, active = coalesce(p_active,true) where id = p_id returning id into rid;
  end if;
  return rid;
end $$;

create or replace function public.atelier_admin_session_delete(p_key text, p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  delete from public.atelier_sessions where id = p_id;
end $$;

create or replace function public.atelier_admin_module(p_key text, p_module jsonb)
returns text language plpgsql security definer set search_path to '' as $$
declare mid text := nullif(btrim(coalesce(p_module->>'id','')),'');
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  if length(p_module::text) > 100000 then raise exception 'module_trop_long'; end if;
  if mid is null then mid := 'm' || substr(replace(gen_random_uuid()::text,'-',''),1,8); end if;
  insert into public.atelier_modules(id, position, title, duration, summary, body, prompts, image_url, video_url, kind, updated_at)
  values (mid, coalesce((p_module->>'position')::int, 100), coalesce(nullif(btrim(p_module->>'title'),''),'Nouveau module'),
          coalesce(p_module->>'duration',''), coalesce(p_module->>'summary',''), coalesce(p_module->>'body',''),
          case when jsonb_typeof(p_module->'prompts') = 'array' then p_module->'prompts' else '[]'::jsonb end,
          coalesce(p_module->>'image_url',''), coalesce(p_module->>'video_url',''),
          case when p_module->>'kind' = 'feedback' then 'feedback' else 'lesson' end, now())
  on conflict (id) do update set position = excluded.position, title = excluded.title, duration = excluded.duration,
     summary = excluded.summary, body = excluded.body, prompts = excluded.prompts, image_url = excluded.image_url,
     video_url = excluded.video_url, kind = excluded.kind, updated_at = now();
  return mid;
end $$;

create or replace function public.atelier_admin_module_delete(p_key text, p_id text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  delete from public.atelier_modules where id = p_id;
end $$;

create or replace function public.atelier_admin_participant_delete(p_key text, p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  delete from public.atelier_participants where id = p_id;
end $$;

create or replace function public.atelier_admin_upload_ticket(p_key text)
returns text language plpgsql security definer set search_path to '' as $$
declare t text := public.atelier_new_token();
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  delete from public.atelier_upload_tickets where expires_at < now();
  insert into public.atelier_upload_tickets values (t, now() + interval '30 minutes');
  return t;
end $$;

create or replace function public.atelier_ticket_ok(p_ticket text) returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.atelier_upload_tickets where ticket = p_ticket and expires_at > now());
$$;

-- ---------- médias : seul l'animateur (ticket valide) peut déposer ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atelier-media','atelier-media', true, 52428800,
        array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atelier media depot animateur" on storage.objects;
create policy "atelier media depot animateur" on storage.objects for insert to anon
  with check (bucket_id = 'atelier-media' and public.atelier_ticket_ok((storage.foldername(name))[1]));

-- ---------- droits ----------
revoke execute on function public.atelier_new_token(), public.atelier_modules_json(), public.atelier_participant(text)
  from public, anon, authenticated;
grant execute on function public.atelier_ticket_ok(text) to anon;
grant execute on function
  public.atelier_join(text,text,text), public.atelier_me(text), public.atelier_save(text,jsonb,text),
  public.atelier_feedback(text,jsonb), public.atelier_chat(text,text,uuid,bigint), public.atelier_send(text,text,uuid,text),
  public.atelier_admin_overview(text), public.atelier_admin_session(text,uuid,text,text,boolean),
  public.atelier_admin_session_delete(text,uuid), public.atelier_admin_module(text,jsonb),
  public.atelier_admin_module_delete(text,text), public.atelier_admin_participant_delete(text,uuid),
  public.atelier_admin_upload_ticket(text)
  to anon;
