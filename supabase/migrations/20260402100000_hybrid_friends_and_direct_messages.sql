-- Hybrid social graph (follow + friend requests + friendships)
-- plus direct-message conversation helper and admin friendship bootstrap.

begin;

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint user_follows_not_self check (follower_id <> followee_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint friend_requests_not_self check (requester_id <> addressee_id)
);

create table if not exists public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by_request_id uuid null references public.friend_requests(id) on delete set null,
  primary key (user_low, user_high),
  constraint friendships_canonical_order check (user_low < user_high)
);

create index if not exists idx_user_follows_followee on public.user_follows(followee_id);
create index if not exists idx_friend_requests_addressee_status on public.friend_requests(addressee_id, status, created_at desc);
create index if not exists idx_friend_requests_requester_status on public.friend_requests(requester_id, status, created_at desc);
create index if not exists idx_friendships_user_low on public.friendships(user_low);
create index if not exists idx_friendships_user_high on public.friendships(user_high);

create unique index if not exists uq_friend_requests_pair_pending
  on public.friend_requests (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status = 'pending';

alter table public.user_follows enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "follows_select_own" on public.user_follows;
create policy "follows_select_own"
  on public.user_follows
  for select
  to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

drop policy if exists "follows_insert_self" on public.user_follows;
create policy "follows_insert_self"
  on public.user_follows
  for insert
  to authenticated
  with check (follower_id = auth.uid() and followee_id <> auth.uid());

drop policy if exists "follows_delete_self" on public.user_follows;
create policy "follows_delete_self"
  on public.user_follows
  for delete
  to authenticated
  using (follower_id = auth.uid());

drop policy if exists "friend_requests_select_participants" on public.friend_requests;
create policy "friend_requests_select_participants"
  on public.friend_requests
  for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friend_requests_insert_requester" on public.friend_requests;
create policy "friend_requests_insert_requester"
  on public.friend_requests
  for insert
  to authenticated
  with check (requester_id = auth.uid() and addressee_id <> auth.uid());

drop policy if exists "friendships_select_participants" on public.friendships;
create policy "friendships_select_participants"
  on public.friendships
  for select
  to authenticated
  using (user_low = auth.uid() or user_high = auth.uid());

drop policy if exists "friendships_insert_participants" on public.friendships;
create policy "friendships_insert_participants"
  on public.friendships
  for insert
  to authenticated
  with check (user_low = auth.uid() or user_high = auth.uid());

-- Service role full access
drop policy if exists "service_role_all_user_follows" on public.user_follows;
create policy "service_role_all_user_follows"
  on public.user_follows
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_all_friend_requests" on public.friend_requests;
create policy "service_role_all_friend_requests"
  on public.friend_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_all_friendships" on public.friendships;
create policy "service_role_all_friendships"
  on public.friendships
  for all
  to service_role
  using (true)
  with check (true);

-- Conversations: support canonical direct threads.
alter table public.conversations add column if not exists is_direct boolean not null default false;
alter table public.conversations add column if not exists direct_key text null;
create unique index if not exists uq_conversations_direct_key
  on public.conversations(direct_key)
  where is_direct = true and direct_key is not null;

create or replace function public.send_friend_request(p_target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_target_user_id is null then
    raise exception 'Target user required';
  end if;
  if p_target_user_id = v_actor then
    raise exception 'Cannot request yourself';
  end if;

  -- Already friends: no-op.
  if exists (
    select 1
    from public.friendships f
    where f.user_low = least(v_actor, p_target_user_id)
      and f.user_high = greatest(v_actor, p_target_user_id)
  ) then
    return null;
  end if;

  -- Existing pending outgoing: return it.
  select fr.id into v_existing_id
  from public.friend_requests fr
  where fr.requester_id = v_actor
    and fr.addressee_id = p_target_user_id
    and fr.status = 'pending'
  limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  -- Existing pending incoming: auto-accept.
  select fr.id into v_existing_id
  from public.friend_requests fr
  where fr.requester_id = p_target_user_id
    and fr.addressee_id = v_actor
    and fr.status = 'pending'
  limit 1;
  if v_existing_id is not null then
    update public.friend_requests
      set status = 'accepted', responded_at = now()
    where id = v_existing_id;

    insert into public.friendships(user_low, user_high, created_by_request_id)
    values (least(v_actor, p_target_user_id), greatest(v_actor, p_target_user_id), v_existing_id)
    on conflict do nothing;

    return v_existing_id;
  end if;

  insert into public.friend_requests(requester_id, addressee_id, status)
  values (v_actor, p_target_user_id, 'pending')
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.friend_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_request_id is null then
    raise exception 'Request id required';
  end if;

  select * into v_request
  from public.friend_requests
  where id = p_request_id;

  if not found then
    raise exception 'Friend request not found';
  end if;
  if v_request.addressee_id <> v_actor then
    raise exception 'Not authorized to respond to this request';
  end if;
  if v_request.status <> 'pending' then
    return v_request.id;
  end if;

  update public.friend_requests
     set status = case when p_accept then 'accepted' else 'rejected' end,
         responded_at = now()
   where id = p_request_id;

  if p_accept then
    insert into public.friendships(user_low, user_high, created_by_request_id)
    values (
      least(v_request.requester_id, v_request.addressee_id),
      greatest(v_request.requester_id, v_request.addressee_id),
      v_request.id
    )
    on conflict do nothing;
  end if;

  return p_request_id;
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  update public.friend_requests
     set status = 'cancelled',
         responded_at = now()
   where id = p_request_id
     and requester_id = v_actor
     and status = 'pending';

  return p_request_id;
end;
$$;

create or replace function public.create_or_get_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_key text;
  v_conversation_id uuid;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if p_other_user_id is null or p_other_user_id = v_actor then
    raise exception 'Invalid direct-message target';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.user_low = least(v_actor, p_other_user_id)
      and f.user_high = greatest(v_actor, p_other_user_id)
  ) then
    raise exception 'Direct messages require friendship';
  end if;

  v_key := least(v_actor::text, p_other_user_id::text) || ':' || greatest(v_actor::text, p_other_user_id::text);

  select c.id into v_conversation_id
  from public.conversations c
  where c.is_direct = true
    and c.direct_key = v_key
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations(is_direct, direct_key, updated_at)
    values (true, v_key, now())
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation_id, v_actor)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.conversation_members(conversation_id, user_id)
  values (v_conversation_id, p_other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  friendship_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    return query execute $q$
      with me as (
        select auth.uid() as uid
      ),
      pairs as (
        select
          case when f.user_low = me.uid then f.user_high else f.user_low end as friend_id,
          f.created_at
        from public.friendships f
        cross join me
        where f.user_low = me.uid or f.user_high = me.uid
      )
      select
        p.friend_id as user_id,
        pr.display_name::text,
        pr.username::text,
        pr.avatar_url::text,
        p.created_at as friendship_created_at
      from pairs p
      left join public.profiles pr on pr.id = p.friend_id
      order by p.created_at desc
    $q$;
  else
    return query
      with me as (
        select auth.uid() as uid
      ),
      pairs as (
        select
          case when f.user_low = me.uid then f.user_high else f.user_low end as friend_id,
          f.created_at
        from public.friendships f
        cross join me
        where f.user_low = me.uid or f.user_high = me.uid
      )
      select
        p.friend_id as user_id,
        coalesce((u.raw_user_meta_data ->> 'display_name')::text, split_part(coalesce(u.email, ''), '@', 1)) as display_name,
        (u.raw_user_meta_data ->> 'username')::text as username,
        (u.raw_user_meta_data ->> 'avatar_url')::text as avatar_url,
        p.created_at as friendship_created_at
      from pairs p
      left join auth.users u on u.id = p.friend_id
      order by p.created_at desc;
  end if;
end;
$$;

create or replace function public.search_users_for_social(p_query text default null, p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  is_friend boolean,
  has_outgoing_request boolean,
  has_incoming_request boolean,
  is_following boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  ) then
    return query execute $q$
      with me as (
        select auth.uid() as uid
      ),
      candidates as (
        select
          pr.id as user_id,
          pr.display_name::text as display_name,
          pr.username::text as username,
          pr.avatar_url::text as avatar_url
        from public.profiles pr
        cross join me
        where pr.id <> me.uid
          and (
            $1 is null
            or length(trim($1)) = 0
            or coalesce(pr.display_name, '') ilike '%' || trim($1) || '%'
            or coalesce(pr.username, '') ilike '%' || trim($1) || '%'
          )
        order by coalesce(pr.display_name, pr.username, '') asc
        limit greatest(1, least(coalesce($2, 20), 50))
      )
      select
        c.user_id,
        c.display_name,
        c.username,
        c.avatar_url,
        exists (
          select 1
          from public.friendships f
          cross join me
          where f.user_low = least(me.uid, c.user_id)
            and f.user_high = greatest(me.uid, c.user_id)
        ) as is_friend,
        exists (
          select 1
          from public.friend_requests fr
          cross join me
          where fr.requester_id = me.uid
            and fr.addressee_id = c.user_id
            and fr.status = 'pending'
        ) as has_outgoing_request,
        exists (
          select 1
          from public.friend_requests fr
          cross join me
          where fr.requester_id = c.user_id
            and fr.addressee_id = me.uid
            and fr.status = 'pending'
        ) as has_incoming_request,
        exists (
          select 1
          from public.user_follows uf
          cross join me
          where uf.follower_id = me.uid
            and uf.followee_id = c.user_id
        ) as is_following
      from candidates c
    $q$ using p_query, p_limit;
  else
    return query
      with me as (
        select auth.uid() as uid
      ),
      candidates as (
        select
          u.id as user_id,
          coalesce((u.raw_user_meta_data ->> 'display_name')::text, split_part(coalesce(u.email, ''), '@', 1)) as display_name,
          (u.raw_user_meta_data ->> 'username')::text as username,
          (u.raw_user_meta_data ->> 'avatar_url')::text as avatar_url
        from auth.users u
        cross join me
        where u.id <> me.uid
          and (
            p_query is null
            or length(trim(p_query)) = 0
            or coalesce((u.raw_user_meta_data ->> 'display_name')::text, '') ilike '%' || trim(p_query) || '%'
            or coalesce((u.raw_user_meta_data ->> 'username')::text, '') ilike '%' || trim(p_query) || '%'
            or coalesce(u.email, '') ilike '%' || trim(p_query) || '%'
          )
        order by coalesce((u.raw_user_meta_data ->> 'display_name')::text, (u.raw_user_meta_data ->> 'username')::text, u.email, '') asc
        limit greatest(1, least(coalesce(p_limit, 20), 50))
      )
      select
        c.user_id,
        c.display_name,
        c.username,
        c.avatar_url,
        exists (
          select 1
          from public.friendships f
          cross join me
          where f.user_low = least(me.uid, c.user_id)
            and f.user_high = greatest(me.uid, c.user_id)
        ) as is_friend,
        exists (
          select 1
          from public.friend_requests fr
          cross join me
          where fr.requester_id = me.uid
            and fr.addressee_id = c.user_id
            and fr.status = 'pending'
        ) as has_outgoing_request,
        exists (
          select 1
          from public.friend_requests fr
          cross join me
          where fr.requester_id = c.user_id
            and fr.addressee_id = me.uid
            and fr.status = 'pending'
        ) as has_incoming_request,
        exists (
          select 1
          from public.user_follows uf
          cross join me
          where uf.follower_id = me.uid
            and uf.followee_id = c.user_id
        ) as is_following
      from candidates c;
  end if;
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.create_or_get_direct_conversation(uuid) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
grant execute on function public.search_users_for_social(text, int) to authenticated;

-- Bootstrap: make all current non-admin users friends with awcarv@gmail.com.
with super_admin as (
  select u.id
  from auth.users u
  where lower(u.email) = lower('awcarv@gmail.com')
  limit 1
),
targets as (
  select u.id
  from auth.users u
  cross join super_admin sa
  left join public.admin_users au on au.user_id = u.id
  where u.id <> sa.id
    and au.user_id is null
)
insert into public.friendships(user_low, user_high)
select least(sa.id, t.id), greatest(sa.id, t.id)
from super_admin sa
cross join targets t
on conflict do nothing;

commit;
