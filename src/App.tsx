import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  BedDouble,
  Building2,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Check,
  ClipboardCopy,
  LogOut,
  House,
  MapPin,
  Plus,
  Pencil,
  ReceiptText,
  ShoppingCart,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import {
  addMonths,
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { cs } from 'date-fns/locale'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Apartment, Booking, Expense, InventoryItem } from './types'

type Page = 'dashboard' | 'calendar' | 'apartments' | 'expenses' | 'inventory'
type Modal = 'booking' | 'expense' | 'inventory' | 'apartment' | null

const demoApartments: Apartment[] = [
  { id: 'apt-1', name: 'Apartmán 1', color: '#2f6f62' },
  { id: 'apt-2', name: 'Apartmán 2', color: '#bd7658' },
]

const today = format(new Date(), 'yyyy-MM-dd')
const money = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })

const bookingDemo: Booking[] = [
  { id: 'b1', apartment_id: 'apt-1', guest_name: 'Jan Novák', guest_count: 2, date_from: today, date_to: format(addMonths(new Date(), 0), 'yyyy-MM-dd'), source: 'Booking.com', note: null, cleaning_completed_at: null },
]

function nights(from: string, to: string) {
  return Math.max(1, Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000))
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [page, setPage] = useState<Page>('dashboard')
  const [modal, setModal] = useState<Modal>(null)
  const [dashboardDate, setDashboardDate] = useState(new Date())
  const [dashboardMonth, setDashboardMonth] = useState(startOfMonth(new Date()))
  const [calendarDate, setCalendarDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null)
  const [shoppingListOpen, setShoppingListOpen] = useState(false)
  const [apartments, setApartments] = useState<Apartment[]>(isSupabaseConfigured ? [] : demoApartments)
  const [bookings, setBookings] = useState<Booking[]>(isSupabaseConfigured ? [] : bookingDemo)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session || !isSupabaseConfigured) void loadData()
  }, [session])

  async function loadData() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [a, b, e, i] = await Promise.all([
      supabase.from('apartments').select('id,name,color').order('created_at'),
      (async () => {
        const result = await supabase.from('bookings').select('id,apartment_id,guest_name,guest_count,date_from,date_to,source,note,cleaning_completed_at').order('date_from')
        if (result.error?.code !== '42703') return result
        const fallback = await supabase.from('bookings').select('id,apartment_id,guest_name,guest_count,date_from,date_to,source,note').order('date_from')
        return { ...fallback, data: fallback.data?.map((booking) => ({ ...booking, cleaning_completed_at: null })) ?? null }
      })(),
      supabase.from('expenses').select('id,apartment_id,category,description,amount,spent_on,note').order('spent_on', { ascending: false }),
      supabase.from('inventory_items').select('id,apartment_id,name,quantity,unit,minimum_quantity,updated_at').order('name'),
    ])
    const firstError = [a.error, b.error, e.error, i.error].find(Boolean)
    if (firstError) setError(firstError.message)
    else {
      setApartments(a.data ?? [])
      setBookings(b.data ?? [])
      setExpenses(e.data ?? [])
      setInventory(i.data ?? [])
    }
    setLoading(false)
  }

  async function insert(table: string, payload: Record<string, unknown> | Record<string, unknown>[]): Promise<string | null> {
    if (!supabase) return null
    const { error: insertError } = await supabase.from(table).insert(payload)
    if (insertError) {
      setError(insertError.message)
      return insertError.message
    }
    await loadData()
    return null
  }

  async function remove(table: string, id: string) {
    if (!confirm('Opravdu chcete tuto položku smazat?')) return
    if (!supabase) {
      if (table === 'bookings') setBookings((v) => v.filter((x) => x.id !== id))
      if (table === 'expenses') setExpenses((v) => v.filter((x) => x.id !== id))
      if (table === 'inventory_items') setInventory((v) => v.filter((x) => x.id !== id))
      return
    }
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadData()
  }

  async function changeInventory(id: string, nextQuantity: number) {
    const quantity = Math.max(0, nextQuantity)
    if (!supabase) {
      setInventory((items) => items.map((item) => item.id === id ? { ...item, quantity, updated_at: new Date().toISOString() } : item))
      return
    }
    setInventory((items) => items.map((item) => item.id === id ? { ...item, quantity } : item))
    const { error: updateError } = await supabase.from('inventory_items').update({ quantity }).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      await loadData()
    }
  }

  async function update(table: string, id: string, payload: Record<string, unknown>): Promise<string | null> {
    if (!supabase) {
      if (table === 'bookings') setBookings((items) => items.map((item) => item.id === id ? { ...item, ...payload } as Booking : item))
      if (table === 'inventory_items') setInventory((items) => items.map((item) => item.id === id ? { ...item, ...payload, updated_at: new Date().toISOString() } as InventoryItem : item))
      return null
    }
    const { error: updateError } = await supabase.from(table).update(payload).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return updateError.message
    }
    await loadData()
    return null
  }

  async function completeCleaning(booking: Booking) {
    const completedAt = new Date().toISOString()
    setBookings((items) => items.map((item) => item.id === booking.id ? { ...item, cleaning_completed_at: completedAt } : item))
    if (!supabase) return
    const { error: updateError } = await supabase.from('bookings').update({ cleaning_completed_at: completedAt }).eq('id', booking.id)
    if (updateError) {
      setError(updateError.code === '42703' ? 'Nejdřív je potřeba spustit databázovou aktualizaci pro evidenci úklidů.' : updateError.message)
      await loadData()
    }
  }

  function closeModal() {
    setModal(null)
    setEditingBooking(null)
    setEditingInventory(null)
  }

  if (!authReady) return <div className="center-state">Načítám…</div>
  if (passwordRecovery && session) return <SetPassword onDone={() => setPasswordRecovery(false)} />
  if (isSupabaseConfigured && !session) return <Login />

  const pageTitle = page === 'dashboard' ? 'Denní přehled' : page === 'calendar' ? 'Pobyty a hosté' : page === 'apartments' ? 'Apartmány' : page === 'expenses' ? 'Výdaje' : 'Zásoby'
  const pageSubtitle = page === 'dashboard' ? 'Kde je potřeba připravit apartmán' : page === 'calendar' ? 'Všechny rezervace na jednom místě' : page === 'apartments' ? 'Přehled všech spravovaných ubytování' : page === 'expenses' ? 'Kontrola provozních nákladů' : 'Co je potřeba doplnit'
  const addKind: Exclude<Modal, null> = page === 'apartments' ? 'apartment' : page === 'expenses' ? 'expense' : page === 'inventory' ? 'inventory' : 'booking'
  const addLabel = page === 'apartments' ? 'apartmán' : page === 'expenses' ? 'výdaj' : page === 'inventory' ? 'položku' : 'pobyt'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BedDouble size={22} /></span><div><strong>Moje apartmány</strong><small>Provozní přehled</small></div></div>
        <nav>
          <NavButton active={page === 'dashboard'} onClick={() => setPage('dashboard')} icon={<House />} label="Dnes" />
          <NavButton active={page === 'calendar'} onClick={() => setPage('calendar')} icon={<CalendarDays />} label="Kalendář" />
          <NavButton active={page === 'apartments'} onClick={() => setPage('apartments')} icon={<Building2 />} label="Apartmány" />
          <NavButton active={page === 'expenses'} onClick={() => setPage('expenses')} icon={<ReceiptText />} label="Výdaje" />
          <NavButton active={page === 'inventory'} onClick={() => setPage('inventory')} icon={<Boxes />} label="Zásoby" />
        </nav>
        <div className="sidebar-foot">
          <span>{session?.user.email ?? 'Ukázkový režim'}</span>
          {session && <button className="icon-button" onClick={() => supabase?.auth.signOut()} title="Odhlásit"><LogOut size={18} /></button>}
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">SPRÁVA UBYTOVÁNÍ</p><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div>
          <button className="primary" onClick={() => { setEditingBooking(null); setEditingInventory(null); setModal(addKind) }}><Plus size={18} /> Přidat {addLabel}</button>
        </header>
        {error && <div className="error"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
        {loading ? <div className="center-state">Načítám data…</div> : (
          <>
            {page === 'dashboard' && <DashboardPage day={dashboardDate} setDay={setDashboardDate} month={dashboardMonth} setMonth={setDashboardMonth} apartments={apartments} bookings={bookings} onEdit={(booking) => { setEditingBooking(booking); setModal('booking') }} onComplete={completeCleaning} />}
            {page === 'calendar' && <CalendarPage week={calendarDate} setWeek={setCalendarDate} apartments={apartments} bookings={bookings} remove={remove} onEdit={(booking) => { setEditingBooking(booking); setModal('booking') }} />}
            {page === 'apartments' && <ApartmentsPage apartments={apartments} bookings={bookings} expenses={expenses} inventory={inventory} onAdd={() => setModal('apartment')} />}
            {page === 'expenses' && <ExpensesPage expenses={expenses} apartments={apartments} remove={remove} />}
            {page === 'inventory' && <InventoryPage inventory={inventory} apartments={apartments} remove={remove} changeQuantity={changeInventory} onEdit={(item) => { setEditingInventory(item); setModal('inventory') }} onAddApartment={() => setModal('apartment')} onShoppingList={() => setShoppingListOpen(true)} />}
          </>
        )}
      </main>
      {modal && <EntryModal kind={modal} apartments={apartments} editingBooking={editingBooking} editingInventory={editingInventory} onClose={closeModal} onInsert={insert} onUpdate={update} demoAdd={(kind, value) => {
        if (kind === 'booking') setBookings((v) => [...v, value as Booking])
        if (kind === 'expense') setExpenses((v) => [value as Expense, ...v])
        if (kind === 'inventory') setInventory((v) => [...v, value as InventoryItem])
        if (kind === 'apartment') setApartments((v) => [...v, value as Apartment])
      }} />}
      {shoppingListOpen && <ShoppingList inventory={inventory} apartments={apartments} onClose={() => setShoppingListOpen(false)} />}
    </div>
  )
}

