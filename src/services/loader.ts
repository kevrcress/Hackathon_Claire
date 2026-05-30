import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface Member {
  patientId: string;
  displayName: string;
  dateOfBirth: string;
  memberId: string;
  phone?: string;
  address?: string;
  gender?: string;
}

export interface Claim {
  claimId: string;
  serviceDate: string;
  serviceEndDate?: string;
  providerName: string;
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

function stripDigits(name: string): string {
  return name.replace(/\d+/g, '').trim();
}

function buildNpiNameMap(entries: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.resource?.resourceType !== 'Encounter') continue;
    for (const participant of entry.resource.participant ?? []) {
      const ref: string = participant.individual?.reference ?? '';
      const display: string = participant.individual?.display ?? '';
      if (ref && display) {
        const npi = ref.split('/').pop() ?? '';
        if (npi) map.set(npi, display);
      }
    }
  }
  return map;
}

function mapClaimType(code: string | undefined): ClaimType {
  switch (code) {
    case 'pharmacy': return 'pharmacy';
    case 'institutional': return 'medical';
    case 'professional': return 'medical';
    default: return 'medical';
  }
}

function mapClaimStatus(eob: any): ClaimStatus {
  if (eob.outcome === 'error') return 'denied';
  if (eob.status === 'active') return 'processed';
  if (eob.status === 'cancelled') return 'denied';
  if (eob.status === 'draft') return 'pending';
  return 'processed';
}

function resolveProviderName(eob: any, npiNameMap: Map<string, string>): string {
  // 1. eob.provider.display
  if (eob.provider?.display && !eob.provider.display.startsWith('NPI:')) {
    return eob.provider.display;
  }

  // 2. careTeam primary display
  const careTeamPrimary = (eob.careTeam ?? []).find(
    (ct: any) => ct.role?.coding?.[0]?.code === 'primary'
  );
  if (careTeamPrimary?.provider?.display && !careTeamPrimary.provider.display.startsWith('NPI:')) {
    return careTeamPrimary.provider.display;
  }

  // 3. NPI lookup via npiNameMap
  const npiRef: string = eob.provider?.reference ?? '';
  if (npiRef) {
    const npi = npiRef.split('/').pop() ?? '';
    if (npi) {
      const fromMap = npiNameMap.get(npi);
      if (fromMap && !fromMap.startsWith('NPI:')) return fromMap;
    }
  }

  // 4. Fallback
  return 'Your provider';
}

