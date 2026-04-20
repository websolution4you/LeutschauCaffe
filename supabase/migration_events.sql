-- Tabuľka pre eventy (podujatia)
CREATE TABLE IF NOT EXISTS public.events_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    s3_key TEXT NOT NULL UNIQUE,      -- Kľúč súboru v S3 (priečinok events/)
    title TEXT DEFAULT '',            -- Názov eventu
    description TEXT DEFAULT '',      -- Popis eventu
    sort_order INTEGER DEFAULT 0,     -- Poradie zobrazenia
    is_active BOOLEAN DEFAULT true,   -- Možnosť skryť
    mime_type TEXT,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Povolenie RLS
ALTER TABLE public.events_items ENABLE ROW LEVEL SECURITY;

-- Policy pre verejnosť
CREATE POLICY "Public read active events" ON public.events_items FOR SELECT USING (is_active = true);

-- Policy pre Adminov
CREATE POLICY "Admins have full access events" ON public.events_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
);
