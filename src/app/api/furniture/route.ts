import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { updateDesign } from '@/lib/supabase'
import type { DesignStyle, RoomType, FurnitureItem, CostEstimate } from '@/lib/supabase'

// ─── SNORA · /api/furniture ───────────────────────────────────────────────────
// POST handler — calls Claude to generate a complete furniture list + cost
// estimate based on room type, style, dimensions, and budget
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─── Budget range mapping ─────────────────────────────────────────────────────

const BUDGET_RANGES: Record<string, { min: number; max: number; label: string }> = {
  '$10k-20k':  { min: 10000,  max: 20000,  label: '$10,000–$20,000' },
  '$20k-40k':  { min: 20000,  max: 40000,  label: '$20,000–$40,000' },
  '$40k-80k':  { min: 40000,  max: 80000,  label: '$40,000–$80,000' },
  '$80k+':     { min: 80000,  max: 150000, label: '$80,000+' },
}

// ─── Style context for better Claude output ───────────────────────────────────

const STYLE_CONTEXT: Record<DesignStyle, string> = {
  'Scandinavian Minimal':
    'Clean lines, light wood (oak/pine), white/grey palette, minimal decor, functional pieces, IKEA-quality to mid-range brands',
  'Modern Luxury':
    'High-end materials, marble, velvet, gold hardware, designer brands (RH, Restoration Hardware, West Elm luxury tier), statement pieces',
  'Desert Southwest':
    'Terracotta, adobe textures, turquoise accents, woven textiles, rustic wood, handcrafted items, Southwestern/Mexican artisan pieces',
  'Industrial Loft':
    'Steel and wood combos, distressed leather, exposed hardware, Edison bulb lighting, reclaimed wood, dark metal finishes',
  'Japandi Zen':
    'Low-profile furniture, natural materials, bamboo, linen, washi, muted earth tones, handmade ceramics, minimal ornament',
  'Bohemian Eclectic':
    'Layered textiles, rattan, macrame, colorful cushions, vintage finds, plants, global textiles, eclectic mix of patterns',
  'Art Deco':
    'Geometric forms, velvet upholstery, mirrored surfaces, black and gold, brass fittings, symmetrical layout, glamorous lighting',
  'Wabi-Sabi':
    'Imperfect natural textures, aged wood, handmade ceramics, linen, stone, organic forms, earthy neutrals, Japanese craftsmanship',
}

// ─── Room type → typical furniture categories ─────────────────────────────────

const ROOM_FURNITURE_GUIDE: Record<RoomType, string> = {
  'Living Room':
    'sofa, accent chairs, coffee table, side tables, TV unit/console, floor lamp, table lamps, area rug, curtains, cushions, wall art, bookshelf, decorative objects',
  'Bedroom':
    'bed frame, mattress, nightstands, dresser/chest of drawers, wardrobe, bedside lamps, area rug, curtains, bedding set, full-length mirror, accent chair',
  'Kitchen':
    'bar stools, kitchen island (if applicable), pendant lights, window treatment, small appliances, storage solutions, decorative items, kitchen accessories',
  'Bathroom':
    'vanity mirror, towel rack, bath mat, shower curtain (if applicable), storage cabinet, decorative items, toilet accessories, lighting fixture',
  'Office':
    'desk, ergonomic chair, bookshelf, filing cabinet, desk lamp, floor lamp, area rug, curtains, wall art, desk accessories, whiteboard or pinboard',
}

// ─── Request body type ────────────────────────────────────────────────────────

interface FurnitureRequestBody {
  designId: string
  roomType: RoomType
  style: DesignStyle
  roomLength: number
  roomWidth: number
  ceilingHeight: number
  budget: string
  userEmail: string
}

// ─── Claude response type ─────────────────────────────────────────────────────

interface ClaudeFurnitureResponse {
  furniture_list: FurnitureItem[]
  materials_list: string[]
  cost_estimate: CostEstimate
  design_notes: string
  room_summary: string
}

// ─── Build Claude prompt ──────────────────────────────────────────────────────

