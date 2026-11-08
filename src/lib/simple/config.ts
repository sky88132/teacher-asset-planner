/** Planning assumptions, not guaranteed returns or a statement of product eligibility. */
export const simpleConfig = {
  version: 'simple-2026-11-v5', checkedOn: '2026-11-08', ktcuRate: 5, irpRate: 7, savingRate: 8,
  salaryYear: 2026, maxStep: 40, maxMonths: 720, annualPersonalLimit: 18000000,
  contributionLawUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033240359',
  ktcuUrl: 'https://www.ktcu.or.kr/PPW-FIA-100100',
  splitUrl: 'https://www.ktcu.or.kr/PPW-FIA-300100',
  splitApplicationUrl: 'https://www.ktcu.or.kr/PPW-CSC-100201',
  salaryUrl: 'https://www.mpm.go.kr/mpm/info/resultPay/bizSalary/2026/',
  retirementUrl: 'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032085735',
  promotionUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027304115',
  militaryCivilUrl: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13110000035',
  militaryCivilLawUrl: 'https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=82190',
  militaryPrivateUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1030483837',
  militaryPrivateProcedureUrl: 'https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=03&joNo=0017&lsiSeq=290433&urlMode=lsScJoRltInfoR',
  militaryNationalUrl: 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0104M0.do',
} as const;
/** MPM 2026 teacher salary table, Annex 11, steps 1–40. No future raises or longevity additions. */
export const teacherSalary2026 = [
  2041500,2103300,2166000,2228500,2291500,2354400,2416600,2478600,2495600,2516700,
  2538300,2585900,2657500,2773700,2889700,3006200,3121000,3241500,3361200,3481000,
  3600700,3733600,3865300,3997500,4129400,4261900,4400100,4538000,4682100,4826800,
  4971100,5115200,5261600,5407500,5553600,5699100,5825700,5952500,6079500,6205700,
] as const;
export const simpleDisclaimer = '본 결과는 입력한 정보와 가정 수익률에 따른 예상 시뮬레이션입니다. 실제 연금액, 퇴직급여 및 투자 결과는 달라질 수 있으므로 참고용으로 활용하시기 바랍니다.';
