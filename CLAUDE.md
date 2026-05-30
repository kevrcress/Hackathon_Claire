<!-- HVE:START — managed by install.sh, do not edit between markers -->
# HVE Claude — Hypervelocity Engineering for Claude Code

This repository provides the **HVE Core** workflow adapted natively for Claude Code. It implements the Research → Plan → Implement → Review (RPI) methodology using slash commands, subagents, and durable file-based handoff artifacts.

Adapted from [microsoft/hve-core](https://github.com/microsoft/hve-core) under the MIT License.

---

## The RPI Methodology

HVE's core insight: when an AI cannot implement during research, it stops optimizing for plausible code and starts optimizing for verified truth. Separating phases by role produces higher-quality outcomes than asking a single session to do everything at once.

**Five operating principles:**

1. **Context discipline** — After a subagent returns, respond with lean summaries only. Do not re-read large artifacts into context.
2. **Durable artifacts over chat** — All research, plans, and reviews live in `.claude-hve-tracking/`. Chat is ephemeral; disk is the source of truth.
3. **Evidence-based responses** — Every finding cites `file:line` (e.g. `src/auth/middleware.ts:47`). No unsupported claims.
4. **Difficulty-adaptive workflow** — Classify tasks before acting. Simple tasks skip subagents. Complex tasks use full parallel dispatch.
5. **Lean turns** — Parent agents return a one-line summary after subagent work. Full detail lives in the log file.

**Difficulty classifications:**

| Level | Characteristics | Approach |
|---|---|---|
| Simple | < 50 lines, single file, clear requirements | Skip subagents; implement directly |
| Medium | 2–5 files, known patterns | 1–2 researcher subagents |
| Medium-Hard | Cross-cutting, multiple modules | Parallel research + plan validation |
| Challenging | New patterns, high risk, unclear requirements | Full parallel dispatch: research, plan, implement, review |

---

## Command Reference

| Command | Purpose | When to use |
|---|---|---|
| `/hve <task>` | Full RPI loop: Research → Plan → Implement → Review | Default for any non-trivial task |
| `/hve-research <task>` | Research phase only | When you want to investigate before committing to a plan |
| `/hve-plan` | Plan phase only | After research exists; reads latest research artifact |
| `/hve-implement` | Implement phase only | After a plan exists; reads latest plan artifact |
| `/hve-review` | Review phase only | After implementation; validates changes against plan |
| `/hve-pr-review` | Senior-level PR code review | Before merging a branch |
| `/hve-memory` | Save conversation context for future sessions | When ending a session mid-task |
| `/hve-challenge` | Adversarial questioning of current work | When you want a skeptic's view on a plan or implementation |
| `/hve-doc-ops` | Documentation QA and gap detection | After major feature work |
| `/hve-prompt-builder` | Iterative prompt engineering sandbox | When authoring new HVE agents or prompts |
| `/hve-prompt-analyze <file>` | Evaluate an existing artifact against quality criteria | Quick quality check without full rebuild |
| `/hve-prompt-refactor <file>` | Remove low-quality or AI-generated boilerplate from an existing artifact | When porting or cleaning up prompt files |
| `/hve-git-commit` | Stage safely, generate conventional commit message, commit | Before every commit |
| `/hve-git-merge <op> <branch>` | Merge / rebase / rebase-onto with conflict handling | When integrating branches |
| `/hve-git-setup` | Audit and configure git identity and tooling | New machine or project setup |

**Standalone phase commands** discover the latest tracking artifact automatically — no manual file attachment required. To resume in a new conversation, just run the next phase command and it will find the handoff file.

---

## Tracking Folder Structure

All runtime artifacts live in `.claude-hve-tracking/`. Durable artifacts are committed; only regenerable output is gitignored — see [Tracking folder & version control](#tracking-folder--version-control) below. This folder is the handoff medium between phases and between sessions.

```
.claude-hve-tracking/
├── research/
│   ├── YYYY-MM-DD/topic.md                    # Consolidated findings
│   └── subagents/YYYY-MM-DD/topic.md           # Per-subagent raw findings
├── plans/
│   ├── YYYY-MM-DD/task-slug-plan.md            # Implementation plan (phases + dependencies)
│   └── logs/YYYY-MM-DD/task-slug-log.md        # Planning discrepancy log (DR-/DD- items; DR = Discrepancy from Research, DD = Design Decision)
├── details/
│   └── YYYY-MM-DD/task-slug-details.md         # Implementation details
├── changes/
│   └── YYYY-MM-DD/task-slug-changes.md         # Changes log (updated per phase)
├── reviews/
│   ├── rpi/YYYY-MM-DD/                         # RPI validation output
│   └── pr/branch-name/                         # PR review output
├── challenges/
│   └── YYYY-MM-DD-topic-challenge.md
├── memory/
│   └── YYYY-MM-DD/kebab-slug.md
├── doc-ops/
│   └── YYYY-MM-DD-session.md
└── sandbox/
    └── YYYY-MM-DD-topic-run-N/
```

---

## Artifact Naming Conventions

- **Date format:** `YYYY-MM-DD` (always today's date when created)
- **Slug format:** `kebab-case-description` derived from the task description (3–6 words max)
- **Plan file suffix:** `-plan.md`
- **Details file suffix:** `-details.md`
- **Changes file suffix:** `-changes.md`
- **Log file suffix:** `-log.md`

Example: task "add OAuth2 to the API" → slug `add-oauth2-api`
- Plan: `.claude-hve-tracking/plans/2025-01-15/add-oauth2-api-plan.md`
- Changes: `.claude-hve-tracking/changes/2025-01-15/add-oauth2-api-changes.md`

---

## Severity Grading

Used in all review, validation, and challenge agents:

| Level | Definition |
|---|---|
| **Critical** | Missing or incorrect required functionality; blocks completion |
| **Major** | Specification deviation that degrades correctness, maintainability, or security |
| **Minor** | Style gap, documentation omission, or improvement opportunity |

Finding ID format: `IV-001`, `IV-002`, ... (sequential per session, reset per artifact; IV = Implementation Validation)

---

## Confidence Markers

All key assumptions in handoff artifacts must carry a confidence marker:

- `[HIGH]` — Verified directly from code, tests, or documentation
- `[MEDIUM]` — Inferred from patterns or indirect evidence
- `[LOW]` — Assumed; needs validation in next phase

Example: `Authentication uses JWT tokens [HIGH] with 24h expiry [MEDIUM]`

---

## Citation Format

All subagent findings must cite locations as `file:line`:

```
src/auth/middleware.ts:47          ← correct
./src/auth/middleware.ts           ← acceptable (no line number)
[middleware.ts](src/auth/...)      ← WRONG: no markdown links
```

Use plain workspace-relative paths. No markdown hyperlinks in findings.

---

## Subagent Response Protocol

All HVE subagents return in this format (never more):

1. One line: artifact path written (the parent re-reads this for detail)
2. One line: status — validators use Pass / Fail; other agents use Complete / Blocked
3. Up to **7 bullet-point findings** (≤ 240 chars each; prioritize Critical/Major)
4. A checklist of up to **5 recommended follow-on items** not yet completed
5. Up to **3 clarifying questions** — only if blocking
6. One line: "Full detail: re-read `<path>`"

The parent agent reads the written artifact for full detail. Chat responses are executive summaries only.

---

## Handoff Block Format

Every standalone phase command ends with this copyable block:

```
╭─────────────────────────────────────────────────────╮
│  HANDOFF                                            │
│  Artifact : .claude-hve-tracking/[path/to/file.md] │
│  Next     : /hve-[next-phase]                       │
│  Tip      : Start a new conversation, then run the  │
│             next command — it finds this auto.      │
╰─────────────────────────────────────────────────────╝
```

The `/hve` orchestrator omits this block (it handles transitions internally).

---

## Context Management Between Phases

- Phase commands are **fully self-contained**: they discover tracking artifacts from disk, not from conversation history.
- For tasks spanning multiple phases: **starting a new conversation per phase** is recommended to keep context lean.
- For simple tasks (< 50 lines, one phase): continuing in the same conversation is fine.
- No manual file attachment or context management is needed — just run the next command.

---

## Instructions Reference

Before implementing in a specific language or tool, read the relevant conventions file:

| Language / Tool | File |
|---|---|
| Bash | `instructions/bash.md` |
| Python | `instructions/python.md` |
| Python (uv) | `instructions/python-uv.md` |
| Python Tests | `instructions/python-tests.md` |
| C# | `instructions/csharp.md` |
| C# Tests | `instructions/csharp-tests.md` |
| Rust | `instructions/rust.md` |
| Rust Tests | `instructions/rust-tests.md` |
| Terraform | `instructions/terraform.md` |
| Markdown | `instructions/markdown.md` |
| Git commits | `instructions/git-commit-messages.md` |
| Writing Style | `instructions/writing-style.md` |

Phase commands that involve implementation explicitly instruct Claude to read the relevant file before writing code.

---

## Security Hygiene

All implementation reviews check these automatically (via the `hve-implementation-validator` subagent, dimension 9):

- **Secret exposure**: grep changed files for `PRIVATE KEY`, `api_key\s*=`, `password\s*=`, `Bearer `, `-----BEGIN`, AWS/GCP key prefixes
- **.gitignore hygiene**: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12` must be listed
- **Committed secrets**: `git diff HEAD --name-only` checked for credential-like files
- **New dependencies**: flagged for review when added; unrecognized registries noted

---

## Optional Power-User: Hooks for Automatic Change Logging

Claude Code's hooks can automatically append file edits to the changes log. Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "echo \"$(date +%Y-%m-%d) - Modified: $CLAUDE_TOOL_INPUT_FILE_PATH\" >> .claude-hve-tracking/changes/auto-log.md"
      }]
    }]
  }
}
```

This is optional. The `hve-phase-implementor` subagent writes the changes log explicitly even without hooks.

---

## Installing HVE in Your Project

Run the installer from this repo, pointing it at the target project:

```bash
./install.sh /path/to/your/project   # or run with no argument from inside the target
```

The installer copies `.claude/commands/`, `.claude/agents/`, `instructions/`, and
`prompts/`, merges the HVE block into the target's `CLAUDE.md`, and adds the tracking
`.gitignore` rules. It is idempotent — re-run it to pull updates.

After installing:

1. Append your project-specific context below the `## Your Project` heading in CLAUDE.md
2. Run `/hve <your first task>` to begin

### Tracking folder & version control

By default the durable HVE artifacts (`research/`, `plans/`, `details/`, `changes/`,
`reviews/`, `challenges/`, `memory/`, `doc-ops/`) **are committed** — they are the shared
history and rationale behind your work. Only the regenerable noise is gitignored:

```
.claude-hve-tracking/**/subagents/
.claude-hve-tracking/sandbox/
```

Date+slug naming (`YYYY-MM-DD/topic.md`) keeps parallel work from colliding. To keep the
whole folder private instead, replace those rules with `.claude-hve-tracking/`.

---
<!-- HVE:END -->

## Your Project

**Claire** is an AI-powered Medicare Advantage member services assistant delivered via iMessage, built for a hackathon using Krava (private-by-architecture inference) and Linq (iMessage API).

### What Claire does
Members text questions about their health insurance — claims, benefits, deductible status, medications, prior auth — and get instant plain-English answers backed by their actual member data. Responses are routed through Krava's private inference layer so identified member data never touches a cleartext LLM.

### Tech stack
- **Runtime:** Node.js, TypeScript
- **Messaging:** Linq API (iMessage webhook + reply)
- **Private inference:** Krava SDK (`@kravalabs/api-client`)
- **Member data:** Synthea R4 synthetic FHIR fixture data, adapted into internal domain models
- **Accumulator math:** Deterministic client-side calculation — never delegated to the LLM
- **Environment:** `.env.local` with `KRAVA_APP_KEY` and `KRAVA_BASE_URL`

### Key architectural rules
- Member context is loaded from Synthea fixtures and structured as typed domain models (Member, Claim, Coverage, AccumulatorState, Medication) before being passed to Krava
- Accumulator totals (deductible paid/total, OOP paid/total) are pre-calculated deterministically — Claire receives the result, never does the math herself
- No procedure codes, diagnosis codes, NPI numbers, claim IDs, or internal identifiers are ever surfaced to the member
- Claire never names the underlying AI model
- All monetary values are integers in cents internally; convert to dollars only for display
- Plain-language insurance terminology always — see Claire's system prompt for terminology translation rules

### Data available to Claire per member
- Member: name, DOB, member ID, plan name, plan type, coverage period, PCP
- Claims: service date, provider name, claim type, status, financials (billed, plan paid, member owes, deductible applied, copay, coinsurance), denial status, diagnoses, line items
- Accumulators: deductible paid vs total, OOP paid vs total, plan year
- Coverage: plan name, type, period, group number, subscriber ID
- Medications: name, dosage, prescribed date, status, prescriber name

### Target users
Medicare Advantage members, primarily 65-80. Write at Grade 6-8 reading level. Second-person active voice. Plain text only in responses — no markdown, no bullets, no asterisks. Short responses — two to five sentences. Offer to go deeper, don't lead with everything.

### Repo structure
```
src/
  adapters/        # FHIR to internal domain model transforms
  services/        # accumulator.service.ts, explanation.service.ts
  fixtures/        # Synthea R4 patient JSON files
  models/          # TypeScript interfaces for domain models
  webhook/         # Linq incoming message handler
  krava/           # Krava SDK integration
```

### Important notes
- This is a hackathon build — speed over perfection, but no credential leaks
- `.env.local` is never committed — `KRAVA_APP_KEY` is server-side only
- Synthea data includes multi-payer lifetime claims; production payer data contains only that plan's claims
- Some Synthea data is sparse: pharmacy EOB financials may be zeroed, Coverage resources may be absent, medication refill/days supply data may be missing — handle these gracefully with sensible fallbacks
- The security validator will run on every review — ensure no API keys appear in source files