function buildFurniturePrompt(body: FurnitureRequestBody): string {
  const budgetRange = BUDGET_RANGES[body.budget] ?? BUDGET_RANGES['$20k-40k']
  const styleContext = STYLE_CONTEXT[body.style]
  const furnitureGuide = ROOM_FURNITURE_GUIDE[body.roomType]
  const roomArea = (body.roomLength * body.roomWidth).toFixed(0)

  return `You are an expert interior designer and furniture consultant for SNORA — a premium interior design company based in Arizona, USA.

Generate a complete, realistic furniture and decor list for the following room:

ROOM DETAILS:
- Room type: ${body.roomType}
- Design style: ${body.style}
- Dimensions: ${body.roomLength}ft × ${body.roomWidth}ft (${roomArea} sq ft)
- Ceiling height: ${body.ceilingHeight}ft
- Total budget: ${budgetRange.label}

STYLE GUIDANCE:
${styleContext}

FURNITURE CATEGORIES TO COVER:
${furnitureGuide}

PRICING RULES:
- All prices must be in USD
- Total furniture cost must stay within budget range: $${budgetRange.min.toLocaleString()} – $${budgetRange.max.toLocaleString()}
- Include realistic US retail prices (not wholesale)
- Scale furniture sizes appropriately for a ${roomArea} sq ft room
- Suggest 2–4 items per category where relevant

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation — just raw JSON.

The JSON must follow this exact structure:
{
  "furniture_list": [
    {
      "name": "Item name (brand suggestion if relevant)",
      "quantity": 1,
      "unit_price": 599,
      "total_price": 599,
      "category": "Seating",
      "notes": "Optional: size recommendation or material detail"
    }
  ],
  "materials_list": [
    "White oak hardwood flooring",
    "Linen upholstery fabric",
    "Matte black metal hardware"
  ],
  "cost_estimate": {
    "furniture_total": 12500,
    "labor_cost": 3500,
    "materials_cost": 2000,
    "grand_total": 18000,
    "currency": "USD"
  },
  "design_notes": "2–3 sentences explaining key design decisions for this specific room and style.",
  "room_summary": "One sentence describing the overall look and feel of the finished room."
}

Categories to use: Seating, Tables, Storage, Lighting, Textiles, Decor, Flooring, Window Treatments, Mirrors, Appliances (if kitchen), Bedding (if bedroom)`
}

// ─── Parse and validate Claude's JSON response ────────────────────────────────

function parseClaudeResponse(rawText: string): ClaudeFurnitureResponse | null {
  try {
    // Strip any accidental markdown fences if Claude added them
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Basic validation
    if (!Array.isArray(parsed.furniture_list)) return null
    if (!Array.isArray(parsed.materials_list)) return null
    if (!parsed.cost_estimate?.grand_total) return null

    return parsed as ClaudeFurnitureResponse
  } catch (err) {
    console.error('[SNORA] Failed to parse Claude JSON:', err)
    return null
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse request ─────────────────────────────────────────────────────
    let body: FurnitureRequestBody

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { designId, roomType, style, roomLength, roomWidth, budget, userEmail } = body

    if (!designId || !roomType || !style || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: designId, roomType, style, userEmail' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[SNORA] ANTHROPIC_API_KEY is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    console.log(`[SNORA] Generating furniture list — ${style} ${roomType} (${budget})`)

    // ── 2. Build prompt ──────────────────────────────────────────────────────
    const prompt = buildFurniturePrompt(body)

    // ── 3. Call Claude ───────────────────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system:
        'You are an expert interior designer for SNORA, a premium Arizona-based interior design company. You always respond with valid JSON only — no markdown, no commentary, no backticks. Just raw JSON.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // ── 4. Extract text response ─────────────────────────────────────────────
    const rawText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!rawText) {
      return NextResponse.json(
        { error: 'Claude returned an empty response' },
        { status: 502 }
      )
    }

    console.log(`[SNORA] Claude responded (${rawText.length} chars)`)

    // ── 5. Parse Claude's JSON ───────────────────────────────────────────────
    const furnitureData = parseClaudeResponse(rawText)

    if (!furnitureData) {
      console.error('[SNORA] Failed to parse Claude response:', rawText.slice(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse furniture list from AI response' },
        { status: 502 }
      )
    }

    console.log(
      `[SNORA] Furniture list generated — ${furnitureData.furniture_list.length} items, ` +
      `total: $${furnitureData.cost_estimate.grand_total.toLocaleString()}`
    )

    // ── 6. Save furniture list + cost estimate to Supabase design record ─────
    const { error: updateError } = await updateDesign(designId, {
      furniture_list: furnitureData.furniture_list,
      materials_list: furnitureData.materials_list,
      cost_estimate: furnitureData.cost_estimate,
    })

    if (updateError) {
      console.error('[SNORA] Failed to save furniture list to Supabase:', updateError)
      // Don't fail the request — still return the data to the frontend
    }

    // ── 7. Return complete furniture response ────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        designId,
        furniture_list: furnitureData.furniture_list,
        materials_list: furnitureData.materials_list,
        cost_estimate: furnitureData.cost_estimate,
        design_notes: furnitureData.design_notes,
        room_summary: furnitureData.room_summary,
        item_count: furnitureData.furniture_list.length,
        model_used: 'claude-sonnet-4-20250514',
        tokens_used: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[SNORA] /api/furniture unhandled error:', message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// ─── GET — health check + sample output ──────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    endpoint: 'SNORA /api/furniture',
    status: 'active',
    model: 'claude-sonnet-4-20250514',
    supported_styles: Object.keys(STYLE_CONTEXT),
    supported_room_types: Object.keys(ROOM_FURNITURE_GUIDE),
    budget_tiers: Object.keys(BUDGET_RANGES),
    sample_request: {
      designId: 'uuid-from-generate-api',
      roomType: 'Living Room',
      style: 'Desert Southwest',
      roomLength: 18,
      roomWidth: 14,
      ceilingHeight: 9,
      budget: '$20k-40k',
      userEmail: 'client@example.com',
    },
  })
}
