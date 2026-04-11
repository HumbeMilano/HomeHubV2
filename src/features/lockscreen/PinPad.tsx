import { useState, useEffect } from 'react';
import type { Member } from '../../types';
import styles from './PinPad.module.css';

const PIN_LENGTH = 4;

interface Props {
  member: Member;
  onSuccess: (member: Member) => void;
  onCancel: () => void;
  pinError: boolean;
}

export default function PinPad({ member, onSuccess, onCancel, pinError }: Props) {
  const [digits, setDigits] = useState<string[]>([]);

  // Auto-submit when PIN_LENGTH digits entered
  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const entered = digits.join('');
      // Compare against stored pin_hash (plain comparison here;
      // in production use bcrypt via Supabase Edge Function)
      const stored = (member as unknown as Record<string, string>)['pin'] ?? '';
      if (entered === stored) {
        onSuccess(member);
      } else {
        // Let parent show error, then reset after brief delay
        setTimeout(() => setDigits([]), 500);
      }
    }
  }, [digits, member, onSuccess]);

  function press(key: string) {
    if (digits.length < PIN_LENGTH) {
      setDigits((d) => [...d, key]);
    }
  }

  function backspace() {
    setDigits((d) => d.slice(0, -1));
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Avatar */}
        <div
          className={styles.avatar}
          style={{ background: member.color }}
        >
          {member.avatar_url
            ? <img src={member.avatar_url} alt={member.name} />
            : member.name.slice(0, 2).toUpperCase()
          }
        </div>

        <p className={styles.name}>{member.name}</p>
        <p className={styles.hint}>Enter PIN</p>

        {/* Dots */}
        <div className={styles.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i < digits.length ? styles.dotFilled : ''} ${pinError ? styles.dotError : ''}`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className={styles.grid}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
            <button
              key={i}
              className={`${styles.key} ${key === '' ? styles.keyEmpty : ''}`}
              disabled={key === ''}
              onClick={() => key === '⌫' ? backspace() : key !== '' && press(key)}
            >
              {key}
            </button>
          ))}
        </div>

        <button className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
