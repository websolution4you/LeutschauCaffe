-- Tabuľka pre novinky
CREATE TABLE IF NOT EXISTS public.news_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v S3
    title TEXT DEFAULT '',            -- Nadpis novinky
    description TEXT DEFAULT '',      -- Sprievodný text
    sort_order INTEGER DEFAULT 0,     -- Poradie zobrazenia
    is_active BOOLEAN DEFAULT true,   -- Možnosť skryť
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Tabuľka pre ponuky práce
CREATE TABLE IF NOT EXISTS public.job_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v S3
    title TEXT DEFAULT '',            -- Názov pozície
    description TEXT DEFAULT '',      -- Popis práce / požiadavky
    sort_order INTEGER DEFAULT 0,     -- Poradie zobrazenia
    is_active BOOLEAN DEFAULT true,   -- Možnosť skryť
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Povolenie RLS
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_items ENABLE ROW LEVEL SECURITY;

-- Policies pre verejnosť
CREATE POLICY "Public read active news" ON public.news_items FOR SELECT USING (is_active = true);
CREATE POLICY "Public read active jobs" ON public.job_items FOR SELECT USING (is_active = true);

-- Policies pre Adminov
CREATE POLICY "Admins have full access news" ON public.news_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
);

CREATE POLICY "Admins have full access jobs" ON public.job_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
);
