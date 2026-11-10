# Bloom — AI Lifestyle Risk Research & Daily Wellness

Bloom combines daily behavioral analytics with a trained Cox time-to-event model for an educational five-year Type 2 diabetes research estimate. The daily check-in model projects habit patterns only; the separate cohort model uses clinical baseline measurements. The project does not provide clinical diagnoses or validated personal disease predictions.

## Run on Windows

You need Node.js LTS and Python 3.11 or newer.

1. Open PowerShell in this folder.
2. Start the API in one PowerShell window:

   ```powershell
   cd backend
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. Open a second PowerShell window in the project folder and start the website:

   ```powershell
   npm install
   npm run dev
   ```

4. Open the local address Vite prints (usually http://localhost:5173).

## Included

- Account registration and sign-in; passwords are stored as hashes.
- Personal daily check-ins for sleep, active days, stress, and meal balance.
- A guided, sequential wellness journey with flexible ideas for students, employees, teachers, shift workers, travelers, caregivers, and people seeking optional support around tobacco, alcohol, or recovery. Routine choices stay in browser storage on that device; they are not disease-risk inputs.
- A symptom and health-topic search that opens MedlinePlus, a U.S. National Library of Medicine resource with reviewed health information. Search terms are sent to MedlinePlus by the user's browser and are not sent to Bloom's API. This is information lookup, not an AI diagnosis.
- A user can update that day's entry or backfill an earlier date; the app keeps a personal history.
- After at least 7 check-ins across 6 or more days, the API fits a transparent straight-line trend to up to 30 recent entries and estimates how four reported habit patterns could look in 30 days. The dashboard marks possible short sleep, lower active-day counts, higher self-rated stress, and low meal-balance ratings as **Watch**, **Improving**, or **Steady**. It recalculates after a check-in; there is no daily model training.
- Optional adult Type 2 diabetes screening using the Indian Diabetes Risk Score (IDRS). Age, waist category, physical activity category, and parental history are calculated in the browser only and are not sent to the API or stored. See the [IDRS validation study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8117908/).
- Optional five-year Type 2 diabetes **research estimate** using a Cox time-to-event model trained on the public NAGALA Japanese cohort from [Dryad DOI 10.5061/dryad.8q0p192](https://doi.org/10.5061/dryad.8q0p192). It requires baseline age, sex, BMI, waist, exercise habit, HbA1c, fasting glucose, and an ultrasound fatty-liver result; it does not use daily habit entries. Values are sent to the API for the one-time calculation and are not saved to the account database. A reproducible trainer is at `backend/scripts/train_diabetes_cox.mjs`; its raw input data is not bundled in the repository.
- Optional mental wellbeing self-ratings for mood, worry, energy, sleep quality, and social comfort. These are stored only in the current browser, not sent to the API or synced across devices. Users can download a JSON export of their account check-ins and browser-only self-ratings.
- Optional adult PHQ-9 and GAD-7 symptom screens. Answers are scored in page memory only and are not saved or sent to the API. Results are symptom-severity screening bands, not diagnoses; the GAD-7 is an initial screen for generalized-anxiety symptoms, not a detector for every anxiety disorder. The self-harm response shows support guidance and India's Tele-MANAS contact. The screeners do not identify bipolar disorder, autism, OCD, panic disorder, phobias, or other conditions. See the [PHQ-9 validation paper](https://doi.org/10.1046/j.1525-1497.2001.016009606.x), [GAD-7 validation paper](https://doi.org/10.1001/ARCHINTE.166.10.1092), and [NIH GAD-7 instrument page](https://www.nih.gov/node/19876).
- SQLite database locally. PostgreSQL is an optional deployment dependency listed in `backend/requirements-postgres.txt`.
- FastAPI docs at http://127.0.0.1:8000/docs.

## Publish a demo on Render

The repository includes a Dockerfile and `render.yaml` Blueprint. Push the project to a GitHub repository, connect that repository in Render, and create a Blueprint from `render.yaml`. This deploys the website and API together with a PostgreSQL database. The app reads the assigned `PORT`, and Render generates a private `JWT_SECRET`.

The included Render plan is for a free demonstration. Render's free web service can sleep when idle, and its free PostgreSQL database expires after 30 days. Use test accounts and sample entries only on this plan. For ongoing use with personal wellness information, choose durable hosting and review account security, privacy, backups, deletion, and relevant health-data requirements first.

## Important limits

The outlook uses simple linear regression on self-reported habits. Its thresholds are transparent app markers, not clinical cutoffs; for example, the sleep card uses a general 7-hour adult reference. The World Health Organization's activity guidance is measured in minutes and intensity, while this demo only asks users for active days, so the app cannot determine whether that guideline is met. See the [CDC sleep guidance](https://www.cdc.gov/heart-disease/about/sleep-and-heart-health.html) and [WHO physical activity guidance](https://www.who.int/europe/news-room/fact-sheets/item/physical-activity).

The 30-day feature predicts **habit patterns only**. The separate IDRS page is a screening questionnaire for Indian adults, not a diagnosis or an individualized prediction of future disease onset; score performance varies across populations. A high score should prompt a conversation with a qualified clinician and appropriate blood-glucose testing. The optional Cox model is an educational research prototype trained on 15,464 Japanese cohort records with 373 incident diabetes events. Its random 80/20 internal holdout C-index was 0.87; this is a ranking measure within the same source cohort, not proof of clinical accuracy. There is no independent external validation or calibration for Bloom users, so the numeric five-year estimate may not generalize and must not be used for diagnosis, treatment, or health decisions. It needs clinical lab/ultrasound inputs and is unrelated to the user's daily check-ins. The PHQ-9 and GAD-7 screens report symptom bands only. Positive results require further evaluation; they do not establish a disorder. The GAD-7 does not identify every anxiety disorder, and this app does not screen for bipolar disorder, autism, OCD, panic disorder, or phobias. The mental wellbeing tracker reports only users' own ratings. Mental wellbeing ratings stay in the browser and can be lost if browser storage is cleared. The app is an educational behavioral-analytics and screening demo, not a medical device. This demo has not been security-reviewed for public use. Before deployment with real users, set a strong private `JWT_SECRET`, use managed PostgreSQL, HTTPS, secure account recovery, rate limiting, backups, privacy/deletion notices, and review the applicable health-data rules. The current database is local to the API server and is not shared between separate installations.
