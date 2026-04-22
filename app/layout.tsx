import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Mood Tracker | Tu archivo lumínico',
  description: 'Un diario de estado de ánimo diario',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={`${inter.variable}`}>
      <body className="font-body antialiased min-h-screen flex flex-col selection:bg-primary/30 text-on-surface bg-background" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
