import Link from 'next/link';
export default function Header(){return <header className="site-header"><Link href="/release-voting" className="mini-logo"><img src="/khs-logo.png" alt="Knallhart serviert"/></Link><nav><Link href="/release-voting">Voting</Link><Link href="/ergebnisse">Ergebnisse</Link><Link href="/kontakt">Kontakt</Link></nav></header>}
