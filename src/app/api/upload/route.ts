import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── SNORA · /api/upload ──────────────────────────────────────────────────────
// POST handler — receives room photo as multipart/form-data,
// uploads to Supabase Storage (room-images bucket), returns public URL
// ─────────────────────────────────────────────────────────────────────────────

// Use service role key for storage uploads (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const BUCKET = 'room-images'
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeEmail(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)
}

function buildFilePath(email: string, originalName: string, mimeType: string): string {
  const safeEmail = sanitizeEmail(email)
  const timestamp = Date.now()
  const random    = Math.random().toString(36).slice(2, 8)

  // Derive extension from mime type
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  const ext = extMap[mimeType] ?? 'jpg'

  // Path: rooms/{email}/{timestamp}-{random}.{ext}
  return `rooms/${safeEmail}/${timestamp}-${random}.${ext}`
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse multipart form data ─────────────────────────────────────────
    let formData: FormData

    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data — send as multipart/form-data' },
        { status: 400 }
      )
    }

    const file  = formData.get('file')  as File | null
    const email = formData.get('email') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided — include "file" field in form data' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'No email provided — include "email" field in form data' },
        { status: 400 }
      )
    }

    // ── 2. Validate file ─────────────────────────────────────────────────────

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Please upload a JPG, PNG, WEBP, or HEIC image.`,
        },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is ${MAX_FILE_SIZE_MB}MB.`,
        },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      )
    }

    console.log(
      `[SNORA] Upload request — ${file.name} (${(file.size / 1024).toFixed(0)}KB, ${file.type}) from ${email}`
    )

    // ── 3. Convert file to ArrayBuffer ───────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer()
    const buffer      = new Uint8Array(arrayBuffer)

    // ── 4. Build unique storage path ─────────────────────────────────────────
    const filePath = buildFilePath(email, file.name, file.type)

    // ── 5. Upload to Supabase Storage ────────────────────────────────────────
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType:  file.type,
        cacheControl: '3600',
        upsert:       false,
      })

    if (uploadError) {
      console.error('[SNORA] Supabase Storage upload error:', uploadError)

      // Handle duplicate path (shouldn't happen with timestamp, but just in case)
      if (uploadError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'Upload conflict — please try again' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    console.log(`[SNORA] Uploaded to: ${uploadData.path}`)

    // ── 6. Get public URL ────────────────────────────────────────────────────
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path)

    if (!urlData?.publicUrl) {
      console.error('[SNORA] Failed to get public URL for path:', uploadData.path)
      return NextResponse.json(
        { error: 'Upload succeeded but failed to generate public URL' },
        { status: 500 }
      )
    }

    console.log(`[SNORA] Public URL: ${urlData.publicUrl}`)

    // ── 7. Return success ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success:  true,
        url:      urlData.publicUrl,
        path:     uploadData.path,
        size:     file.size,
        mimeType: file.type,
      },
      { status: 200 }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[SNORA] /api/upload unhandled error:', message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// ─── GET — health check ───────────────────────────────────────────────────────

export async function GET() {
  // Verify bucket accessibility
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list('', { limit: 1 })

  return NextResponse.json({
    endpoint:      'SNORA /api/upload',
    status:        error ? 'error' : 'active',
    bucket:        BUCKET,
    bucket_status: error ? `Error: ${error.message}` : 'accessible',
    max_file_size: `${MAX_FILE_SIZE_MB}MB`,
    allowed_types: ALLOWED_MIME_TYPES,
  })
}
