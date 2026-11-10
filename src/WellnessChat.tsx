import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, ShieldCheck, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function WellnessChat({ token }: { token: string }) {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [consent, setConsent] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/chat/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Could not check chat availability.'); setAvailable(Boolean(data.available)) })
      .catch(() => setAvailable(false))
  }, [token])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])

  async function send(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || !consent || !available || busy) return
    const next: Message[] = [...messages, { role: 'user' as const, content }].slice(-10)
    setMessages(next); setInput(''); setError(''); setBusy(true)
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: next, consent: true }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'The guide could not reply. Please try again.')
      setMessages((current) => [...current, { role: 'assistant' as const, content: String(data.reply ?? '') }].slice(-12))
    } catch (e) { setError(e instanceof Error ? e.message : 'The guide could not reply. Please try again.') }
    finally { setBusy(false) }
  }

  return <section className="page chat-page">
    <div className="eyebrow"><i/> BLOOM WELLNESS GUIDE</div><h1>Ask for a small next step.</h1>
    <p className="page-intro">Chat about everyday wellness habits or how to use Bloom. This guide cannot diagnose diseases or predict your future health.</p>
    <div className="chat-privacy"><ShieldCheck size={17}/><span>Your chat stays in this page and is not saved to your Bloom account. If you choose to chat, your messages are sent to OpenAI to create replies; the provider may retain API content for safety monitoring under its data policies. Avoid sharing names or other identifying details. Demo limit: 10 messages per account per hour.</span></div>
    {available === false && <div className="chat-config"><b>AI chat is not connected yet.</b><span>The app owner must add an <code>OPENAI_API_KEY</code> in Render. Keep the key private and only add it if you have enabled API billing.</span></div>}
    {available === null && <p className="chat-status">Checking chat availability…</p>}
    <div className="chat-box" aria-live="polite">
      {messages.length === 0 ? <div className="chat-welcome"><span><Bot size={20}/></span><h2>Hi, I’m Bloom’s wellness guide.</h2><p>What small wellness question can I help you think through?</p></div> : <div className="chat-messages">{messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${index}-${message.role}`}><b>{message.role === 'user' ? 'You' : 'Bloom guide'}</b><p>{message.content}</p></article>)}{busy && <article className="chat-message assistant"><b>Bloom guide</b><p className="chat-typing">Thinking…</p></article>}<div ref={endRef}/></div>}
      {error && <div className="error chat-error">{error}</div>}
      <form className="chat-form" onSubmit={send}><label htmlFor="wellness-chat-input">Your message</label><div><textarea id="wellness-chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="For example: help me plan a short wind-down routine" maxLength={1200} rows={2} disabled={!available || busy}/><button className="primary" disabled={!available || busy || !consent || !input.trim()} aria-label="Send message">{busy ? '…' : <ArrowUp size={17}/>}</button></div><small>{input.length}/1200 characters</small></form>
    </div>
    <div className="chat-controls"><label className="chat-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={!available}/>I understand my messages are sent to OpenAI for replies and are not saved in my Bloom account.</label><button className="subtle" disabled={!messages.length || busy} onClick={() => { setMessages([]); setError('') }}><Trash2 size={14}/> Clear chat</button></div>
    <div className="info-box"><ShieldCheck size={17}/><span><b>Not medical care.</b> The guide may be wrong. It does not interpret your stored check-ins, diagnose, recommend medicines, or replace a qualified health professional. For severe or sudden symptoms, contact local emergency services.</span></div>
  </section>
}
