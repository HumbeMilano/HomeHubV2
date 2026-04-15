import { useEffect, useRef } from 'react';
import type { AppPage } from '../types';

interface Props {
  page: AppPage;
  children: React.ReactNode;
}

export default function PageTransition({ page, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-enter', 'page-enter-active');
    el.classList.add('page-enter');
    const frame = requestAnimationFrame(() => {
      el.classList.add('page-enter-active');
      el.classList.remove('page-enter');
    });
    return () => cancelAnimationFrame(frame);
  }, [page]);

  return (
    <div ref={ref} style={{ height: '100%', width: '100%' }}>
      {children}
    </div>
  );
}
