import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  BedDouble,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LogOut,
  Plus,
  ReceiptText,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import {
  addMonths,
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
} from 'date-fns'
import { cs } from 'date-fns/locale'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Apartment, Booking, Expense, InventoryItem } from './types'

type Page = 'calendar' | 'expenses' | 'inventory'
type Modal = 'booking' | 'expense' | 'inventory' | 'apartment' | null

const demoApartments: Apartment[] = [
  { id: 'apt-1', name: 'Apartmán 1', color: '#2f6f62' },
  { id: 'apt-2', name: 'Apartmán 2', color: '#bd7658' },
]

const today = format(new Date(), 'yyyy-MM-dd')
const money = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })

const bookingDemo: Booking[] = [
  { id: 'b1', apartment_id: 'apt-1', guest_name: 'Jan Novák', guest_count: 2, date_from: today, date_to: format(addMonths(new Date(), 0), 'yyyy-MM-dd'), source: 'Booking.com', note: null },
]

function nights(from: string, to: string) {
  return Math.max(1, Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000))
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [page, setPage] = useState<Page>('calendar')
  const [modal, setModal] = useState<Modal>(null)
  const [month, setMonth] = useState(startOfMonth(new Date()))
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
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
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
      supabase.from('bookings').select('id,apartment_id,guest_name,guest_count,date_from,date_to,source,note').order('date_from'),
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

  async function insert(table: string, payload: Record<string, unknown>) {
    if (!supabase) return false
    const { error: insertError } = await supabase.from(table).insert(payload)
    if (insertError) {
      setError(insertError.message)
      return false
    }
    await loadData()
    return true
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

  if (!authReady) return <div className="center-state">Načítám…</div>
  if (isSupabaseConfigured && !session) return <Login />

  const pageTitle = page === 'calendar' ? 'Pobyty a hosté' : page === 'expenses' ? 'Výdaje' : 'Zásoby'
  const pageSubtitle = page === 'calendar' ? 'Všechny rezervace na jednom místě' : page === 'expenses' ? 'Kontrola provozních nákladů' : 'Co je potřeba doplnit'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BedDouble size={22} /></span><div><strong>Moje apartmány</strong><small>Provozní přehled</small></div></div>
        <nav>
          <NavButton active={page === 'calendar'} onClick={() => setPage('calendar')} icon={<CalendarDays />} label="Kalendář" />
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
          <button className="primary" onClick={() => setModal(page === 'calendar' ? 'booking' : page === 'expenses' ? 'expense' : 'inventory')}><Plus size={18} /> Přidat {page === 'calendar' ? 'pobyt' : page === 'expenses' ? 'výdaj' : 'položku'}</button>
        </header>
        {error && <div className="error"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
        {loading ? <div className="center-state">Načítám data…</div> : (
          <>
            {page === 'calendar' && <CalendarPage month={month} setMonth={setMonth} apartments={apartments} bookings={bookings} remove={remove} />}
            {page === 'expenses' && <ExpensesPage expenses={expenses} apartments={apartments} remove={remove} />}
            {page === 'inventory' && <InventoryPage inventory={inventory} apartments={apartments} remove={remove} onAddApartment={() => setModal('apartment')} />}
          </>
        )}
      </main>
      {modal && <EntryModal kind={modal} apartments={apartments} onClose={() => setModal(null)} onInsert={insert} demoAdd={(kind, value) => {
        if (kind === 'booking') setBookings((v) => [...v, value as Booking])
        if (kind === 'expense') setExpenses((v) => [value as Expense, ...v])
        if (kind === 'inventory') setInventory((v) => [...v, value as InventoryItem])
        if (kind === 'apartment') setApartments((v) => [...v, value as Apartment])
      }} />}
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    setMessage('')
    const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    if (error) setMessage(error.message)
    else setSent(true)
  }
  return <div className="login-page"><div className="login-card"><span className="brand-mark large"><BedDouble size={28} /></span><p className="eyebrow">MOJE APARTMÁNY</p><h1>{sent ? 'Zkontrolujte e-mail' : 'Přihlášení'}</h1><p>{sent ? `Přihlašovací odkaz jsme poslali na ${email}.` : 'Přihlaste se bezpečným odkazem bez hesla.'}</p>{!sent && <form onSubmit={submit}><label>E-mail<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vas@email.cz" /></label><button className="primary full">Poslat přihlašovací odkaz</button></form>}{message && <p className="form-error">{message}</p>}</div></div>
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={active ? 'nav-active' : ''} onClick={onClick}>{icon}{label}</button>
}

function CalendarPage({ month, setMonth, apartments, bookings, remove }: { month: Date; setMonth: (d: Date) => void; apartments: Apartment[]; bookings: Booking[]; remove: (table: string, id: string) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const visible = bookings.filter((b) => parseISO(b.date_from) <= endOfMonth(month) && parseISO(b.date_to) >= startOfMonth(month))
  const guestTotal = visible.reduce((sum, b) => sum + b.guest_count, 0)
  return <div className="content-stack">
    <section className="stats-grid">
      <Stat icon={<CalendarDays />} label="Pobytů tento měsíc" value={String(visible.length)} />
      <Stat icon={<Users />} label="Hostů celkem" value={String(guestTotal)} />
      <Stat icon={<BedDouble />} label="Obsazených nocí" value={String(visible.reduce((sum, b) => sum + nights(b.date_from, b.date_to), 0))} />
    </section>
    <section className="panel calendar-panel">
      <div className="panel-head"><div><h2>{format(month, 'LLLL yyyy', { locale: cs })}</h2><div className="legend">{apartments.map((a) => <span key={a.id}><i style={{ background: a.color }} />{a.name}</span>)}</div></div><div className="month-controls"><button onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft /></button><button onClick={() => setMonth(startOfMonth(new Date()))}>Dnes</button><button onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></button></div></div>
      <div className="calendar weekdays">{['Po','Út','St','Čt','Pá','So','Ne'].map((d) => <strong key={d}>{d}</strong>)}</div>
      <div className="calendar">{days.map((day) => {
        const matches = bookings.filter((b) => parseISO(b.date_from) <= day && parseISO(b.date_to) >= day)
        return <div className={`day ${!isSameMonth(day, month) ? 'muted' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`} key={day.toISOString()}><span>{format(day, 'd')}</span>{matches.slice(0, 2).map((b) => { const apt = apartments.find((a) => a.id === b.apartment_id); return <div className="booking-chip" style={{ '--apt': apt?.color ?? '#667' } as React.CSSProperties} key={b.id} title={`${b.guest_name}, ${b.guest_count} hosté`}>{b.guest_name}</div>})}{matches.length > 2 && <small>+{matches.length - 2} další</small>}</div>
      })}</div>
    </section>
    <section className="panel"><div className="panel-head"><h2>Nadcházející pobyty</h2></div><div className="table-wrap"><table><thead><tr><th>Host</th><th>Apartmán</th><th>Termín</th><th>Hosté</th><th>Zdroj</th><th></th></tr></thead><tbody>{bookings.length ? bookings.map((b) => <tr key={b.id}><td><strong>{b.guest_name}</strong></td><td><ApartmentBadge apartment={apartments.find((a) => a.id === b.apartment_id)} /></td><td>{format(parseISO(b.date_from), 'd. M.')} – {format(parseISO(b.date_to), 'd. M. yyyy')}<small>{nights(b.date_from, b.date_to)} nocí</small></td><td>{b.guest_count}</td><td>{b.source}</td><td><button className="delete" onClick={() => remove('bookings', b.id)}><Trash2 size={16} /></button></td></tr>) : <EmptyRow columns={6} text="Zatím tu nejsou žádné pobyty." />}</tbody></table></div></section>
  </div>
}

function ExpensesPage({ expenses, apartments, remove }: { expenses: Expense[]; apartments: Apartment[]; remove: (table: string, id: string) => void }) {
  const current = expenses.filter((e) => isSameMonth(parseISO(e.spent_on), new Date()))
  const byCategory = useMemo(() => Object.entries(current.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + Number(e.amount) }), {})).sort((a, b) => b[1] - a[1]), [current])
  return <div className="content-stack"><section className="stats-grid"><Stat icon={<WalletCards />} label="Tento měsíc" value={money.format(current.reduce((s, e) => s + Number(e.amount), 0))} /><Stat icon={<ReceiptText />} label="Počet výdajů" value={String(current.length)} /><Stat icon={<BedDouble />} label="Nejvyšší kategorie" value={byCategory[0]?.[0] ?? '—'} /></section><section className="panel"><div className="panel-head"><div><h2>Přehled výdajů</h2><p>Seřazeno od nejnovějších</p></div></div><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Popis</th><th>Kategorie</th><th>Apartmán</th><th>Částka</th><th></th></tr></thead><tbody>{expenses.length ? expenses.map((e) => <tr key={e.id}><td>{format(parseISO(e.spent_on), 'd. M. yyyy')}</td><td><strong>{e.description}</strong>{e.note && <small>{e.note}</small>}</td><td><span className="category">{e.category}</span></td><td>{e.apartment_id ? <ApartmentBadge apartment={apartments.find((a) => a.id === e.apartment_id)} /> : 'Společné'}</td><td className="amount">{money.format(e.amount)}</td><td><button className="delete" onClick={() => remove('expenses', e.id)}><Trash2 size={16} /></button></td></tr>) : <EmptyRow columns={6} text="Zatím tu nejsou žádné výdaje." />}</tbody></table></div></section></div>
}