export function loadAllPatients(testDataDir: string): Map<string, LoadedPatientData> {
  const result = new Map<string, LoadedPatientData>();

  const files = fs.readdirSync(testDataDir).filter(f => f.endsWith('.json'));

  for (const name of files) {
    try {
      const filePath = path.join(testDataDir, name);
      const bundle = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const entries: any[] = bundle.entry ?? [];

      // Build resource map: fullUrl -> resource
      const resourceMap = new Map<string, any>();
      for (const entry of entries) {
        if (entry.fullUrl && entry.resource) {
          resourceMap.set(entry.fullUrl, entry.resource);
        }
      }

      // Build NPI name map from Encounter participants
      const npiNameMap = buildNpiNameMap(entries);

      // Extract Patient
      const patientResource = entries.find(e => e.resource?.resourceType === 'Patient')?.resource;
      if (!patientResource) {
        console.warn(`[loader] Skipped bad file ${name}: no Patient resource found`);
        continue;
      }

      const patientId = name.replace(/\.json$/, '');

      const givenNames: string[] = patientResource.name?.[0]?.given ?? [];
      const familyName: string = patientResource.name?.[0]?.family ?? '';
      const displayName = stripDigits(givenNames.join(' ') + ' ' + familyName);

      const memberId =
        patientResource.identifier?.find(
          (i: any) => i.type?.coding?.[0]?.code === 'MB'
        )?.value ?? patientId;

      const dateOfBirth: string = patientResource.birthDate ?? '';

      const phone: string | undefined = patientResource.telecom?.find(
        (t: any) => t.system === 'phone'
      )?.value;

      const addr = patientResource.address?.[0];
      const address: string | undefined =
        addr?.city && addr?.state ? `${addr.city}, ${addr.state}` : undefined;

      const gender: string | undefined = patientResource.gender;

      const member: Member = {
        patientId,
        displayName,
        dateOfBirth,
        memberId,
        phone,
        address,
        gender,
      };

      // Extract EOBs
      const claims: Claim[] = [];
      let latestEobDate = '';
      let coverageResource: any = null;

      const eobEntries = entries.filter(
        e => e.resource?.resourceType === 'ExplanationOfBenefit'
      );

      for (const entry of eobEntries) {
        const eob = entry.resource as any;

        // Skip NO_INSURANCE
        const insurerDisplay: string = eob.insurer?.display ?? '';
        if (
          insurerDisplay === 'NO_INSURANCE' ||
          insurerDisplay.toLowerCase().includes('no_insurance')
        ) {
          continue;
        }

        // Skip old claims
        const serviceDate: string = eob.billablePeriod?.start ?? '';
        const serviceDateShort = serviceDate.substring(0, 10);
        if (serviceDateShort < '2020-01-01') continue;

        const claimType = mapClaimType(eob.type?.coding?.[0]?.code);
        const status = mapClaimStatus(eob);
        const isDenied = status === 'denied';

        // Financials from eob.total[]
        const totals: any[] = eob.total ?? [];
        const billedRaw =
          totals.find(
            (t: any) => t.category?.coding?.[0]?.code === 'submitted'
          )?.amount?.value ?? 0;
        const planPaidRaw =
          totals.find(
            (t: any) => t.category?.coding?.[0]?.code === 'benefit'
          )?.amount?.value ?? 0;
        const memberOwesRaw =
          totals.find(
            (t: any) => t.category?.coding?.[0]?.code === 'memberliability'
          )?.amount?.value ?? (eob.payment?.amount?.value ?? 0);

        const billedAmount = Math.round(billedRaw * 100);
        const planPaid = Math.round(planPaidRaw * 100);
        const memberOwes = Math.round(memberOwesRaw * 100);
        const deductibleApplied = 0;
        const copay = 0;
        const coinsurance = 0;

        const providerName = resolveProviderName(eob, npiNameMap);

        // Diagnoses
        const diagnoses: string[] = (eob.diagnosis ?? [])
          .map((d: any) => d.diagnosisCodeableConcept?.coding?.[0]?.display ?? '')
          .filter(Boolean);

        const claimId: string =
          eob.id ?? eob.identifier?.[0]?.value ?? crypto.randomUUID();

        const serviceEndDate: string | undefined = eob.billablePeriod?.end
          ? eob.billablePeriod.end.substring(0, 10)
          : undefined;

        claims.push({
          claimId,
          serviceDate: serviceDateShort,
          serviceEndDate,
          providerName,
          claimType,
          status,
          billedAmount,
          planPaid,
          memberOwes,
          deductibleApplied,
          copay,
          coinsurance,
          isDenied,
          diagnoses,
        });

        // Track most recent EOB for coverage extraction
        if (serviceDateShort > latestEobDate) {
          latestEobDate = serviceDateShort;
          const contained: any[] = eob.contained ?? [];
          const cov = contained.find((r: any) => r.resourceType === 'Coverage');
          if (cov) {
            coverageResource = cov;
          }
        }
      }

      // Build Coverage from most recent EOB's contained Coverage resource
      let coverage: Coverage | null = null;
      if (coverageResource) {
        const planType: string =
          coverageResource.type?.text ??
          coverageResource.type?.coding?.[0]?.display ??
          'Medicare Advantage';
        const insurerName: string | undefined = coverageResource.payor?.[0]?.display;
        const covStatus: string | undefined = coverageResource.status;

        coverage = {
          planName: insurerName ?? planType,
          planType,
          periodStart: '',
          periodEnd: '',
          insurerName,
          status: covStatus,
        };
      }

      // Extract MedicationRequests
      const medications: Medication[] = [];
      const medEntries = entries.filter(
        e => e.resource?.resourceType === 'MedicationRequest'
      );

      for (const entry of medEntries) {
        const med = entry.resource as any;

        if (med.status !== 'active' && med.status !== 'completed') continue;

        let medName = 'Unknown medication';

        if (med.medicationCodeableConcept) {
          // Pattern 1: inline
          medName =
            med.medicationCodeableConcept.coding?.[0]?.display ??
            med.medicationCodeableConcept.text ??
            'Unknown medication';
        } else if (med.medicationReference?.reference) {
          // Pattern 2: reference lookup
          const ref: string = med.medicationReference.reference;
          const resource = resourceMap.get(ref);
          if (resource) {
            medName =
              resource.code?.coding?.[0]?.display ??
              resource.code?.text ??
              'Unknown medication';
          }
        }

        const dosage: string | undefined = med.dosageInstruction?.[0]?.text;
        const prescribedDate: string = med.authoredOn ?? '';
        const prescriberName: string | undefined = med.requester?.display;

        medications.push({
          name: medName,
          dosage,
          prescribedDate,
          status: med.status,
          prescriberName,
        });
      }

      // Sort claims descending by serviceDate
      claims.sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));

      const patientData: LoadedPatientData = {
        patientId,
        member,
        claims,
        coverage,
        accumulators: {
          deductiblePaid: 0,
          deductibleTotal: 0,
          oopPaid: 0,
          oopTotal: 0,
          planYear: '',
          eobCount: 0,
        },
        medications,
      };

      result.set(patientId, patientData);
      console.log(`[loader] Loaded ${name}: ${claims.length} claims, ${medications.length} meds`);
    } catch (err) {
      console.warn(`[loader] Skipped bad file ${name}: ${err}`);
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
