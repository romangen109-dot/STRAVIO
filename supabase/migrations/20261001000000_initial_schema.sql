create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategies (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  workflow_step integer not null default 0 check (workflow_step between 0 and 5),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table public.documents (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  strategy_id text not null,
  title text not null,
  content text not null default '',
  status text not null default 'ready' check (status in ('ready', 'edited')),
  strategy_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id),
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete cascade
);

create table public.tasks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  strategy_id text not null,
  stage_id text not null,
  title text not null,
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in-progress', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  deadline date,
  source_stage_plan_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id),
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete cascade
);

create table public.ai_messages (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  strategy_id text not null,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  proposal jsonb,
  created_at timestamptz not null default now(),
  primary key (id, user_id),
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete cascade
);

create table public.activity (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  strategy_id text,
  document_id text,
  type text not null check (type in ('strategy-created', 'strategy-updated', 'strategy-completed', 'document-generated', 'document-edited', 'document-deleted', 'task-created', 'task-completed', 'ai-action-applied')),
  title text not null,
  created_at timestamptz not null default now(),
  primary key (id, user_id),
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete cascade
);

create table public.ai_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, window_start)
);

create index strategies_user_updated_idx on public.strategies (user_id, updated_at desc);
create index documents_strategy_idx on public.documents (user_id, strategy_id, created_at desc);
create index tasks_strategy_status_idx on public.tasks (user_id, strategy_id, status, deadline);
create unique index tasks_unique_stage_plan_idx on public.tasks (user_id, strategy_id, source_stage_plan_id) where source_stage_plan_id is not null;
create index ai_messages_strategy_idx on public.ai_messages (user_id, strategy_id, created_at);
create index activity_user_created_idx on public.activity (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.ai_messages enable row level security;
alter table public.activity enable row level security;
alter table public.ai_rate_limits enable row level security;

create policy "users manage own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "users manage own strategies" on public.strategies for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage own documents" on public.documents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage own tasks" on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage own ai messages" on public.ai_messages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users read own activity" on public.activity for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users insert own activity" on public.activity for insert to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles, public.strategies, public.documents, public.tasks, public.ai_messages to authenticated;
grant select, insert on public.activity to authenticated;
revoke all on public.ai_rate_limits from anon, authenticated;

create or replace function public.log_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  target_strategy text;
  target_document text;
  event_type text;
  event_title text;
  recent_update_id text;
begin
  if tg_table_name = 'strategies' then
    owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    target_strategy := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op = 'INSERT' then
      event_type := 'strategy-created';
      event_title := coalesce(new.name, 'Strategy created');
    elsif tg_op = 'UPDATE' and not old.completed and new.completed then
      event_type := 'strategy-completed';
      event_title := coalesce(new.name, 'Strategy completed');
    elsif tg_op = 'UPDATE' then
      event_type := 'strategy-updated';
      event_title := coalesce(new.name, 'Strategy updated');
      select id into recent_update_id from public.activity
      where user_id = owner_id and strategy_id = target_strategy and type = 'strategy-updated'
        and created_at > now() - interval '1 minute'
      order by created_at desc limit 1;
      if recent_update_id is not null then
        update public.activity set title = event_title, created_at = now() where id = recent_update_id and user_id = owner_id;
        return new;
      end if;
    else
      return old;
    end if;
  elsif tg_table_name = 'documents' then
    owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    target_strategy := case when tg_op = 'DELETE' then old.strategy_id else new.strategy_id end;
    target_document := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op = 'INSERT' then
      event_type := 'document-generated';
      event_title := coalesce(new.title, 'Document created');
    elsif tg_op = 'DELETE' then
      event_type := 'document-deleted';
      event_title := coalesce(old.title, 'Document deleted');
    elsif new.status = 'edited' and new.content is distinct from old.content then
      event_type := 'document-edited';
      event_title := coalesce(new.title, 'Document updated');
    else
      return new;
    end if;
  elsif tg_table_name = 'tasks' then
    owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    target_strategy := case when tg_op = 'DELETE' then old.strategy_id else new.strategy_id end;
    if tg_op = 'INSERT' then
      event_type := 'task-created';
      event_title := coalesce(new.title, 'Task created');
    elsif tg_op = 'UPDATE' and old.status is distinct from 'completed' and new.status = 'completed' then
      event_type := 'task-completed';
      event_title := coalesce(new.title, 'Task completed');
    else
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' and tg_table_name = 'documents' and not exists (
    select 1 from public.strategies where id = target_strategy and user_id = owner_id
  ) then
    target_strategy := null;
  end if;

  insert into public.activity (id, user_id, strategy_id, document_id, type, title)
  values (gen_random_uuid()::text, owner_id, target_strategy, target_document, event_type, event_title);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger strategy_activity_after_write after insert or update on public.strategies
  for each row execute procedure public.log_workspace_change();
