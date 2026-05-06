-- Automatically create a profiles row when a new auth user signs up.
-- Runs as SECURITY DEFINER so it bypasses RLS — no client session needed.
-- Run in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, age, sex)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    (new.raw_user_meta_data->>'age')::integer,
    new.raw_user_meta_data->>'sex'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
