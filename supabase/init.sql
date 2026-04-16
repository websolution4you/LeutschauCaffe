-- 1. Tabuľka pre profily užívateľov (Admin check)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    is_admin BOOLEAN DEFAULT false
);

-- 2. Tabuľka pre položky galérie
CREATE TABLE public.gallery_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v S3
    alt_text TEXT DEFAULT '',         -- SEO popis
    sort_order INTEGER DEFAULT 0,     -- Poradie v galérii
    is_active BOOLEAN DEFAULT true,   -- Možnosť dočasne skryť fotku
    mime_type TEXT,                   -- Napr. "image/jpeg"
    file_size INTEGER,                -- Veľkosť v bajtoch
    uploaded_by UUID REFERENCES auth.users(id)
);

-- 3. Povolenie RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- 4. Policies pre PROFILES
-- Užívateľ si môže čítať vlastný profil
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- 5. Policies pre GALLERY_ITEMS
-- Verejnosť vidí len aktívne fotky
CREATE POLICY "Public read active photos" ON public.gallery_items
    FOR SELECT USING (is_active = true);

-- Iba Admin môže robiť všetko (Insert, Update, Delete)
CREATE POLICY "Admins have full access" ON public.gallery_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- 6. Trigger na automatické vytvorenie profilu pri registrácii
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, is_admin)
  VALUES (new.id, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
