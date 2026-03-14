import { NextRequest, NextResponse } from 'next/server'
import { saveLead, getDesignById } from '@/lib/supabase'
import type { Lead, LeadStatus, DesignStyle } from '@/lib/supabase'

// ─── SNORA · /api/lead ────────────────────────────────────────────────────────
// POST handler — saves lead to Supabase + sends email notification to SNORA team
// Uses Resend for email delivery (free tier: 3,000 emails/month)
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY!
const SNORA_TEAM_EMAIL = process.env.SNORA_TEAM_EMAIL ?? 'leads@snora.com'
const SNORA_FROM_EMAIL = process.env.SNORA_FROM_EMAIL ?? 'noreply@snora.com'

// ─── Request body type ────────────────────────────────────────────────────────

interface LeadRequestBody {
  // Client info
  name: string
  email: string
  phone: string
  city: string
  zip?: string

  // Project info
  budget: string
  style: DesignStyle
  designId?: string

  // Optional context
  roomType?: string
  notes?: string
}

// ─── Email HTML builder — SNORA team notification ─────────────────────────────

function buildTeamEmailHtml(lead: Lead, designUrl?: string): string {
  const statusBadge = `
    <span style="
      display:inline-block;
      background:#D85A30;
      color:#ffffff;
      padding:4px 12px;
      border-radius:4px;
      font-size:12px;
      font-weight:600;
      letter-spacing:1px;
      text-transform:uppercase;
    ">NEW LEAD</span>
  `

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:14px;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${value}</td>
    </tr>
  `

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="background:#1a0a3c;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:22px;font-weight:700;color:#E8B86D;letter-spacing:3px;">SNORA</div>
                  <div style="font-size:12px;color:#9ca3af;margin-top:2px;letter-spacing:1px;">AI INTERIOR DESIGN · ARIZONA</div>
                </td>
                <td align="right">${statusBadge}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alert bar -->
        <tr>
          <td style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:14px 32px;">
            <p style="margin:0;font-size:15px;color:#92400e;font-weight:500;">
              A new client just requested a free consultation from the SNORA app.
            </p>
          </td>
        </tr>

        <!-- Client info -->
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="font-size:11px;font-weight:600;color:#D85A30;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;">
              CLIENT INFORMATION
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
              ${row('Full Name', lead.name)}
              ${row('Email', `<a href="mailto:${lead.email}" style="color:#D85A30;">${lead.email}</a>`)}
              ${row('Phone', `<a href="tel:${lead.phone}" style="color:#D85A30;">${lead.phone}</a>`)}
              ${row('City', lead.city)}
              ${lead.zip ? row('ZIP Code', lead.zip) : ''}
            </table>
          </td>
        </tr>

        <!-- Project info -->
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="font-size:11px;font-weight:600;color:#D85A30;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;">
              PROJECT DETAILS
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f3f4f6;">
              ${row('Design Style', lead.style)}
              ${row('Budget Range', lead.budget)}
              ${lead.notes ? row('Notes', lead.notes) : ''}
            </table>
          </td>
        </tr>

        <!-- Design preview link -->
        ${designUrl ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <div style="background:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb;">
              <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">AI Design Preview</div>
              <a href="${designUrl}" style="color:#D85A30;font-size:14px;font-weight:500;">
                View Client's SNORA Design →
              </a>
            </div>
          </td>
        </tr>
        ` : ''}

        <!-- CTA buttons -->
        <tr>
          <td style="padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;">
                  <a href="mailto:${lead.email}?subject=Your%20SNORA%20Design%20Consultation&body=Hi%20${encodeURIComponent(lead.name)},"
                     style="display:inline-block;background:#D85A30;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
                    Reply to Client
                  </a>
                </td>
                <td>
                  <a href="tel:${lead.phone}"
                     style="display:inline-block;background:#1a0a3c;color:#ffffff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
                    Call Client
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This lead came through the SNORA AI Interior Design App.
              Respond within 24 hours for best conversion rates.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#d1d5db;">
              SNORA · Arizona, USA · snora.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
  `.trim()
}

// ─── Email HTML builder — client confirmation ─────────────────────────────────

function buildClientEmailHtml(lead: Lead): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="background:#1a0a3c;padding:32px;">
            <div style="font-size:26px;font-weight:700;color:#E8B86D;letter-spacing:4px;text-align:center;">SNORA</div>
            <div style="font-size:12px;color:#9ca3af;text-align:center;margin-top:4px;letter-spacing:1px;">AI INTERIOR DESIGN · ARIZONA</div>
          </td>
        </tr>

        <!-- Main content -->
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#111827;font-weight:600;">
              We received your request, ${lead.name.split(' ')[0]}!
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
              Your free consultation request has been sent to the SNORA Arizona team.
              We'll reach out within <strong style="color:#111827;">24 hours</strong> to discuss your
              <strong style="color:#D85A30;">${lead.style}</strong> design.
            </p>

            <!-- Summary card -->
            <div style="background:#f9fafb;border-radius:10px;padding:20px;border:1px solid #e5e7eb;margin-bottom:24px;">
              <div style="font-size:11px;font-weight:600;color:#D85A30;letter-spacing:1.5px;margin-bottom:12px;">YOUR CONSULTATION DETAILS</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;width:120px;">Design Style</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${lead.style}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">Budget Range</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${lead.budget}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#6b7280;">Location</td>
                  <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:500;">${lead.city}${lead.zip ? `, ${lead.zip}` : ''}</td>
                </tr>
              </table>
            </div>

            <!-- What happens next -->
            <div style="margin-bottom:28px;">
              <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:1.5px;margin-bottom:14px;">WHAT HAPPENS NEXT</div>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:6px 0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;background:#D85A30;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:10px;">1</span>
                    <span style="font-size:14px;color:#374151;">Our team reviews your AI design</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;background:#D85A30;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:10px;">2</span>
                    <span style="font-size:14px;color:#374151;">We call you to discuss your vision</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;background:#D85A30;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:10px;">3</span>
                    <span style="font-size:14px;color:#374151;">We send you a detailed quote</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;background:#D85A30;color:#fff;border-radius:50%;font-size:11px;font-weight:700;text-align:center;line-height:22px;margin-right:10px;">4</span>
                    <span style="font-size:14px;color:#374151;">SNORA builds and installs your design</span>
                  </td>
                </tr>
              </table>
            </div>

            <p style="margin:0;font-size:14px;color:#6b7280;">
              Questions? Reply to this email or call us directly.<br>
              <a href="mailto:${SNORA_TEAM_EMAIL}" style="color:#D85A30;">${SNORA_TEAM_EMAIL}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1a0a3c;padding:20px 32px;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              SNORA · AI Interior Design · Arizona, USA
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>
  `.trim()
}

