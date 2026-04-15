import { useState } from 'react';
import { Sun, Moon, Users, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useMembersStore } from '../store/membersStore';
import MembersPage from '../features/members/MembersPage';
import styles from './SettingsPanel.module.css';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { activeMember, unlock } = useAuthStore();
  const { theme, setTheme } = useAppStore();
  const { members } = useMembersStore();
  const [showMembers, setShowMembers] = useState(false);

  const otherMembers = members.filter((m) => m.id !== activeMember?.id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        {/* Active member */}
        {activeMember && (
          <div className={styles.activeSection}>
            <div
              className="avatar"
              style={{ background: activeMember.color, width: 56, height: 56, fontSize: 20, flexShrink: 0 }}
            >
              {activeMember.avatar_url
                ? <img src={activeMember.avatar_url} alt={activeMember.name} />
                : activeMember.name.slice(0, 2).toUpperCase()
              }
            </div>
            <div>
              <p className={styles.activeName}>{activeMember.name}</p>
              <p className={styles.activeHint}>Active member</p>
            </div>
          </div>
        )}

        {/* Switch member */}
        {otherMembers.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Switch to</p>
            <div className={styles.memberRow}>
              {otherMembers.map((m) => (
                <button
                  key={m.id}
                  className={styles.switchBtn}
                  onClick={() => { unlock(m); onClose(); }}
                >
                  <div
                    className="avatar"
                    style={{ background: m.color, width: 44, height: 44, fontSize: 15 }}
                  >
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} />
                      : m.name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <span className={styles.switchName}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.divider} />

        {/* Theme toggle */}
        <button
          className={styles.settingsRow}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {/* Manage members */}
        <button
          className={styles.settingsRow}
          onClick={() => setShowMembers(!showMembers)}
        >
          <Users size={18} />
          <span>Manage members</span>
        </button>

        {showMembers && (
          <div className={styles.membersEmbed}>
            <MembersPage />
          </div>
        )}
      </div>
    </div>
  );
}
