// Civil decree supplementary Art.10(10), NEW ENTRANT column only, <=1 through <=33 years.
// Matches the decree text of Presidential Decrees 21974 (2010), 24890 and 25840 and a commercial
// teacher pension calculator; 84.62% (13th year) verified against an agency quote (2026-11-20).
// Never used for pre-2010 careers.
export const newEntrantFactors = [77.25,78.03,78.35,78.91,79.56,80.06,80.72,81.32,81.75,82.45,82.89,83.70,84.62,
  85.65,86.70,87.89,89.00,90.25,91.42,92.52,92.86,93.30,93.81,94.53,95.33,96.07,97.02,97.90,98.99,100.00,101.09,102.23,103.44] as const;
export function newEntrantFactor(months: number): number | null {
  return Number.isInteger(months) && months > 0 ? newEntrantFactors[Math.min(33, Math.ceil(months / 12)) - 1] : null;
}
