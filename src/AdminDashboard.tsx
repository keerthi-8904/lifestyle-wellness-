import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarDays, RefreshCw, ShieldCheck, Users } from 'lucide-react'

type AdminUser = { id: number; name: string; email: string; created_at: string; checkin_count: number }
type AdminCheckin = { id: number; date: string; sleep: number; activity: number; stress: number; meals: number }

async function adminApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`/api/admin${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not load owner data.')
  return body as T
}

export default function AdminDashboard({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [checkins, setCheckins] = useState<AdminCheckin[]>([])
  const [checkinTotal, setCheckinTotal] = useState(0)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  async function loadUsers(append = false) {
    setBusy(true); setError('')
    try {
      const offset = append ? users.length : 0
      const result = await adminApi<{ total: number; users: AdminUser[] }>(`/users?limit=50&offset=${offset}`, token)
      setUsers((current) => append ? [...current, ...result.users] : result.users)
      setTotal(result.total)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load owner data.') }
    finally { setBusy(false) }
  }

  async function showCheckins(person: AdminUser) {
    setSelected(person); setCheckins([]); setError(''); setBusy(true)
    try {
      const result = await adminApi<{ total: number; checkins: AdminCheckin[] }>(`/users/${person.id}/checkins?limit=100&offset=0`, token)
      setCheckins(result.checkins); setCheckinTotal(result.total)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load check-ins.') }
    finally { setBusy(false) }
  }

  async function loadMoreCheckins() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const result = await adminApi<{ checkins: AdminCheckin[] }>(`/users/${selected.id}/checkins?limit=100&offset=${checkins.length}`, token)
      setCheckins((current) => [...current, ...result.checkins])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load older check-ins.') }
    finally { setBusy(false) }
  }

  useEffect(() => { void loadUsers() }, [token])
  return <section className="page admin-page">
    <div className="eyebrow"><i/> PRIVATE OWNER AREA</div>
    <div className="admin-heading"><div><h1>Account overview</h1><p className="page-intro">Review registered accounts and their saved daily check-ins.</p></div><button className="subtle" onClick={() => { setSelected(null); void loadUsers() }}><RefreshCw size={14}/> Refresh</button></div>
    <div className="admin-privacy"><ShieldCheck size={18}/><span>Owner access only. Treat names, email addresses, and wellness check-ins as private. Passwords are never shown here.</span></div>
    {error && <div className="error admin-error">{error}</div>}
    <div className="admin-summary"><Users size={18}/><b>{total}</b><span>registered {total === 1 ? 'account' : 'accounts'}</span></div>
    {!selected ? <><div className="admin-user-list">{users.map((person) => <article className="admin-user-card" key={person.id}><div className="admin-avatar">{person.name.slice(0, 1).toUpperCase()}</div><div className="admin-user-copy"><b>{person.name}</b><span>{person.email}</span><small>Joined {new Date(person.created_at).toLocaleDateString()} · {person.checkin_count} check-ins</small></div><button className="subtle" onClick={() => void showCheckins(person)}>View check-ins <ArrowDown size={14}/></button></article>)}</div>{busy && <p className="admin-status">Loading accounts…</p>}{!busy && users.length === 0 && <p className="admin-status">No accounts found.</p>}{users.length < total && <button className="subtle admin-more" disabled={busy} onClick={() => void loadUsers(true)}>Load more accounts</button>}</>
      : <><button className="link admin-back" onClick={() => { setSelected(null); setCheckins([]); setError('') }}><ArrowUp size={14}/> Back to all accounts</button><article className="admin-detail"><div className="admin-user-copy"><b>{selected.name}</b><span>{selected.email}</span><small>Joined {new Date(selected.created_at).toLocaleDateString()}</small></div><h2><CalendarDays size={17}/> Daily check-ins <small>{checkinTotal} total</small></h2>{checkins.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Sleep</th><th>Active days</th><th>Stress</th><th>Meals</th></tr></thead><tbody>{checkins.map((entry) => <tr key={entry.id}><td>{new Date(`${entry.date}T12:00:00`).toLocaleDateString()}</td><td>{entry.sleep} hrs</td><td>{entry.activity}</td><td>{entry.stress} / 5</td><td>{entry.meals} / 5</td></tr>)}</tbody></table></div> : !busy && <p className="admin-status">No check-ins for this account yet.</p>}{busy && <p className="admin-status">Loading check-ins…</p>}{checkins.length < checkinTotal && <button className="subtle admin-more" disabled={busy} onClick={() => void loadMoreCheckins()}>Load older check-ins</button>}</article></>}
  </section>
}
