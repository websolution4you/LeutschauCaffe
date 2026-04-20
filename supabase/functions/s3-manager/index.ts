import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        console.error("Chyba: Chýba Authorization header")
        return new Response('Chýba prihlásenie', { status: 401, headers: CORS_HEADERS })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token)
    if (userErr || !user) {
        console.error("Chyba: Nepodarilo sa získať používateľa z tokenu", userErr)
        return new Response('Neplatný token', { status: 401, headers: CORS_HEADERS })
    }

    const { data: profile, error: profErr } = await supabaseClient
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (profErr || !profile?.is_admin) {
        console.error("Chyba: Používateľ nie je admin", { user_id: user.id, profile })
        return new Response('Nedostatočné oprávnenia', { status: 403, headers: CORS_HEADERS })
    }

    // --- DIAGNOSTIKA PREMENNÝCH ---
    console.log("Kontrola Env premenných:", {
        AWS_REGION: Deno.env.get('AWS_REGION') ? "NASTAVENÉ" : "CHÝBA (undefined)",
        S3_BUCKET_NAME: Deno.env.get('S3_BUCKET_NAME') ? "NASTAVENÉ" : "CHÝBA (undefined)",
        AWS_ACCESS_KEY_ID: Deno.env.get('AWS_ACCESS_KEY_ID') ? "NASTAVENÉ" : "CHÝBA (undefined)"
    })

    const { action, contentType, fileName, s3Key, folder } = await req.json()
    const targetFolder = folder || 'gallery';

    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION')!,
      endPoint: `s3.${Deno.env.get('AWS_REGION')}.amazonaws.com`,
      accessKey: Deno.env.get('AWS_ACCESS_KEY_ID')!,
      secretKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      bucket: Deno.env.get('S3_BUCKET_NAME')!,
    })

    if (action === 'sign') {
      // OČISTA NÁZVU: Odstránime diakritiku, medzery a špeciálne znaky
      const sanitizedFileName = fileName.replace(/[^a-z0-9.-]/gi, '_');
      const key = `${targetFolder}/${Date.now()}-${sanitizedFileName}`
      const uploadUrl = await s3Client.getPresignedUrl("PUT", key, {
        expirySeconds: 60,
        headers: { "Content-Type": contentType }
      })
      return new Response(JSON.stringify({ uploadUrl, key }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      await s3Client.deleteObject(s3Key)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Neplatná akcia', { status: 400, headers: CORS_HEADERS })
  } catch (error) {
    console.error("Kritická chyba vo funkcii:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