function Login() {
  const cityAccounts: Record<string, string> = {
    'mwm-olomouc': 'jamichalek@centrum.cz',
  }
  const [city, setCity] = useState('mwm-olomouc')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    const { error } = await supabase!.auth.signInWithPassword({ email: cityAccounts[city], password })
    if (error) setMessage('Město nebo heslo není správné.')
    setLoading(false)
  }
  async function resetPassword() {
    setMessage('')
    setLoading(true)
    const { error } = await supabase!.auth.resetPasswordForEmail(cityAccounts[city], { redirectTo: window.location.origin + window.location.pathname })
    if (error) setMessage('Obnovovací odkaz se nepodařilo odeslat.')
    else setResetSent(true)
    setLoading(false)
  }
  return <div className="login-page"><div className="login-card"><span className="brand-mark large"><BedDouble size={28} /></span><p className="eyebrow">SPRÁVA UBYTOVÁNÍ</p><h1>Přihlášení</h1><p>{resetSent ? 'Odkaz pro nastavení hesla jsme poslali na e-mail správce.' : 'Vyberte město a zadejte přístupové heslo.'}</p>{!resetSent && <form onSubmit={submit}><label>Město<select value={city} onChange={(e) => setCity(e.target.value)}><option value="mwm-olomouc">MWM Olomouc</option></select></label><label>Heslo<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Zadejte heslo" autoComplete="current-password" /></label><button className="primary full" disabled={loading}>{loading ? 'Přihlašuji…' : 'Přihlásit'}</button><button type="button" className="text-button" disabled={loading} onClick={resetPassword}>Nastavit nebo obnovit heslo</button></form>}{message && <p className="form-error login-error">{message}</p>}</div></div>
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) setMessage(error.message)
    else onDone()
    setLoading(false)
  }
  return <div className="login-page"><div className="login-card"><span className="brand-mark large"><BedDouble size={28} /></span><p className="eyebrow">MWM OLOMOUC</p><h1>Nastavení hesla</h1><p>Zadejte nové přístupové heslo. Potom budete přihlášený.</p><form onSubmit={submit}><label>Nové heslo<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Alespoň 8 znaků" autoComplete="new-password" /></label><button className="primary full" disabled={loading}>{loading ? 'Ukládám…' : 'Nastavit heslo'}</button></form>{message && <p className="form-error login-error">{message}</p>}</div></div>
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={active ? 'nav-active' : ''} onClick={onClick}>{icon}{label}</button>
}

