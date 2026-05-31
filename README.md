# Claire

AI-powered Medicare Advantage member services assistant. Members ask plain-English questions about their health insurance and get instant answers backed by their real member data.

Built for the Krava + Linq hackathon.

---

## What it does

Claire answers member questions about:

- Claims — what was billed, what the plan paid, what the member owes, denial status
- Deductible and out-of-pocket progress
- Medications — active prescriptions, dosage, prescriber
- Plan benefits — copays, coinsurance, supplemental benefits (dental, vision, hearing, fitness)
- Coverage status and plan details

Responses are 2–5 sentences, Grade 6–8 reading level, plain text only.

## How it works

Member data is loaded from JSON fixtures at startup. When a member sends a message, their claims, medications, accumulators, and plan details are assembled into a structured prompt and sent to Krava, which processes it privately. Krava returns Claire's response, which is streamed back to the member.

Accumulator math (deductible paid, out-of-pocket progress) is calculated deterministically on the server before anything is sent to the model — Claire receives the result, never does the arithmetic herself.

## Stack

- **Node.js + TypeScript** — Express server
- **Krava** (`@kravalabs/api-client`) — private AI inference
- **Member data** — flat JSON fixtures with member, claims, medications, and coverage

## Running locally

```bash
cp .env.local.example .env.local   # add KRAVA_APP_KEY and KRAVA_BASE_URL
npm install
npm run dev
```

Open `http://localhost:3000/dashboard` — the member services dashboard.
Open `http://localhost:3000/memberchat` — the member chat interface.

## Environment variables

| Variable | Description |
|---|---|
| `KRAVA_APP_KEY` | Krava platform app key |
| `KRAVA_BASE_URL` | Krava API base URL (default: `https://krava.io`) |
| `PORT` | Server port (default: `3000`) |

## Member data

Place member JSON files in `test-data/`. Each file is one member. The server loads all members at startup and lists them in the dashboard.

## Demo

Live demo: https://hackathonclaire-production.up.railway.app/dashboard
