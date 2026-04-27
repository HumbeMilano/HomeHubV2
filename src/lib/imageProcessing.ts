// Client-side HEIC/HEIF → JPEG conversion before Supabase Storage upload.
// Browsers other than Safari can't render HEIC, so without conversion the
// stored file silently becomes a broken image cross-device. heic2any is
// dynamically imported so its ~310KB gzipped payload only loads when a
// HEIC file is actually picked.
export async function normalizeImageForUpload(file: File): Promise<File> {
  const byMime    = file.type === 'image/heic' || file.type === 'image/heif';
  const byExt     = /\.(heic|heif)$/i.test(file.name);
  if (!byMime && !byExt) return file;

  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(result) ? result[0] : result;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
}
