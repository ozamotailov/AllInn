// Minimal Telegram bot (long-polling) that answers /start and /help with a
// welcome describing All-Inn and a button to launch the Mini App. Also fills in
// the bot's commands and profile descriptions (RU + EN). Opt-in via BOT_POLLING.

import type { Env } from '../env.js';
import { appLinkFor } from '../env.js';

type Log = { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };

interface TgResult<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}
interface TgUpdate {
  update_id: number;
  message?: { chat: { id: number }; text?: string; from?: { language_code?: string } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRu = (lang?: string): boolean => !!lang && lang.toLowerCase().startsWith('ru');

// Overridable for tests; defaults to the real Bot API.
const apiBase = (): string => process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org';

async function call<T>(token: string, method: string, body?: unknown): Promise<TgResult<T>> {
  const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json()) as TgResult<T>;
}

function welcome(lang: string, env: Env): { text: string; reply_markup?: unknown } {
  const ru = isRu(lang);
  const btn = launchButton(env, ru);
  const tail = btn
    ? ru
      ? 'Нажмите кнопку ниже, чтобы открыть приложение 👇'
      : 'Tap the button below to open the app 👇'
    : ru
      ? 'Откройте приложение кнопкой меню (≡) внизу 👇'
      : 'Open the app from the menu (≡) button below 👇';

  const text = ru
    ? [
        "🃏 <b>All-Inn</b> — Texas Hold'em для своей компании, прямо в Telegram.",
        '',
        'Домашняя игра на <b>виртуальных фишках</b> — никаких денег внутри. Вы сами договариваетесь, что значат фишки, и рассчитываетесь между собой.',
        '',
        '♠️ Создайте стол: блайнды, стартовый стек, таймер хода',
        '♥️ Позовите друзей — пришлите ссылку прямо в чат',
        '♦️ Честная раздача: колода фиксируется до сдачи (provably fair) — можно проверить',
        '♣️ В конце — автоматический расчёт «кто кому должен»',
        '',
        tail,
      ].join('\n')
    : [
        "🃏 <b>All-Inn</b> — Texas Hold'em for your friends, right inside Telegram.",
        '',
        'A home game on <b>virtual chips</b> — no money inside. You agree what the chips are worth and settle up among yourselves.',
        '',
        '♠️ Create a table: blinds, starting stack, action timer',
        '♥️ Invite friends — drop the link straight into a chat',
        '♦️ Provably-fair deal: the deck is committed before the deal — verifiable',
        '♣️ At the end — an automatic "who owes whom" settle-up',
        '',
        tail,
      ].join('\n');

  return { text, reply_markup: btn ? { inline_keyboard: [[btn]] } : undefined };
}

function launchButton(env: Env, ru: boolean): Record<string, unknown> | undefined {
  const text = ru ? '♠️ Открыть All-Inn' : '♠️ Open All-Inn';
  if (env.miniAppUrl) return { text, web_app: { url: env.miniAppUrl } };
  const link = appLinkFor(env);
  if (link) return { text, url: link };
  return undefined;
}

/** Populate the bot's commands and profile descriptions for both languages. */
async function configure(token: string, env: Env, log: Log): Promise<void> {
  const commands = (ru: boolean) => [
    { command: 'start', description: ru ? 'О боте и запуск' : 'About & launch' },
    { command: 'help', description: ru ? 'Как это работает' : 'How it works' },
  ];
  const shortDesc = (ru: boolean) =>
    ru
      ? "Texas Hold'em на виртуальных фишках для своих. Создайте стол и зовите друзей."
      : "Texas Hold'em on virtual chips for friends. Create a table and invite your friends.";
  const desc = (ru: boolean) =>
    ru
      ? "All-Inn — покер Техасский холдем на виртуальных фишках для своей компании. Создайте стол, позовите друзей и играйте прямо в Telegram."
      : "All-Inn — Texas Hold'em poker on virtual chips for your friends. Create a table, invite friends, and play right inside Telegram.";

  for (const ru of [false, true]) {
    const lc = ru ? { language_code: 'ru' } : {};
    await call(token, 'setMyCommands', { commands: commands(ru), ...lc });
    await call(token, 'setMyShortDescription', { short_description: shortDesc(ru), ...lc });
    await call(token, 'setMyDescription', { description: desc(ru), ...lc });
  }
  log.info('bot: commands & descriptions configured');
}

/** Start the long-polling bot. Returns a stop() function. */
export function startBot(env: Env, log: Log): () => void {
  const token = env.botToken;
  if (!token) {
    log.warn('BOT_POLLING=true but BOT_TOKEN is empty — bot not started.');
    return () => {};
  }
  let running = true;
  let offset = 0;

  const handle = async (u: TgUpdate): Promise<void> => {
    const m = u.message;
    if (!m || typeof m.text !== 'string') return;
    const cmd = m.text.trim().split(/\s+/)[0].split('@')[0];
    if (cmd !== '/start' && cmd !== '/help') return;
    const w = welcome(m.from?.language_code ?? 'en', env);
    await call(token, 'sendMessage', {
      chat_id: m.chat.id,
      text: w.text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: w.reply_markup,
    });
  };

  const loop = async (): Promise<void> => {
    // Clear any stale webhook/backlog so polling starts clean.
    await call(token, 'deleteWebhook', { drop_pending_updates: true }).catch(() => undefined);
    await configure(token, env, log).catch((e) => log.warn({ err: String(e) }, 'bot configure failed'));
    log.info('bot: long-polling started');
    while (running) {
      try {
        const res = await call<TgUpdate[]>(token, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message'],
        });
        if (!res.ok) {
          if (res.error_code === 409) {
            log.warn('bot: getUpdates 409 conflict (a webhook or another poller is active)');
            await sleep(5000);
          } else {
            await sleep(2000);
          }
          continue;
        }
        for (const u of res.result ?? []) {
          offset = u.update_id + 1;
          await handle(u).catch((e) => log.warn({ err: String(e) }, 'bot handle error'));
        }
      } catch (e) {
        log.warn({ err: String(e) }, 'bot poll error');
        await sleep(2000);
      }
    }
  };

  void loop();
  return () => {
    running = false;
  };
}
