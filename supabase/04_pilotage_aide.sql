-- Version 1.2 : mode pilotage (module affiché à tous) et main levée (demande d'aide)

alter table public.atelier_sessions add column if not exists current_module text;
alter table public.atelier_participants add column if not exists help_at timestamptz;

-- Participant : récupère ses infos, le module piloté et l'état de sa demande d'aide
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
                                      'current_module',p.current_module,'feedback',p.feedback,'help', p.help_at is not null),
    'session', jsonb_build_object('id',s.id,'label',s.label,'pilot',s.current_module),
    'modules', public.atelier_modules_json());
end $$;

-- Participant : un seul appel régulier pour le chat, le module piloté et la demande d'aide
create or replace function public.atelier_pulse(p_token text, p_after bigint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants; s public.atelier_sessions;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  select * into s from public.atelier_sessions where id = p.session_id;
  return jsonb_build_object(
    'messages', public.atelier_chat(p_token, null, null, p_after),
    'pilot', s.current_module,
    'active', s.active,
    'help', p.help_at is not null);
end $$;

create or replace function public.atelier_help(p_token text, p_on boolean)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.atelier_participants;
begin
  p := public.atelier_participant(p_token);
  if p.id is null then raise exception 'acces_refuse'; end if;
  update public.atelier_participants
     set help_at = case when coalesce(p_on,false) then coalesce(help_at, now()) else null end, last_seen = now()
   where id = p.id;
end $$;

-- Animateur : choisir le module affiché à tous (null = libre)
create or replace function public.atelier_admin_pilot(p_key text, p_session uuid, p_module text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  if p_module is not null and not exists (select 1 from public.atelier_modules where id = p_module) then
    raise exception 'module_inconnu'; end if;
  update public.atelier_sessions set current_module = p_module where id = p_session;
end $$;

-- Animateur : marquer une demande d'aide comme réglée
create or replace function public.atelier_admin_help_clear(p_key text, p_participant uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  update public.atelier_participants set help_at = null where id = p_participant;
end $$;

-- Vue d'ensemble : ajoute le module piloté et les demandes d'aide
create or replace function public.atelier_admin_overview(p_key text)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin(p_key) then raise exception 'forbidden'; end if;
  perform public.atelier_purge();
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'code',s.code,'active',s.active,
        'max_participants',s.max_participants,'current_module',s.current_module,'created_at',s.created_at,
        'participants', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'business',p.business,
            'progress',p.progress,'current_module',p.current_module,'feedback',p.feedback,'contact_consent',p.contact_consent,
            'help_at',p.help_at,'created_at',p.created_at,'last_seen',p.last_seen) order by p.created_at)
          from public.atelier_participants p where p.session_id = s.id), '[]'::jsonb))
      order by s.created_at desc) from public.atelier_sessions s), '[]'::jsonb),
    'modules', public.atelier_modules_json(),
    'settings', public.atelier_privacy());
end $$;

grant execute on function
  public.atelier_me(text), public.atelier_pulse(text,bigint), public.atelier_help(text,boolean),
  public.atelier_admin_pilot(text,uuid,text), public.atelier_admin_help_clear(text,uuid),
  public.atelier_admin_overview(text)
  to anon;
