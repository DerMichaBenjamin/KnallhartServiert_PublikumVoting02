'use client';

import { usePathname } from 'next/navigation';

type IconName = 'dashboard' | 'rounds' | 'dj' | 'stats' | 'imprint' | 'logout';

function Icon({ name }: { name: IconName }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

  if (name === 'dashboard') return <svg {...common} aria-hidden="true"><path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  if (name === 'rounds') return <svg {...common} aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m2 0h3" /></svg>;
  if (name === 'dj') return <svg {...common} aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0" /><path d="M4 13v5a2 2 0 0 0 2 2h2v-8H6a2 2 0 0 0-2 2Zm16 0v5a2 2 0 0 1-2 2h-2v-8h2a2 2 0 0 1 2 2Z" /></svg>;
  if (name === 'stats') return <svg {...common} aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" /></svg>;
  if (name === 'imprint') return <svg {...common} aria-hidden="true"><path d="M7 3h8l3 3v15H7V3Z" /><path d="M15 3v4h4M10 12h5m-5 4h5" /></svg>;
  return <svg {...common} aria-hidden="true"><path d="M10 5H5v14h5m4-3 4-4-4-4m4 4H9" /></svg>;
}

const navigation = [
  { href: '/admin/release-voting', label: 'Dashboard', icon: 'dashboard' as const },
  { href: '/admin/rounds', label: 'Umfragen', icon: 'rounds' as const },
  { href: '/admin/dj-voting', label: 'DJ-Bewertungen', icon: 'dj' as const },
  { href: '/admin/statistics', label: 'Statistiken', icon: 'stats' as const },
  { href: '/admin/impressum', label: 'Impressum', icon: 'imprint' as const },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin/release-voting') return pathname === href;
  if (href === '/admin/rounds') {
    return pathname.startsWith('/admin/rounds')
      || (pathname.startsWith('/admin/release-voting/') && !pathname.includes('/results') && !pathname.includes('/statistics'));
  }
  if (href === '/admin/statistics' && (pathname.includes('/results') || pathname.includes('/statistics'))) return true;
  return pathname.startsWith(href);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className="ks-admin-app">
      <aside className="ks-admin-sidebar">
        <a className="ks-admin-brand" href="/admin/release-voting" aria-label="Zum Dashboard">
          <img src="/khs-logo.png" alt="Knallhart Serviert" />
          <span>Voting Backend</span>
        </a>

        <nav className="ks-admin-nav" aria-label="Admin-Navigation">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} className={isActive(pathname, item.href) ? 'active' : ''}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <form action="/api/admin/logout" method="post" className="ks-admin-logout">
          <button type="submit"><Icon name="logout" /><span>Logout</span></button>
        </form>
      </aside>
      <div className="ks-admin-main"><div className="ks-admin-content">{children}</div></div>
    </div>
  );
}
