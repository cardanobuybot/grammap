'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { IconClose } from './icons';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * A panel beside the map: slides up from the bottom on phones, sits on the right on
 * wide screens. The map stays usable behind it.
 */
export function Sheet({ title, onClose, children, footer }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside ref={ref} className="sheet" role="dialog" aria-label={title} tabIndex={-1}>
      <header className="sheet__head">
        <h2 className="sheet__title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')}>
          <IconClose />
        </button>
      </header>
      <div className="sheet__body">{children}</div>
      {footer ? <footer className="sheet__foot">{footer}</footer> : null}
    </aside>
  );
}
