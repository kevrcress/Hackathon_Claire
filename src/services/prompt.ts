import { LoadedPatientData, Claim, Medication } from './loader';

export const DEMO_PLAN = {
  planId: 'humana-usaa-honor-giveback-h5525-079',
  planName: 'Claire Medicare Advantage Gold',
  contractId: 'H5525',
  planNumber: '079',
  planType: 'PPO',
  insurer: 'Humana',
  source: 'https://www.medicare.org/medicare-advantage-plans/plan/H5525-079-0/',
  sourceDate: '2026-01-23',

  defaultBenefits: {
    planYear: 2026,
    monthlyPremium: 0,
    partBGivebackCents: 5500,

    individualDeductible: 50000,
    familyDeductible: 50000,
    individualOopMax: 650000,
    familyOopMax: 650000,

    primaryCareCopay: 0,
    specialistCopay: 5500,
    urgentCareCopay: 5000,
    erCopay: 13000,
    coinsurancePercent: 20,

    partDIncluded: true,

    additionalCostSharing: {
      inpatientHospitalPerDay1to5: 30000,
      inpatientHospitalPerDay6to90: 0,
      skilledNursingFacilityPerDay1to20: 1000,
      skilledNursingFacilityPerDay21to100: 21800,
      groundAmbulance: 33500,
      physicalTherapy: 3500,
      occupationalTherapy: 3500,
      outpatientMentalHealth: 0,
      labServices: 0,
      durableMedicalEquipmentCoinsurance: 15,
      chemotherapyCoinsurance: 20,
    },

    supplementalBenefits: {
      dental: true,
      vision: true,
      hearing: true,
      fitness: true,
      telehealth: true,
      otc: false,
      transportation: false,
    },

    dentalHighlights: {
      examCopay: 0,
      cleaningCopay: 0,
      xrayCopay: 0,
      restorativeCoinsurance: 35,
    },

    visionHighlights: {
      routineExamCopay: 0,
      eyeglassesCopay: 0,
      contactLensesCopay: 0,
    },

    hearingHighlights: {
      examCopay: 0,
      prescriptionHearingAidMin: 69900,
      prescriptionHearingAidMax: 99900,
    },
  },

  partD: {
    planId: 'S5884-157-0',
    planName: 'Humana Premier Rx Plan',
    contractId: 'S5884',
    planNumber: '157',
    insurer: 'Humana',
    planYear: 2026,
    source: 'https://www.medicareplans.com/prescription-drugs/plan/S5884-157-0/',
    sourceDate: '2026-01-23',

    monthlyPremiumCents: 11590,
    annualDeductible: 0,

    tiers: {
      tier1PreferredGeneric: { label: 'Preferred Generic', retailCopay: 0,    mailOrderCopay: 500  },
      tier2Generic:          { label: 'Generic',           retailCopay: 400,  mailOrderCopay: 1000 },
      tier3PreferredBrand:   { label: 'Preferred Brand',   retailCopay: 4500, mailOrderCopay: 4700 },
      tier4NonPreferred:     { label: 'Non-Preferred Drug', retailCoinsurancePercent: 50, mailOrderCoinsurancePercent: 50 },
      tier5Specialty:        { label: 'Specialty',          retailCoinsurancePercent: 33, mailOrderCoinsurancePercent: 33 },
    },
  },
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
  const b = DEMO_PLAN.defaultBenefits;
  const acs = b.additionalCostSharing;
  const sup = b.supplementalBenefits;
  const rx = DEMO_PLAN.partD;
  const t = rx.tiers;

  const coverageSection = coverage
    ? `Plan Type: ${coverage.planType ?? DEMO_PLAN.planType}
Status: ${coverage.status ?? 'active'}
Period: ${coverage.periodStart ? fmtDate(coverage.periodStart) : 'N/A'} to ${coverage.periodEnd ? fmtDate(coverage.periodEnd) : 'N/A'}`
    : `Plan Type: ${DEMO_PLAN.planType}
Status: Active
Period: January 1, ${b.planYear} to December 31, ${b.planYear}`;

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
- All amounts shown to member must be in dollars (e.g. $130.00)
- When you don't know something, say "I don't have that information in your records"

MEMBER PROFILE:
Name: ${member.displayName}
Date of Birth: ${member.dateOfBirth}
Member ID: ${member.memberId}
Plan: ${DEMO_PLAN.planName}
Plan Year: ${b.planYear}
${member.phone ? 'Phone: ' + member.phone : ''}
${member.address ? 'Address: ' + member.address : ''}

COST SHARING:
Deductible: ${fmt(accumulators.deductiblePaid)} paid of ${fmt(b.individualDeductible)} total
Out-of-Pocket Maximum: ${fmt(accumulators.oopPaid)} paid of ${fmt(b.individualOopMax)} total
PCP Visit: No copay
Specialist Visit: ${fmt(b.specialistCopay)} copay
Urgent Care: ${fmt(b.urgentCareCopay)} copay
Emergency Room: ${fmt(b.erCopay)} copay
Inpatient Hospital: ${fmt(acs.inpatientHospitalPerDay1to5)}/day for days 1-5, then no copay through day 90
Skilled Nursing Facility: ${fmt(acs.skilledNursingFacilityPerDay1to20)}/day for days 1-20, ${fmt(acs.skilledNursingFacilityPerDay21to100)}/day for days 21-100
Ground Ambulance: ${fmt(acs.groundAmbulance)} copay
Physical Therapy: ${fmt(acs.physicalTherapy)} copay per visit
Occupational Therapy: ${fmt(acs.occupationalTherapy)} copay per visit
Mental Health (outpatient): No copay
Lab Services: No copay
Coinsurance: ${b.coinsurancePercent}% for applicable services
Part B Giveback: ${fmt(b.partBGivebackCents)}/month reduction in Part B premium

PRESCRIPTION DRUGS (Part D — ${rx.planName}):
Monthly Premium: ${fmt(rx.monthlyPremiumCents)}
Annual Deductible: None
Tier 1 Preferred Generic: No copay at retail, ${fmt(t.tier1PreferredGeneric.mailOrderCopay)} by mail
Tier 2 Generic: ${fmt(t.tier2Generic.retailCopay)} at retail, ${fmt(t.tier2Generic.mailOrderCopay)} by mail
Tier 3 Preferred Brand: ${fmt(t.tier3PreferredBrand.retailCopay)} at retail, ${fmt(t.tier3PreferredBrand.mailOrderCopay)} by mail
Tier 4 Non-Preferred: ${t.tier4NonPreferred.retailCoinsurancePercent}% coinsurance
Tier 5 Specialty: ${t.tier5Specialty.retailCoinsurancePercent}% coinsurance

SUPPLEMENTAL BENEFITS:
Dental: ${sup.dental ? `Included — exams, cleanings, and X-rays at no cost; restorative care at ${b.dentalHighlights.restorativeCoinsurance}% coinsurance` : 'Not included'}
Vision: ${sup.vision ? 'Included — routine exam and eyeglasses or contacts at no cost' : 'Not included'}
Hearing: ${sup.hearing ? `Included — exam at no cost; hearing aids from ${fmt(b.hearingHighlights.prescriptionHearingAidMin)} to ${fmt(b.hearingHighlights.prescriptionHearingAidMax)}` : 'Not included'}
Fitness: ${sup.fitness ? 'Included' : 'Not included'}
Telehealth: ${sup.telehealth ? 'Included' : 'Not included'}

COVERAGE:
${coverageSection}

RECENT CLAIMS (up to 8, newest first):
${recentClaimsText(claims.slice(0, 8))}

MEDICATIONS (up to 10):
${medicationsText(medications.slice(0, 10))}`;
}