// ─── Send email via Resend ────────────────────────────────────────────────────

async function sendEmail(options: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<{ success: boolean; error: string | null }> {
  if (!RESEND_API_KEY) {
    console.warn('[SNORA] RESEND_API_KEY not set — skipping email')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `SNORA <${SNORA_FROM_EMAIL}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[SNORA] Resend error:', err)
      return { success: false, error: `Email failed: ${response.status}` }
    }

    const data = await response.json()
    console.log(`[SNORA] Email sent successfully. ID: ${data.id}`)
    return { success: true, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Email send failed'
    console.error('[SNORA] sendEmail unexpected error:', msg)
    return { success: false, error: msg }
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validateLeadBody(body: LeadRequestBody): string | null {
  if (!body.name?.trim())  return 'Name is required'
  if (!body.email?.trim()) return 'Email is required'
  if (!body.phone?.trim()) return 'Phone is required'
  if (!body.city?.trim())  return 'City is required'
  if (!body.budget?.trim()) return 'Budget is required'
  if (!body.style?.trim()) return 'Design style is required'

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(body.email)) return 'Invalid email address'

  return null
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse and validate ────────────────────────────────────────────────
    let body: LeadRequestBody

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationError = validateLeadBody(body)
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    console.log(`[SNORA] New lead from ${body.name} — ${body.city} — ${body.style}`)

    // ── 2. Build lead object ─────────────────────────────────────────────────
    const lead: Lead = {
      name:      body.name.trim(),
      email:     body.email.trim().toLowerCase(),
      phone:     body.phone.trim(),
      city:      body.city.trim(),
      zip:       body.zip?.trim(),
      budget:    body.budget,
      style:     body.style,
      design_id: body.designId,
      status:    'new' as LeadStatus,
      notes:     body.notes?.trim(),
    }

    // ── 3. Save lead to Supabase ─────────────────────────────────────────────
    const { data: savedLead, error: saveError } = await saveLead(lead)

    if (saveError || !savedLead) {
      console.error('[SNORA] Failed to save lead:', saveError)
      return NextResponse.json(
        { error: 'Failed to save your request. Please try again.' },
        { status: 500 }
      )
    }

    console.log(`[SNORA] Lead saved with ID: ${savedLead.id}`)

    // ── 4. Fetch design details for email (if designId provided) ─────────────
    let designUrl: string | undefined
    if (body.designId) {
      const { data: design } = await getDesignById(body.designId)
      if (design?.generated_image_url) {
        designUrl = design.generated_image_url
      }
    }

    // ── 5. Send emails in parallel ───────────────────────────────────────────
    const [teamEmailResult, clientEmailResult] = await Promise.allSettled([
      // Team notification
      sendEmail({
        to: SNORA_TEAM_EMAIL,
        subject: `New SNORA Lead — ${lead.name} · ${lead.city} · ${lead.style}`,
        html: buildTeamEmailHtml(savedLead, designUrl),
        replyTo: lead.email,
      }),
      // Client confirmation
      sendEmail({
        to: lead.email,
        subject: `We got your request, ${lead.name.split(' ')[0]}! — SNORA Design`,
        html: buildClientEmailHtml(savedLead),
        replyTo: SNORA_TEAM_EMAIL,
      }),
    ])

    const teamEmailSent =
      teamEmailResult.status === 'fulfilled' && teamEmailResult.value.success
    const clientEmailSent =
      clientEmailResult.status === 'fulfilled' && clientEmailResult.value.success

    console.log(
      `[SNORA] Emails — team: ${teamEmailSent ? 'sent' : 'failed'}, ` +
      `client: ${clientEmailSent ? 'sent' : 'failed'}`
    )

    // ── 6. Return success ────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        leadId: savedLead.id,
        message: 'Consultation request received. Our team will contact you within 24 hours.',
        emails: {
          team_notified: teamEmailSent,
          client_confirmed: clientEmailSent,
        },
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    console.error('[SNORA] /api/lead unhandled error:', message)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

// ─── GET — health check ───────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    endpoint: 'SNORA /api/lead',
    status: 'active',
    email_service: 'Resend',
    required_env: [
      'RESEND_API_KEY',
      'SNORA_TEAM_EMAIL',
      'SNORA_FROM_EMAIL',
    ],
    sample_request: {
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+1 480 555 0123',
      city: 'Scottsdale',
      zip: '85251',
      budget: '$20k-40k',
      style: 'Desert Southwest',
      designId: 'uuid-from-generate-api',
    },
  })
}
