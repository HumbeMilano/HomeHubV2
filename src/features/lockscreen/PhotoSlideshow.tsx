import { useEffect, useState } from 'react';
import type { Photo } from '../../types';
import { supabase } from '../../lib/supabase';

// Fallback gradient backgrounds shown when no photos are uploaded
const GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #0d0d0d 0%, #1a0533 50%, #2d0057 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  'linear-gradient(135deg, #141414 0%, #1f1f3a 50%, #252550 100%)',
];

interface Props {
  interval?: number; // ms between slides, default 30000
}

export default function PhotoSlideshow({ interval = 30_000 }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Load photos from Supabase on mount
  useEffect(() => {
    supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) setPhotos(data as Photo[]);
      });
  }, []);

  // Auto-advance
  useEffect(() => {
    if (interval <= 0) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % Math.max(photos.length, GRADIENTS.length));
        setFade(true);
      }, 600);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, photos.length]);

  const background = photos.length > 0
    ? `url(${photos[index % photos.length].url}) center/cover no-repeat`
    : GRADIENTS[index % GRADIENTS.length];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background,
        transition: 'opacity 600ms ease',
        opacity: fade ? 1 : 0,
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
