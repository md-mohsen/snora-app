import { NextRequest, NextResponse } from 'next/server'
import { saveDesign, updateDesign, uploadRoomImage } from '@/lib/supabase'
import type { DesignStyle, RoomType } from '@/lib/supabase'

// ─── SNORA · /api/generate ────────────────────────────────────────────────────
// POST handler — takes room image + style, calls Replicate, saves to Supabase
// ─────────────────────────────────────────────────────────────────────────────

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN!
const REPLICATE_MODEL_VERSION =
  '76604baddc85b1b4616e1c6475eca080da339c8875bd4996705440484a6eac38'

// Style → detailed prompt mapping for better AI results
const STYLE_PROMPTS: Record<DesignStyle, string> = {
  'Scandinavian Minimal':
    'Scandinavian minimal interior design, white walls, light wood furniture, clean lines, cozy textiles, neutral tones, hygge aesthetic, natural light, simple and functional, 8k photorealistic',
  'Modern Luxury':
    'modern luxury interior design, marble surfaces, gold accents, velvet furniture, dramatic lighting, high-end finishes, sophisticated palette, designer furniture, 8k photorealistic',
  'Desert Southwest':
    'Desert Southwest interior design, adobe walls, terracotta tiles, warm earth tones, cacti, woven textiles, turquoise accents, rustic wood, Arizona style, 8k photorealistic',
  'Industrial Loft':
    'industrial loft interior design, exposed brick, concrete floors, steel beams, Edison bulbs, distressed wood, dark tones, urban aesthetic, warehouse style, 8k photorealistic',
  'Japandi Zen':
    'Japandi zen interior design, minimalist Japanese Scandinavian fusion, natural wood, wabi-sabi elements, neutral palette, low furniture, bamboo, peaceful and serene, 8k photorealistic',
  'Bohemian Eclectic':
    'bohemian eclectic interior design, rich jewel tones, layered textiles, macrame, plants, vintage furniture, global patterns, colorful and free-spirited, 8k photorealistic',
  'Art Deco':
    'Art Deco interior design, geometric patterns, gold and black palette, mirrored surfaces, velvet upholstery, bold symmetry, glamorous 1920s luxury, 8k photorealistic',
  'Wabi-Sabi':
    'Wabi-Sabi interior design, imperfect beauty, natural textures, aged wood, linen fabrics, muted earth tones, handmade ceramics, organic forms, Japanese aesthetic, 8k photorealistic',
}

// ─── Request body type ────────────────────────────────────────────────────────

interface GenerateRequestBody {
  imageUrl: string        // public URL of uploaded room photo
  style: DesignStyle
  roomType: RoomType
  roomLength: number
  roomWidth: number
  ceilingHeight: number
  budget: string
  userEmail: string
}

// ─── Replicate polling helpers ────────────────────────────────────────────────

async function createReplicatePrediction(
  imageUrl: string,
  stylePrompt: string
): Promise<{ predictionId: string | null; error: string | null }> {
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: REPLICATE_MODEL_VERSION,
      input: {
        image: imageUrl,
        prompt: stylePrompt,
        guidance_scale: 15,
        negative_prompt:
          'lowres, watermark, banner, logo, watermark, contactinfo, text, deformed, blurry, blur, out of focus, out of frame, surreal, ugly',
        num_inference_steps: 50,
        strength: 0.8,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[SNORA] Replicate create prediction failed:', err)
    return { predictionId: null, error: `Replicate error: ${response.status}` }
  }

  const prediction = await response.json()
  return { predictionId: prediction.id, error: null }
}

