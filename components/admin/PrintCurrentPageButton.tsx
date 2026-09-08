'use client';

import { useEffect } from 'react';

export default function PrintCurrentPageButton({ autoPrint = false, label = 'Diese Seite drucken' }: { autoPrint?: boolean; label?: string }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return <button className="ks-button secondary no-print" type="button" onClick={() => window.print()}>{label}</button>;
}
