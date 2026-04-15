import { useEffect, useState } from 'react';
import { Users, Plus, Pencil, X } from 'lucide-react';
import type { Member } from '../../types';
import { useMembersStore } from '../../store/membersStore';
import { subscribeToTable } from '../../lib/realtime';
import MemberForm from './MemberForm';
import styles from './MembersPage.module.css';

export default function MembersPage() {
  const { members, fetchAll, deleteMember } = useMembersStore();
  const [modal, setModal] = useState<{ member?: Member } | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    return subscribeToTable<Member>({
      table: 'household_members',
      onData: ({ eventType, new: row, old }) => {
        const store = useMembersStore.getState();
        if (eventType === 'INSERT' && row) {
          if (!store.members.find((m) => m.id === row.id)) store.setMembers([...store.members, row]);
        } else if (eventType === 'UPDATE' && row) {
          store.setMembers(store.members.map((m) => (m.id === row.id ? row : m)));
        } else if (eventType === 'DELETE' && old) {
          store.setMembers(store.members.filter((m) => m.id !== old.id));
        }
      },
    });
  }, []);

  async function handleDelete(member: Member) {
    if (!confirm(`Delete "${member.name}"? This cannot be undone.`)) return;
    await deleteMember(member.id);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Members</h2>
        <button className="btn btn--primary" style={{ display:'flex', alignItems:'center', gap:4 }} onClick={() => setModal({})}>
          <Plus size={14} /> Add member
        </button>
      </div>

      {members.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Users size={48} /></div>
          <p>No members yet. Add one to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={() => setModal({ member })}
              onDelete={() => handleDelete(member)}
            />
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <MemberForm existing={modal.member} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MemberCard({ member, onEdit, onDelete }: { member: Member; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.avatar} style={{ background: member.color }}>
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.name} className={styles.avatarImg} />
          : member.name.slice(0, 2).toUpperCase()
        }
      </div>
      <span className={styles.name}>{member.name}</span>
      <div className={styles.actions}>
        <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} onClick={onEdit}><Pencil size={14} /></button>
        <button className="btn btn--ghost btn--icon" style={{ color: 'var(--danger)', width: 32, height: 32 }} onClick={onDelete}><X size={14} /></button>
      </div>
    </div>
  );
}
