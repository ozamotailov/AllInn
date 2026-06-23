import type { Card } from '@allinn/shared';

const SUIT: Record<Card['suit'], string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export function CardView({
  card,
  hidden,
  dim,
  highlight,
}: {
  card?: Card;
  hidden?: boolean;
  dim?: boolean;
  highlight?: boolean;
}) {
  if (hidden || !card) return <span className="playing-card back" />;
  const red = card.suit === 'h' || card.suit === 'd';
  return (
    <span
      className={`playing-card ${red ? 'red' : 'black'}${dim ? ' dim' : ''}${highlight ? ' hl' : ''}`}
    >
      {card.rank}
      {SUIT[card.suit]}
    </span>
  );
}
