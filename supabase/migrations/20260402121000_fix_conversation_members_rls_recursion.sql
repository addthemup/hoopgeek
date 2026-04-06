-- Fix RLS recursion on conversation_members ("42P17")
-- Root cause: policies on conversation_members querying conversation_members directly.

begin;

create or replace function public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid, uuid) to service_role;

drop policy if exists "Members see their conversations" on public.conversations;
create policy "Members see their conversations"
  on public.conversations
  for select
  to authenticated
  using (public.is_conversation_member(id, auth.uid()));

drop policy if exists "Members see membership rows" on public.conversation_members;
create policy "Members see membership rows"
  on public.conversation_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "Members read messages" on public.messages;
create policy "Members read messages"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

commit;
