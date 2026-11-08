# Bloom — Daily Wellness Check-ins

Bloom is a project demo where multiple users can create accounts, log daily lifestyle habits, and see simple summaries based on their own recent entries.

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
- A user can update that day's entry or backfill an earlier date; the app keeps a personal history.
- After at least 7 check-ins across 6 or more days, the API fits a transparent straight-line trend to up to 30 recent entries and estimates how four reported habit patterns could look in 30 days. The dashboard marks possible short sleep, lower active-day counts, higher self-rated stress, and low meal-balance ratings as **Watch**, **Improving**, or **Steady**. It recalculates after a check-in; there is no daily model training.
- Optional adult Type 2 diabetes screening using the Indian Diabetes Risk Score (IDRS). Age, waist category, physical activity category, and parental history are calculated in the browser only and are not sent to the API or stored. See the [IDRS validation study](https://pmc.ncbi.nlm.nih.gov/articles/PMC8117908/).
- SQLite database locally. PostgreSQL is an optional deployment dependency listed in `backend/requirements-postgres.txt`.
- FastAPI docs at http://127.0.0.1:8000/docs.

## Publish a demo on Render

The repository includes a Dockerfile and `render.yaml` Blueprint. Push the project to a GitHub repository, connect that repository in Render, and create a Blueprint from `render.yaml`. This deploys the website and API together with a PostgreSQL database. The app reads the assigned `PORT`, and Render generates a private `JWT_SECRET`.

The included Render plan is for a free demonstration. Render's free web service can sleep when idle, and its free PostgreSQL database expires after 30 days. Use test accounts and sample entries only on this plan. For ongoing use with personal wellness information, choose durable hosting and review account security, privacy, backups, deletion, and relevant health-data requirements first.

## Important limits

The outlook uses simple linear regression on self-reported habits. Its thresholds are transparent app markers, not clinical cutoffs; for example, the sleep card uses a general 7-hour adult reference. The World Health Organization's activity guidance is measured in minutes and intensity, while this demo only asks users for active days, so the app cannot determine whether that guideline is met. See the [CDC sleep guidance](https://www.cdc.gov/heart-disease/about/sleep-and-heart-health.html) and [WHO physical activity guidance](https://www.who.int/europe/news-room/fact-sheets/item/physical-activity).

The 30-day feature predicts **habit patterns only**. The separate IDRS page is a screening questionnaire for Indian adults, not a diagnosis or an individualized prediction of future disease onset; score performance varies across populations. A high score should prompt a conversation with a qualified clinician and appropriate blood-glucose testing. It is not medical advice. The app is not a trained or clinically validated medical AI model and should be presented as an educational behavioral-analytics and screening demo, not a medical device. This demo has not been security-reviewed for public use. Before deployment with real users, set a strong private `JWT_SECRET`, use managed PostgreSQL, HTTPS, secure account recovery, rate limiting, backups, privacy/deletion notices, and review the applicable health-data rules. The current database is local to the API server and is not shared between separate installations.
