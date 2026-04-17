import { useState, useRef } from 'react';
import {
  Sun, Moon, Users, X, Lock,
  Home, Globe, Clock, Key, ChevronRight, Check, Image, Timer,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { useMembersStore } from '../store/membersStore';
import type { Member } from '../types';
import MembersPage from '../features/members/MembersPage';
import PinChange from '../features/lockscreen/PinChange';
import PinPad from '../features/lockscreen/PinPad';
import PhotoManager from '../features/lockscreen/PhotoManager';
import styles from './SettingsPanel.module.css';

interface Props {
  onClose: () => void;
}

const AUTO_LOCK_OPTIONS = [
  { value: 0,  label: 'Never' },
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
];

const SLIDE_OPTIONS = [
  { value: 10_000,  label: '10 s' },
  { value: 15_000,  label: '15 s' },
  { value: 20_000,  label: '20 s' },
  { value: 30_000,  label: '30 s' },
  { value: 45_000,  label: '45 s' },
  { value: 60_000,  label: '1 min' },
  { value: 120_000, label: '2 min' },
];

function formatSlideInterval(ms: number): string {
  return SLIDE_OPTIONS.find((o) => o.value === ms)?.label ?? `${ms / 1000}s`;
}

type View = 'main' | 'members' | 'pin-change' | 'photos';

export default function SettingsPanel({ onClose }: Props) {
  const { activeMember, unlock, lock } = useAuthStore();
  const { theme, setTheme, autoLockMinutes, setAutoLockMinutes, householdName, setHouseholdName, language, setLanguage, photoSlideInterval, setPhotoSlideInterval } = useAppStore();
  const { members } = useMembersStore();

  const [view, setView] = useState<View>('main');
  const [switchTarget, setSwitchTarget] = useState<Member | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(householdName);
  const [showLockMenu, setShowLockMenu] = useState(false);
  const [showSlideMenu, setShowSlideMenu] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const otherMembers = members.filter((m) => m.id !== activeMember?.id);

  function saveName() {
    const trimmed = nameValue.trim();
    if (trimmed) setHouseholdName(trimmed);
    setEditingName(false);
  }

  function handleLockOptionSelect(val: number) {
    setAutoLockMinutes(val);
    setShowLockMenu(false);
  }

  // ── Switch-to PIN pad ────────────────────────────────────────────────────
  if (switchTarget) {
    return (
      <div className={styles.backdrop} onClick={() => setSwitchTarget(null)}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHandle} />
          <div className={styles.sheetHeader}>
            <button className={styles.backBtn} onClick={() => setSwitchTarget(null)}>‹ Back</button>
            <span className={styles.sheetTitle}>Switch to {switchTarget.name.split(' ')[0]}</span>
            <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
          </div>
          <div className={styles.scrollArea} style={{ overflow: 'hidden', padding: 0 }}>
            <PinPad
              member={switchTarget}
              onSuccess={(m) => { unlock(m); onClose(); }}
              onCancel={() => setSwitchTarget(null)}
              pinError={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Sub-views ────────────────────────────────────────────────────────────
  if (view === 'photos') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHandle} />
          <div className={styles.sheetHeader}>
            <button className={styles.backBtn} onClick={() => setView('main')}>‹ Back</button>
            <span className={styles.sheetTitle}>Lock Screen Photos</span>
            <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
          </div>
          <div className={styles.scrollArea}>
            <PhotoManager />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'members') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHandle} />
          <div className={styles.sheetHeader}>
            <button className={styles.backBtn} onClick={() => setView('main')}>‹ Back</button>
            <span className={styles.sheetTitle}>Members</span>
            <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
          </div>
          <div className={styles.scrollArea}>
            <MembersPage />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'pin-change') {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHandle} />
          <div className={styles.sheetHeader}>
            <button className={styles.backBtn} onClick={() => setView('main')}>‹ Back</button>
            <span className={styles.sheetTitle}>Change PIN</span>
            <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
          </div>
          <div className={styles.scrollArea}>
            {activeMember && (
              <PinChange member={activeMember} onDone={() => setView('main')} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main settings view ───────────────────────────────────────────────────
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />

        <div className={styles.sheetHeader}>
          <span className={styles.sheetTitle}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.scrollArea}>

          {/* Active member */}
          {activeMember && (
            <div className={styles.memberHero}>
              <div className="avatar" style={{ background: activeMember.color, width: 60, height: 60, fontSize: 22, flexShrink: 0 }}>
                {activeMember.avatar_url
                  ? <img src={activeMember.avatar_url} alt={activeMember.name} />
                  : activeMember.name.slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <p className={styles.heroName}>{activeMember.name}</p>
                <p className={styles.heroHint}>Active member</p>
              </div>
            </div>
          )}

          {/* Switch member — requires PIN */}
          {otherMembers.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Switch to</p>
              <div className={styles.memberRow}>
                {otherMembers.map((m) => (
                  <button key={m.id} className={styles.switchBtn} onClick={() => setSwitchTarget(m)}>
                    <div className="avatar" style={{ background: m.color, width: 46, height: 46, fontSize: 16 }}>
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.name} />
                        : m.name.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <span className={styles.switchName}>{m.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Apariencia ─────────────────────────────────────── */}
          <p className={styles.sectionTitle}>Appearance</p>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowIcon} style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              </div>
              <span className={styles.rowLabel}>Theme</span>
              <div className={styles.themeToggle}>
                <button className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`} onClick={() => setTheme('dark')}>
                  <Moon size={13} /> Dark
                </button>
                <button className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`} onClick={() => setTheme('light')}>
                  <Sun size={13} /> Light
                </button>
              </div>
            </div>
          </div>

          {/* ── Idioma ─────────────────────────────────────────── */}
          <p className={styles.sectionTitle}>Language</p>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowIcon} style={{ background: 'rgba(10,132,255,0.15)', color: 'var(--accent)' }}>
                <Globe size={16} />
              </div>
              <span className={styles.rowLabel}>Language</span>
              <div className={styles.langToggle}>
                <button className={`${styles.langBtn} ${language === 'es' ? styles.langBtnActive : ''}`} onClick={() => setLanguage('es')}>ES</button>
                <button className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`} onClick={() => setLanguage('en')}>EN</button>
              </div>
            </div>
          </div>

          {/* ── Hogar ──────────────────────────────────────────── */}
          <p className={styles.sectionTitle}>Household</p>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowIcon} style={{ background: 'rgba(48,209,88,0.15)', color: 'var(--success)' }}>
                <Home size={16} />
              </div>
              <span className={styles.rowLabel}>Name</span>
              {editingName ? (
                <div className={styles.nameEdit}>
                  <input
                    ref={nameInputRef}
                    className={styles.nameInput}
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                    autoFocus
                    maxLength={30}
                  />
                  <button className={styles.saveBtn} onClick={saveName}><Check size={14} /></button>
                </div>
              ) : (
                <button className={styles.valueBtn} onClick={() => { setEditingName(true); setNameValue(householdName); }}>
                  {householdName} <ChevronRight size={14} />
                </button>
              )}
            </div>
            <div className={styles.rowDivider} />
            <button className={styles.row} onClick={() => setView('members')}>
              <div className={styles.rowIcon} style={{ background: 'rgba(94,92,230,0.15)', color: '#5E5CE6' }}>
                <Users size={16} />
              </div>
              <span className={styles.rowLabel}>Members</span>
              <span className={styles.rowChevron}><ChevronRight size={16} /></span>
            </button>
          </div>

          {/* ── Privacidad ─────────────────────────────────────── */}
          <p className={styles.sectionTitle}>Privacy</p>
          <div className={styles.card}>
            <div className={styles.rowRelative}>
              <button className={styles.row} onClick={() => setShowLockMenu((v) => !v)}>
                <div className={styles.rowIcon} style={{ background: 'rgba(255,69,58,0.15)', color: 'var(--danger)' }}>
                  <Clock size={16} />
                </div>
                <span className={styles.rowLabel}>Auto-lock</span>
                <span className={styles.valueBtn}>
                  {AUTO_LOCK_OPTIONS.find((o) => o.value === autoLockMinutes)?.label ?? '–'} <ChevronRight size={14} />
                </span>
              </button>
              {showLockMenu && (
                <div className={styles.dropdown}>
                  {AUTO_LOCK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.dropdownItem} ${autoLockMinutes === opt.value ? styles.dropdownItemActive : ''}`}
                      onClick={() => handleLockOptionSelect(opt.value)}
                    >
                      {opt.label}
                      {autoLockMinutes === opt.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.rowDivider} />
            <button className={styles.row} onClick={() => setView('pin-change')}>
              <div className={styles.rowIcon} style={{ background: 'rgba(255,159,10,0.15)', color: '#FF9F0A' }}>
                <Key size={16} />
              </div>
              <span className={styles.rowLabel}>Change PIN</span>
              <span className={styles.rowChevron}><ChevronRight size={16} /></span>
            </button>
          </div>

          {/* ── Lock Screen Photos + Interval ─────────────────── */}
          <p className={styles.sectionTitle}>Lock Screen</p>
          <div className={styles.card}>
            <button className={styles.row} onClick={() => setView('photos')}>
              <div className={styles.rowIcon} style={{ background: 'rgba(10,132,255,0.15)', color: 'var(--accent)' }}>
                <Image size={16} />
              </div>
              <span className={styles.rowLabel}>Background Photos</span>
              <span className={styles.rowChevron}><ChevronRight size={16} /></span>
            </button>
            <div className={styles.rowDivider} />
            <div className={styles.rowRelative}>
              <button className={styles.row} onClick={() => setShowSlideMenu((v) => !v)}>
                <div className={styles.rowIcon} style={{ background: 'rgba(94,92,230,0.15)', color: '#5E5CE6' }}>
                  <Timer size={16} />
                </div>
                <span className={styles.rowLabel}>Photo Interval</span>
                <span className={styles.valueBtn}>
                  {formatSlideInterval(photoSlideInterval)} <ChevronRight size={14} />
                </span>
              </button>
              {showSlideMenu && (
                <div className={styles.dropdown}>
                  {SLIDE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.dropdownItem} ${photoSlideInterval === opt.value ? styles.dropdownItemActive : ''}`}
                      onClick={() => { setPhotoSlideInterval(opt.value); setShowSlideMenu(false); }}
                    >
                      {opt.label}
                      {photoSlideInterval === opt.value && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Lock ───────────────────────────────────────────── */}
          <button className={styles.lockBtn} onClick={() => { lock(); onClose(); }}>
            <Lock size={17} />
            Lock Screen
          </button>

          <div style={{ height: 'env(safe-area-inset-bottom, 16px)', minHeight: 16 }} />
        </div>
      </div>
    </div>
  );
}
