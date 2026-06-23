import { getLanguageCode } from './telegram.js';

type Lang = 'en' | 'ru';

// Auto-detect from Telegram; override with ?lang=ru|en (handy for browser dev).
function detectLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl === 'ru' || fromUrl === 'en') return fromUrl;
  const lc = getLanguageCode();
  return lc && lc.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

const LANG: Lang = detectLang();

const D: Record<string, { en: string; ru: string }> = {
  // auth / connection
  'auth.signingIn': { en: 'Signing in…', ru: 'Вход…' },
  'auth.failed': { en: 'Sign-in failed', ru: 'Не удалось войти' },
  'room.joining': { en: 'Joining room {code}…', ru: 'Подключение к комнате {code}…' },
  'room.error': { en: 'Room error: {error}', ru: 'Ошибка комнаты: {error}' },
  'conn.reconnecting': { en: 'reconnecting…', ru: 'переподключение…' },

  // create room
  'create.title': { en: 'New table', ru: 'Новый стол' },
  'create.smallBlind': { en: 'Small blind', ru: 'Малый блайнд' },
  'create.bigBlind': { en: 'Big blind', ru: 'Большой блайнд' },
  'create.startingStack': { en: 'Starting stack', ru: 'Стартовый стек' },
  'create.maxPlayers': { en: 'Max players', ru: 'Макс. игроков' },
  'create.actionTimer': { en: 'Action timer (s)', ru: 'Таймер хода (с)' },
  'create.autoStart': { en: 'Auto-start at 2 players', ru: 'Авто-старт при 2 игроках' },
  'create.creating': { en: 'Creating…', ru: 'Создание…' },
  'create.create': { en: 'Create room', ru: 'Создать комнату' },

  // lobby
  'lobby.title': { en: 'Lobby', ru: 'Лобби' },
  'lobby.config': {
    en: '{sb}/{bb} · stack {stack} · {max}-max · {timer}s',
    ru: '{sb}/{bb} · стек {stack} · {max}-макс · {timer}с',
  },
  'lobby.roomCode': { en: 'Room code', ru: 'Код комнаты' },
  'lobby.copyLink': { en: 'Copy link', ru: 'Копировать ссылку' },
  'lobby.copyCode': { en: 'Copy code', ru: 'Копировать код' },
  'lobby.copied': { en: 'Copied ✓', ru: 'Скопировано ✓' },
  'lobby.sitHere': { en: 'Sit here', ru: 'Сесть' },
  'lobby.waitingPlayer': { en: 'Waiting for another player to sit…', ru: 'Ждём ещё игрока…' },
  'lobby.startGame': { en: '▶ Start game', ru: '▶ Начать игру' },
  'lobby.pauseGame': { en: '⏸ Pause game', ru: '⏸ Пауза' },
  'lobby.pausedWaitHost': { en: '⏸ Game paused — waiting for the host…', ru: '⏸ Пауза — ждём хоста…' },
  'lobby.online': { en: '{n} online', ru: '{n} онлайн' },
  'lobby.rebuy': { en: 'Rebuy +{n}', ru: 'Докупить +{n}' },
  'lobby.leaveSeat': { en: 'Leave seat', ru: 'Встать' },

  // table
  'table.pot': { en: 'Pot {n}', ru: 'Банк {n}' },
  'table.spectating': { en: 'spectating', ru: 'наблюдение' },
  'table.pausing': { en: '⏸ Pausing after this hand…', ru: '⏸ Пауза после этой раздачи…' },
  'table.handResult': { en: 'Hand result', ru: 'Итог раздачи' },
  'table.wonUncontested': { en: 'Won uncontested', ru: 'Выигрыш без вскрытия' },
  'table.won': { en: '— won {n}', ru: '— выигрыш {n}' },
  'table.waiting': { en: 'Waiting…', ru: 'Ожидание…' },
  'table.pause': { en: '⏸ Pause', ru: '⏸ Пауза' },
  'table.resume': { en: '▶ Resume', ru: '▶ Продолжить' },
  'seat.allin': { en: 'all-in', ru: 'олл-ин' },
  'seat.folded': { en: 'folded', ru: 'пас' },

  // streets
  'street.preflop': { en: 'preflop', ru: 'префлоп' },
  'street.flop': { en: 'flop', ru: 'флоп' },
  'street.turn': { en: 'turn', ru: 'тёрн' },
  'street.river': { en: 'river', ru: 'ривер' },
  'street.showdown': { en: 'showdown', ru: 'вскрытие' },

  // hand names (match shared CATEGORY_NAMES)
  'hand.High Card': { en: 'High Card', ru: 'Старшая карта' },
  'hand.Pair': { en: 'Pair', ru: 'Пара' },
  'hand.Two Pair': { en: 'Two Pair', ru: 'Две пары' },
  'hand.Three of a Kind': { en: 'Three of a Kind', ru: 'Сет' },
  'hand.Straight': { en: 'Straight', ru: 'Стрит' },
  'hand.Flush': { en: 'Flush', ru: 'Флеш' },
  'hand.Full House': { en: 'Full House', ru: 'Фулл-хаус' },
  'hand.Four of a Kind': { en: 'Four of a Kind', ru: 'Каре' },
  'hand.Straight Flush': { en: 'Straight Flush', ru: 'Стрит-флеш' },

  // actions
  'act.yourTurn': { en: 'Your turn', ru: 'Ваш ход' },
  'act.fold': { en: 'Fold', ru: 'Фолд' },
  'act.check': { en: 'Check', ru: 'Чек' },
  'act.call': { en: 'Call {n}', ru: 'Колл {n}' },
  'act.bet': { en: 'Bet {n}', ru: 'Бет {n}' },
  'act.raise': { en: 'Raise {n}', ru: 'Рейз {n}' },
  'act.allIn': { en: 'All-in', ru: 'Олл-ин' },

  // fairness
  'fair.verify': { en: 'Verify deck (provably fair)', ru: 'Проверить колоду (provably fair)' },
  'fair.checking': { en: 'checking…', ru: 'проверка…' },
  'fair.ok': { en: '✓ deck committed before the deal, unaltered', ru: '✓ колода зафиксирована до сдачи, без подмены' },
  'fair.bad': { en: '✗ verification failed', ru: '✗ проверка не прошла' },

  // ledger
  'ledger.player': { en: 'Player', ru: 'Игрок' },
  'ledger.buyIn': { en: 'Buy-in', ru: 'Вход' },
  'ledger.stack': { en: 'Stack', ru: 'Стек' },
  'ledger.net': { en: 'Net', ru: 'Итог' },
  'ledger.whoPays': { en: 'Who pays whom', ru: 'Кто кому платит' },
  'ledger.even': { en: "Everyone's even — nothing to settle.", ru: 'Все при своих — рассчитываться не нужно.' },
  'ledger.yourResult': { en: 'Your result', ru: 'Твой итог' },
  'ledger.youReceive': { en: "You'll receive:", ru: 'Тебе переведут:' },
  'ledger.youSend': { en: 'You need to send:', ru: 'Тебе нужно отправить:' },
  'ledger.youEven': { en: "You're even — nothing to settle.", ru: 'Ты при своих — рассчитываться не нужно.' },

  // common
  'common.you': { en: '(you)', ru: '(вы)' },
  'common.settleUp': { en: 'Settle up', ru: 'Расчёт' },
  'common.rebuy': { en: 'Rebuy', ru: 'Докупить' },
  'common.leave': { en: 'Leave', ru: 'Выйти' },
  'common.close': { en: 'Close', ru: 'Закрыть' },
  'common.seconds': { en: '{n}s', ru: '{n}с' },
  'confirm.leaveTable': { en: 'Leave the table?', ru: 'Выйти из-за стола?' },
  'confirm.leaveSeat': { en: 'Leave your seat?', ru: 'Встать с места?' },
};

export function t(key: string, params?: Record<string, string | number>): string {
  const entry = D[key];
  let s = entry ? entry[LANG] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Localize a hand-category name from the shared evaluator. */
export function tHand(name: string): string {
  return D[`hand.${name}`] ? t(`hand.${name}`) : name;
}
