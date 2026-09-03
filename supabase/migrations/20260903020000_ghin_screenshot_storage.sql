-- Private storage for GHIN screenshot import (phase 3). The screenshot
-- itself is only ever written here if the golfer expressly checks "Keep
-- my screenshot on file" at confirmation time (see confirmGhinImportAction
-- in src/actions/golf-ghin-import.ts) — the default path never touches
-- persistent storage at all: OCR extraction runs on the uploaded bytes
-- in server memory for the one request, and nothing is written unless
-- the golfer opts in.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ghin-screenshots',
  'ghin-screenshots',
  false,
  10485760, -- 10 MB, generous for a phone screenshot
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

alter table public.golf_profiles add column ghin_screenshot_path text;
comment on column public.golf_profiles.ghin_screenshot_path is
  'Path within the private ghin-screenshots bucket. Set only when the golfer expressly chose to keep their screenshot on file during GHIN import — null otherwise, which is the default outcome. Never a public URL; always read back through a short-lived signed URL requested by the owner.';

-- Objects are stored under `{auth.uid()}/...` — each policy checks that
-- the first path segment matches the caller's own uid. storage.objects
-- ships with RLS already enabled and no default policies (Supabase's
-- standard secure default: zero access until a policy grants it), so
-- these are the only rules governing this bucket.
create policy "ghin_screenshots_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'ghin-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ghin_screenshots_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ghin-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ghin_screenshots_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ghin-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
