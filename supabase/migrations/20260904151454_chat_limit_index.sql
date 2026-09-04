create index if not exists chat_messages_user_role_date_idx
  on public.chat_messages (user_id, role, created_at desc);