function DashboardPage({ day, setDay, month, setMonth, apartments, bookings, onEdit, onComplete }: { day: Date; setDay: (day: Date) => void; month: Date; setMonth: (month: Date) => void; apartments: Apartment[]; bookings: Booking[]; onEdit: (booking: Booking) => void; onComplete: (booking: Booking) => void }) {
  const dayKey = format(day, 'yyyy-MM-dd')
  const arrivals = bookings.filter((booking) => booking.date_from === dayKey && !booking.cleaning_completed_at)
  const tomorrowKey = format(addDays(day, 1), 'yyyy-MM-dd')
  const tomorrowCount = bookings.filter((booking) => booking.date_from === tomorrowKey).length
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const monthBookings = bookings.filter((booking) => isSameMonth(parseISO(booking.date_from), month))
  const completedCleanings = monthBookings.filter((booking) => Boolean(booking.cleaning_completed_at)).length
  const monthApartmentCount = new Set(monthBookings.map((booking) => booking.apartment_id)).size
  const isToday = isSameDay(day, new Date())
  return <div className="content-stack">
    <section className="day-switcher panel">
      <button onClick={() => setDay(addDays(day, -1))}><ChevronLeft size={19} /></button>
      <div><p>{isToday ? 'DNES' : format(day, 'EEEE', { locale: cs }).toUpperCase()}</p><h2>{format(day, 'd. MMMM yyyy', { locale: cs })}</h2></div>
      <button onClick={() => setDay(addDays(day, 1))}><ChevronRight size={19} /></button>
    </section>
    {!isToday && <button className="today-link" onClick={() => setDay(new Date())}>Vrátit se na dnešek</button>}
    <section className="stats-grid">
      <Stat icon={<House />} label="Apartmánů k úklidu" value={String(arrivals.length)} />
      <Stat icon={<Users />} label="Přijíždějících hostů" value={String(arrivals.reduce((sum, booking) => sum + booking.guest_count, 0))} />
      <Stat icon={<CalendarDays />} label="Příjezdy následující den" value={String(tomorrowCount)} />
    </section>
    <section className="panel cleaning-panel">
      <div className="panel-head"><div><p className="eyebrow">PLÁN ÚKLIDU</p><h2>{arrivals.length ? `Připravit ${arrivals.length} ${arrivals.length === 1 ? 'apartmán' : arrivals.length < 5 ? 'apartmány' : 'apartmánů'}` : 'Žádný úklid před příjezdem'}</h2></div></div>
      {arrivals.length ? <div className="cleaning-list">{arrivals.map((booking, index) => {
        const apartment = apartments.find((item) => item.id === booking.apartment_id)
        return <article className="cleaning-card" key={booking.id} style={{ '--apt': apartment?.color ?? '#667' } as React.CSSProperties}>
          <span className="cleaning-order">{index + 1}</span>
          <div className="cleaning-main"><div className="cleaning-title"><MapPin size={18} /><h3>{apartment?.name ?? 'Neznámý apartmán'}</h3></div><p>Připravit před příjezdem hosta <strong>{booking.guest_name}</strong></p>{booking.note && <small>{booking.note}</small>}</div>
          <div className="cleaning-meta"><span><Users size={15} /> {booking.guest_count} {booking.guest_count === 1 ? 'host' : 'hosté'}</span><span><CalendarDays size={15} /> {nights(booking.date_from, booking.date_to)} nocí</span><span>{booking.source}</span></div>
          <div className="cleaning-actions"><button className="secondary cleaning-edit" onClick={() => onEdit(booking)}><Pencil size={15} /> Upravit</button><button className="primary cleaning-done" onClick={() => onComplete(booking)}><Check size={16} /> Hotovo</button></div>
        </article>
      })}</div> : <div className="empty-cleaning"><span className="brand-mark large"><House size={27} /></span><h3>Pro tento den nic nezačíná</h3><p>V žádném apartmánu není naplánovaný nový příjezd.</p></div>}
    </section>
    <section className="monthly-overview">
      <div className="month-overview-head panel">
        <button onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft size={19} /></button>
        <div><p>MĚSÍČNÍ PŘEHLED</p><h2>{format(month, 'LLLL yyyy', { locale: cs })}</h2></div>
        <button onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={19} /></button>
      </div>
      {!isSameMonth(month, new Date()) && <button className="today-link" onClick={() => setMonth(startOfMonth(new Date()))}>Aktuální měsíc</button>}
      <div className="stats-grid dashboard-stats">
        <Stat icon={<CalendarDays />} label="Naplánovaných úklidů" value={String(monthBookings.length)} />
        <Stat icon={<House />} label="Provedených úklidů" value={String(completedCleanings)} />
        <Stat icon={<Users />} label="Hostů v měsíci" value={String(monthBookings.reduce((sum, booking) => sum + booking.guest_count, 0))} />
        <Stat icon={<Building2 />} label="Využitých apartmánů" value={String(monthApartmentCount)} />
      </div>
    </section>
  </div>
}

