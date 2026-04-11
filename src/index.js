import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  getContentType,
  downloadContentFromMessage,
} from '@whiskeysockets/baileys';
import pino     from 'pino';
import chalk    from 'chalk';
import figlet   from 'figlet';
import gradient from 'gradient-string';
import fs       from 'fs-extra';

import config               from './config.js';
import store, { bindStore } from './lib/store.js';
import { serialize }        from './lib/serialize.js';
import { MessageQueue }     from './lib/queue.js';
import { handleMessage, loadPlugins } from './handler.js';
import { startPairingServer, updateSock } from './pairing.js';

export const errorLogs = [];
const logger = pino({ level: 'silent' });

let retryCount          = 0;
const MAX_RETRIES       = 5;
let pluginsLoaded        = false;
let pairingServerStarted = false;
let everConnected        = false;  // track if pairing ever succeeded

function printBanner() {
  try {
    const banner = figlet.textSync('ALMEERV5', { font: 'ANSI Shadow' });
    console.log(gradient.rainbow(banner));
  } catch { console.log(chalk.cyan('=== ALMEERV5 ===')); }
  console.log(chalk.cyan('  ═'.repeat(28)));
  console.log(chalk.bold.green('   🤖  ALMEERV5 WhatsApp Bot  ') + chalk.yellow('v5.0.0'));
  console.log(chalk.dim('   github.com/SIDER44  |  ALMEER Brand'));
  console.log(chalk.cyan('  ═'.repeat(28)) + '\n');
}

