'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { DesignStyle, RoomType, FurnitureItem, CostEstimate } from '@/lib/supabase'

// ─── SNORA · Design Studio · src/app/studio/page.tsx ─────────────────────────
// Aesthetic: Dark editorial luxury — deep ink background, terracotta accents,
// Cormorant Garamond serif headings, cinematic before/after slider
// Flow: upload → style → details → generating → results + lead form
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STYLES: { id: DesignStyle; emoji: string; tagline: string; palette: string[] }[] = [
  {
    id: 'Scandinavian Minimal',
    emoji: '🌿',
    tagline: 'Light · Airy · Purposeful',
    palette: ['#F5F0E8', '#D4C5A9', '#8B7355'],
  },
  {
    id: 'Modern Luxury',
    emoji: '💎',
    tagline: 'Opulent · Bold · Refined',
    palette: ['#1A1208', '#C9A84C', '#6B4226'],
  },
  {
    id: 'Desert Southwest',
    emoji: '🏜️',
    tagline: 'Warm · Earthy · Alive',
    palette: ['#D4622A', '#E8A87C', '#8B4513'],
  },
  {
    id: 'Industrial Loft',
    emoji: '⚙️',
    tagline: 'Raw · Urban · Honest',
    palette: ['#2C2C2C', '#8C8C8C', '#B5532A'],
  },
  {
    id: 'Japandi Zen',
    emoji: '🎋',
    tagline: 'Still · Natural · Pure',
    palette: ['#F0EBE3', '#B5A898', '#4A4035'],
  },
  {
    id: 'Bohemian Eclectic',
    emoji: '🌸',
    tagline: 'Layered · Free · Vivid',
    palette: ['#8B3A8B', '#D4A017', '#2E8B57'],
  },
  {
    id: 'Art Deco',
    emoji: '🔶',
    tagline: 'Geometric · Glamorous · Timeless',
    palette: ['#0A0A0A', '#C9A84C', '#1A1A2E'],
  },
  {
    id: 'Wabi-Sabi',
    emoji: '🪨',
    tagline: 'Imperfect · Aged · Honest',
    palette: ['#E8DDD0', '#9B8B78', '#5C4A3A'],
  },
]

const ROOM_TYPES: RoomType[] = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office']
const BUDGETS = ['$10k–$20k', '$20k–$40k', '$40k–$80k', '$80k+']

const LOAD_MESSAGES = [
  "Reading your room's bones…",
  'Mapping light and shadow…',
  'Translating dimensions…',
  'Channeling your chosen style…',
  'Placing furniture with intent…',
  'Selecting materials and finishes…',
  'Rendering the transformation…',
  'Pricing every detail…',
  'Polishing the final design…',
]

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'style' | 'details' | 'generating' | 'results'

interface GenerateResult {
  designId: string
  originalImageUrl: string
  generatedImageUrl: string
}

interface FurnitureResult {
  furniture_list: FurnitureItem[]
  materials_list: string[]
  cost_estimate: CostEstimate
  design_notes: string
  room_summary: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StudioPage() {
  // ── Step navigation ──────────────────────────────────────────────────────
  const [step, setStep]         = useState<Step>('upload')
  const [mounted, setMounted]   = useState(false)

  // ── Upload state ─────────────────────────────────────────────────────────
  const [imageFile, setImageFile]       = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging]     = useState(false)
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  // ── Design choices ───────────────────────────────────────────────────────
  const [selectedStyle, setSelectedStyle] = useState<DesignStyle | null>(null)
  const [roomType, setRoomType]           = useState<RoomType>('Living Room')
  const [roomL, setRoomL]                 = useState('16')
  const [roomW, setRoomW]                 = useState('14')
  const [ceilH, setCeilH]                 = useState('9')
  const [budget, setBudget]               = useState('$20k–$40k')
  const [userEmail, setUserEmail]         = useState('')

  // ── Results ──────────────────────────────────────────────────────────────
  const [genResult, setGenResult]       = useState<GenerateResult | null>(null)
  const [furnResult, setFurnResult]     = useState<FurnitureResult | null>(null)
  const [loadMsgIdx, setLoadMsgIdx]     = useState(0)
  const [globalError, setGlobalError]   = useState<string | null>(null)

  // ── Before/after slider ───────────────────────────────────────────────────
  const [sliderPct, setSliderPct]   = useState(50)
  const [sliderActive, setSliderActive] = useState(false)
  const compareRef                  = useRef<HTMLDivElement>(null)

