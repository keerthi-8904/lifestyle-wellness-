import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Search, ShieldCheck } from 'lucide-react'

const routines = ['Student', 'Office / employee', 'Teacher', 'Shift worker', 'Traveler', 'Home / caregiver', 'Smoker', 'Alcohol reduction', 'Recovery support', 'Another routine']
const focusChoices = ['Sleep routine', 'Stress breaks', 'More movement', 'Balanced meals', 'Reduce or quit tobacco', 'Reduce alcohol', 'Support recovery', 'Stay connected']
const plans: Record<string, string[]> = {
  Student: ['Choose one regular wind-down time', 'Take a short movement break between study blocks', 'Keep water nearby while studying'],
  'Office / employee': ['Stand or stretch during one work break', 'Take a brief screen-free pause', 'Set a realistic end-of-work wind-down cue'],
  Teacher: ['Plan a brief reset between teaching blocks', 'Keep water accessible during the day', 'Protect a short transition after work'],
  'Shift worker': ['Use a consistent sleep cue for your current shift', 'Plan a short movement break when safe', 'Keep a simple meal or snack plan for your shift'],
  Traveler: ['Use a gentle sleep routine after arrival', 'Take a short walk when practical', 'Keep a water and meal reminder'],
  'Home / caregiver': ['Pair a stretch with an existing daily task', 'Ask someone to share one small task if available', 'Take a brief quiet pause when practical'],
  Smoker: ['Notice one common smoking cue without judging yourself', 'Consider one small delay or smoke-free interval', 'Ask a health professional about evidence-based quitting support'],
  'Alcohol reduction': ['Notice when and why you usually drink', 'Choose one alcohol-free activity or day if safe for you', 'Ask a clinician for help if cutting down causes symptoms'],
  'Recovery support': ['Keep a trusted support contact easy to reach', 'Plan one routine that supports your recovery today', 'Contact your care team or local support service if cravings rise'],
  'Another routine': ['Choose one steady sleep cue', 'Add a comfortable movement break', 'Take one brief pause to check how you feel'],
}