function InventoryPage({ inventory, apartments, remove, onAddApartment }: { inventory: InventoryItem[]; apartments: Apartment[]; remove: (table: string, id: string) => void; onAddApartment: () => void }) {
  const low = inventory.filter((i) => Number(i.quantity) <= Number(i.minimum_quantity))
  return <div className="content-stack"><section className="stats-grid"><Stat icon={<Boxes />} label="Položek celkem" value={String(inventory.length)} /><Stat icon={<CircleAlert />} label="Je potřeba doplnit" value={String(low.length)} warning={low.length > 0} /><Stat icon={<BedDouble />} label="Apartmány" value={String(apartments.length)} /></section><div className="section-title"><h2>Zásoby podle apartmánu</h2><button className="secondary" onClick={onAddApartment}><Plus size={17} /> Nový apartmán</button></div>{apartments.length ? apartments.map((apt) => { const items = inventory.filter((i) => i.apartment_id === apt.id); return <section className="panel" key={apt.id}><div className="panel-head"><div><ApartmentBadge apartment={apt} /><p>{items.length} položek</p></div></div><div className="inventory-grid">{items.length ? items.map((item) => { const isLow = Number(item.quantity) <= Number(item.minimum_quantity); return <article className={`stock-card ${isLow ? 'stock-low' : ''}`} key={item.id}><div><h3>{item.name}</h3><p>Minimum: {item.minimum_quantity} {item.unit}</p></div><div className="stock-value"><strong>{item.quantity}</strong><span>{item.unit}</span></div>{isLow && <span className="low-label">Doplnit</span>}<button className="delete" onClick={() => remove('inventory_items', item.id)}><Trash2 size={15} /></button></article>}) : <div className="empty-card">Pro tento apartmán zatím nejsou žádné položky.</div>}</div></section>}) : <section className="panel empty-card">Nejdřív přidejte apartmán.</section>}</div>
}

