import type { KtcuProduct } from './ktcu-input.ts';

export const ktcuReviewedOn = '2026-11-07';
export const ktcuProducts: Record<KtcuProduct, { name: string; url: string; rate: number; effectiveOn: string; summary: string }> = {
  'long-term': { name: '장기저축급여', url: 'https://www.ktcu.or.kr/PPW-FIA-101000', rate: 5, effectiveOn: '2026-07-01',
    summary: '월 3만~150만원, 6천원 단위. 2019년 전후 부담금과 특별가산금을 구분합니다. 앱은 가입자격·상품 급여액을 자동 판정하지 않습니다.' },
  installment: { name: '장기저축급여 분할급여금', url: 'https://www.ktcu.or.kr/PPW-FIA-300101', rate: 5, effectiveOn: '2026-07-01',
    summary: '퇴직급여 청구 시 신청하는 별도 제도입니다. 5·10·15·20·25·30년, 월/연 지급 조건을 확인하세요. 앱의 가상 인출은 이 상품의 급여액이 아닙니다.' },
  'retirement-interest': { name: '퇴직생활급여 · 부가금형', url: 'https://www.ktcu.or.kr/PPW-FIA-400100', rate: 4.12, effectiveOn: '2026-10-20',
    summary: '월 부가금형은 이자 지급 후 원금을 별도로 받습니다. 월 지급 기준 연 4.12%, 연 지급 기준 4.20%로 구분합니다.' },
  'retirement-annuity': { name: '퇴직생활급여 · 확정연금형', url: 'https://www.ktcu.or.kr/PPW-FIA-400100', rate: 5, effectiveOn: '2026-07-01',
    summary: '원리금 분할 지급 상품으로 5·10·15·20년 조건이 안내되어 있습니다. 장기저축급여 분할급여금과 다른 상품입니다.' },
  'retirement-saving': { name: '퇴직생활급여 · 적립형', url: 'https://www.ktcu.or.kr/PPW-FIA-400100', rate: 4.2, effectiveOn: '2026-10-20',
    summary: '3·5년 적립 후 만기 지급 상품입니다. 장기저축급여용 적립 시뮬레이션을 이 상품에 적용하지 않습니다.' },
};