create trigger document_activity_after_write after insert or update or delete on public.documents
  for each row execute procedure public.log_workspace_change();
create trigger task_activity_after_write after insert or update on public.tasks
  for each row execute procedure public.log_workspace_change();

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_user();

create or replace function public.import_local_workspace(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  inserted_count integer;
  imported jsonb := jsonb_build_object('strategies', 0, 'documents', 0, 'tasks', 0, 'messages', 0, 'activity', 0);
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(payload) <> 'object' or coalesce(payload ->> 'version', '') <> '1' then
    raise exception 'Unsupported import format' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'strategies', '[]'::jsonb)) > 100
    or jsonb_array_length(coalesce(payload -> 'documents', '[]'::jsonb)) > 500
    or jsonb_array_length(coalesce(payload -> 'tasks', '[]'::jsonb)) > 5000
    or jsonb_array_length(coalesce(payload -> 'messages', '[]'::jsonb)) > 10000
    or jsonb_array_length(coalesce(payload -> 'activity', '[]'::jsonb)) > 5000 then
    raise exception 'Import exceeds supported limits' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'strategies', '[]'::jsonb)) loop
    insert into public.strategies (id, user_id, name, description, data, workflow_step, completed, created_at, updated_at)
    values (entry ->> 'id', owner_id, coalesce(entry ->> 'name', 'Untitled Strategy'), coalesce(entry ->> 'description', ''),
      coalesce(entry -> 'data', '{}'::jsonb), coalesce((entry ->> 'workflow_step')::integer, 0), coalesce((entry ->> 'completed')::boolean, false),
      coalesce((entry ->> 'created_at')::timestamptz, now()), coalesce((entry ->> 'updated_at')::timestamptz, now()))
    on conflict (id, user_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then imported := jsonb_set(imported, '{strategies}', to_jsonb((imported ->> 'strategies')::integer + inserted_count)); end if;
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'documents', '[]'::jsonb)) loop
    insert into public.documents (id, user_id, strategy_id, title, content, status, strategy_snapshot, created_at, updated_at)
    values (entry ->> 'id', owner_id, entry ->> 'strategy_id', coalesce(entry ->> 'title', 'Untitled Strategy'), coalesce(entry ->> 'content', ''),
      coalesce(entry ->> 'status', 'ready'), coalesce(entry -> 'strategy_snapshot', '{}'::jsonb),
      coalesce((entry ->> 'created_at')::timestamptz, now()), coalesce((entry ->> 'updated_at')::timestamptz, now()))
    on conflict (id, user_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then imported := jsonb_set(imported, '{documents}', to_jsonb((imported ->> 'documents')::integer + inserted_count)); end if;
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'tasks', '[]'::jsonb)) loop
    insert into public.tasks (id, user_id, strategy_id, stage_id, title, description, status, priority, deadline, source_stage_plan_id, created_at, updated_at)
    values (entry ->> 'id', owner_id, entry ->> 'strategy_id', entry ->> 'stage_id', entry ->> 'title', coalesce(entry ->> 'description', ''),
      coalesce(entry ->> 'status', 'todo'), coalesce(entry ->> 'priority', 'medium'), nullif(entry ->> 'deadline', '')::date,
      entry ->> 'source_stage_plan_id', coalesce((entry ->> 'created_at')::timestamptz, now()), now())
    on conflict (id, user_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then imported := jsonb_set(imported, '{tasks}', to_jsonb((imported ->> 'tasks')::integer + inserted_count)); end if;
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'messages', '[]'::jsonb)) loop
    insert into public.ai_messages (id, user_id, strategy_id, role, content, proposal, created_at)
    values (entry ->> 'id', owner_id, entry ->> 'strategy_id', entry ->> 'role', entry ->> 'content', entry -> 'proposal', coalesce((entry ->> 'created_at')::timestamptz, now()))
    on conflict (id, user_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then imported := jsonb_set(imported, '{messages}', to_jsonb((imported ->> 'messages')::integer + inserted_count)); end if;
  end loop;

  for entry in select value from jsonb_array_elements(coalesce(payload -> 'activity', '[]'::jsonb)) loop
    insert into public.activity (id, user_id, strategy_id, document_id, type, title, created_at)
    values (entry ->> 'id', owner_id, nullif(entry ->> 'strategy_id', ''), nullif(entry ->> 'document_id', ''), entry ->> 'type', coalesce(entry ->> 'title', ''), coalesce((entry ->> 'created_at')::timestamptz, now()))
    on conflict (id, user_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then imported := jsonb_set(imported, '{activity}', to_jsonb((imported ->> 'activity')::integer + inserted_count)); end if;
  end loop;

  return imported;
end;
$$;

create or replace function public.consume_ai_request(p_max_requests integer default 12)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_window timestamptz := date_trunc('minute', clock_timestamp());
  current_count integer;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_max_requests < 1 or p_max_requests > 100 then raise exception 'Invalid rate limit' using errcode = '22023'; end if;

  insert into public.ai_rate_limits (user_id, window_start, request_count)
  values (owner_id, current_window, 1)
  on conflict (user_id, window_start) do update
    set request_count = public.ai_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from public.ai_rate_limits where user_id = owner_id and window_start < current_window - interval '1 minute';
  return current_count <= p_max_requests;
end;
$$;

create or replace function public.resolve_ai_proposal(p_message_id text, p_strategy_id text, p_action text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  selected_message public.ai_messages%rowtype;
  selected_strategy public.strategies%rowtype;
  task_entry jsonb;
  task_count integer;
  destination text;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_action is null or p_action not in ('apply', 'cancel') then raise exception 'Invalid proposal action' using errcode = '22023'; end if;

  select * into selected_message from public.ai_messages
  where id = p_message_id and strategy_id = p_strategy_id and role = 'agent'
  for update;
  if not found or selected_message.proposal ->> 'status' <> 'pending' then
    raise exception 'Proposal is unavailable or already handled' using errcode = '40001';
  end if;

  if p_action = 'cancel' then
    update public.ai_messages set proposal = jsonb_set(selected_message.proposal, '{status}', '"cancelled"'::jsonb)
    where id = p_message_id and user_id = owner_id;
    return jsonb_build_object('status', 'cancelled');
  end if;

  if selected_message.proposal ->> 'kind' = 'update-desired-state' then
    select * into selected_strategy from public.strategies
    where id = p_strategy_id and user_id = owner_id for update;
    if not found then raise exception 'Strategy not found' using errcode = 'P0002'; end if;
    if selected_strategy.data #>> '{desiredState,destination}' <> selected_message.proposal ->> 'previousValue' then
      raise exception 'Strategy changed; request a new proposal' using errcode = '40001';
    end if;
    destination := selected_message.proposal ->> 'proposedValue';
    update public.strategies set data = jsonb_set(selected_strategy.data, '{desiredState,destination}', to_jsonb(destination), true), updated_at = now()
    where id = p_strategy_id and user_id = owner_id;
  elsif selected_message.proposal ->> 'kind' = 'create-tasks' then
    if jsonb_typeof(selected_message.proposal -> 'tasks') <> 'array' then raise exception 'Invalid task proposal' using errcode = '22023'; end if;
    task_count := jsonb_array_length(selected_message.proposal -> 'tasks');
    if task_count < 1 or task_count > 50 then raise exception 'Invalid task count' using errcode = '22023'; end if;
    for task_entry in select value from jsonb_array_elements(selected_message.proposal -> 'tasks') loop
      if coalesce(task_entry ->> 'strategyId', '') <> p_strategy_id or coalesce(task_entry ->> 'title', '') = '' or coalesce(task_entry ->> 'stageId', '') = '' then
        raise exception 'Invalid task proposal item' using errcode = '22023';
      end if;
      if nullif(task_entry ->> 'sourceStagePlanId', '') is not null and exists (
        select 1 from public.tasks where user_id = owner_id and strategy_id = p_strategy_id and source_stage_plan_id = task_entry ->> 'sourceStagePlanId'
      ) then
        raise exception 'Tasks already exist for this stage plan' using errcode = '23505';
      end if;
      insert into public.tasks (id, user_id, strategy_id, stage_id, title, description, status, priority, deadline, source_stage_plan_id)
      values (gen_random_uuid()::text, owner_id, p_strategy_id, task_entry ->> 'stageId', left(task_entry ->> 'title', 300),
        left(coalesce(task_entry ->> 'description', ''), 4000), 'todo',
        case when task_entry ->> 'priority' in ('high', 'low') then task_entry ->> 'priority' else 'medium' end,
        nullif(task_entry ->> 'deadline', '')::date, task_entry ->> 'sourceStagePlanId');
    end loop;
  else
    raise exception 'Unsupported proposal type' using errcode = '22023';
  end if;

  update public.ai_messages set proposal = jsonb_set(selected_message.proposal, '{status}', '"applied"'::jsonb)
  where id = p_message_id and user_id = owner_id;
  insert into public.activity (id, user_id, strategy_id, type, title)
  values (gen_random_uuid()::text, owner_id, p_strategy_id, 'ai-action-applied', 'AI proposal applied');
  return jsonb_build_object('status', 'applied');
end;
$$;

revoke all on function public.import_local_workspace(jsonb) from public;
grant execute on function public.import_local_workspace(jsonb) to authenticated;
revoke all on function public.consume_ai_request(integer) from public;
grant execute on function public.consume_ai_request(integer) to authenticated;
revoke all on function public.resolve_ai_proposal(text, text, text) from public;
grant execute on function public.resolve_ai_proposal(text, text, text) to authenticated;
revoke all on function public.log_workspace_change() from public;