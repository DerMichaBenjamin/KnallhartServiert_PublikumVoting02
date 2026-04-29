import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Knallhart serviert Publikums-Voting', description: 'Publikums-Voting für Knallhart serviert' };
export default function RootLayout({children}:{children:React.ReactNode}){ return <html lang="de"><body>{children}</body></html>; }
