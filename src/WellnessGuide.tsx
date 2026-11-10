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
  const [submitted, setSubmitted] = useState('')
  function search(event: FormEvent) { event.preventDefault(); const value = query.trim(); if (value) setSubmitted(value) }
  function selectTopic(value: string) { setQuery(value); setSubmitted(value) }
  const q = submitted.toLowerCase()
  const urgent = /chest pain|can't breathe|cannot breathe|trouble breathing|one side.*weak|face droop|stroke|faint|hurt myself|suicid|kill myself/.test(q)
  const support = /sleep|insomnia|tired|fatigue|exhaust/.test(q) ? { title: 'Start with rest and a routine check', steps: ['Notice your sleep and wake times for a few days.', 'Try one calming wind-down cue that fits your schedule.', 'If tiredness is persistent, worsening, or affects daily tasks, contact a healthcare professional.'], topic: 'sleep' }
    : /stress|worr|anx|panic|overwhelm|pressure/.test(q) ? { title: 'Try one small reset and reach out', steps: ['Pause for a few slow, comfortable breaths and name one thing you can do next.', 'If this keeps interfering with work, study, sleep, or relationships, consider talking with a qualified professional.', 'If you feel unsafe, contact local emergency help or a trusted person now.'], topic: 'stress' }
    : /smok|tobacco|nicotine|drink|alcohol|addict|crav|substance|recover/.test(q) ? { title: 'Support works better without judgment', steps: ['Notice situations that make the habit harder to change; you do not need to change everything today.', 'Choose one trusted person or health professional to discuss a support plan with.', 'If reducing alcohol or another substance makes you feel unwell, seek medical advice rather than stopping suddenly on your own.'], topic: 'substance use' }
    : /move|exercise|active|sitting|walk/.test(q) ? { title: 'Make movement fit your day', steps: ['Pick a comfortable movement break that matches your ability and surroundings.', 'Attach it to an existing routine, such as after class, during a work break, or while travelling.', 'If activity causes concerning symptoms or you have health limitations, ask a professional what is appropriate for you.'], topic: 'physical activity' }
    : /food|meal|eat|nutrition|hungry/.test(q) ? { title: 'Start with one manageable food routine', steps: ['Notice whether your schedule makes regular meals difficult.', 'Consider one practical change, such as planning a simple meal or snack when you have access to food.', 'For persistent appetite or eating concerns, seek advice from a qualified health professional.'], topic: 'nutrition' }
    : submitted ? { title: 'Let’s find reliable information for your question', steps: ['Bloom cannot safely interpret every symptom or tell you its cause.', 'Use the trusted health-topic search below to read about the words you entered.', 'If symptoms are severe, worsening, persistent, or worrying you, contact a qualified healthcare professional.'], topic: submitted } : null
  return <section className="page symptom-page" id="symptom-guide"><div className="eyebrow"><i/> BLOOM SUPPORT FINDER</div><h1>What would help today?</h1><p className="page-intro">Describe a wellness challenge or symptom in a few words. Bloom offers a few safe next steps for common wellness topics and links to trusted health information. It does not diagnose conditions.</p>
    <div className="quick-topics"><span>Try a topic:</span>{['I feel stressed', 'I can’t sleep', 'I want to reduce smoking', 'I need more movement', 'I have a symptom question'].map((item) => <button key={item} onClick={() => selectTopic(item)}>{item}</button>)}</div>
    <form className="symptom-search" onSubmit={search}><label htmlFor="symptom-query">What are you looking for help with?</label><div><Search size={19}/><input id="symptom-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Example: stress, sleep, smoking, headache…" maxLength={120}/><button className="primary" disabled={!query.trim()}>Find support <ArrowRight size={14}/></button></div><small>Your words are processed only in this page to show general support suggestions. They are not saved or sent to Bloom’s API.</small></form>
    {support && <article className={`support-result ${urgent ? 'urgent-result' : ''}`}><div className="eyebrow"><i/> {urgent ? 'PLEASE GET HELP NOW' : 'A PLACE TO START'}</div><h2>{urgent ? 'This may need urgent attention.' : support.title}</h2>{urgent ? <p>If you may be facing a medical emergency or cannot stay safe, contact your local emergency service now or go to the nearest emergency department. Bloom cannot assess emergencies.</p> : <ul>{support.steps.map((step) => <li key={step}>{step}</li>)}</ul>}<a className="support-source" href={`https://medlineplus.gov/search/?q=${encodeURIComponent(support.topic)}`} target="_blank" rel="noreferrer">Read trusted information about “{support.topic}” <ExternalLink size={14}/></a><small>This is general information, not an assessment or treatment plan. It may not fit your situation.</small></article>}
    <div className="topic-links"><a href="https://medlineplus.gov/symptoms.html" target="_blank" rel="noreferrer">Browse symptom topics <ExternalLink size={14}/></a><a href="https://medlineplus.gov/healthtopics.html" target="_blank" rel="noreferrer">Browse all health topics <ExternalLink size={14}/></a></div>
    <div className="info-box"><ShieldCheck size={17}/><span><b>Information, not a diagnosis.</b> Symptoms can have many causes. If they are severe, sudden, worsening, persistent, or concerning, get advice from a qualified health professional.</span></div>
    <p className="research-source">Trusted health information: <a href="https://medlineplus.gov/" target="_blank" rel="noreferrer">MedlinePlus, U.S. National Library of Medicine</a>. Bloom’s AI model does not predict all diseases.</p>
  </section>
}
