import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, ImageOff } from 'lucide-react';
import type { Photo } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { uid } from '../../lib/utils';
import { normalizeImageForUpload } from '../../lib/imageProcessing';
import styles from './PhotoManager.module.css';

export default function PhotoManager() {
  const { activeMember } = useAuthStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPhotos((data ?? []) as Photo[]));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);

    for (const rawFile of Array.from(files)) {
      let file: File;
      try {
        file = await normalizeImageForUpload(rawFile);
      } catch (e) {
        setError(`Failed to process ${rawFile.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setUploading(false);
        return;
      }
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${uid()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setError(`Upload failed: ${uploadErr.message}`);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path);

      const record: Photo = {
        id: uid(),
        url: publicUrl,
        storage_path: path,
        uploaded_by: activeMember?.id ?? null,
        created_at: new Date().toISOString(),
      };

      await supabase.from('photos').insert(record);
      setPhotos((p) => [record, ...p]);
    }

    setUploading(false);
  }

  async function deletePhoto(photo: Photo) {
    // Remove from storage
    await supabase.storage.from('photos').remove([photo.storage_path]);
    // Remove from DB
    await supabase.from('photos').delete().eq('id', photo.id);
    setPhotos((p) => p.filter((ph) => ph.id !== photo.id));
  }

  return (
    <div className={styles.root}>
      {/* Upload button */}
      <button
        className={styles.uploadBtn}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload size={16} />
        {uploading ? 'Uploading…' : 'Add Photos'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className={styles.error}>{error}</p>}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className={styles.empty}>
          <ImageOff size={28} />
          <p>No photos yet. Add some to show on the lock screen.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {photos.map((photo) => (
            <div key={photo.id} className={styles.thumb}>
              <img src={photo.url} alt="" />
              <button
                className={styles.deleteBtn}
                onClick={() => deletePhoto(photo)}
                title="Remove photo"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
