import * as fs from 'fs';
import * as path from 'path';

export interface Member {
  patientId: string;
  displayName: string;
  dateOfBirth: string;
  memberId: string;
  phone?: string;
  address?: string;
  gender?: string;
  primaryCareProvider?: string;
}

export interface Claim {
  claimId: string;
  serviceDate: string;
  serviceEndDate?: string;
  providerName: string;
  facilityName?: string;
  specialty?: string;
  serviceDescription: string;
  claimType: 'medical' | 'pharmacy' | 'dental' | 'vision';
  status: 'processed' | 'denied' | 'pending';
  billedAmount: number;        // cents
  planPaid: number;            // cents
  memberOwes: number;          // cents
  deductibleApplied: number;   // cents
  copay: number;               // cents
  coinsurance: number;         // cents
  isDenied: boolean;
  denialReason?: string;
  diagnoses: string[];
}

export interface Coverage {
  planName: string;
  planType: string;
  periodStart: string;
  periodEnd: string;
  groupNumber?: string;
  subscriberId?: string;
  insurerName?: string;
  status?: string;
}

export interface AccumulatorState {
  deductiblePaid: number;   // cents
  deductibleTotal: number;  // cents
  oopPaid: number;          // cents
  oopTotal: number;         // cents
  planYear: string;
  eobCount: number;
}

export interface Medication {
  name: string;
  dosage?: string;
  prescribedDate: string;
  status: string;
  prescriberName?: string;
  tier?: string;
  refillsRemaining?: number;
  daysSupply?: number;
}

export type ClaimType = 'medical' | 'pharmacy' | 'dental' | 'vision';
export type ClaimStatus = 'processed' | 'denied' | 'pending';

export interface LoadedPatientData {
  patientId: string;
  member: Member;
  claims: Claim[];
  coverage: Coverage | null;
  accumulators: AccumulatorState;
  medications: Medication[];
}

export function loadAllPatients(testDataDir: string): Map<string, LoadedPatientData> {
  const result = new Map<string, LoadedPatientData>();

  const files = fs.readdirSync(testDataDir).filter(f => f.endsWith('.json'));

  for (const name of files) {
    try {
      const filePath = path.join(testDataDir, name);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const patientId: string = raw.member.patientId;

      const member: Member = {
        patientId,
        displayName: raw.member.displayName,
        dateOfBirth: raw.member.dateOfBirth,
        memberId: raw.member.memberId,
        phone: raw.member.phone,
        address: raw.member.address,
        gender: raw.member.gender,
        primaryCareProvider: raw.member.primaryCareProvider,
      };

      const coverage: Coverage | null = raw.coverage ? {
        planName: raw.coverage.planName,
        planType: raw.coverage.planType,
        periodStart: raw.coverage.periodStart ?? '',
        periodEnd: raw.coverage.periodEnd ?? '',
        groupNumber: raw.coverage.groupNumber,
        subscriberId: raw.coverage.subscriberId,
        insurerName: raw.coverage.insurerName,
        status: raw.coverage.status,
      } : null;

      const acc = raw.accumulators ?? {};
      const accumulators: AccumulatorState = {
        deductiblePaid:  Math.round((acc.deductiblePaid  ?? 0) * 100),
        deductibleTotal: Math.round((acc.deductibleTotal ?? 0) * 100),
        oopPaid:         Math.round((acc.oopPaid         ?? 0) * 100),
        oopTotal:        Math.round((acc.oopTotal        ?? 0) * 100),
        planYear:        acc.planYear ?? '',
        eobCount:        (raw.claims ?? []).length,
      };

      const claims: Claim[] = (raw.claims ?? []).map((c: any): Claim => ({
        claimId:            c.claimId,
        serviceDate:        c.serviceDate,
        serviceEndDate:     c.serviceEndDate,
        providerName:       c.providerName,
        facilityName:       c.facilityName,
        specialty:          c.specialty,
        serviceDescription: c.serviceDescription ?? '',
        claimType:          c.claimType,
        status:             c.status,
        isDenied:           c.isDenied ?? false,
        denialReason:       c.denialReason,
        billedAmount:       Math.round((c.billedAmount      ?? 0) * 100),
        planPaid:           Math.round((c.planPaid          ?? 0) * 100),
        memberOwes:         Math.round((c.memberOwes        ?? 0) * 100),
        deductibleApplied:  Math.round((c.deductibleApplied ?? 0) * 100),
        copay:              Math.round((c.copay             ?? 0) * 100),
        coinsurance:        Math.round((c.coinsurance       ?? 0) * 100),
        diagnoses:          c.diagnoses ?? [],
      }));

      claims.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));

      const medications: Medication[] = (raw.medications ?? []).map((m: any): Medication => ({
        name:             m.name,
        dosage:           m.dosage,
        prescribedDate:   m.prescribedDate,
        status:           m.status,
        prescriberName:   m.prescriberName,
        tier:             m.tier,
        refillsRemaining: m.refillsRemaining,
        daysSupply:       m.daysSupply,
      }));

      result.set(patientId, { patientId, member, claims, coverage, accumulators, medications });
      console.log(`[loader] Loaded ${name}: ${claims.length} claims, ${medications.length} meds`);
    } catch (err) {
      console.warn(`[loader] Skipped ${name}: ${err}`);
    }
  }

  return result;
}

export function getPatientList(
  patients: Map<string, LoadedPatientData>
): Array<{ patientId: string; displayName: string }> {
  return Array.from(patients.values())
    .map(p => ({ patientId: p.patientId, displayName: p.member.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
