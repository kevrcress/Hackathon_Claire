import { LoadedPatientData, Claim, Medication } from './loader';

export const DEMO_PLAN = {
  planName: 'Claire Medicare Advantage Gold',
  planYear: '2026',
  deductibleTotal: 150000,  // $1,500.00 in cents
  oopTotal: 450000,         // $4,500.00 in cents
  copayPCP: 1000,           // $10.00
  copaySpecialist: 4000,    // $40.00
  coinsuranceRate: 0.20,
};

export function fmt(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function recentClaimsText(claims: Claim[]): string {
  if (claims.length === 0) return 'None on file';
  return claims
    .map(c => {
      const provider = c.providerName.startsWith('NPI:') ? 'Your provider' : c.providerName;
      return `- ${fmtDate(c.serviceDate)}: ${provider} (${c.claimType}) — Status: ${c.status}${c.isDenied ? ' (denied)' : ''} — Billed: ${fmt(c.billedAmount)}, You owe: ${fmt(c.memberOwes)}`;
    })
    .join('\n');
}

function medicationsText(meds: Medication[]): string {
  if (meds.length === 0) return 'None on file';
  return meds
    .map(m => {
      let line = `- ${m.name}`;
      if (m.dosage) line += ` — ${m.dosage}`;
      line += ` (${m.status})`;
      if (m.prescriberName) line += `, prescribed by ${m.prescriberName}`;
      return line;
    })
    .join('\n');
}

export function buildSystemPrompt(data: LoadedPatientData): string {
  const { member, accumulators, coverage, claims, medications } = data;

  const coverageSection = coverage
    ? `Plan Type: ${coverage.planType ?? 'Medicare Advantage'}
Status: ${coverage.status ?? 'active'}
Period: ${coverage.periodStart ? fmtDate(coverage.periodStart) : 'N/A'} to ${coverage.periodEnd ? fmtDate(coverage.periodEnd) : 'N/A'}`
    : 'Coverage: Medicare Advantage Gold';

  return `You are Claire, a Medicare Advantage member services assistant for ${member.displayName}.
You help members understand their health insurance — claims, benefits, deductibles, medications, and coverage.

IMPORTANT RULES:
- Write at Grade 6-8 reading level
- Use second-person active voice ("your deductible", "you owe")
- Plain text only — no markdown, no bullets, no asterisks
- Keep responses to 2-5 sentences
- Offer to go deeper, but don't lead with everything
- Never name the underlying AI model
- Never show claim IDs, procedure codes, diagnosis codes, NPI numbers, or provider IDs
- All amounts shown to member must be in dollars (e.g. $1,500.00)
- When you don't know something, say "I don't have that information in your records"

MEMBER PROFILE:
Name: ${member.displayName}
Date of Birth: ${member.dateOfBirth}
Member ID: ${member.memberId}
Plan: ${DEMO_PLAN.planName}
Plan Year: ${DEMO_PLAN.planYear}
${member.phone ? 'Phone: ' + member.phone : ''}
${member.address ? 'Address: ' + member.address : ''}

COST SHARING:
Deductible: ${fmt(accumulators.deductiblePaid)} paid of ${fmt(DEMO_PLAN.deductibleTotal)} total
Out-of-Pocket: ${fmt(accumulators.oopPaid)} paid of ${fmt(DEMO_PLAN.oopTotal)} total
PCP Copay: ${fmt(DEMO_PLAN.copayPCP)}
Specialist Copay: ${fmt(DEMO_PLAN.copaySpecialist)}
Coinsurance: ${(DEMO_PLAN.coinsuranceRate * 100).toFixed(0)}% after deductible

COVERAGE:
${coverageSection}

RECENT CLAIMS (up to 8, newest first):
${recentClaimsText(claims.slice(0, 8))}

MEDICATIONS (up to 10):
${medicationsText(medications.slice(0, 10))}`;
}
