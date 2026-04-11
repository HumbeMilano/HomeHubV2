import { useEffect, useState } from 'react';
import type { Member } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import PhotoSlideshow from './PhotoSlideshow';
import PinPad from './PinPad';
import styles from './LockScreen.module.css';
import { format } from 'date-fns';

export default function LockScreen() {
  const { unlock, pinError, setPinError } = useAuthStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [now, setNow] = useState(new Date());

  // Load household members
  useEffect(() => {
    supabase
      .from('household_members')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setMembers(data as Member[]);
      });
  }, []);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleSuccess(member: Member) {
    unlock(member);
  }

  function handleCancel() {
    setSelected(null);
    setPinError(false);
  }

  return (
    <div className={styles.root}>
      <PhotoSlideshow interval={30_000} />

      {/* Overlay */}
      <div className={styles.overlay}>
        {/* Clock */}
        <div className={styles.clock}>
          <span className={styles.time}>{format(now, 'HH:mm')}</span>
          <span className={styles.date}>{format(now, 'EEEE, MMMM d')}</span>
        </div>

        {/* Quick info bar */}
        <QuickInfo />

        {/* Member picker */}
        <div className={styles.memberSection}>
          <p className={styles.prompt}>Who&apos;s there?</p>
          <div className={styles.memberGrid}>
            {members.length === 0 ? (
              // Dev bypass when no members in DB yet
              <DevBypass onUnlock={handleSuccess} />
            ) : (
              members.map((m) => (
                <button
                  key={m.id}
                  className={styles.memberBtn}
                  onClick={() => { setSelected(m); setPinError(false); }}
                >
                  <div className={styles.memberAvatar} style={{ background: m.color }}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} />
                      : m.name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <span className={styles.memberName}>{m.name.split(' ')[0]}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PIN pad — slides in over the lock screen */}
      {selected && (
        <PinPad
          member={selected}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          pinError={pinError}
        />
      )}
    </div>
  );
}

// Shows today's chore count + next reminder as quick glance info
function QuickInfo() {
  // TODO in Phase 4: query chores + reminders
  return (
    <div className={styles.quickInfo}>
      <span>📅 Today&apos;s chores loading…</span>
    </div>
  );
}

function DevBypass({ onUnlock }: { onUnlock: (m: Member) => void }) {
  const dev: Member = {
    id: 'dev', name: 'Dev User', color: '#5b5bf6',
    avatar_url: null, supabase_user_id: null, created_at: '',
  };
  return (
    <button
      className={styles.memberBtn}
      onClick={() => onUnlock(dev)}
      title="No members in DB — dev bypass"
    >
      <div className={styles.memberAvatar} style={{ background: '#5b5bf6' }}>DV</div>
      <span className={styles.memberName}>Dev</span>
    </button>
  );
}