async function startBot() {
  printBanner();
  await fs.ensureDir(config.SESSION_PATH);
  await fs.ensureDir('./downloads');

  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_PATH);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(chalk.dim(`  Baileys v${version.join('.')} — ${isLatest ? 'latest ✓' : 'update available'}\n`));

  if (!pluginsLoaded) {
    await loadPlugins();
    pluginsLoaded = true;
  }

  // ── EXACT V4 socket config — no browser override ─────────────
  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal:              false,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect:            true,
    syncFullHistory:                false,
    shouldIgnoreJid:                () => false,
    getMessage: async (key) => {
      const jid = key.remoteJid;
      return (
        store.messages[jid]?.[key.id]?.message ||
        store.statusMessages?.[key.id]?.message ||
        { conversation: '' }
      );
    },
  });

  updateSock(sock);
  bindStore(sock);
  sock.MQ = new MessageQueue();

  if (!pairingServerStarted) {
    pairingServerStarted = true;
    startPairingServer(config.PORT);
    console.log(chalk.yellow('  ⚠️  Not yet paired.'));
    console.log(chalk.cyan(`  🌐 Visit your Railway URL to pair.\n`));
  }

  // ── connection.update — exact V4 logic ───────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'connecting') {
      console.log(chalk.dim('  Connecting to WhatsApp...'));
    }

    if (connection === 'open') {
      retryCount    = 0;
      everConnected = true;
      const user = sock.user?.id?.split(':')[0] || 'unknown';
      console.log(chalk.bold.green('\n  ✅ CONNECTED TO WHATSAPP!'));
      console.log(chalk.yellow(`  📱 Number : ${user}`));
      console.log(chalk.cyan(`  🤖 Bot    : ${config.BOT_NAME}\n`));
      if (config.OWNER) {
        const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
        sock.sendMessage(ownerJid, {
          text:
            `╔══════════════════════╗\n` +
            `║  🤖 *ALMEERV5 ONLINE* ║\n` +
            `╚══════════════════════╝\n\n` +
            `✅ Bot connected!\n` +
            `📱 *Number:* ${user}\n` +
            `🟢 *Node:* ${process.version}\n\n` +
            `_Type ${config.PREFIX}menu for commands_ 🚀`,
        }).catch(() => {});
      }
    }

    if (connection === 'close') {
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      console.log(chalk.yellow(`  Disconnected — ${reason}`));

      if (code === DisconnectReason.loggedOut) {
        console.log(chalk.red('\n  ❌ Logged out.'));
        if (!everConnected) {
          // Pairing failed — wipe partial session so next attempt is clean
          console.log(chalk.yellow('  Clearing failed session for fresh pairing...\n'));
          fs.emptyDirSync(config.SESSION_PATH);
        } else {
          // Was working before — keep session, just exit
          console.log(chalk.yellow('  Session kept. Restart to reconnect.\n'));
        }
        process.exit(1);
      } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        console.log(chalk.yellow(`  🔄 Retry ${retryCount}/${MAX_RETRIES} in ${delay/1000}s...`));
        setTimeout(startBot, delay);
      } else {
        console.log(chalk.red('\n  ❌ Max retries reached. Exiting.\n'));
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Store messages ────────────────────────────────────────────
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (jid === 'status@broadcast') {
        store.statusMessages[msg.key.id] = msg;
        const sk = Object.keys(store.statusMessages);
        if (sk.length > 500) delete store.statusMessages[sk[0]];
      } else {
        if (!store.messages[jid]) store.messages[jid] = {};
        const keys = Object.keys(store.messages[jid]);
        if (keys.length >= 200) delete store.messages[jid][keys[0]];
        store.messages[jid][msg.key.id] = msg;
      }
    }
  });

  // ── Anti-delete ───────────────────────────────────────────────
  sock.ev.on('messages.delete', async (item) => {
    if (!('keys' in item)) return;
    for (const key of item.keys) {
      try {
        const isStatus = key.remoteJid === 'status@broadcast';
        if (isStatus) {
          if (!config.ANTI_DELETE_STATUS || !config.OWNER) continue;
          const deleted = store.statusMessages[key.id];
          if (!deleted?.message) continue;
          const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
          const sender   = deleted.key.participant || deleted.key.remoteJid;
          const caption  =
            `╔══════════════════╗\n║  🗑️ *ANTI-DELETE STATUS*\n╚══════════════════╝\n\n` +
            `*From:* wa.me/${sender.split('@')[0]}\n> _${config.BOT_NAME}_`;
          const m = deleted.message;
          if (m.conversation || m.extendedTextMessage?.text) {
            await sock.sendMessage(ownerJid, {
              text: caption + `\n📝 ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage) {
            const t = m.imageMessage ? 'image' : m.videoMessage ? 'video' : 'audio';
            const stream = await downloadContentFromMessage(m[`${t}Message`], t);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            await sock.sendMessage(ownerJid, { [t]: Buffer.concat(chunks), caption });
          } else {
            await sock.sendMessage(ownerJid, { text: caption });
          }
        } else {
          if (!config.ANTI_DELETE_DM || !config.OWNER) continue;
          if (isJidGroup(key.remoteJid)) continue;
          const deleted = store.messages[key.remoteJid]?.[key.id];
          if (!deleted?.message) continue;
          const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
          const sender   = deleted.key.participant || deleted.key.remoteJid;
          const caption  =
            `╔══════════════════╗\n║  🗑️ *ANTI-DELETE DM*\n╚══════════════════╝\n\n` +
            `*From:* wa.me/${sender.split('@')[0]}\n> _${config.BOT_NAME}_`;
          const m = deleted.message;
          if (m.conversation || m.extendedTextMessage?.text) {
            await sock.sendMessage(ownerJid, {
              text: caption + `\n📝 ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage || m.stickerMessage) {
            const t = m.imageMessage ? 'image' : m.videoMessage ? 'video'
                    : m.audioMessage ? 'audio' : 'sticker';
            const stream = await downloadContentFromMessage(m[`${t}Message`], t);
            const chunks = [];
            for await (const c of stream) chunks.push(c);
            const buf = Buffer.concat(chunks);
            await sock.sendMessage(ownerJid,
              t === 'sticker' ? { sticker: buf } : { [t]: buf, caption }
            );
          } else {
            await sock.sendMessage(ownerJid, { text: caption + '\n📦 [Media]' });
          }
        }
      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
      }
    }
  });

  const spamTracker = {};

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const raw of messages) {
      try {
        if (!raw.message) continue;
        const msgType = getContentType(raw.message);
        if (['protocolMessage','senderKeyDistributionMessage'].includes(msgType)) continue;

        if (raw.key.remoteJid === 'status@broadcast') {
          if (config.AUTO_VIEW_STATUS)
            await sock.readMessages([raw.key]).catch(() => {});
          if (config.AUTO_REACT_STATUS) {
            const emojis = ['❤️','🔥','😍','💯','👏','✨','🎯'];
            await sock.sendMessage(
              raw.key.participant || raw.key.remoteJid,
              { react: { text: emojis[Math.floor(Math.random()*emojis.length)], key: raw.key } }
            ).catch(() => {});
          }
          continue;
        }

        if (raw.key.fromMe) continue;
        const m = serialize(sock, raw);
        if (!m) continue;

        if (config.AUTO_READ && !m.isGroup)
          await sock.readMessages([m.key]).catch(() => {});

        const now = Date.now();
        if (!spamTracker[m.sender]) spamTracker[m.sender] = [];
        spamTracker[m.sender] = spamTracker[m.sender].filter(t => now - t < config.ANTI_SPAM_WINDOW);
        spamTracker[m.sender].push(now);
        if (spamTracker[m.sender].length > config.ANTI_SPAM_LIMIT) continue;

        if (!m.isCmd) continue;

        if (config.AUTO_TYPING)
          await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});
        await handleMessage(sock, m);
        if (config.AUTO_TYPING)
          await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        console.error(chalk.red('  Error:'), err.message);
      }
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (store.welcomeToggle?.[id] === false) return;
      const meta = await sock.groupMetadata(id).catch(() => null);
      if (!meta) return;
      for (const pJid of participants) {
        const num = pJid.split('@')[0];
        if (action === 'add') {
          const custom = store.welcomeMessages?.[id];
          const text   = custom
            ? custom.replace('{user}',`@${num}`).replace('{group}',meta.subject)
            : `╔══════════════════╗\n║  🎉 *WELCOME*\n╚══════════════════╝\n\n` +
              `Hello @${num}! 👋\nWelcome to *${meta.subject}*!\n\n> _${config.BOT_NAME}_`;
          await sock.sendMessage(id, { text, mentions: [pJid] });
        } else if (action === 'remove') {
          await sock.sendMessage(id, {
            text:
              `╔══════════════════╗\n║  👋 *GOODBYE*\n╚══════════════════╝\n\n` +
              `@${num} left *${meta.subject}*. Take care! 🌟\n\n> _${config.BOT_NAME}_`,
            mentions: [pJid],
          });
        }
      }
    } catch (_) {}
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const raw of messages) {
      try {
        if (!raw.message || !raw.key.remoteJid?.endsWith('@g.us') || raw.key.fromMe) continue;
        if (!store.antilink?.[raw.key.remoteJid]) continue;
        const body =
          raw.message.conversation ||
          raw.message.extendedTextMessage?.text ||
          raw.message.imageMessage?.caption || '';
        if (!/(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i.test(body)) continue;
        const meta   = await sock.groupMetadata(raw.key.remoteJid).catch(() => null);
        if (!meta) continue;
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        const sender = raw.key.participant || raw.participant;
        if (admins.includes(sender)) continue;
        await sock.sendMessage(raw.key.remoteJid, { delete: raw.key }).catch(() => {});
        await sock.sendMessage(raw.key.remoteJid, {
          text: `@${sender.split('@')[0]} ⚠️ Links not allowed here!`,
          mentions: [sender],
        });
      } catch (_) {}
    }
  });
}

startBot().catch(err => {
  console.error(chalk.red('Fatal:'), err);
  process.exit(1);
});