async function pollReplicatePrediction(
  predictionId: string,
  maxAttempts = 30,
  intervalMs = 3000
): Promise<{ outputUrl: string | null; error: string | null }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      return {
        outputUrl: null,
        error: `Replicate poll error: ${response.status}`,
      }
    }

    const prediction = await response.json()

    console.log(
      `[SNORA] Replicate status (attempt ${attempt + 1}): ${prediction.status}`
    )

    if (prediction.status === 'succeeded') {
      const outputUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output
      return { outputUrl, error: null }
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return {
        outputUrl: null,
        error: `Replicate prediction ${prediction.status}: ${prediction.error ?? 'unknown'}`,
      }
    }

    // status is 'starting' or 'processing' — keep polling
  }

  return {
    outputUrl: null,
    error: 'Replicate timed out after 90 seconds',
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    let body: GenerateRequestBody

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const {
      imageUrl,
      style,
      roomType,
      roomLength,
      roomWidth,
      ceilingHeight,
      budget,
      userEmail,
    } = body

    // Validate required fields
    if (!imageUrl || !style || !roomType || !userEmail) {
      return NextResponse.json(
        {
          error: 'Missing required fields: imageUrl, style, roomType, userEmail',
        },
        { status: 400 }
      )
    }

    if (!STYLE_PROMPTS[style]) {
      return NextResponse.json(
        { error: `Invalid style: ${style}` },
        { status: 400 }
      )
    }

    if (!REPLICATE_API_TOKEN) {
      console.error('[SNORA] REPLICATE_API_TOKEN is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    console.log(`[SNORA] Starting design generation — style: ${style}, room: ${roomType}`)

    // ── 2. Save initial design record to Supabase (status: generating) ──────
    const { data: initialDesign, error: saveError } = await saveDesign({
      user_email: userEmail,
      room_type: roomType,
      style,
      budget,
      room_length: roomLength,
      room_width: roomWidth,
      ceiling_ht: ceilingHeight,
      original_image_url: imageUrl,
      generated_image_url: undefined,
      status: 'generating',
    })

    if (saveError || !initialDesign?.id) {
      console.error('[SNORA] Failed to save initial design:', saveError)
      return NextResponse.json(
        { error: 'Failed to save design to database' },
        { status: 500 }
      )
    }

    const designId = initialDesign.id
    console.log(`[SNORA] Design record created: ${designId}`)

    // ── 3. Build style prompt with room context ──────────────────────────────
    const basePrompt = STYLE_PROMPTS[style]
    const roomContext = `${roomType}, ${roomLength}ft x ${roomWidth}ft, ${ceilingHeight}ft ceiling`
    const fullPrompt = `${basePrompt}, ${roomContext}`

    // ── 4. Submit to Replicate ───────────────────────────────────────────────
    console.log(`[SNORA] Submitting to Replicate...`)

    const { predictionId, error: replicateError } =
      await createReplicatePrediction(imageUrl, fullPrompt)

    if (replicateError || !predictionId) {
      // Mark design as failed in DB
      await updateDesign(designId, { status: 'failed' })

      return NextResponse.json(
        { error: replicateError ?? 'Failed to start image generation' },
        { status: 502 }
      )
    }

    console.log(`[SNORA] Replicate prediction started: ${predictionId}`)

    // ── 5. Poll for result ───────────────────────────────────────────────────
    const { outputUrl, error: pollError } = await pollReplicatePrediction(
      predictionId
    )

    if (pollError || !outputUrl) {
      await updateDesign(designId, { status: 'failed' })

      return NextResponse.json(
        { error: pollError ?? 'Image generation failed' },
        { status: 502 }
      )
    }

    console.log(`[SNORA] Replicate succeeded. Output URL: ${outputUrl}`)

    // ── 6. Update design record with generated image URL ─────────────────────
    const { data: updatedDesign, error: updateError } = await updateDesign(
      designId,
      {
        generated_image_url: outputUrl,
        status: 'generated',
      }
    )

    if (updateError) {
      console.error('[SNORA] Failed to update design with output:', updateError)
      // Don't fail the request — we still have the outputUrl
    }

    // ── 7. Return success response ───────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        designId,
        originalImageUrl: imageUrl,
        generatedImageUrl: outputUrl,
        style,
        roomType,
        design: updatedDesign ?? initialDesign,
      },
      { status: 200 }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[SNORA] /api/generate unhandled error:', message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// ─── GET — health check ───────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    endpoint: 'SNORA /api/generate',
    status: 'active',
    model: 'adirik/interior-design',
    styles: Object.keys(STYLE_PROMPTS),
  })
}
