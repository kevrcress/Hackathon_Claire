import { Claim, AccumulatorState } from './loader';

export function calculateAccumulators(
  claims: Claim[],
  deductibleTotal: number,
  oopTotal: number,
  planYear: string
): AccumulatorState {
  // Filter to processed claims in the matching plan year
  const yearClaims = claims.filter(
    c => c.status === 'processed' && c.serviceDate.startsWith(planYear)
  );

  let totalDeductible = 0;
  let totalCopay = 0;
  let totalCoinsurance = 0;
  let totalMemberOwes = 0;

  for (const claim of yearClaims) {
    totalDeductible += claim.deductibleApplied;
    totalCopay += claim.copay;
    totalCoinsurance += claim.coinsurance;
    totalMemberOwes += claim.memberOwes;
  }

  // Synthea fallback: deductibleApplied is sparse in Synthea data, use memberOwes as proxy
  let deductiblePaid = totalDeductible;
  if (deductiblePaid === 0 && deductibleTotal > 0) {
    deductiblePaid = Math.min(totalMemberOwes, deductibleTotal);
  }

  // Synthea fallback: if oopPaid is 0, sum totalMemberOwes instead
  let oopPaid = totalDeductible + totalCopay + totalCoinsurance;
  if (oopPaid === 0) {
    oopPaid = totalMemberOwes;
  }

  // Cap both at their respective maximums
  deductiblePaid = Math.min(deductiblePaid, deductibleTotal);
  oopPaid = Math.min(oopPaid, oopTotal);

  return {
    deductiblePaid,
    deductibleTotal,
    oopPaid,
    oopTotal,
    planYear,
    eobCount: yearClaims.length,
  };
}