  // ── Lead form ─────────────────────────────────────────────────────────────
  const [leadName,  setLeadName]   = useState('')
  const [leadEmail, setLeadEmail]  = useState('')
  const [leadPhone, setLeadPhone]  = useState('')
  const [leadCity,  setLeadCity]   = useState('')
  const [leadNotes, setLeadNotes]  = useState('')
  const [leadBusy,  setLeadBusy]   = useState(false)
  const [leadDone,  setLeadDone]   = useState(false)
  const [leadErr,   setLeadErr]    = useState<string | null>(null)

  // mount fade
  useEffect(() => { setMounted(true) }, [])

  // ─── Image handlers ───────────────────────────────────────────────────────

  const acceptFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setGlobalError('Please upload an image — JPG, PNG, or HEIC.')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setGlobalError(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }, [])

  // ─── Generate flow ────────────────────────────────────────────────────────

  const startGenerate = async () => {
    if (!imageFile || !selectedStyle || !userEmail) {
      setGlobalError('Upload a photo, choose a style, and enter your email.')
      return
    }
    setGlobalError(null)
    setStep('generating')
    setLoadMsgIdx(0)

    // Animate loading messages
    const timer = setInterval(() => {
      setLoadMsgIdx(i => Math.min(i + 1, LOAD_MESSAGES.length - 1))
    }, 3000)

    try {
      // 1. Upload image
      const fd = new FormData()
      fd.append('file', imageFile)
      fd.append('email', userEmail)
      const upRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!upRes.ok) throw new Error((await upRes.json()).error ?? 'Upload failed')
      const { url: imageUrl } = await upRes.json()

      // 2. Generate AI redesign
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          style: selectedStyle,
          roomType,
          roomLength: parseFloat(roomL) || 16,
          roomWidth:  parseFloat(roomW) || 14,
          ceilingHeight: parseFloat(ceilH) || 9,
          budget,
          userEmail,
        }),
      })
      if (!genRes.ok) throw new Error((await genRes.json()).error ?? 'Generation failed')
      const gd = await genRes.json()
      setGenResult({ designId: gd.designId, originalImageUrl: gd.originalImageUrl, generatedImageUrl: gd.generatedImageUrl })

      // 3. Get furniture list (non-blocking for UX)
      fetch('/api/furniture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: gd.designId,
          roomType,
          style: selectedStyle,
          roomLength: parseFloat(roomL) || 16,
          roomWidth:  parseFloat(roomW) || 14,
          ceilingHeight: parseFloat(ceilH) || 9,
          budget,
          userEmail,
        }),
      }).then(r => r.ok ? r.json() : null).then(fd => { if (fd) setFurnResult(fd) })

      clearInterval(timer)
      setStep('results')
    } catch (err) {
      clearInterval(timer)
      setGlobalError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('details')
    }
  }

  // ─── Lead submit ──────────────────────────────────────────────────────────

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setLeadBusy(true)
    setLeadErr(null)
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName, email: leadEmail, phone: leadPhone,
          city: leadCity, budget, style: selectedStyle,
          designId: genResult?.designId, notes: leadNotes,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Submission failed')
      setLeadDone(true)
    } catch (err) {
      setLeadErr(err instanceof Error ? err.message : 'Failed — please try again')
    } finally {
      setLeadBusy(false)
    }
  }

  // ─── Slider pointer tracking ──────────────────────────────────────────────

  const moveSlider = (clientX: number) => {
    if (!compareRef.current) return
    const { left, width } = compareRef.current.getBoundingClientRect()
    setSliderPct(Math.max(2, Math.min(98, ((clientX - left) / width) * 100)))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ─── Global styles ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --ink:      #0C0A08;
          --ink2:     #161210;
          --ink3:     #1E1A16;
          --clay:     #D85A30;
          --clay2:    #B8431E;
          --gold:     #C9943A;
          --cream:    #F5EEE4;
          --cream2:   #D4C4AA;
          --mist:     rgba(245,238,228,0.55);
          --dim:      rgba(245,238,228,0.35);
          --ghost:    rgba(245,238,228,0.12);
          --border:   rgba(245,238,228,0.09);
          --border2:  rgba(216,90,48,0.35);
          --serif:    'Cormorant Garamond', Georgia, serif;
          --sans:     'Jost', system-ui, sans-serif;
          --r-sm:     10px;
          --r-md:     16px;
          --r-lg:     24px;
        }

        html, body { background: var(--ink); color: var(--cream); font-family: var(--sans); }

        /* Input base */
        .s-input {
          width: 100%;
          background: rgba(245,238,228,0.04);
          border: 1px solid var(--border);
          border-radius: 10;
          padding: 12px 14px;
          color: var(--cream);
          font-family: var(--sans);
          font-size: 14px;
          font-weight: 300;
          outline: none;
          transition: border-color .2s, background .2s;
          -webkit-appearance: none;
        }
        .s-input::placeholder { color: var(--dim); }
        .s-input:focus { border-color: var(--clay); background: rgba(216,90,48,0.05); }
        select.s-input option { background: #1E1A16; }
        textarea.s-input { resize: vertical; min-height: 80px; line-height: 1.6; }

        /* Buttons */
        .btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 15px 28px;
          background: var(--clay);
          border: none; border-radius: 10;
          color: #fff; font-family: var(--sans); font-size: 14px; font-weight: 500;
          letter-spacing: .5px; cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s;
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--clay2);
          box-shadow: 0 8px 24px rgba(216,90,48,0.3);
          transform: translateY(-1px);
        }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: .4; cursor: not-allowed; }

        .btn-ghost {
          background: none; border: 1px solid var(--border);
          border-radius: 10; padding: 9px 18px;
          color: var(--dim); font-family: var(--sans); font-size: 13px;
          cursor: pointer; transition: border-color .2s, color .2s;
        }
        .btn-ghost:hover { border-color: var(--cream2); color: var(--cream); }

        /* Style card */
        .style-card {
          position: relative;
          background: var(--ink3);
          border: 1.5px solid var(--border);
          border-radius: 16;
          padding: 22px 16px 18px;
          cursor: pointer;
          transition: border-color .2s, transform .2s, box-shadow .2s;
          overflow: hidden;
        }
        .style-card::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(216,90,48,0.06) 0%, transparent 60%);
          opacity: 0; transition: opacity .2s;
        }
        .style-card:hover { border-color: rgba(216,90,48,0.4); transform: translateY(-3px); }
        .style-card:hover::before { opacity: 1; }
        .style-card.active {
          border-color: var(--clay);
          box-shadow: 0 0 0 4px rgba(216,90,48,0.1), 0 12px 32px rgba(0,0,0,0.4);
        }
        .style-card.active::before { opacity: 1; }

        /* Budget pill */
        .budget-pill {
          padding: 10px 16px; border-radius: 8px; text-align: center;
          border: 1.5px solid var(--border); background: var(--ink3);
          font-size: 13px; font-weight: 400; color: var(--dim);
          cursor: pointer; transition: all .18s;
        }
        .budget-pill:hover { border-color: rgba(216,90,48,0.4); color: var(--cream); }
        .budget-pill.active {
          border-color: var(--clay); color: var(--clay);
          background: rgba(216,90,48,0.1); font-weight: 500;
        }

        /* Furniture row */
        .furn-row {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 13px 0;
          border-bottom: 1px solid var(--border);
        }
        .furn-row:last-child { border-bottom: none; }

        /* Fade-up animation */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }

        /* Stagger delays */
        .d1 { animation-delay: .05s; }
        .d2 { animation-delay: .12s; }
        .d3 { animation-delay: .19s; }
        .d4 { animation-delay: .26s; }

        /* Loading orb */
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(216,90,48,.4); }
          50%       { transform: scale(1.06); opacity: .85; box-shadow: 0 0 0 18px rgba(216,90,48,0); }
        }
        .orb { animation: orb-pulse 2.4s ease-in-out infinite; }

        /* Progress track */
        @keyframes track-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .track-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, var(--clay2), var(--clay), var(--gold));
          animation: track-fill 27s linear both;
        }

        /* Slider label */
        .compare-label {
          position: absolute; top: 14px;
          background: rgba(12,10,8,.75); backdrop-filter: blur(8px);
          color: var(--cream2); font-size: 11px; font-weight: 500; letter-spacing: 1.5px;
          padding: 5px 12px; border-radius: 30px; pointer-events: none; user-select: none;
        }

        /* Cost card */
        .cost-card {
          background: var(--ink3); border: 1px solid var(--border);
          border-radius: 16; padding: 18px;
          text-align: center;
        }

        /* Grain overlay */
        body::after {
          content: '';
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          opacity: .025; pointer-events: none; z-index: 9999;
        }
      `}</style>

      <div style={{ minHeight: '100vh', opacity: mounted ? 1 : 0, transition: 'opacity .3s' }}>

        {/* ══════════ HEADER ══════════ */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', height: 62,
          background: 'rgba(12,10,8,.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--clay) 0%, var(--clay2) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--serif)', fontSize: 18, color: '#fff', fontWeight: 600,
            }}>S</div>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 21, letterSpacing: 4, color: 'var(--cream)', fontWeight: 300 }}>
              SNORA
            </span>
            <span style={{ color: 'var(--ghost)', margin: '0 2px' }}>·</span>
            <span style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 300 }}>
              Design Studio
            </span>
          </div>

          {/* Step breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(['upload','style','details','results'] as const).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: step === s ? 'var(--clay)' :
                    ['upload','style','details','generating','results'].indexOf(step) > i ? 'var(--clay2)' : 'var(--border)',
                  transition: 'background .3s',
                }}/>
                {i < 3 && <div style={{ width: 16, height: 1, background: 'var(--border)' }}/>}
              </div>
            ))}
          </div>
        </header>

        {/* ══════════ PAGE BODY ══════════ */}
        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '56px 24px 80px' }}>

          {/* ──────────────────────────── STEP: UPLOAD ─────────────────────── */}
          {step === 'upload' && (
            <div>
              {/* Hero */}
              <div className="fade-up" style={{ textAlign: 'center', marginBottom: 56 }}>
                <p style={{ fontSize: 11, letterSpacing: 3, color: 'var(--clay)', fontWeight: 500, marginBottom: 20, textTransform: 'uppercase' }}>
                  AI Interior Design · Arizona
                </p>
                <h1 style={{
                  fontFamily: 'var(--serif)', fontSize: 'clamp(40px,6vw,68px)',
                  fontWeight: 300, lineHeight: 1.08, color: 'var(--cream)',
                  marginBottom: 20,
                }}>
                  Your room, <em style={{ color: 'var(--clay)', fontStyle: 'italic' }}>reimagined</em>
                </h1>
                <p style={{ fontSize: 16, fontWeight: 300, color: 'var(--mist)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
                  Upload a photo. Choose your aesthetic. Receive an AI-generated redesign with a complete furniture list and cost estimate — in under 90 seconds.
                </p>
              </div>

              {/* Upload zone */}
              <div className="fade-up d1" style={{ maxWidth: 560, margin: '0 auto 28px' }}>
                <div
                  onDrop={onDrop}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#D85A30' : imagePreview ? 'rgba(216,90,48,.5)' : 'rgba(245,238,228,.09)'}`,
                    borderRadius: 24,
                    background: isDragging ? 'rgba(216,90,48,.06)' : imagePreview ? 'var(--ink2)' : 'rgba(245,238,228,.02)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'all .25s',
                    minHeight: imagePreview ? 0 : 280,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {imagePreview ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      <img src={imagePreview} alt="Your room"
                        style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block', borderRadius: 22 }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 22,
                        background: 'linear-gradient(to top, rgba(12,10,8,.7) 0%, transparent 50%)',
                      }}/>
                      <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
                        <span style={{
                          background: 'rgba(12,10,8,.7)', backdropFilter: 'blur(8px)',
                          color: 'var(--cream2)', fontSize: 12, padding: '5px 12px', borderRadius: 20,
                        }}>Click to change</span>
                      </div>
                      <div style={{ position: 'absolute', top: 14, right: 14 }}>
                        <span style={{
                          background: 'var(--clay)', color: '#fff',
                          fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20, letterSpacing: .5,
                        }}>✓ Ready</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
                        background: 'rgba(216,90,48,.1)', border: '1px solid rgba(216,90,48,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                      }}>📷</div>
                      <p style={{ fontSize: 16, color: 'var(--cream)', fontWeight: 400, marginBottom: 8 }}>
                        Drop your room photo here
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 20 }}>
                        or click to browse · JPG · PNG · HEIC
                      </p>
                      <span style={{
                        display: 'inline-block', background: 'var(--clay)', color: '#fff',
                        padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                      }}>Choose Photo</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && acceptFile(e.target.files[0])} />
              </div>

              {/* Email */}
              <div className="fade-up d2" style={{ maxWidth: 560, margin: '0 auto 24px' }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', letterSpacing: .5, marginBottom: 8 }}>
                  YOUR EMAIL — to receive your design results
                </label>
                <input
                  type="email" className="s-input"
                  placeholder="you@email.com"
                  value={userEmail}
                  onChange={e => setUserEmail(e.target.value)}
                />
              </div>

              {/* Error */}
              {globalError && (
                <p className="fade-up" style={{ textAlign: 'center', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  {globalError}
                </p>
              )}

              {/* CTA */}
              <div className="fade-up d3" style={{ maxWidth: 560, margin: '0 auto 52px' }}>
                <button
                  className="btn-primary"
                  disabled={!imagePreview || !userEmail}
                  onClick={() => setStep('style')}
                >
                  Choose Your Style
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              {/* Steps */}
              <div className="fade-up d4" style={{
                maxWidth: 560, margin: '0 auto',
                display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
              }}>
                {[
                  ['01', 'Upload photo'],
                  ['02', 'Pick style'],
                  ['03', 'AI generates'],
                  ['04', 'Get your quote'],
                ].map(([n, l]) => (
                  <div key={n} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'var(--serif)', fontSize: 22, color: 'rgba(216,90,48,.4)',
                      marginBottom: 6, fontWeight: 300,
                    }}>{n}</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────────────────── STEP: STYLE ──────────────────────── */}
          {step === 'style' && (
            <div>
              <button className="btn-ghost fade-up" style={{ marginBottom: 40 }}
                onClick={() => setStep('upload')}>
                ← Back
              </button>

              <div className="fade-up" style={{ marginBottom: 40 }}>
                <p style={{ fontSize: 11, letterSpacing: 3, color: 'var(--clay)', marginBottom: 14, textTransform: 'uppercase' }}>
                  Step 2 of 3
                </p>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px,4vw,50px)', fontWeight: 300, color: 'var(--cream)', marginBottom: 10 }}>
                  Choose your aesthetic
                </h2>
                <p style={{ fontSize: 15, color: 'var(--mist)', fontWeight: 300 }}>
                  Our AI will redesign your room in this exact visual language
                </p>
              </div>

              <div className="fade-up d1" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14, marginBottom: 44,
              }}>
                {STYLES.map(s => (
                  <div
                    key={s.id}
                    className={`style-card${selectedStyle === s.id ? ' active' : ''}`}
                    onClick={() => setSelectedStyle(s.id)}
                  >
                    {/* Palette swatches */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16, justifyContent: 'flex-end' }}>
                      {s.palette.map((c, i) => (
                        <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: .8 }}/>
                      ))}
                    </div>

                    <div style={{ fontSize: 26, marginBottom: 12 }}>{s.emoji}</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cream)', marginBottom: 5, lineHeight: 1.3 }}>
                      {s.id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: .3 }}>
                      {s.tagline}
                    </div>

                    {selectedStyle === s.id && (
                      <div style={{
                        position: 'absolute', top: 12, left: 12,
                        background: 'var(--clay)', color: '#fff',
                        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                        padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
                      }}>Selected</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="fade-up d2" style={{ maxWidth: 400 }}>
                <button
                  className="btn-primary"
                  disabled={!selectedStyle}
                  onClick={() => selectedStyle && setStep('details')}
                >
                  Continue with {selectedStyle ?? 'a style'}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ──────────────────────────── STEP: DETAILS ────────────────────── */}
          {step === 'details' && (
            <div>
              <button className="btn-ghost fade-up" style={{ marginBottom: 40 }}
                onClick={() => setStep('style')}>
                ← Back
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'start' }}>
                {/* Left */}
                <div className="fade-up">
                  <p style={{ fontSize: 11, letterSpacing: 3, color: 'var(--clay)', marginBottom: 14, textTransform: 'uppercase' }}>
                    Step 3 of 3
                  </p>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px,3vw,44px)', fontWeight: 300, color: 'var(--cream)', marginBottom: 24 }}>
                    Room details
                  </h2>

                  {imagePreview && (
                    <div style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 20, position: 'relative' }}>
                      <img src={imagePreview} alt="Your room"
                        style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(12,10,8,.65) 0%, transparent 55%)',
                      }}/>
                      <div style={{ position: 'absolute', bottom: 14, left: 14, display: 'flex', gap: 8 }}>
                        <span style={{
                          background: 'var(--clay)', color: '#fff',
                          fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 20,
                        }}>{selectedStyle}</span>
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.8, fontWeight: 300 }}>
                    Accurate dimensions let our AI select furniture that fits perfectly and generate realistic cost estimates for your Arizona home.
                  </p>
                </div>

                {/* Right — form */}
                <div className="fade-up d1">
                  {/* Room type */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', letterSpacing: .5, marginBottom: 8 }}>
                      ROOM TYPE
                    </label>
                    <select className="s-input" value={roomType}
                      onChange={e => setRoomType(e.target.value as RoomType)}>
                      {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  {/* Dimensions */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', letterSpacing: .5, marginBottom: 8 }}>
                      DIMENSIONS (FEET)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      {[
                        { label: 'Length', val: roomL, set: setRoomL },
                        { label: 'Width',  val: roomW, set: setRoomW },
                        { label: 'Ceiling', val: ceilH, set: setCeilH },
                      ].map(d => (
                        <div key={d.label}>
                          <input type="number" className="s-input"
                            style={{ textAlign: 'center' }}
                            value={d.val}
                            onChange={e => d.set(e.target.value)}
                          />
                          <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center', marginTop: 5 }}>
                            {d.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Budget */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--dim)', letterSpacing: .5, marginBottom: 8 }}>
                      BUDGET RANGE
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {BUDGETS.map(b => (
                        <div key={b}
                          className={`budget-pill${budget === b ? ' active' : ''}`}
                          onClick={() => setBudget(b)}
                        >{b}</div>
                      ))}
                    </div>
                  </div>

                  {globalError && (
                    <p style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>{globalError}</p>
                  )}

                  <button className="btn-primary" onClick={startGenerate}>
                    Generate SNORA Design
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1l1.8 4H13l-3.5 2.5 1.3 4L7 9 3.2 11.5 4.5 7.5 1 5h4.2z" fill="currentColor"/>
                    </svg>
                  </button>
                  <p style={{ fontSize: 12, color: 'rgba(245,238,228,.2)', textAlign: 'center', marginTop: 12, fontWeight: 300 }}>
                    Takes 60–90 seconds · Free · No commitment
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────── STEP: GENERATING ─────────────────── */}
          {step === 'generating' && (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              {/* Orb */}
              <div className="orb" style={{
                width: 80, height: 80, borderRadius: 22,
                background: 'linear-gradient(135deg, var(--clay) 0%, var(--clay2) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 32px',
                fontFamily: 'var(--serif)', fontSize: 32, color: '#fff', fontWeight: 300,
              }}>S</div>

              <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 'clamp(26px,3vw,40px)',
                fontWeight: 300, color: 'var(--cream)', marginBottom: 10,
              }}>
                Creating your {selectedStyle} design
              </h2>
              <p style={{ fontSize: 15, color: 'var(--mist)', marginBottom: 52, fontWeight: 300 }}>
                Reimagining your {roomType} — please wait
              </p>

              {/* Progress messages */}
              <div style={{ maxWidth: 380, margin: '0 auto 40px' }}>
                {LOAD_MESSAGES.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '9px 0',
                    opacity: i <= loadMsgIdx ? 1 : 0.15,
                    transition: 'opacity .5s',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: i < loadMsgIdx
                        ? 'rgba(29,158,117,.25)'
                        : i === loadMsgIdx
                        ? 'rgba(216,90,48,.25)'
                        : 'var(--ink3)',
                      border: `1.5px solid ${i < loadMsgIdx ? '#1D9E75' : i === loadMsgIdx ? '#D85A30' : 'rgba(245,238,228,.09)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: i < loadMsgIdx ? '#1D9E75' : 'transparent',
                      transition: 'all .4s',
                    }}>
                      {i < loadMsgIdx ? '✓' : ''}
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 300,
                      color: i === loadMsgIdx ? 'var(--cream)' : 'var(--dim)',
                      textAlign: 'left',
                      transition: 'color .4s',
                    }}>{msg}</span>
                  </div>
                ))}
              </div>

              {/* Progress track */}
              <div style={{
                maxWidth: 380, height: 3, borderRadius: 2,
                background: 'var(--ink3)', margin: '0 auto', overflow: 'hidden',
              }}>
                <div className="track-fill"/>
              </div>
            </div>
          )}

          {/* ──────────────────────────── STEP: RESULTS ────────────────────── */}
          {step === 'results' && genResult && (
            <div>
              {/* Result header */}
              <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: 3, color: 'var(--clay)', marginBottom: 12, textTransform: 'uppercase' }}>
                    Your SNORA Design
                  </p>
                  <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 300, color: 'var(--cream)', lineHeight: 1.1 }}>
                    {selectedStyle}
                  </h2>
                  {furnResult?.room_summary && (
                    <p style={{ fontSize: 15, color: 'var(--mist)', marginTop: 10, fontWeight: 300, maxWidth: 500 }}>
                      {furnResult.room_summary}
                    </p>
                  )}
                </div>
                <button className="btn-ghost" onClick={() => {
                  setStep('upload'); setGenResult(null); setFurnResult(null);
                  setImageFile(null); setImagePreview(null); setSelectedStyle(null);
                  setLeadDone(false);
                }}>
                  Start New Design
                </button>
              </div>

              {/* ── Before / After Slider ── */}
              <div className="fade-up d1" style={{ marginBottom: 52 }}>
                <div
                  ref={compareRef}
                  style={{
                    position: 'relative', width: '100%', height: 'clamp(300px, 50vw, 520px)',
                    borderRadius: 24, overflow: 'hidden',
                    cursor: 'ew-resize', userSelect: 'none',
                    border: '1px solid var(--border)',
                  }}
                  onMouseMove={e => sliderActive && moveSlider(e.clientX)}
                  onMouseDown={e => { setSliderActive(true); moveSlider(e.clientX) }}
                  onMouseUp={() => setSliderActive(false)}
                  onMouseLeave={() => setSliderActive(false)}
                  onTouchMove={e => moveSlider(e.touches[0].clientX)}
                >
                  {/* After */}
                  <img src={genResult.generatedImageUrl} alt="SNORA Design"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Before (clipped) */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: `polygon(0 0, ${sliderPct}% 0, ${sliderPct}% 100%, 0 100%)`,
                  }}>
                    <img src={genResult.originalImageUrl} alt="Original"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to right, rgba(12,10,8,.15) 0%, transparent 100%)',
                    }}/>
                  </div>

                  {/* Divider line */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${sliderPct}%`, width: 2,
                    background: 'rgba(255,255,255,.85)',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 12px rgba(0,0,0,.5)',
                  }}>
                    {/* Handle */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 40, height: 40, borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 2px 16px rgba(0,0,0,.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: '#555', letterSpacing: -1,
                    }}>◀▶</div>
                  </div>

                  {/* Labels */}
                  <div className="compare-label" style={{ left: 14 }}>BEFORE</div>
                  <div className="compare-label" style={{ right: 14, background: 'var(--clay)', color: '#fff' }}>
                    SNORA DESIGN
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(12,10,8,.65)', backdropFilter: 'blur(8px)',
                    color: 'var(--cream2)', fontSize: 11, padding: '4px 14px', borderRadius: 20,
                    pointerEvents: 'none',
                  }}>
                    Drag to compare
                  </div>
                </div>
              </div>

              {/* ── Two-column: furniture list + lead form ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 32, alignItems: 'start' }}>

                {/* ── FURNITURE LIST ── */}
                <div className="fade-up d2">
                  {/* Cost cards */}
                  {furnResult?.cost_estimate && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
                      {[
                        { label: 'Furniture',   val: furnResult.cost_estimate.furniture_total },
                        { label: 'Labor',        val: furnResult.cost_estimate.labor_cost },
                        { label: 'Grand Total',  val: furnResult.cost_estimate.grand_total, accent: true },
                      ].map(c => (
                        <div key={c.label} className="cost-card">
                          <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                            {c.label}
                          </div>
                          <div style={{
                            fontFamily: 'var(--serif)',
                            fontSize: c.accent ? 26 : 22,
                            fontWeight: 300,
                            color: c.accent ? 'var(--clay)' : 'var(--cream)',
                          }}>
                            ${c.val.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Design notes */}
                  {furnResult?.design_notes && (
                    <div style={{
                      background: 'rgba(216,90,48,.05)',
                      border: '1px solid rgba(216,90,48,.18)',
                      borderLeft: '3px solid var(--clay)',
                      borderRadius: '0 10px 10px 0',
                      padding: '14px 18px', marginBottom: 24,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--clay)', letterSpacing: 1.5, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase' }}>
                        Designer Notes
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--mist)', margin: 0, lineHeight: 1.75, fontWeight: 300 }}>
                        {furnResult.design_notes}
                      </p>
                    </div>
                  )}

                  {/* Furniture items */}
                  {furnResult?.furniture_list?.length ? (
                    <div style={{
                      background: 'var(--ink2)',
                      border: '1px solid var(--border)',
                      borderRadius: 18, overflow: 'hidden',
                    }}>
                      <div style={{
                        padding: '16px 22px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--cream)', letterSpacing: .3 }}>
                          Furniture & Decor
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                          {furnResult.furniture_list.length} items
                        </span>
                      </div>
                      <div style={{ padding: '4px 22px 16px' }}>
                        {furnResult.furniture_list.map((item, i) => (
                          <div key={i} className="furn-row">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, color: 'var(--cream)', fontWeight: 400, marginBottom: 4, lineHeight: 1.35 }}>
                                {item.name}
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                                  background: 'rgba(216,90,48,.1)', color: 'var(--clay)',
                                  border: '1px solid rgba(216,90,48,.2)', fontWeight: 500, letterSpacing: .3,
                                }}>
                                  {item.category}
                                </span>
                                {item.quantity > 1 && (
                                  <span style={{ fontSize: 10, color: 'var(--dim)', alignSelf: 'center' }}>
                                    Qty {item.quantity}
                                  </span>
                                )}
                                {item.notes && (
                                  <span style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic', alignSelf: 'center' }}>
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 14, color: 'var(--cream)', fontWeight: 500 }}>
                                ${item.total_price.toLocaleString()}
                              </div>
                              {item.quantity > 1 && (
                                <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                                  ea. ${item.unit_price.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Loading skeleton while furniture fetches */
                    <div style={{
                      background: 'var(--ink2)', border: '1px solid var(--border)',
                      borderRadius: 18, padding: 24,
                    }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          height: 14, borderRadius: 4, marginBottom: 14,
                          background: 'linear-gradient(90deg, var(--ink3) 25%, rgba(216,90,48,.08) 50%, var(--ink3) 75%)',
                          backgroundSize: '200% auto',
                          animation: 'shimmer 1.6s linear infinite',
                          width: `${[85, 65, 75, 55, 90][i - 1]}%`,
                        }}/>
                      ))}
                      <style>{`
                        @keyframes shimmer {
                          0%   { background-position: 200% center; }
                          100% { background-position: -200% center; }
                        }
                      `}</style>
                    </div>
                  )}
                </div>

                {/* ── LEAD CAPTURE FORM ── */}
                <div className="fade-up d3">
                  <div style={{
                    background: 'var(--ink2)',
                    border: '1px solid var(--border)',
                    borderRadius: 22,
                    padding: 28,
                    position: 'sticky', top: 82,
                  }}>
                    {leadDone ? (
                      /* ── Confirmation state ── */
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: '50%', margin: '0 auto 20px',
                          background: 'rgba(29,158,117,.15)',
                          border: '1.5px solid rgba(29,158,117,.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22,
                        }}>✓</div>
                        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 300, color: 'var(--cream)', marginBottom: 12 }}>
                          Request received
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--mist)', lineHeight: 1.75, fontWeight: 300, marginBottom: 20 }}>
                          Our Arizona team will call you within <strong style={{ color: 'var(--cream)', fontWeight: 500 }}>24 hours</strong> to discuss your {selectedStyle} project and send a detailed quote.
                        </p>
                        <div style={{
                          background: 'rgba(29,158,117,.08)',
                          border: '1px solid rgba(29,158,117,.2)',
                          borderRadius: 10, padding: '12px 16px',
                        }}>
                          <p style={{ margin: 0, fontSize: 12, color: 'var(--dim)', fontWeight: 300 }}>
                            Confirmation sent to <span style={{ color: 'var(--cream)' }}>{leadEmail}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* ── Lead form ── */
                      <>
                        <div style={{ marginBottom: 24 }}>
                          <div style={{
                            display: 'inline-block',
                            background: 'rgba(216,90,48,.1)', color: 'var(--clay)',
                            fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                            padding: '4px 10px', borderRadius: 4, marginBottom: 14, textTransform: 'uppercase',
                          }}>Free Consultation</div>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 300, color: 'var(--cream)', marginBottom: 10 }}>
                            Get a quote from our Arizona team
                          </h3>
                          <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.7, fontWeight: 300 }}>
                            SNORA designs, sources, and installs every project. Real craftsmanship, built in Arizona.
                          </p>
                        </div>

                        <form onSubmit={submitLead}>
                          {[
                            { label: 'FULL NAME',     type: 'text',  val: leadName,  set: setLeadName,  ph: 'Jane Smith' },
                            { label: 'EMAIL',         type: 'email', val: leadEmail, set: setLeadEmail, ph: 'jane@email.com' },
                            { label: 'PHONE',         type: 'tel',   val: leadPhone, set: setLeadPhone, ph: '+1 480 555 0100' },
                            { label: 'CITY',          type: 'text',  val: leadCity,  set: setLeadCity,  ph: 'Scottsdale, Phoenix, Tempe…' },
                          ].map(f => (
                            <div key={f.label} style={{ marginBottom: 14 }}>
                              <label style={{ display: 'block', fontSize: 10, color: 'var(--dim)', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>
                                {f.label}
                              </label>
                              <input
                                type={f.type} className="s-input" required
                                placeholder={f.ph}
                                value={f.val}
                                onChange={e => f.set(e.target.value)}
                              />
                            </div>
                          ))}

                          <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--dim)', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>
                              NOTES (OPTIONAL)
                            </label>
                            <textarea className="s-input" placeholder="Any specific requests or questions?"
                              value={leadNotes} onChange={e => setLeadNotes(e.target.value)} rows={3}/>
                          </div>

                          {leadErr && (
                            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{leadErr}</p>
                          )}

                          <button
                            type="submit" className="btn-primary"
                            disabled={leadBusy || !leadName || !leadEmail || !leadPhone || !leadCity}
                          >
                            {leadBusy ? 'Sending…' : 'Request Free Consultation'}
                            {!leadBusy && (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>

                          <p style={{ fontSize: 11, color: 'rgba(245,238,228,.18)', textAlign: 'center', marginTop: 12, fontWeight: 300 }}>
                            No commitment · Arizona team only · Response within 24h
                          </p>
                        </form>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>

        {/* ══════════ FOOTER ══════════ */}
        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '22px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--dim)', letterSpacing: 3, fontWeight: 300 }}>
            SNORA
          </span>
          <span style={{ fontSize: 11, color: 'rgba(245,238,228,.18)', letterSpacing: 1 }}>
            AI INTERIOR DESIGN · ARIZONA · {new Date().getFullYear()}
          </span>
        </footer>

      </div>
    </>
  )
}
