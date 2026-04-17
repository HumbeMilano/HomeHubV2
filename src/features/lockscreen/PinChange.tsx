import { useState } from 'react';
import { Check } from 'lucide-react';
import bcrypt from 'bcryptjs';
import type { Member } from '../../types';
import { supabase } from '../../lib/supabase';
import styles from './PinChange.module.css';

type Step = 'verify' | 'new' | 'confirm' | 'done';

interface Props {
  member: Member;
  onDone: () => void;
}

const PIN_LENGTH = 4;

export default function PinChange({ member, onDone }: Props) {
  const [step, setStep] = useState<Step>('verify');
  const [digits, setDigits] = useState<string[]>([]);
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stepLabels: Record<Step, string> = {
    verify:  'Enter your current PIN',
    new:     'Enter new PIN',
    confirm: 'Confirm new PIN',
    done:    'PIN changed!',
  };

  function press(key: string) {
    if (digits.length < PIN_LENGTH && !loading) {
      const next = [...digits, key];
      setDigits(next);
      setError('');
      if (next.length === PIN_LENGTH) handleComplete(next.join(''));
    }
  }

  function backspace() {
    if (!loading) setDigits((d) => d.slice(0, -1));
  }

  async function handleComplete(entered: string) {
    setLoading(true);
    setError('');

    if (step === 'verify') {
      // Verify current PIN via Edge Function
      const { data, error: fnErr } = await supabase.functions.invoke('verify-pin', {
        body: { member_id: member.id, pin: entered },
      });
      setLoading(false);
      if (!fnErr && data?.match) {
        setStep('new');
        setDigits([]);
      } else {
        setError('Incorrect PIN');
        setTimeout(() => { setDigits([]); setError(''); }, 700);
      }
      return;
    }

    if (step === 'new') {
      setNewPin(entered);
      setStep('confirm');
      setDigits([]);
      setLoading(false);
      return;
    }

    if (step === 'confirm') {
      if (entered !== newPin) {
        setLoading(false);
        setError('PINs do not match');
        setTimeout(() => { setDigits([]); setError(''); }, 700);
        return;
      }
      // Hash new PIN and save (cost=12 matches server-side verify-pin)
      const hash = await bcrypt.hash(entered, 12);
      const { error: dbErr } = await supabase
        .from('household_members')
        .update({ pin: hash })
        .eq('id', member.id);
      setLoading(false);
      if (dbErr) {
        setError('Failed to save. Try again.');
        setTimeout(() => { setDigits([]); setError(''); }, 1000);
      } else {
        setStep('done');
      }
      return;
    }
  }

  if (step === 'done') {
    return (
      <div className={styles.root}>
        <div className={styles.successIcon}>
          <Check size={32} />
        </div>
        <p className={styles.title}>PIN Updated</p>
        <p className={styles.subtitle}>Your PIN has been changed successfully.</p>
        <button className={styles.doneBtn} onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* Member avatar */}
      <div className={styles.avatar} style={{ background: member.color }}>
        {member.avatar_url
          ? <img src={member.avatar_url} alt={member.name} />
          : member.name.slice(0, 2).toUpperCase()
        }
      </div>

      <p className={styles.title}>{stepLabels[step]}</p>

      {/* Step indicator */}
      <div className={styles.steps}>
        {(['verify', 'new', 'confirm'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`${styles.stepDot} ${
              step === s ? styles.stepDotActive :
              (['verify', 'new', 'confirm'] as Step[]).indexOf(step) > i ? styles.stepDotDone : ''
            }`}
          />
        ))}
      </div>

      {/* Dots */}
      <div className={`${styles.dots} ${error ? styles.dotsError : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i < digits.length ? styles.dotFilled : ''} ${error ? styles.dotError : ''}`}
          />
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.loading}>Verifying…</p>}

      {/* Numpad */}
      <div className={styles.grid}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
          <button
            key={i}
            className={`${styles.key} ${key === '' ? styles.keyEmpty : ''}`}
            disabled={key === '' || loading || digits.length === PIN_LENGTH}
            onClick={() => key === '⌫' ? backspace() : key !== '' && press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
