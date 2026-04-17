import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '1em', radius = 'var(--r-sm)', className }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className ?? ''}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.card}>
      <Skeleton height={18} width="55%" radius="var(--r-xs)" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} height={13} width={`${70 - i * 10}%`} radius="var(--r-xs)" />
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <Skeleton width={36} height={36} radius="var(--r-md)" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton height={14} width="60%" radius="var(--r-xs)" />
            <Skeleton height={11} width="40%" radius="var(--r-xs)" />
          </div>
        </div>
      ))}
    </div>
  );
}
