import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, GripVertical, X } from 'lucide-react';
import type { Note } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { subscribeToTable } from '../../../lib/realtime';
import { uid } from '../../../lib/utils';
import styles from './NotesWidget.module.css';

// Muted, readable pastels
const NOTE_COLORS = ['#e9d97a', '#7ecfaa', '#7ab8e8', '#d97ab8', '#e8a870', '#a889d4'];

export default function NotesWidget() {
  const { activeMember } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('notes').select('*').then(({ data }) => setNotes((data ?? []) as Note[]));
  }, []);

  useEffect(() => {
    const unsub = subscribeToTable<Note>({
      table: 'notes',
      onData: ({ eventType, new: row, old }) => {
        if (eventType === 'INSERT' && row) setNotes((p) => [...p.filter((n) => n.id !== row.id), row]);
        if (eventType === 'UPDATE' && row) setNotes((p) => p.map((n) => n.id === row.id ? row : n));
        if (eventType === 'DELETE' && old) setNotes((p) => p.filter((n) => n.id !== old.id));
      },
    });
    return unsub;
  }, []);

  async function addNote() {
    const board = boardRef.current;
    const w = 120; const h = 100;
    const x = board ? Math.random() * Math.max(0, board.offsetWidth - w - 8) + 4 : 4;
    const y = board ? Math.random() * Math.max(0, board.offsetHeight - h - 8) + 4 : 4;
    const note: Note = {
      id: uid(),
      content: '',
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      author_id: activeMember?.id ?? null,
      is_shared: true,
      position_x: Math.round(x),
      position_y: Math.round(y),
      width: w,
      height: h,
      on_lock_screen: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setNotes((p) => [...p, note]);
    await supabase.from('notes').insert(note);
  }

  async function updateNote(id: string, patch: Partial<Note>) {
    const updated = new Date().toISOString();
    setNotes((p) => p.map((n) => n.id === id ? { ...n, ...patch, updated_at: updated } : n));
    await supabase.from('notes').update({ ...patch, updated_at: updated }).eq('id', id);
  }

  async function deleteNote(id: string) {
    setNotes((p) => p.filter((n) => n.id !== id));
    await supabase.from('notes').delete().eq('id', id);
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.title}><FileText size={14} /> Notes</span>
        <button className="btn btn--primary btn--sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={addNote}><Plus size={12} /> Add</button>
      </div>
      <div className={styles.board} ref={boardRef}>
        {notes.map((note) => (
          <MiniNote
            key={note.id}
            note={note}
            boardRef={boardRef}
            onUpdate={(patch) => updateNote(note.id, patch)}
            onDelete={() => deleteNote(note.id)}
          />
        ))}
        {notes.length === 0 && (
          <div className={styles.empty}>
            <FileText size={28} />
            <p>No notes yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniNote({ note, boardRef, onUpdate, onDelete }: {
  note: Note;
  boardRef: React.RefObject<HTMLDivElement | null>;
  onUpdate: (patch: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: note.position_x, oy: note.position_y };

    function onMove(me: MouseEvent) {
      if (!drag.current || !cardRef.current) return;
      cardRef.current.style.left = `${drag.current.ox + me.clientX - drag.current.sx}px`;
      cardRef.current.style.top  = `${drag.current.oy + me.clientY - drag.current.sy}px`;
    }
    function onUp(me: MouseEvent) {
      if (!drag.current) return;
      const board = boardRef.current;
      const bw = board?.offsetWidth ?? 999; const bh = board?.offsetHeight ?? 999;
      const nx = Math.max(0, Math.min(bw - note.width - 4, drag.current.ox + me.clientX - drag.current.sx));
      const ny = Math.max(0, Math.min(bh - note.height - 4, drag.current.oy + me.clientY - drag.current.sy));
      onUpdate({ position_x: Math.round(nx), position_y: Math.round(ny) });
      drag.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={cardRef}
      className={styles.note}
      style={{ left: note.position_x, top: note.position_y, width: note.width, minHeight: note.height, background: note.color }}
      onMouseDown={onMouseDown}
    >
      <div className={styles.noteHandle}>
        <GripVertical size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
        <button className={styles.del} onClick={(e) => { e.stopPropagation(); onDelete(); }}><X size={10} /></button>
      </div>
      <textarea
        className={styles.text}
        value={note.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Write…"
      />
    </div>
  );
}
