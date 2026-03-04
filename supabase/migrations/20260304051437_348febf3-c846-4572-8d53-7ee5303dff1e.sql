
ALTER TABLE public.profiles ADD COLUMN basiq_user_id text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN bank_connected boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN bank_name text DEFAULT null;
