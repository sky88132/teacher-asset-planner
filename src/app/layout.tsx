import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '교사 자산 플래너',
  description: '교사를 위한 은퇴자산 통합 관리 · 간편 계산 준비',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
