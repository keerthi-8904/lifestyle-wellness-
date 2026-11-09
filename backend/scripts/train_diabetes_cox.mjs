#!/usr/bin/env node
// Train an educational, internal-validation Cox model from the Dryad NAGALA TSV.
// Usage: node backend/scripts/train_diabetes_cox.mjs path/to/nagala.tsv
// The source file is not copied into or bundled with the deployed application.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'diabetes_research_model.json')
const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Pass the tab-separated Dryad dataset text file as the first argument.')
  process.exit(2)
}

const lines = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)
const headers = lines[0].split('\t')
const col = Object.fromEntries(headers.map((name, i) => [name, i]))
const required = [
  'Sex, 1:Men, 2:Women', 'Baseline Age, yrs', 'Baseline Fatty liver 0/1',
  'Baseline BMI, kg/m2', 'Baseline Waist circumference(WC), cm',
  'Baseline Habit of exercise 0/1', 'Follow up duration, days',
  'Baseline HbA1c, %', 'Baseline Fasting plasma glucose, mg/dl', 'Incident DM 0/1',
]
for (const name of required) if (col[name] === undefined) throw new Error(`Dataset column missing: ${name}`)

// Fixed, pre-outcome clinical/demographic fields only. IDs, derived obesity
// groupings, follow-up duration, and the outcome are never model predictors.
const featureNames = ['age', 'male', 'bmi', 'waist_cm', 'exercise_habit', 'hba1c_percent', 'fasting_glucose_mg_dl', 'fatty_liver']
const rows = []
for (const line of lines.slice(1)) {
  const cells = line.split('\t')
  if (cells.length !== headers.length) throw new Error(`Expected ${headers.length} columns; found ${cells.length}`)
  const number = (name) => Number(cells[col[name]])
  const x = [
    number('Baseline Age, yrs'),
    number('Sex, 1:Men, 2:Women'),
    number('Baseline BMI, kg/m2'),
    number('Baseline Waist circumference(WC), cm'),
    number('Baseline Habit of exercise 0/1'),
    number('Baseline HbA1c, %'),
    number('Baseline Fasting plasma glucose, mg/dl'),
    number('Baseline Fatty liver 0/1'),
  ]
  const duration = number('Follow up duration, days')
  const event = number('Incident DM 0/1')
  if (x.every(Number.isFinite) && Number.isFinite(duration) && duration > 0 && (event === 0 || event === 1)) rows.push({ x, duration, event })
}
if (rows.length < 1000 || rows.reduce((sum, row) => sum + row.event, 0) < 50) throw new Error('Dataset is too small or has too few events for this prototype.')

