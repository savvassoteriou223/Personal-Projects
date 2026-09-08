-- Automatically create a profiles row when a new auth user signs up.
-- Runs as SECURITY DEFINER so it bypasses RLS — no client session needed.
-- Run in Supabase Dashboard → SQL Editor

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, age, sex, dob)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    CASE WHEN new.raw_user_meta_data->>'age' IS NOT NULL
         THEN (new.raw_user_meta_data->>'age')::integer ELSE NULL END,
    new.raw_user_meta_data->>'sex',
    CASE WHEN new.raw_user_meta_data->>'dob' IS NOT NULL
         THEN (new.raw_user_meta_data->>'dob')::date ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