function CalendarPage({ week, setWeek, apartments, bookings, remove, onEdit }: { week: Date; setWeek: (d: Date) => void; apartments: Apartment[]; bookings: Booking[]; remove: (table: string, id: string) => void; onEdit: (booking: Booking) => void }) {
  const weekStart = startOfWeek(week, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const visible = bookings.filter((b) => parseISO(b.date_from) <= weekEnd && parseISO(b.date_to) >= weekStart)
  const guestTotal = visible.reduce((sum, b) => sum + b.guest_count, 0)
  return <div className="content-stack">
    <section className="stats-grid">
      <Stat icon={<CalendarDays />} label="Pobytů tento týden" value={String(visible.length)} />
      <Stat icon={<Users />} label="Hostů celkem" value={String(guestTotal)} />
      <Stat icon={<BedDouble />} label="Obsazených nocí" value={String(visible.reduce((sum, b) => sum + nights(b.date_from, b.date_to), 0))} />
    </section>
    <section className="panel calendar-panel">
      <div className="panel-head"><div><p className="week-kicker">TÝDENNÍ PŘEHLED</p><h2>{format(weekStart, 'd. M.', { locale: cs })} – {format(weekEnd, 'd. M. yyyy', { locale: cs })}</h2><div className="legend">{apartments.map((a) => <span key={a.id}><i style={{ background: a.color }} />{a.name}</span>)}</div></div><div className="month-controls"><button onClick={() => setWeek(subWeeks(weekStart, 1))}><ChevronLeft /></button><button onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Dnes</button><button onClick={() => setWeek(addWeeks(weekStart, 1))}><ChevronRight /></button></div></div>
      <div className="week-calendar">{days.map((day) => {
        const matches = bookings.filter((b) => parseISO(b.date_from) <= day && parseISO(b.date_to) >= day)
        return <div className={`week-day ${isSameDay(day, new Date()) ? 'today' : ''}`} key={day.toISOString()}><div className="week-day-head"><span>{format(day, 'EEEE', { locale: cs })}</span><strong>{format(day, 'd. M.')}</strong></div><div className="week-day-bookings">{matches.length ? matches.map((b) => { const apt = apartments.find((a) => a.id === b.apartment_id); return <button className="booking-chip" onClick={() => onEdit(b)} style={{ '--apt': apt?.color ?? '#667' } as React.CSSProperties} key={b.id} title="Kliknutím upravit"><strong>{b.guest_name}</strong><small>{apt?.name ?? 'Apartmán'} · {b.guest_count} {b.guest_count === 1 ? 'host' : 'hosté'}</small></button>}) : <span className="no-bookings">Volno</span>}</div></div>
      })}</div>
    </section>
    <section className="panel"><div className="panel-head"><h2>Všechny pobyty</h2></div><div className="table-wrap desktop-bookings"><table><thead><tr><th>Host</th><th>Apartmán</th><th>Termín</th><th>Hosté</th><th>Zdroj</th><th></th></tr></thead><tbody>{bookings.length ? bookings.map((b) => <tr key={b.id}><td><strong>{b.guest_name}</strong></td><td><ApartmentBadge apartment={apartments.find((a) => a.id === b.apartment_id)} /></td><td>{format(parseISO(b.date_from), 'd. M.')} – {format(parseISO(b.date_to), 'd. M. yyyy')}<small>{nights(b.date_from, b.date_to)} nocí</small></td><td>{b.guest_count}</td><td>{b.source}</td><td><div className="row-actions"><button className="edit" onClick={() => onEdit(b)} title="Upravit"><Pencil size={16} /></button><button className="delete" onClick={() => remove('bookings', b.id)} title="Smazat"><Trash2 size={16} /></button></div></td></tr>) : <EmptyRow columns={6} text="Zatím tu nejsou žádné pobyty." />}</tbody></table></div><div className="mobile-bookings">{bookings.length ? bookings.map((b) => <article key={b.id}><div className="mobile-booking-top"><div><strong>{b.guest_name}</strong><ApartmentBadge apartment={apartments.find((a) => a.id === b.apartment_id)} /></div><div className="row-actions"><button className="edit" onClick={() => onEdit(b)}><Pencil size={16} /></button><button className="delete" onClick={() => remove('bookings', b.id)}><Trash2 size={16} /></button></div></div><p>{format(parseISO(b.date_from), 'd. M.')} – {format(parseISO(b.date_to), 'd. M. yyyy')} · {nights(b.date_from, b.date_to)} nocí</p><small>{b.guest_count} {b.guest_count === 1 ? 'host' : 'hosté'} · {b.source}</small></article>) : <div className="empty-card">Zatím tu nejsou žádné pobyty.</div>}</div></section>
  </div>
}

function ExpensesPage({ expenses, apartments, remove }: { expenses: Expense[]; apartments: Apartment[]; remove: (table: string, id: string) => void }) {
  const current = expenses.filter((e) => isSameMonth(parseISO(e.spent_on), new Date()))
  const byCategory = useMemo(() => Object.entries(current.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + Number(e.amount) }), {})).sort((a, b) => b[1] - a[1]), [current])
  return <div className="content-stack"><section className="stats-grid"><Stat icon={<WalletCards />} label="Tento měsíc" value={money.format(current.reduce((s, e) => s + Number(e.amount), 0))} /><Stat icon={<ReceiptText />} label="Počet výdajů" value={String(current.length)} /><Stat icon={<BedDouble />} label="Nejvyšší kategorie" value={byCategory[0]?.[0] ?? '—'} /></section><section className="panel"><div className="panel-head"><div><h2>Přehled výdajů</h2><p>Seřazeno od nejnovějších</p></div></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Popis</th><th>Kategorie</th><th>Apartmán</th><th>Částka</th><th></th></tr></thead><tbody>{expenses.length ? expenses.map((e) => <tr key={e.id}><td>{format(parseISO(e.spent_on), 'd. M. yyyy')}</td><td><strong>{e.description}</strong>{e.note && <small>{e.note}</small>}</td><td><span className="category">{e.category}</span></td><td>{e.apartment_id ? <ApartmentBadge apartment={apartments.find((a) => a.id === e.apartment_id)} /> : 'Společné'}</td><td className="amount">{money.format(e.amount)}</td><td><button className="delete" onClick={() => remove('expenses', e.id)}><Trash2 size={16} /></button></td></tr>) : <EmptyRow columns={6} text="Zatím tu nejsou žádné výdaje." />}</tbody></table></div></section></div>
}

