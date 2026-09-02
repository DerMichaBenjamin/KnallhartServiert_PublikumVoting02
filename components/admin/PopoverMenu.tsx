'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';

const OPEN_EVENT = 'ks-admin-popover-open';

export default function PopoverMenu({
  label,
  trigger,
  triggerClassName,
  panelClassName = '',
  role = 'menu',
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  role?: 'menu' | 'dialog';
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    function onOtherPopover(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    }
    window.addEventListener(OPEN_EVENT, onOtherPopover);
    return () => window.removeEventListener(OPEN_EVENT, onOtherPopover);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]');
    firstFocusable?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [id, open]);

  return <div className="ks-controlled-popover" ref={rootRef}>
    <button
      ref={triggerRef}
      type="button"
      className={triggerClassName}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup={role === 'menu' ? 'menu' : 'dialog'}
      aria-controls={open ? id : undefined}
      onClick={() => setOpen((value) => !value)}
    >{trigger}</button>
    {open && <div id={id} ref={panelRef} className={`ks-controlled-popover-panel ${panelClassName}`} role={role} aria-label={label}>
      {typeof children === 'function' ? children(close) : children}
    </div>}
  </div>;
}
