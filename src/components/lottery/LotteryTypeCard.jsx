// ─── Componente: LotteryTypeCard ─────────────────────────────
import { useApp } from '../../context/AppContext';
import { LOTTERY_LIST } from '../../data/lotteryTypes';
import { Lock } from 'lucide-react';

export const LotteryTypeGrid = ({ selected, onSelect, disabledGames = [] }) => {
  const { lotteries } = useApp();
  return (
    <div className="lottery-grid">
      {(lotteries || LOTTERY_LIST).map((lottery) => {
        const isDisabled = disabledGames.includes(lottery.id);
        return (
          <LotteryTypeCard
            key={lottery.id}
            lottery={lottery}
            selected={selected === lottery.id}
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelect(lottery.id)}
          />
        );
      })}
    </div>
  );
};

export const LotteryTypeCard = ({ lottery, selected, onClick, disabled = false }) => (
  <div
    className={`lottery-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
    style={{
      background: lottery.gradient,
      cursor: disabled ? 'not-allowed' : 'pointer',
      position: 'relative',
    }}
    onClick={onClick}
    role="button"
    aria-pressed={selected}
    aria-disabled={disabled}
    aria-label={`${disabled ? 'Deshabilitado: ' : ''}${lottery.name}`}
  >
    <div className="lottery-card-content">
      <div className="lottery-card-emoji">{lottery.emoji}</div>
      <div className="lottery-card-name">{lottery.name}</div>
      <div className="lottery-card-desc">{lottery.description}</div>
    </div>
    {disabled && (
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '0.3rem', zIndex: 2,
      }}>
        <Lock size={22} color="#fff" />
        <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Deshabilitado
        </span>
      </div>
    )}
  </div>
);
