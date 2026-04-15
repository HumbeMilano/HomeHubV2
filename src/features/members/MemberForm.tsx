import { useRef, useState } from 'react';
import type { Member } from '../../types';
import { useMembersStore } from '../../store/membersStore';
import { supabase } from '../../lib/supabase';
import { uid } from '../../lib/utils';

const MEMBER_COLORS = [
  '#5b5bf6',
  '#60a5fa',
  '#34d399',
  '#4ade80',
  '#fb923c',
  '#f472b6',
  '#ef4444',
  '#facc15',
  '#818cf8',
  '#38bdf8',
];

interface Props {
  existing?: Member;
  onClose: () => void;
}

export default function MemberForm({ existing, onClose }: Props) {
  const { addMember, updateMember } = useMembersStore();

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? MEMBER_COLORS[0]);
  const [pin, setPin] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten imágenes.');
      return;
    }
    setUploadError('');
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    setImageFile(null);
    setPreviewUrl(null);
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadPhoto(memberId: string): Promise<string | null> {
    if (!imageFile) return avatarUrl;
    const ext = imageFile.name.split('.').pop() ?? 'jpg';
    const path = `${memberId}/${uid()}.${ext}`;
    const { error } = await supabase.storage
      .from('member-avatars')
      .upload(path, imageFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('member-avatars').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      if (existing) {
        const newAvatarUrl = imageFile ? await uploadPhoto(existing.id) : avatarUrl;
        const patch: Partial<Member> & { pin?: string } = {
          name,
          color,
          avatar_url: newAvatarUrl,
          ...(pin ? { pin } : {}),
        };
        await updateMember(existing.id, patch);
      } else {
        if (!pin) { setSaving(false); return; }
        const saved = await addMember({ name, color, pin });
        const newAvatarUrl = imageFile ? await uploadPhoto(saved.id) : null;
        if (newAvatarUrl) {
          await updateMember(saved.id, { avatar_url: newAvatarUrl });
        }
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  const initials = name.slice(0, 2).toUpperCase() || '??';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Member' : 'New Member'}
      </h2>

      {/* Avatar preview + upload */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <div
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: color, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}
        >
          {previewUrl
            ? <img src={previewUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials
          }
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {previewUrl && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--danger)' }}
              onClick={handleRemovePhoto}
            >
              Remove
            </button>
          )}
        </div>
        {uploadError && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{uploadError}</span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Name */}
      <div className="field">
        <label htmlFor="member-name">Name *</label>
        <input
          id="member-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ana García"
          required
          autoFocus
        />
      </div>

      {/* Color picker — only show when no photo */}
      {!previewUrl && (
        <div className="field">
          <label>Avatar color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: c, border: 'none', cursor: 'pointer',
                  outline: color === c ? `3px solid var(--text)` : '3px solid transparent',
                  outlineOffset: 2,
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* PIN */}
      <div className="field">
        <label htmlFor="member-pin">
          PIN {existing ? '(leave blank to keep current)' : '*'}
        </label>
        <input
          id="member-pin"
          className="input"
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={existing ? '••••' : '4 digits'}
          required={!existing}
          maxLength={4}
          pattern="[0-9]{4}"
        />
      </div>

      {saveError && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)', margin: 0 }}>
          Error: {saveError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add member'}
        </button>
      </div>
    </form>
  );
}
