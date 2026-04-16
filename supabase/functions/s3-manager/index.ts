import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Chýba prihlásenie', { status: 401, headers: CORS_HEADERS })

    // Inicializácia Supabase klienta vo funkcii
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Service role pre obídenie RLS pri overovaní admina
      { global: { headers: { Authorization: authHeader } } }
    )

    // 1. Získať identitu používateľa cez JWT z headera
    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser()
    if (userErr || !user) return new Response('Neplatný token', { status: 401, headers: CORS_HEADERS })

    // 2. Skontrolovať, či je admin (query na profiles)
    const { data: profile, error: profErr } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profErr || !profile?.is_admin) {
        return new Response('Nedostatočné oprávnenia', { status: 403, headers: CORS_HEADERS })
    }

    // --- Overenie úspešné, pokračujeme k S3 ---

    const { action, contentType, fileName, s3Key } = await req.json()
    const s3Client = new S3Client({
      region: Deno.env.get('AWS_REGION'),
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!,
      },
    })

    if (action === 'sign') {
      const key = `gallery/${Date.now()}-${fileName}`
      const command = new PutObjectCommand({
        Bucket: Deno.env.get('S3_BUCKET_NAME'),
        Key: key,
        ContentType: contentType,
      })

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 })
      return new Response(JSON.stringify({ uploadUrl, key }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete') {
      const command = new DeleteObjectCommand({
        Bucket: Deno.env.get('S3_BUCKET_NAME'),
        Key: s3Key,
      })
      await s3Client.send(command)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Neplatná akcia', { status: 400, headers: CORS_HEADERS })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
