import { useState, useEffect } from 'react';
import type { Member } from '../../types';
import { supabase } from '../../lib/supabase';
import styles from './PinPad.module.css';

const PIN_LENGTH = 4;

interface Props {
  member: Member;
  onSuccess: (member: Member) => void;
  onCancel: () => void;
  /** Optional: controlled error from parent. If undefined, PinPad manages its own state. */
  pinError?: boolean;
}

export default function PinPad({ member, onSuccess, onCancel, pinError: externalError }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [internalError, setInternalError] = useState(false);

  const pinError = externalError ?? internalError;

  // Auto-submit when PIN_LENGTH digits entered
  useEffect(() => {
    if (digits.length !== PIN_LENGTH || verifying) return;

    const entered = digits.join('');
    setVerifying(true);

    supabase.functions
      .invoke('verify-pin', { body: { member_id: member.id, pin: entered } })
      .then(({ data, error }) => {
        setVerifying(false);
        if (!error && data?.match) {
          onSuccess(member);
        } else {
          setInternalError(true);
          setTimeout(() => { setDigits([]); setInternalError(false); }, 900);
        }
      });
  }, [digits, member, onSuccess, verifying]);

  function press(key: string) {
    if (digits.length < PIN_LENGTH && !verifying) {
      setDigits((d) => [...d, key]);
    }
  }

  function backspace() {
    if (!verifying) setDigits((d) => d.slice(0, -1));
  }

  const hintText = verifying ? 'Verifying…' : '';

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.avatar} style={{ background: member.color }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt={member.name} />
            : member.name.slice(0, 2).toUpperCase()
          }
        </div>

        <p className={styles.name}>{member.name}</p>
        <p className={styles.hint}>{hintText}</p>

        {/* Dots — error takes priority to avoid double animation */}
        <div className={`${styles.dots} ${pinError ? styles.dotsError : ''}`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${pinError ? styles.dotError : i < digits.length ? styles.dotFilled : ''}`}
            />
          ))}
        </div>

        {pinError && <p className={styles.errorMsg}>Incorrect PIN. Try again.</p>}

        <div className={styles.grid}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            <button
              key={i}
              className={`${styles.key} ${key === '' ? styles.keyEmpty : ''}`}
              disabled={key === '' || verifying}
              onClick={() => key === '⌫' ? backspace() : key !== '' && press(key)}
            >
              {key}
            </button>
          ))}
        </div>

        <button className={styles.cancel} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
