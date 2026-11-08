import type { Metadata } from 'next';
import './globals.css';
import './planner-theme.css';

export const metadata: Metadata = {
  title: '교사 은퇴 연금 시뮬레이터',
  description: '교사 전용 은퇴 연금 시뮬레이터 · 공적연금·교직원공제회·IRP·연금저축 은퇴 설계',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
