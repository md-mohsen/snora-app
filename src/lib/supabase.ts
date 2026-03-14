import { createClient } from '@supabase/supabase-js'

// ─── SNORA Supabase Client ────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Public client — used on the frontend
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client — used on the backend (API routes only, never expose to browser)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export type DesignStyle =
  | 'Scandinavian Minimal'
  | 'Modern Luxury'
  | 'Desert Southwest'
  | 'Industrial Loft'
  | 'Japandi Zen'
  | 'Bohemian Eclectic'
  | 'Art Deco'
  | 'Wabi-Sabi'

export type RoomType =
  | 'Living Room'
  | 'Bedroom'
  | 'Kitchen'
  | 'Bathroom'
  | 'Office'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'quoted'
  | 'won'
  | 'lost'

export type DesignStatus =
  | 'generating'
  | 'generated'
  | 'failed'

export interface FurnitureItem {
  name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
  notes?: string
}

export interface CostEstimate {
  furniture_total: number
  labor_cost: number
  materials_cost: number
  grand_total: number
  currency: string
}

export interface Design {
  id?: string
  created_at?: string
  user_email: string
  room_type: RoomType
  style: DesignStyle
  budget: string
  room_length: number
  room_width: number
  ceiling_ht: number
  original_image_url: string
  generated_image_url?: string
  furniture_list?: FurnitureItem[]
  materials_list?: string[]
  cost_estimate?: CostEstimate
  status: DesignStatus
}

export interface Lead {
  id?: string
  created_at?: string
  name: string
  email: string
  phone: string
  city: string
  zip?: string
  budget: string
  style: DesignStyle
  design_id?: string
  status: LeadStatus
  notes?: string
}

// ─── uploadRoomImage() ────────────────────────────────────────────────────────
// Uploads room photo to Supabase Storage and returns the public URL

export async function uploadRoomImage(
  file: File,
  userEmail: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Create a unique filename using timestamp + sanitized email
    const timestamp = Date.now()
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_')
    const fileExt = file.name.split('.').pop() ?? 'jpg'
    const fileName = `${sanitizedEmail}_${timestamp}.${fileExt}`
    const filePath = `room-photos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('room-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      console.error('[SNORA] uploadRoomImage error:', uploadError)
      return { url: null, error: uploadError.message }
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('room-images')
      .getPublicUrl(filePath)

    return { url: urlData.publicUrl, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upload error'
    console.error('[SNORA] uploadRoomImage unexpected error:', message)
    return { url: null, error: message }
  }
}

// ─── saveDesign() ─────────────────────────────────────────────────────────────
// Saves a design record to the designs table, returns the saved design with its ID

export async function saveDesign(
  design: Design
): Promise<{ data: Design | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('designs')
      .insert([design])
      .select()
      .single()

    if (error) {
      console.error('[SNORA] saveDesign error:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Design, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown save error'
    console.error('[SNORA] saveDesign unexpected error:', message)
    return { data: null, error: message }
  }
}

// ─── updateDesign() ───────────────────────────────────────────────────────────
// Updates an existing design (e.g. after Replicate finishes generating the image)

export async function updateDesign(
  designId: string,
  updates: Partial<Design>
): Promise<{ data: Design | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('designs')
      .update(updates)
      .eq('id', designId)
      .select()
      .single()

    if (error) {
      console.error('[SNORA] updateDesign error:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Design, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown update error'
    console.error('[SNORA] updateDesign unexpected error:', message)
    return { data: null, error: message }
  }
}

// ─── saveLead() ───────────────────────────────────────────────────────────────
// Saves a lead to the leads table when user requests a free consultation

export async function saveLead(
  lead: Lead
): Promise<{ data: Lead | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .insert([lead])
      .select()
      .single()

    if (error) {
      console.error('[SNORA] saveLead error:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Lead, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown lead save error'
    console.error('[SNORA] saveLead unexpected error:', message)
    return { data: null, error: message }
  }
}

// ─── getDesignById() ──────────────────────────────────────────────────────────
// Fetches a single design by ID — used in the results page

export async function getDesignById(
  designId: string
): Promise<{ data: Design | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', designId)
      .single()

    if (error) {
      console.error('[SNORA] getDesignById error:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Design, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error'
    console.error('[SNORA] getDesignById unexpected error:', message)
    return { data: null, error: message }
  }
}

// ─── getAllLeads() ────────────────────────────────────────────────────────────
// Fetches all leads — used in the SNORA admin dashboard

export async function getAllLeads(): Promise<{
  data: Lead[] | null
  error: string | null
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*, designs(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[SNORA] getAllLeads error:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Lead[], error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error'
    console.error('[SNORA] getAllLeads unexpected error:', message)
    return { data: null, error: message }
  }
}

// ─── updateLeadStatus() ───────────────────────────────────────────────────────
// Updates a lead's status — used in the admin dashboard

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabaseAdmin
      .from('leads')
      .update({ status })
      .eq('id', leadId)

    if (error) {
      console.error('[SNORA] updateLeadStatus error:', error)
      return { error: error.message }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown update error'
    console.error('[SNORA] updateLeadStatus unexpected error:', message)
    return { error: message }
  }
}