export function WellnessJourney({ userId, onDailyCheckin, onViewTrends, onOpenSymptoms }: { userId: number; onDailyCheckin: () => void; onViewTrends: () => void; onOpenSymptoms: () => void }) {
  const key = `bloom_routine_${userId}`
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}') as { routine?: string; focus?: string[] } } catch { return {} } })()
  const [step, setStep] = useState(saved.routine ? 2 : 1)
  const [routine, setRoutine] = useState(saved.routine || '')
  const [focus, setFocus] = useState<string[]>(saved.focus || [])
  const [savedPlan, setSavedPlan] = useState(false)
  function toggle(item: string) { setFocus((items) => items.includes(item) ? items.filter((x) => x !== item) : [...items, item]) }
  function save() { localStorage.setItem(key, JSON.stringify({ routine, focus })); setSavedPlan(true); setStep(3) }
  const ideas = plans[routine] || plans['Another routine']
  return <section className="page journey-page">
    <div className="eyebrow"><i/> YOUR WELLNESS, ONE STEP AT A TIME</div><h1>A plan that fits your day.</h1>
    <p className="page-intro">Bloom uses your routine and check-ins to offer practical habit ideas. It does not use these answers to diagnose or predict disease.</p>
    <div className="journey-steps" aria-label="Wellness plan steps">{['Your routine', 'What matters', 'Your daily flow'].map((label, i) => <div className={step === i + 1 ? 'active' : step > i + 1 ? 'complete' : ''} key={label}><b>{i + 1}</b><span>{label}</span></div>)}</div>
    {step === 1 && <article className="journey-card"><h2>1. What best describes your usual day?</h2><p>Choose one. You can change this later.</p><div className="choice-grid">{routines.map((item) => <button className={routine === item ? 'chosen' : ''} key={item} onClick={() => setRoutine(item)}>{item}</button>)}</div><div className="journey-actions"><button className="primary" disabled={!routine} onClick={() => setStep(2)}>Continue <ArrowRight size={15}/></button></div></article>}
    {step === 2 && <article className="journey-card"><h2>2. What would you like support with?</h2><p>Pick any that feel useful. These choices stay in this browser on this device.</p><div className="choice-grid">{focusChoices.map((item) => <button className={focus.includes(item) ? 'chosen' : ''} key={item} onClick={() => toggle(item)} aria-pressed={focus.includes(item)}>{item}</button>)}</div><div className="journey-actions"><button className="subtle" onClick={() => setStep(1)}><ArrowLeft size={14}/> Back</button><button className="primary" onClick={save}>Build my flow <ArrowRight size={15}/></button></div></article>}
    {step === 3 && <><article className="journey-card"><div className="eyebrow"><i/> {routine.toUpperCase()} ROUTINE</div><h2>3. Keep it small and flexible.</h2><p>{savedPlan ? 'Your selected routine and focus are saved on this device.' : 'Here are ideas you can adapt to your day.'}</p><div className="journey-plan">{ideas.map((idea, i) => <div key={idea}><b>{i + 1}</b><span>{idea}</span></div>)}</div><div className="journey-actions"><button className="subtle" onClick={() => setStep(2)}><ArrowLeft size={14}/> Edit choices</button><button className="primary" onClick={onDailyCheckin}>Next: daily check-in <ArrowRight size={15}/></button></div></article><article className="journey-card sequence-card"><h2>Your ongoing sequence</h2><div className="sequence-list"><div><b>1</b><span><strong>Choose today’s habits</strong><small>Use the daily check-in to log sleep, activity, stress, and meals.</small></span><button className="link" onClick={onDailyCheckin}>Check in <ArrowRight size={14}/></button></div><div><b>2</b><span><strong>Notice your patterns</strong><small>Review your own recent check-ins and 30-day habit trend.</small></span><button className="link" onClick={onViewTrends}>View trends <ArrowRight size={14}/></button></div><div><b>3</b><span><strong>Look up health information</strong><small>Search trusted health topics if you have a symptom question.</small></span><button className="link" onClick={onOpenSymptoms}>Symptom guide <ArrowRight size={14}/></button></div></div></article></>}
    <div className="info-box"><ShieldCheck size={17}/> Routine and focus choices are stored only in this browser. Check-ins are stored in your account. This plan is general wellness support, not medical care.</div>
  </section>
}

export function SymptomGuide() {
  const [query, setQuery] = useState('')
  function search(event: FormEvent) { event.preventDefault(); const value = query.trim(); if (!value) return; window.open(`https://medlineplus.gov/search/?q=${encodeURIComponent(value)}`, '_blank', 'noopener,noreferrer') }
  return <section className="page symptom-page" id="symptom-guide"><div className="eyebrow"><i/> TRUSTED HEALTH INFORMATION</div><h1>What would you like to understand?</h1><p className="page-intro">Search symptoms or health topics. Bloom won’t guess a disease from your words. MedlinePlus provides reviewed information about symptoms, conditions, causes, and care.</p>
    <form className="symptom-search" onSubmit={search}><label htmlFor="symptom-query">Symptom or health topic</label><div><Search size={19}/><input id="symptom-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example, headache or feeling anxious" maxLength={120}/><button className="primary" disabled={!query.trim()}>Search <ExternalLink size={14}/></button></div><small>Your search opens MedlinePlus in a new tab. The words you enter are sent to that external website, not stored by Bloom.</small></form>
    <div className="topic-links"><a href="https://medlineplus.gov/symptoms.html" target="_blank" rel="noreferrer">Browse symptom topics <ExternalLink size={14}/></a><a href="https://medlineplus.gov/healthtopics.html" target="_blank" rel="noreferrer">Browse all health topics <ExternalLink size={14}/></a></div>
    <div className="info-box"><ShieldCheck size={17}/><span><b>Information, not a diagnosis.</b> Symptoms can have many causes and need professional assessment. For severe or sudden symptoms, such as trouble breathing, severe chest pain, or stroke signs, contact your local emergency service now.</span></div>
    <p className="research-source">Health information: <a href="https://medlineplus.gov/" target="_blank" rel="noreferrer">MedlinePlus, U.S. National Library of Medicine</a>. This external search can cover a broad range of conditions; it does not mean Bloom’s AI predicts them.</p>
  </section>
}