function EntryModal({ kind, apartments, onClose, onInsert, demoAdd }: { kind: Exclude<Modal, null>; apartments: Apartment[]; onClose: () => void; onInsert: (table: string, payload: Record<string, unknown>) => Promise<boolean>; demoAdd: (kind: string, value: unknown) => void }) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const titles = { booking: 'Nový pobyt', expense: 'Nový výdaj', inventory: 'Nová skladová položka', apartment: 'Nový apartmán' }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setFormError('')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    let table = ''
    let payload: Record<string, unknown> = {}
    if (kind === 'booking') { table = 'bookings'; payload = { ...data, guest_count: Number(data.guest_count), note: data.note || null } }
    if (kind === 'expense') { table = 'expenses'; payload = { ...data, apartment_id: data.apartment_id || null, amount: Number(data.amount), note: data.note || null } }
    if (kind === 'inventory') { table = 'inventory_items'; payload = { ...data, quantity: Number(data.quantity), minimum_quantity: Number(data.minimum_quantity) } }
    if (kind === 'apartment') { table = 'apartments'; payload = data }
    if (kind === 'booking' && String(data.date_to) < String(data.date_from)) { setFormError('Datum odjezdu musí být po příjezdu.'); setSaving(false); return }
    if (!supabase) {
      demoAdd(kind, { ...payload, id: crypto.randomUUID(), updated_at: new Date().toISOString() })
      onClose(); return
    }
    if (await onInsert(table, payload)) onClose()
    setSaving(false)
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className="modal"><div className="modal-head"><div><p className="eyebrow">PŘIDAT ZÁZNAM</p><h2>{titles[kind]}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={submit}>
    {kind === 'booking' && <><label>Jméno hosta<input required name="guest_name" autoFocus /></label><div className="form-row"><label>Apartmán<SelectApartment apartments={apartments} required /></label><label>Počet hostů<input required name="guest_count" type="number" min="1" defaultValue="2" /></label></div><div className="form-row"><label>Příjezd<input required name="date_from" type="date" defaultValue={today} /></label><label>Odjezd<input required name="date_to" type="date" defaultValue={today} /></label></div><label>Zdroj<select name="source" defaultValue="Booking.com"><option>Booking.com</option><option>Airbnb</option><option>Přímá rezervace</option><option>Jiné</option></select></label><label>Poznámka<textarea name="note" rows={2} /></label></>}
    {kind === 'expense' && <><label>Popis<input required name="description" autoFocus placeholder="Např. praní prádla" /></label><div className="form-row"><label>Částka (Kč)<input required name="amount" type="number" min="0" step="0.01" /></label><label>Datum<input required name="spent_on" type="date" defaultValue={today} /></label></div><div className="form-row"><label>Kategorie<select name="category"><option>Praní</option><option>Drogerie</option><option>Vybavení</option><option>Úklid</option><option>Opravy</option><option>Energie</option><option>Ostatní</option></select></label><label>Apartmán<SelectApartment apartments={apartments} allowShared /></label></div><label>Poznámka<textarea name="note" rows={2} /></label></>}
    {kind === 'inventory' && <><label>Název položky<input required name="name" autoFocus placeholder="Např. cukr" /></label><label>Apartmán<SelectApartment apartments={apartments} required /></label><div className="form-row"><label>Aktuální počet<input required name="quantity" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Jednotka<select name="unit"><option>ks</option><option>balení</option><option>lahví</option><option>kg</option><option>l</option></select></label></div><label>Upozornit při počtu<input required name="minimum_quantity" type="number" min="0" step="0.01" defaultValue="1" /></label></>}
    {kind === 'apartment' && <><label>Název apartmánu<input required name="name" autoFocus placeholder="Např. Apartmán 1" /></label><label>Barva v kalendáři<input required name="color" type="color" defaultValue="#2f6f62" /></label></>}
    {formError && <p className="form-error">{formError}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onClose}>Zrušit</button><button className="primary" disabled={saving || (apartments.length === 0 && kind !== 'apartment')}>{saving ? 'Ukládám…' : 'Uložit'}</button></div>
  </form></div></div>
}

function SelectApartment({ apartments, required, allowShared }: { apartments: Apartment[]; required?: boolean; allowShared?: boolean }) {
  return <select name="apartment_id" required={required} defaultValue="">{allowShared && <option value="">Společné</option>}{!allowShared && <option value="" disabled>Vyberte…</option>}{apartments.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>
}

function Stat({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) { return <article className={`stat ${warning ? 'warning' : ''}`}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article> }
function ApartmentBadge({ apartment }: { apartment?: Apartment }) { return apartment ? <span className="apartment-badge"><i style={{ background: apartment.color }} />{apartment.name}</span> : <span>Neznámý</span> }
function EmptyRow({ columns, text }: { columns: number; text: string }) { return <tr><td colSpan={columns} className="empty-row">{text}</td></tr> }

export default App
