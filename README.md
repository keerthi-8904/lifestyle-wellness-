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
- A user can update that day's entry; the app keeps a personal history.
- SQLite database locally. PostgreSQL is an optional deployment dependency listed in `backend/requirements-postgres.txt`.
- FastAPI docs at http://127.0.0.1:8000/docs.

## Publish a demo on Render

The repository includes a Dockerfile and `render.yaml` Blueprint. Push the project to a GitHub repository, connect that repository in Render, and create a Blueprint from `render.yaml`. This deploys the website and API together with a PostgreSQL database. The app reads the assigned `PORT`, and Render generates a private `JWT_SECRET`.

The included Render plan is for a free demonstration. Render's free web service can sleep when idle, and its free PostgreSQL database expires after 30 days. Use test accounts and sample entries only on this plan. For ongoing use with personal wellness information, choose durable hosting and review account security, privacy, backups, deletion, and relevant health-data requirements first.

## Important limits

The dashboard describes self-reported habit patterns. Its illustrative thresholds are not a validated future disease risk prediction, medical advice, or diagnosis. This demo has not been security-reviewed for public use. Before deployment with real users, set a strong private `JWT_SECRET`, use managed PostgreSQL, HTTPS, secure account recovery, rate limiting, backups, privacy/deletion notices, and review the applicable health-data rules. The current database is local to the API server and is not shared between separate installations.
