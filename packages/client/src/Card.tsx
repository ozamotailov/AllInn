import type { Card } from '@allinn/shared';

const SUIT: Record<Card['suit'], string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) return <span className="playing-card back" />;
  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <span className={`playing-card ${red ? 'red' : 'black'}`}>
      {card.rank}
      {SUIT[card.suit]}
    </span>
  );
}
