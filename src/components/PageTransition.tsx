import { useLayoutEffect, useRef } from 'react';
import type { AppPage } from '../types';

interface Props {
  page: AppPage;
  children: React.ReactNode;
}

export default function PageTransition({ page, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // useLayoutEffect runs synchronously after DOM mutations but before paint,
  // so we can set opacity:0 on the new content before the browser draws it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
    el.style.transition = 'none';
    const frame = requestAnimationFrame(() => {
      el.style.transition = 'opacity var(--transition-page), transform var(--transition-page)';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);

  return (
    <div ref={ref} style={{ height: '100%', width: '100%' }}>
      {children}
    </div>
  );
}