function ApartmentsPage({ apartments, bookings, expenses, inventory, onAdd }: { apartments: Apartment[]; bookings: Booking[]; expenses: Expense[]; inventory: InventoryItem[]; onAdd: () => void }) {
  const now = new Date()
  return <div className="content-stack">
    <section className="stats-grid">
      <Stat icon={<Building2 />} label="Apartmánů celkem" value={String(apartments.length)} />
      <Stat icon={<CalendarDays />} label="Aktivních a budoucích pobytů" value={String(bookings.filter((b) => parseISO(b.date_to) >= now).length)} />
      <Stat icon={<CircleAlert />} label="Položek k doplnění" value={String(inventory.filter((i) => Number(i.quantity) <= Number(i.minimum_quantity)).length)} />
    </section>
    <div className="section-title"><h2>Moje apartmány</h2><button className="secondary" onClick={onAdd}><Plus size={17} /> Nový apartmán</button></div>
    {apartments.length ? <section className="apartment-grid">{apartments.map((apt) => {
      const aptBookings = bookings.filter((b) => b.apartment_id === apt.id)
      const aptExpenses = expenses.filter((e) => e.apartment_id === apt.id && isSameMonth(parseISO(e.spent_on), now))
      const aptInventory = inventory.filter((i) => i.apartment_id === apt.id)
      const low = aptInventory.filter((i) => Number(i.quantity) <= Number(i.minimum_quantity)).length
      return <article className="apartment-card" key={apt.id} style={{ '--apt': apt.color } as React.CSSProperties}>
        <div className="apartment-card-head"><span><Building2 size={22} /></span><div><h3>{apt.name}</h3><p>{aptBookings.filter((b) => parseISO(b.date_to) >= now).length} budoucích pobytů</p></div></div>
        <dl><div><dt>Zásoby</dt><dd>{aptInventory.length} položek</dd></div><div><dt>K doplnění</dt><dd className={low ? 'danger-text' : ''}>{low}</dd></div><div><dt>Výdaje tento měsíc</dt><dd>{money.format(aptExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}</dd></div></dl>
      </article>
    })}</section> : <section className="panel empty-apartments"><span className="brand-mark large"><Building2 size={27} /></span><h2>Zatím tu není žádný apartmán</h2><p>Přidejte první apartmán. Ihned se objeví ve všech formulářích.</p><button className="primary" onClick={onAdd}><Plus size={18} /> Přidat apartmán</button></section>}
  </div>
}

function InventoryPage({ inventory, apartments, remove, changeQuantity, onEdit, onAddApartment, onShoppingList }: { inventory: InventoryItem[]; apartments: Apartment[]; remove: (table: string, id: string) => void; changeQuantity: (id: string, quantity: number) => void; onEdit: (item: InventoryItem) => void; onAddApartment: () => void; onShoppingList: () => void }) {
  const low = inventory.filter((i) => Number(i.quantity) <= Number(i.minimum_quantity))
  return <div className="content-stack"><section className="stats-grid"><Stat icon={<Boxes />} label="Položek celkem" value={String(inventory.length)} /><Stat icon={<CircleAlert />} label="Je potřeba doplnit" value={String(low.length)} warning={low.length > 0} /><Stat icon={<BedDouble />} label="Apartmány" value={String(apartments.length)} /></section><div className="section-title"><h2>Zásoby podle apartmánu</h2><div className="section-title-actions"><button className="primary" onClick={onShoppingList}><ShoppingCart size={17} /> Nákupní seznam <span className="button-count">{low.length}</span></button><button className="secondary" onClick={onAddApartment}><Plus size={17} /> Nový apartmán</button></div></div>{apartments.length ? apartments.map((apt) => { const items = inventory.filter((i) => i.apartment_id === apt.id); return <section className="panel" key={apt.id}><div className="panel-head"><div><ApartmentBadge apartment={apt} /><p>{items.length} položek</p></div></div><div className="inventory-grid">{items.length ? items.map((item) => { const isLow = Number(item.quantity) <= Number(item.minimum_quantity); return <article className={`stock-card ${isLow ? 'stock-low' : ''}`} key={item.id}><div><h3>{item.name}</h3><p>Minimum: {item.minimum_quantity} {item.unit}</p></div><div className="stock-value"><strong>{item.quantity}</strong><span>{item.unit}</span></div><div className="stock-footer">{isLow ? <span className="low-label">Doplnit</span> : <span />}<div className="stock-actions"><div className="quantity-controls"><button aria-label="Odebrat jeden kus" onClick={() => changeQuantity(item.id, Number(item.quantity) - 1)}>−</button><button aria-label="Přidat jeden kus" onClick={() => changeQuantity(item.id, Number(item.quantity) + 1)}>+</button></div><button className="stock-edit" aria-label={`Upravit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={17} /></button><button className="stock-delete" aria-label={`Smazat ${item.name}`} onClick={() => remove('inventory_items', item.id)}><Trash2 size={17} /></button></div></div></article>}) : <div className="empty-card">Pro tento apartmán zatím nejsou žádné položky.</div>}</div></section>}) : <section className="panel empty-card">Nejdřív přidejte apartmán.</section>}</div>
}

function ShoppingList({ inventory, apartments, onClose }: { inventory: InventoryItem[]; apartments: Apartment[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const missing = inventory.filter((item) => Number(item.quantity) <= Number(item.minimum_quantity))
  const shoppingText = ['Nákupní seznam', ...apartments.flatMap((apartment) => {
    const items = missing.filter((item) => item.apartment_id === apartment.id)
    if (!items.length) return []
    return ['', apartment.name, ...items.map((item) => `• ${item.name}: ${Math.max(1, Math.ceil(Number(item.minimum_quantity) - Number(item.quantity)))} ${item.unit} (nyní ${item.quantity})`)]
  })].join('\n')
  async function shareList() {
    try {
      if (navigator.share) await navigator.share({ title: 'Nákupní seznam', text: shoppingText })
      else await navigator.clipboard.writeText(shoppingText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Uživatel může systémové sdílení zavřít bez změny.
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal shopping-modal"><div className="modal-head"><div><p className="eyebrow">ZÁSOBY</p><h2>Nákupní seznam</h2></div><button className="icon-button" onClick={onClose}><X /></button></div>{missing.length ? <div className="shopping-content">{apartments.map((apartment) => { const items = missing.filter((item) => item.apartment_id === apartment.id); if (!items.length) return null; return <section className="shopping-apartment" key={apartment.id}><ApartmentBadge apartment={apartment} /><div>{items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>Aktuálně {item.quantity} {item.unit}, minimum {item.minimum_quantity}</small></div><span>koupit <strong>{Math.max(1, Math.ceil(Number(item.minimum_quantity) - Number(item.quantity)))}</strong> {item.unit}</span></article>)}</div></section>})}<button className="primary full" onClick={shareList}>{copied ? <Check size={18} /> : <ClipboardCopy size={18} />}{copied ? 'Zkopírováno' : 'Sdílet nebo zkopírovat'}</button></div> : <div className="empty-cleaning"><span className="brand-mark large"><Check size={27} /></span><h3>Není potřeba nic dokupovat</h3><p>Všechny zásoby jsou nad nastaveným minimem.</p></div>}</div></div>
}

function EntryModal({ kind, apartments, editingBooking, editingInventory, onClose, onInsert, onUpdate, demoAdd }: { kind: Exclude<Modal, null>; apartments: Apartment[]; editingBooking: Booking | null; editingInventory: InventoryItem | null; onClose: () => void; onInsert: (table: string, payload: Record<string, unknown> | Record<string, unknown>[]) => Promise<string | null>; onUpdate: (table: string, id: string, payload: Record<string, unknown>) => Promise<string | null>; demoAdd: (kind: string, value: unknown) => void }) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const titles = { booking: editingBooking ? 'Upravit pobyt' : 'Nový pobyt', expense: 'Nový výdaj', inventory: editingInventory ? 'Upravit skladovou položku' : 'Nová skladová položka', apartment: 'Nový apartmán' }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError('')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    let table = ''
    let payload: Record<string, unknown> | Record<string, unknown>[] = {}
    if (kind === 'booking') { table = 'bookings'; payload = { ...data, guest_count: Number(data.guest_count), note: data.note || null } }
    if (kind === 'expense') { table = 'expenses'; payload = { ...data, apartment_id: data.apartment_id || null, amount: Number(data.amount), note: data.note || null } }
    if (kind === 'inventory') {
      table = 'inventory_items'
      const inventoryPayload = { ...data, quantity: Number(data.quantity), minimum_quantity: Number(data.minimum_quantity) }
      if (data.apartment_id === '__all__' && !editingInventory) payload = apartments.map((apartment) => ({ ...inventoryPayload, apartment_id: apartment.id }))
      else payload = inventoryPayload
    }
    if (kind === 'apartment') { table = 'apartments'; payload = data }
    if (kind === 'booking' && String(data.date_to) < String(data.date_from)) { setFormError('Datum odjezdu musí být po příjezdu.'); setSaving(false); return }
    if (!supabase) {
      if (Array.isArray(payload)) payload.forEach((item) => demoAdd(kind, { ...item, id: crypto.randomUUID(), updated_at: new Date().toISOString() }))
      else demoAdd(kind, { ...payload, id: crypto.randomUUID(), updated_at: new Date().toISOString() })
      onClose(); return
    }
    const saveError = editingBooking && kind === 'booking' ? await onUpdate(table, editingBooking.id, payload as Record<string, unknown>) : editingInventory && kind === 'inventory' ? await onUpdate(table, editingInventory.id, payload as Record<string, unknown>) : await onInsert(table, payload)
    if (!saveError) onClose()
    else setFormError(saveError)
    setSaving(false)
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><p className="eyebrow">PŘIDAT ZÁZNAM</p><h2>{titles[kind]}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={submit}>
    {kind === 'booking' && <><label>Jméno hosta<input required name="guest_name" autoFocus defaultValue={editingBooking?.guest_name ?? ''} /></label><div className="form-row"><label>Apartmán<SelectApartment apartments={apartments} required value={editingBooking?.apartment_id} /></label><label>Počet hostů<input required name="guest_count" type="number" min="1" defaultValue={editingBooking?.guest_count ?? 2} /></label></div><div className="form-row"><label>Příjezd<input required name="date_from" type="date" defaultValue={editingBooking?.date_from ?? today} /></label><label>Odjezd<input required name="date_to" type="date" defaultValue={editingBooking?.date_to ?? today} /></label></div><label>Zdroj<select name="source" defaultValue={editingBooking?.source ?? 'Booking.com'}><option>Booking.com</option><option>Airbnb</option><option>Přímá rezervace</option><option>Jiné</option></select></label><label>Poznámka<textarea name="note" rows={2} defaultValue={editingBooking?.note ?? ''} /></label></>}
    {kind === 'expense' && <><label>Popis<input required name="description" autoFocus placeholder="Např. praní prádla" /></label><div className="form-row"><label>Částka (Kč)<input required name="amount" type="number" min="0" step="0.01" /></label><label>Datum<input required name="spent_on" type="date" defaultValue={today} /></label></div><div className="form-row"><label>Kategorie<select name="category"><option>Praní</option><option>Drogerie</option><option>Vybavení</option><option>Úklid</option><option>Opravy</option><option>Energie</option><option>Ostatní</option></select></label><label>Apartmán<SelectApartment apartments={apartments} allowShared /></label></div><label>Poznámka<textarea name="note" rows={2} /></label></>}
    {kind === 'inventory' && <>{apartments.length === 0 ? <div className="form-notice"><CircleAlert size={18} />Nejdřív přidejte alespoň jeden apartmán v sekci Apartmány.</div> : <><label>Název položky<input required name="name" autoFocus placeholder="Např. cukr" defaultValue={editingInventory?.name ?? ''} /></label><label>Apartmán<SelectApartment apartments={apartments} required value={editingInventory?.apartment_id} allowAll={!editingInventory} /></label><div className="form-row"><label>Aktuální počet<input required name="quantity" type="number" min="0" step="0.01" defaultValue={editingInventory?.quantity ?? 0} /></label><label>Jednotka<select name="unit" defaultValue={editingInventory?.unit ?? 'ks'}><option>ks</option><option>balení</option><option>lahví</option><option>kg</option><option>l</option></select></label></div><label>Upozornit při počtu<input required name="minimum_quantity" type="number" min="0" step="0.01" defaultValue={editingInventory?.minimum_quantity ?? 1} /></label></>}</>}
    {kind === 'apartment' && <><label>Název apartmánu<input required name="name" autoFocus placeholder="Např. Apartmán 1" /></label><label>Barva v kalendáři<input required name="color" type="color" defaultValue="#2f6f62" /></label></>}
    {formError && <p className="form-error">{formError}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Zrušit</button><button className="primary" disabled={saving || ((kind === 'booking' || kind === 'inventory') && apartments.length === 0)}>{saving ? 'Ukládám…' : (editingBooking && kind === 'booking') || (editingInventory && kind === 'inventory') ? 'Uložit změny' : 'Uložit'}</button></div>
  </form></div></div>
}

function SelectApartment({ apartments, required, allowShared, allowAll, value }: { apartments: Apartment[]; required?: boolean; allowShared?: boolean; allowAll?: boolean; value?: string }) {
  return <select name="apartment_id" required={required} defaultValue={value ?? ''}>{allowShared && <option value="">Společné</option>}{!allowShared && <option value="" disabled>Vyberte…</option>}{allowAll && <option value="__all__">Všechny apartmány</option>}{apartments.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>
}

function Stat({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) { return <article className={`stat ${warning ? 'warning' : ''}`}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article> }
function ApartmentBadge({ apartment }: { apartment?: Apartment }) { return apartment ? <span className="apartment-badge"><i style={{ background: apartment.color }} />{apartment.name}</span> : <span>Neznámý</span> }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns} className="empty-row">{text}</td></tr> }

export default App
