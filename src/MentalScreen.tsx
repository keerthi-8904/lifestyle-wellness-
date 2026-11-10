import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

type Scale = 'depression' | 'anxiety'

const questions = {
  depression: [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself, or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading or watching television',
    'Moving or speaking so slowly that other people could have noticed, or being so fidgety or restless that you moved around more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ],
  anxiety: [
    'Feeling nervous, anxious, or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid, as if something awful might happen',
  ],
}
const choices = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day']

function band(scale: Scale, score: number) {
  if (score < 5) return { title: 'Minimal symptom range', advice: 'A low screen score does not rule out a concern. Seek support if you are worried.' }
  if (score < 10) return { title: 'Mild symptom range', advice: 'Consider checking in with someone you trust or a qualified professional if these symptoms bother you.' }
  if (score < 15) return { title: 'Moderate symptom range', advice: 'Consider discussing these symptoms with a qualified health professional. This score cannot confirm a disorder.' }
  if (scale === 'anxiety') return { title: 'Severe symptom range', advice: 'Consider contacting a qualified health professional for an assessment and support.' }
  if (score < 20) return { title: 'Moderately severe symptom range', advice: 'Consider contacting a qualified health professional for an assessment and support.' }
  return { title: 'Severe symptom range', advice: 'Consider contacting a qualified health professional for an assessment and support.' }
}

export default function MentalScreen() {
  const [scale, setScale] = useState<Scale>('depression')
  const [adult, setAdult] = useState(false)
  const [answers, setAnswers] = useState<Record<Scale, number[]>>({ depression: Array(9).fill(-1), anxiety: Array(7).fill(-1) })
  const [submitted, setSubmitted] = useState(false)
  const items = questions[scale]
  const current = answers[scale]
  const score = useMemo(() => current.reduce((sum, answer) => sum + Math.max(0, answer), 0), [current])
  const result = band(scale, score)
  const completed = current.every((answer) => answer >= 0)

  function chooseScale(next: Scale) { setScale(next); setSubmitted(false) }
  function setAnswer(index: number, value: number) {
    setAnswers((all) => ({ ...all, [scale]: all[scale].map((answer, i) => i === index ? value : answer) }))
    setSubmitted(false)
  }

  return <section className="page">
    <div className="eyebrow"><i/> SYMPTOM SCREENING</div>
    <h1>Mental health check-in</h1>
    <p className="page-intro">These short questionnaires screen for recent depression or generalized-anxiety symptoms. They do not detect or diagnose a mental illness.</p>
    <div className="screen-privacy"><ShieldCheck size={17}/><span>Your answers stay in this page’s browser memory. They are not sent to Bloom’s API, saved to your account, or kept after you leave this page.</span></div>
    <div className="screen-age"><label><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)}/> I confirm I am 18 or older.</label><span>This English-language demo is intended for adults. A screening score may not be suitable for every culture, language, or age group.</span></div>
    <div className="screen-tabs" role="tablist" aria-label="Choose symptom questionnaire">
      <button type="button" role="tab" aria-selected={scale === 'depression'} className={scale === 'depression' ? 'active' : ''} onClick={() => chooseScale('depression')}>Depression symptoms · PHQ-9</button>
      <button type="button" role="tab" aria-selected={scale === 'anxiety'} className={scale === 'anxiety' ? 'active' : ''} onClick={() => chooseScale('anxiety')}>Generalized anxiety · GAD-7</button>
    </div>
    <div className="screen-question-intro">Over the last two weeks, how often have you been bothered by the following problems?</div>
    {!adult ? <div className="empty screen-locked"><h2>Adult confirmation required</h2><p>Confirm that you are 18 or older before opening this screening questionnaire.</p></div> : <>
      <div className="screen-questions">{items.map((question, index) => <fieldset className="screen-question" key={`${scale}-${index}`}><legend><b>{index + 1}.</b> {question}</legend><div className="screen-options">{choices.map((choice, value) => <label key={choice}><input type="radio" name={`${scale}-${index}`} value={value} checked={current[index] === value} onChange={() => setAnswer(index, value)}/><span>{choice}</span></label>)}</div></fieldset>)}</div>
      <button type="button" className="primary" disabled={!completed} onClick={() => setSubmitted(true)}>Show screening result</button>
      {submitted && <article className="screen-result" aria-live="polite"><div className="eyebrow">SCREENING RESULT · NOT A DIAGNOSIS</div><strong>{score}<small> / {scale === 'depression' ? 27 : 21}</small></strong><h2>{result.title}</h2><p>{result.advice}</p><p className="screen-result-note">This result only reflects your answers for the past two weeks. Symptoms can have many causes. A qualified professional must assess whether a disorder is present.</p>
        {scale === 'depression' && current[8] > 0 && <div className="screen-support"><b>Support is available.</b><p>Because you selected an answer other than “Not at all” on the self-harm question, please consider reaching out to someone you trust and a qualified professional. If you might act on these thoughts or cannot stay safe, contact your local emergency service or go to an emergency department now. In India, Tele-MANAS is available at <a href="tel:14416">14416</a> or <a href="tel:18008914416">1800-89-14416</a>.</p></div>}
      </article>}
    </>}
    <div className="disclaimer idrs-disclaimer"><ShieldCheck size={17}/><span><b>Important:</b> A positive result is not a diagnosis. PHQ-9 screens depressive symptoms; GAD-7 screens generalized-anxiety symptoms. These tools do not identify bipolar disorder, autism, OCD, panic disorder, phobias, or other conditions. If symptoms concern you, talk with a qualified professional.</span></div>
    <p className="research-source">Questionnaire sources: <a href="https://doi.org/10.1046/j.1525-1497.2001.016009606.x" target="_blank" rel="noreferrer">PHQ-9 development and validation</a> · <a href="https://doi.org/10.1001/ARCHINTE.166.10.1092" target="_blank" rel="noreferrer">GAD-7 development and validation</a>. Screening tools can flag symptoms but need further evaluation to establish a diagnosis. <a href="https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/anxiety-adults-screening" target="_blank" rel="noreferrer">Evidence on anxiety screening</a>.</p>
  </section>
}
