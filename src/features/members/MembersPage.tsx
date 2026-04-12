import { useEffect, useState } from 'react';
import type { Member } from '../../types';
import { useMembersStore } from '../../store/membersStore';
import { subscribeToTable } from '../../lib/realtime';
import MemberForm from './MemberForm';
import styles from './MembersPage.module.css';

export default function MembersPage() {
  const { members, fetchAll, deleteMember } = useMembersStore();
  const [modal, setModal] = useState<{ member?: Member } | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cross-device Realtime sync
  useEffect(() => {
    return subscribeToTable<Member>({
      table: 'household_members',
      onData: ({ eventType, new: row, old }) => {
        const store = useMembersStore.getState();
        if (eventType === 'INSERT' && row) {
          if (!store.members.find((m) => m.id === row.id)) {
            store.setMembers([...store.members, row]);
          }
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
        <button className="btn btn--primary" onClick={() => setModal({})}>
          + Add member
        </button>
      </div>

      {members.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
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

interface CardProps {
  member: Member;
  onEdit: () => void;
  onDelete: () => void;
}

function MemberCard({ member, onEdit, onDelete }: CardProps) {
  const initials = member.name.slice(0, 2).toUpperCase();
  return (
    <div className={styles.card}>
      <div className={styles.avatar} style={{ background: member.color }}>
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.name} className={styles.avatarImg} />
          : initials
        }
      </div>
      <span className={styles.name}>{member.name}</span>
      <div className={styles.actions}>
        <button className="btn btn--ghost btn--sm" onClick={onEdit}>Edit</button>
        <button
          className="btn btn--ghost btn--sm"
          style={{ color: 'var(--danger)' }}
          onClick={onDelete}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
