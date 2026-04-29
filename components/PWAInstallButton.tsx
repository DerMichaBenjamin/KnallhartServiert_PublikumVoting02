'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(standalone);

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowHint(false);
    }

    function onAppInstalled() {
      setInstallEvent(null);
      setShowHint(false);
      setIsStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (isStandalone) return null;

  async function handleInstallClick() {
    if (!installEvent) {
      setShowHint(true);
      return;
    }

    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <div className="w-full max-w-[1080px] rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm">
      <button className="btn w-full md:w-auto" onClick={handleInstallClick}>
        Als App zur Startseite hinzufügen
      </button>
      {showHint && (
        <p className="mt-3 text-sm font-semibold text-[#06285f]">
          Öffne das Browser-Menü und wähle „Zum Startbildschirm hinzufügen“.
        </p>
      )}
    </div>
  );
}