// Reproducible stratified 80/20 holdout split.
let seed = 20261109
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const eventRows = rows.filter((r) => r.event === 1)
const censoredRows = rows.filter((r) => r.event === 0)
function shuffled(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
function split(items) { const a = shuffled(items); const n = Math.max(1, Math.round(a.length * 0.2)); return [a.slice(n), a.slice(0, n)] }
const [trainEvents, testEvents] = split(eventRows)
const [trainCensored, testCensored] = split(censoredRows)
const trainRaw = [...trainEvents, ...trainCensored]
const testRaw = [...testEvents, ...testCensored]

function standardize(reference, data) {
  const p = featureNames.length
  const means = Array(p).fill(0)
  const scales = Array(p).fill(0)
  for (const row of reference) for (let j = 0; j < p; j++) means[j] += row.x[j] / reference.length
  for (const row of reference) for (let j = 0; j < p; j++) scales[j] += (row.x[j] - means[j]) ** 2 / reference.length
  for (let j = 0; j < p; j++) scales[j] = Math.sqrt(scales[j]) || 1
  return { means, scales, data: data.map((row) => ({ ...row, z: row.x.map((v, j) => (v - means[j]) / scales[j]) })) }
}
function solve(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, i) => [...row, vector[i]])
  for (let c = 0; c < n; c++) {
    let pivot = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r
    if (Math.abs(a[pivot][c]) < 1e-12) throw new Error('Model information matrix is singular.')
    ;[a[c], a[pivot]] = [a[pivot], a[c]]
    const div = a[c][c]
    for (let k = c; k <= n; k++) a[c][k] /= div
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k] }
  }
  return a.map((row) => row[n])
}
function coxObjective(data, beta, ridge = 0.05, derivatives = false) {
  const p = beta.length
  const ordered = data.map((row) => ({ ...row, w: Math.exp(Math.max(-30, Math.min(30, row.z.reduce((s, v, j) => s + v * beta[j], 0)))) })).sort((a, b) => b.duration - a.duration)
  const times = [...new Set(data.filter((r) => r.event).map((r) => r.duration))].sort((a, b) => b - a)
  let pos = 0, s0 = 0, s1 = Array(p).fill(0), s2 = Array(p * p).fill(0)
  let loglik = 0, gradient = Array(p).fill(0), information = Array.from({ length: p }, () => Array(p).fill(0))
  for (const time of times) {
    while (pos < ordered.length && ordered[pos].duration >= time) {
      const r = ordered[pos++], z = r.z, w = r.w
      s0 += w
      for (let j = 0; j < p; j++) { s1[j] += w * z[j]; for (let k = 0; k < p; k++) s2[j * p + k] += w * z[j] * z[k] }
    }
    const tied = data.filter((r) => r.event && r.duration === time)
    const e0 = tied.reduce((s, r) => s + Math.exp(Math.max(-30, Math.min(30, r.z.reduce((t, v, j) => t + v * beta[j], 0)))), 0)
    const e1 = Array(p).fill(0), e2 = Array(p * p).fill(0)
    for (const r of tied) { const w = Math.exp(Math.max(-30, Math.min(30, r.z.reduce((s, v, j) => s + v * beta[j], 0)))); loglik += r.z.reduce((s, v, j) => s + v * beta[j], 0); for (let j = 0; j < p; j++) { e1[j] += w * r.z[j]; for (let k = 0; k < p; k++) e2[j * p + k] += w * r.z[j] * r.z[k] } }
    for (let l = 0; l < tied.length; l++) {
      const fraction = l / tied.length, denom = s0 - fraction * e0
      loglik -= Math.log(denom)
      if (!derivatives) continue
      const mean = s1.map((v, j) => (v - fraction * e1[j]) / denom)
      for (let j = 0; j < p; j++) {
        gradient[j] -= mean[j]
        for (let k = 0; k < p; k++) information[j][k] += (s2[j * p + k] - fraction * e2[j * p + k]) / denom - mean[j] * mean[k]
      }
    }
    if (derivatives) for (const r of tied) for (let j = 0; j < p; j++) gradient[j] += r.z[j]
  }
  for (let j = 0; j < p; j++) { loglik -= ridge * beta[j] * beta[j] / 2; if (derivatives) { gradient[j] -= ridge * beta[j]; information[j][j] += ridge } }
  return { loglik, gradient, information }
}
function fitCox(data) {
  let beta = Array(featureNames.length).fill(0), current = coxObjective(data, beta).loglik
  for (let iteration = 0; iteration < 80; iteration++) {
    const { gradient, information } = coxObjective(data, beta, 0.05, true)
    const step = solve(information, gradient)
    let scale = 1, candidate = beta, value = current
    while (scale > 1e-7) { candidate = beta.map((b, j) => b + scale * step[j]); value = coxObjective(data, candidate).loglik; if (value >= current - 1e-9) break; scale /= 2 }
    if (scale <= 1e-7) break
    beta = candidate; current = value
    if (Math.max(...step.map(Math.abs)) * scale < 1e-7) break
  }
  return beta
}
function riskScore(row, beta) { return row.z.reduce((s, v, j) => s + v * beta[j], 0) }
function cIndex(data, beta) {
  let concordant = 0, comparable = 0
  const scored = data.map((row) => ({ ...row, score: riskScore(row, beta) }))
  for (let i = 0; i < scored.length; i++) if (scored[i].event) for (let j = 0; j < scored.length; j++) {
    if (scored[i].duration < scored[j].duration) { comparable++; concordant += scored[i].score > scored[j].score ? 1 : scored[i].score === scored[j].score ? 0.5 : 0 }
  }
  return comparable ? concordant / comparable : null
}

const standardizedTrain = standardize(trainRaw, trainRaw)
const standardizedTest = standardize(trainRaw, testRaw).data
const validationBeta = fitCox(standardizedTrain.data)
const validationC = cIndex(standardizedTest, validationBeta)

// Refit on all available records for the deployable research artifact.
const standardizedAll = standardize(rows, rows)
const beta = fitCox(standardizedAll.data)
const ordered = standardizedAll.data.map((row) => ({ ...row, w: Math.exp(Math.max(-30, Math.min(30, riskScore(row, beta)))) })).sort((a, b) => b.duration - a.duration)
let baseline = 0
const eventTimes = [...new Set(rows.filter((r) => r.event).map((r) => r.duration))].sort((a, b) => a - b)
for (const time of eventTimes) {
  let s0 = 0
  for (const row of ordered) if (row.duration >= time) s0 += row.w
  const d = rows.filter((r) => r.event && r.duration === time).length
  baseline += d / s0
  if (time > 5 * 365.25) break
}
const horizonDays = 5 * 365.25
const artifact = {
  model_type: 'Cox proportional hazards',
  model_version: 'research-cox-v1',
  cohort: 'NAGALA Japanese health-check cohort (Dryad DOI 10.5061/dryad.8q0p192)',
  horizon_days: horizonDays,
  features: featureNames,
  means: standardizedAll.means,
  scales: standardizedAll.scales,
  coefficients: beta,
  baseline_cumulative_hazard_5y: baseline,
  validation: { method: 'stratified random 80/20 holdout; fixed seed 20261109; Harrell concordance index', c_index: validationC, n_train: trainRaw.length, events_train: trainEvents.length, n_test: testRaw.length, events_test: testEvents.length },
  cohort_summary: { n: rows.length, events: rows.reduce((s, row) => s + row.event, 0), followup_median_days: [...rows].map((r) => r.duration).sort((a, b) => a - b)[Math.floor(rows.length / 2)] },
  limitations: 'Internal research prototype only. Japanese cohort; no external or local-population validation; historical follow-up varies. Not for diagnosis, care decisions, or clinical use. A 5-year cohort estimate does not use users’ daily habit journal and may not generalize to Bloom users.',
}
fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n')
console.log(JSON.stringify({ artifact: outPath, validation: artifact.validation, cohort_summary: artifact.cohort_summary }, null, 2))
