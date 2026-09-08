import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:jamichalek@centrum.cz',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

function localParts(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

Deno.serve(async () => {
  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*').eq('enabled', true)
  if (error) return new Response(error.message, { status: 500 })
  let sent = 0

  for (const subscription of subscriptions || []) {
    const local = localParts(subscription.timezone || 'Europe/Prague')
    const notificationType = local.time === String(subscription.morning_time || '07:00').slice(0, 5) ? 'morning' : local.time === String(subscription.evening_time || '18:00').slice(0, 5) ? 'evening' : null
    if (!notificationType) continue
    const targetDate = notificationType === 'morning' ? local.date : nextDate(local.date)

    const { data: alreadySent } = await supabase.from('notification_log').select('id').eq('subscription_id', subscription.id).eq('notification_type', notificationType).eq('notification_date', targetDate).maybeSingle()
    if (alreadySent) continue

    const { data: bookings } = await supabase.from('bookings').select('id,guest_name,cleaning_completed_at,apartments(name)').eq('owner_id', subscription.owner_id).eq('date_from', targetDate)
    const pending = (bookings || []).filter((booking) => !booking.cleaning_completed_at)
    if (!pending.length) continue

    const names = pending.map((booking) => booking.apartments?.name || 'Apartmán').join(', ')
    const title = notificationType === 'morning' ? `Dnes čeká ${pending.length} úklidů` : `Zítra čeká ${pending.length} úklidů`
    const payload = JSON.stringify({ title, body: names, tag: `${notificationType}-${targetDate}`, url: 'https://jakubmich97-droid.github.io/apartmany/' })
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload)
      await supabase.from('notification_log').insert({ subscription_id: subscription.id, notification_type: notificationType, notification_date: targetDate })
      sent++
    } catch (pushError) {
      const statusCode = (pushError as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
    }
  }
  return Response.json({ ok: true, sent })
})
