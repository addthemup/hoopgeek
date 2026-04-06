-- Ensure social RPCs always expose email/username labels.

begin;

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  username text,
  email text,
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
        coalesce(pr.display_name::text, (u.raw_user_meta_data ->> 'display_name')::text, split_part(coalesce(u.email, ''), '@', 1)) as display_name,
        coalesce(pr.username::text, (u.raw_user_meta_data ->> 'username')::text) as username,
        u.email::text as email,
        coalesce(pr.avatar_url::text, (u.raw_user_meta_data ->> 'avatar_url')::text) as avatar_url,
        p.created_at as friendship_created_at
      from pairs p
      left join public.profiles pr on pr.id = p.friend_id
      left join auth.users u on u.id = p.friend_id
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
        u.email::text as email,
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
  email text,
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
          coalesce(pr.display_name::text, (u.raw_user_meta_data ->> 'display_name')::text, split_part(coalesce(u.email, ''), '@', 1)) as display_name,
          coalesce(pr.username::text, (u.raw_user_meta_data ->> 'username')::text) as username,
          u.email::text as email,
          coalesce(pr.avatar_url::text, (u.raw_user_meta_data ->> 'avatar_url')::text) as avatar_url
        from public.profiles pr
        left join auth.users u on u.id = pr.id
        cross join me
        where pr.id <> me.uid
          and (
            $1 is null
            or length(trim($1)) = 0
            or coalesce(pr.display_name, '') ilike '%' || trim($1) || '%'
            or coalesce(pr.username, '') ilike '%' || trim($1) || '%'
            or coalesce(u.email, '') ilike '%' || trim($1) || '%'
          )
        order by coalesce(pr.display_name, pr.username, u.email, '') asc
        limit greatest(1, least(coalesce($2, 20), 50))
      )
      select
        c.user_id,
        c.display_name,
        c.username,
        c.email,
        c.avatar_url,
        exists (
          select 1 from public.friendships f cross join me
          where f.user_low = least(me.uid, c.user_id)
            and f.user_high = greatest(me.uid, c.user_id)
        ) as is_friend,
        exists (
          select 1 from public.friend_requests fr cross join me
          where fr.requester_id = me.uid
            and fr.addressee_id = c.user_id
            and fr.status = 'pending'
        ) as has_outgoing_request,
        exists (
          select 1 from public.friend_requests fr cross join me
          where fr.requester_id = c.user_id
            and fr.addressee_id = me.uid
            and fr.status = 'pending'
        ) as has_incoming_request,
        exists (
          select 1 from public.user_follows uf cross join me
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
          u.email::text as email,
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
        c.email,
        c.avatar_url,
        exists (
          select 1 from public.friendships f cross join me
          where f.user_low = least(me.uid, c.user_id)
            and f.user_high = greatest(me.uid, c.user_id)
        ) as is_friend,
        exists (
          select 1 from public.friend_requests fr cross join me
          where fr.requester_id = me.uid
            and fr.addressee_id = c.user_id
            and fr.status = 'pending'
        ) as has_outgoing_request,
        exists (
          select 1 from public.friend_requests fr cross join me
          where fr.requester_id = c.user_id
            and fr.addressee_id = me.uid
            and fr.status = 'pending'
        ) as has_incoming_request,
        exists (
          select 1 from public.user_follows uf cross join me
          where uf.follower_id = me.uid
            and uf.followee_id = c.user_id
        ) as is_following
      from candidates c;
  end if;
end;
$$;

commit;
