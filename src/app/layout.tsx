import type { Metadata } from 'next';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '800'] });
const body = Public_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = { title: 'Dispatch: ride-sharing and smart dispatch', description: 'DBMS Level 3 project' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
