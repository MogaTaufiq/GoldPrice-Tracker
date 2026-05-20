import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { GoldPrice } from '@/types'

/**
 * GET /api/backup
 * Quarterly cron: Export all gold_prices to CSV and send via Resend email.
 * Protected by CRON_SECRET header (via middleware).
 * 
 * Flow:
 * 1. Query all gold_prices from DB
 * 2. Convert to CSV format: date,source,price_sell,price_buy,usd_rate,usd_price
 * 3. Send email via Resend to BACKUP_EMAIL_TO
 * 4. Log result to fetch_logs table
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  let status: 'success' | 'error' = 'success'
  let message = ''

  try {
    // 1. Fetch all gold prices
    const supabase = createServerSupabaseClient()
    const { data: prices, error: queryError } = await supabase
      .from('gold_prices')
      .select('*')
      .order('date', { ascending: true })

    if (queryError) throw new Error(`DB query failed: ${queryError.message}`)

    if (!prices || prices.length === 0) {
      throw new Error('No prices found in database')
    }

    // 2. Convert to CSV
    const csv = convertToCSV(prices)
    const fileName = getBackupFileName()
    const subject = `💰 Gold Price Backup — ${fileName}`

    // 3. Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    const backupEmailTo = process.env.BACKUP_EMAIL_TO
    const backupEmailFrom = process.env.BACKUP_EMAIL_FROM

    if (!resendApiKey || !backupEmailTo || !backupEmailFrom) {
      throw new Error('Missing Resend or email config: RESEND_API_KEY, BACKUP_EMAIL_TO, or BACKUP_EMAIL_FROM')
    }

    const emailResult = await sendBackupEmail({
      apiKey: resendApiKey,
      to: backupEmailTo,
      from: backupEmailFrom,
      subject,
      fileName,
      csvContent: csv,
    })

    message = `✅ Backup sent successfully: ${fileName} (${prices.length} records)`

    // 4. Log to fetch_logs
    await supabase.from('fetch_logs').insert({
      source: 'all',
      status: 'success',
      message,
      duration_ms: Date.now() - startTime,
      triggered_by: 'cron',
    })

    return NextResponse.json({
      ok: true,
      message,
      recordCount: prices.length,
      fileName,
    })
  } catch (err) {
    const errorMsg = String(err)
    status = 'error'
    message = errorMsg

    // Log error to fetch_logs
    try {
      const supabase = createServerSupabaseClient()
      await supabase.from('fetch_logs').insert({
        source: 'all',
        status: 'error',
        message: errorMsg,
        duration_ms: Date.now() - startTime,
        triggered_by: 'cron',
      })
    } catch (logErr) {
      console.error('Failed to log backup error:', logErr)
    }

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}

/**
 * Convert GoldPrice array to CSV string with headers.
 * Format: date,source,price_sell,price_buy,usd_rate,usd_price
 */
function convertToCSV(prices: GoldPrice[]): string {
  const headers = ['date', 'source', 'price_sell', 'price_buy', 'usd_rate', 'usd_price', 'created_at', 'created_by']
  const rows = prices.map(p => [
    p.date,
    p.source,
    p.price_sell ?? '',
    p.price_buy ?? '',
    p.usd_rate ?? '',
    p.usd_price ?? '',
    p.created_at,
    p.created_by,
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape cells that contain commas or quotes
      if (String(cell).includes(',') || String(cell).includes('"')) {
        return `"${String(cell).replace(/"/g, '""')}"`
      }
      return cell
    }).join(',')),
  ].join('\n')

  return csvContent
}

/**
 * Generate backup filename: gold_backup_YYYY-MM.csv
 */
function getBackupFileName(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `gold_backup_${year}-${month}.csv`
}

/**
 * Send backup CSV via Resend email API.
 */
interface SendEmailOptions {
  apiKey: string
  to: string
  from: string
  subject: string
  fileName: string
  csvContent: string
}

async function sendBackupEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  // Encode CSV as base64 for attachment
  const csvBase64 = Buffer.from(opts.csvContent).toString('base64')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: generateEmailHTML(opts.fileName),
      attachments: [
        {
          filename: opts.fileName,
          content: csvBase64,
          content_type: 'text/csv',
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Resend API error: ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

/**
 * Generate HTML email body.
 */
function generateEmailHTML(fileName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d4af37;">💰 Gold Price Backup</h2>
      <p>Berikut adalah backup harga emas terbaru Anda.</p>
      
      <div style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin: 1.5rem 0;">
        <p style="margin: 0.5rem 0;">
          <strong>File:</strong> ${fileName}
        </p>
        <p style="margin: 0.5rem 0; font-size: 0.9rem; color: #666;">
          Format: date, source, price_sell, price_buy, usd_rate, usd_price, created_at, created_by
        </p>
      </div>
      
      <p style="color: #666; font-size: 0.9rem;">
        Backup ini berisi semua data harga emas dari ketiga sumber (Antam, International, Nasril).
      </p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
      
      <p style="color: #999; font-size: 0.8rem; margin: 0;">
        Email ini dikirim secara otomatis oleh Gold Price Tracker.
      </p>
    </div>
  `
}
