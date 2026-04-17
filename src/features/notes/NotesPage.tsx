import { useEffect, useRef, useState, type RefObject } from 'react';
import { FileText, Plus, GripVertical, X, Lock, Unlock } from 'lucide-react';
import type { Note } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import { createBroadcastChannel } from '../../lib/broadcast';
import { uid } from '../../lib/utils';
import ConfirmModal from '../../components/ConfirmModal';
import styles from './NotesPage.module.css';

const bc = createBroadcastChannel<Note>('notes');

const NOTE_COLORS = ['#e9d97a','#7ecfaa','#7ab8e8','#d97ab8','#e8a870','#a889d4','#e87a7a'];
const DEFAULT_WIDTH = 200;
const DEFAULT_HEIGHT = 160;
const SAVE_DEBOUNCE_MS = 400;

export default function NotesPage() {
  const { activeMember } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lockPanelRef = useRef<HTMLDivElement>(null);

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
      on_lock_screen: false,
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
    try {
      await supabase.from('notes').update({ ...patch, updated_at: updated }).eq('id', id);
      const note = notes.find((n) => n.id === id);
      if (note) bc.post('UPDATE', { ...note, ...patch, updated_at: updated });
    } catch {
      // silently ignore — next realtime event will reconcile
    }
  }

  async function deleteNote(id: string) {
    setNotes((p) => p.filter((n) => n.id !== id));
    setConfirmDelete(null);
    await supabase.from('notes').delete().eq('id', id);
  }

  function pinToLockScreen(id: string) {
    updateNote(id, { on_lock_screen: true });
  }

  function unpinFromLockScreen(id: string) {
    updateNote(id, { on_lock_screen: false });
  }

  const boardNotes = notes.filter((n) => !(n.on_lock_screen ?? false));
  const lockNotes  = notes.filter((n) => n.on_lock_screen ?? false);

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <h2 className={styles.heading}>Notes</h2>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={addNote}
        >
          <Plus size={14} /> New note
        </button>
      </div>

      {/* Main layout: board + lock screen panel */}
      <div className={styles.mainLayout}>
        {/* Free-form board */}
        <div className={styles.board} ref={boardRef}>
          {boardNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={(patch) => updateNote(note.id, patch)}
              onDeleteRequest={() => setConfirmDelete(note.id)}
              onPinToLock={() => pinToLockScreen(note.id)}
              lockPanelRef={lockPanelRef}
            />
          ))}
          {boardNotes.length === 0 && lockNotes.length === 0 && (
            <div className={styles.empty}>
              <FileText size={48} />
              <p>Click "+ New note" to add a sticky note</p>
            </div>
          )}
          {boardNotes.length === 0 && lockNotes.length > 0 && (
            <div className={styles.empty}>
              <p style={{ fontSize: 13, opacity: 0.5 }}>All notes are on the lock screen</p>
            </div>
          )}
        </div>

        {/* Lock screen panel (1/3) */}
        <div className={styles.lockPanel} ref={lockPanelRef}>
          <div className={styles.lockPanelHeader}>
            <Lock size={13} />
            <span>Lock Screen</span>
          </div>
          <p className={styles.lockPanelHint}>
            Drag a note here or tap the lock icon to pin it
          </p>

          {lockNotes.length === 0 && (
            <div className={styles.lockPanelEmpty}>
              <div className={styles.lockDropZone}>
                Drop notes here
              </div>
            </div>
          )}

          <div className={styles.lockNotesList}>
            {lockNotes.map((note) => (
              <div key={note.id} className={styles.lockNote} style={{ background: note.color }}>
                <div className={styles.lockNoteBar}>
                  <span className={styles.lockNoteColor} />
                  <button
                    className={styles.lockNoteUnpin}
                    onClick={() => unpinFromLockScreen(note.id)}
                    title="Remove from lock screen"
                  >
                    <Unlock size={11} />
                  </button>
                </div>
                <p className={styles.lockNoteText}>{note.content || <em style={{ opacity: 0.4 }}>Empty note</em>}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete !== null}
        message="Delete this note? This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && deleteNote(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

/* ── NoteCard ─────────────────────────────────────────────────────────────── */
interface NoteCardProps {
  note: Note;
  onUpdate: (patch: Partial<Note>) => void;
  onDeleteRequest: () => void;
  onPinToLock: () => void;
  lockPanelRef: RefObject<HTMLDivElement>;
}

function NoteCard({ note, onUpdate, onDeleteRequest, onPinToLock, lockPanelRef }: NoteCardProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localContent, setLocalContent] = useState(note.content);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocalContent(note.content); }, [note.content]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  function startDrag(startX: number, startY: number) {
    dragState.current = { startX, startY, origX: note.position_x, origY: note.position_y };
  }

  function isOverLockPanel(clientX: number, clientY: number): boolean {
    if (!lockPanelRef.current) return false;
    const r = lockPanelRef.current.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragState.current || !cardRef.current) return;
    cardRef.current.style.left = `${dragState.current.origX + clientX - dragState.current.startX}px`;
    cardRef.current.style.top  = `${dragState.current.origY + clientY - dragState.current.startY}px`;
    // Highlight lock panel via direct DOM — no React state, stays smooth during drag
    if (lockPanelRef.current) {
      lockPanelRef.current.classList.toggle(styles.lockPanelActive, isOverLockPanel(clientX, clientY));
    }
  }

  function endDrag(clientX: number, clientY: number) {
    if (!dragState.current) return;
    // Clear lock panel highlight
    lockPanelRef.current?.classList.remove(styles.lockPanelActive);

    // Drop on lock panel → pin the note and snap card back
    if (isOverLockPanel(clientX, clientY)) {
      if (cardRef.current) {
        cardRef.current.style.left = `${dragState.current.origX}px`;
        cardRef.current.style.top  = `${dragState.current.origY}px`;
      }
      dragState.current = null;
      onPinToLock();
      return;
    }

    onUpdate({
      position_x: Math.max(0, dragState.current.origX + clientX - dragState.current.startX),
      position_y: Math.max(0, dragState.current.origY + clientY - dragState.current.startY),
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
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
    function onMove(te: TouchEvent) {
      if (!te.touches[0]) return;
      te.preventDefault();
      moveDrag(te.touches[0].clientX, te.touches[0].clientY);
    }
    function onEnd(te: TouchEvent) {
      endDrag(te.changedTouches[0].clientX, te.changedTouches[0].clientY);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    }
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  function onContentChange(value: string) {
    setLocalContent(value);
    setSaving(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onUpdate({ content: value });
      setSaving(false);
    }, SAVE_DEBOUNCE_MS);
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
        {saving && <span className={styles.savingDot} title="Saving…" />}
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            className={styles.noteDelete}
            onClick={(e) => { e.stopPropagation(); onPinToLock(); }}
            title="Pin to lock screen"
          >
            <Lock size={11} />
          </button>
          <button
            className={styles.noteDelete}
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            title="Delete note"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <textarea
        className={styles.noteText}
        value={localContent}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Write something…"
      />
    </div>
  );
}
