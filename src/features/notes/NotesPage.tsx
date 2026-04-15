import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, GripVertical, X } from 'lucide-react';
import type { Note } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import { createBroadcastChannel } from '../../lib/broadcast';
import { uid } from '../../lib/utils';
import styles from './NotesPage.module.css';

const bc = createBroadcastChannel<Note>('notes');

const NOTE_COLORS = ['#e9d97a','#7ecfaa','#7ab8e8','#d97ab8','#e8a870','#a889d4','#e87a7a'];
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 160;

export default function NotesPage() {
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
    const unsubBc = bc.listen((msg) => {
      const note = msg.payload;
      if (msg.type === 'UPDATE') setNotes((p) => p.map((n) => n.id === note.id ? note : n));
    });
    return () => { unsub(); unsubBc(); };
  }, []);

  async function addNote() {
    const board = boardRef.current;
    const x = board ? Math.random() * Math.max(0, board.offsetWidth - DEFAULT_WIDTH - 40) + 20 : 20;
    const y = board ? Math.random() * Math.max(0, board.offsetHeight - DEFAULT_HEIGHT - 40) + 20 : 20;
    const note: Note = {
      id: uid(),
      content: '',
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      author_id: activeMember?.id ?? null,
      is_shared: true,
      position_x: Math.round(x),
      position_y: Math.round(y),
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
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
    const note = notes.find((n) => n.id === id);
    if (note) bc.post('UPDATE', { ...note, ...patch, updated_at: updated });
  }

  async function deleteNote(id: string) {
    setNotes((p) => p.filter((n) => n.id !== id));
    await supabase.from('notes').delete().eq('id', id);
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <h2 className={styles.heading}>Notes</h2>
        </div>
        <button className="btn btn--primary" style={{ display:'flex', alignItems:'center', gap:4 }} onClick={addNote}><Plus size={14} /> New note</button>
      </div>
      <div className={styles.board} ref={boardRef}>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={(patch) => updateNote(note.id, patch)}
            onDelete={() => deleteNote(note.id)}
          />
        ))}
        {notes.length === 0 && (
          <div className={styles.empty}>
            <FileText size={48} />
            <p>Click "+ New note" to add a sticky note</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  onUpdate: (patch: Partial<Note>) => void;
  onDelete: () => void;
}

function NoteCard({ note, onUpdate, onDelete }: NoteCardProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function startDrag(startX: number, startY: number) {
    dragState.current = {
      startX,
      startY,
      origX: note.position_x,
      origY: note.position_y,
    };
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragState.current) return;
    const dx = clientX - dragState.current.startX;
    const dy = clientY - dragState.current.startY;
    if (cardRef.current) {
      cardRef.current.style.left = `${dragState.current.origX + dx}px`;
      cardRef.current.style.top = `${dragState.current.origY + dy}px`;
    }
  }

  function endDrag(clientX: number, clientY: number) {
    if (!dragState.current) return;
    const dx = clientX - dragState.current.startX;
    const dy = clientY - dragState.current.startY;
    onUpdate({
      position_x: Math.max(0, dragState.current.origX + dx),
      position_y: Math.max(0, dragState.current.origY + dy),
    });
    dragState.current = null;
  }

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    startDrag(e.clientX, e.clientY);

    function onMove(me: MouseEvent) { moveDrag(me.clientX, me.clientY); }
    function onUp(me: MouseEvent) {
      endDrag(me.clientX, me.clientY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault(); // prevent scroll while dragging
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);

    function onMove(te: TouchEvent) {
      if (!te.touches[0]) return;
      te.preventDefault();
      moveDrag(te.touches[0].clientX, te.touches[0].clientY);
    }
    function onEnd(te: TouchEvent) {
      const t = te.changedTouches[0];
      endDrag(t.clientX, t.clientY);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }

    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  return (
    <div
      ref={cardRef}
      className={styles.note}
      style={{
        left: note.position_x,
        top: note.position_y,
        width: note.width,
        minHeight: note.height,
        background: note.color,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div className={styles.noteHandle}>
        <GripVertical size={14} style={{ color: 'rgba(0,0,0,.3)', flexShrink: 0 }} />
        <button
          className={styles.noteDelete}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete note"
        ><X size={12} /></button>
      </div>
      <textarea
        className={styles.noteText}
        value={note.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Write something…"
      />
    </div>
  );
}
