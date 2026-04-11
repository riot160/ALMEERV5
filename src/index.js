import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  getContentType,
  downloadContentFromMessage,
  jidNormalizedUser,
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
const logger       = pino({ level: 'silent' });
const BOT_START_TIME = Date.now();  // ignore messages older than bot start

let retryCount           = 0;
const MAX_RETRIES        = 5;
let pluginsLoaded        = false;
let pairingServerStarted = false;
let everConnected        = false;

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

  // ── Socket — exact V4 config, no browser override ────────────
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

  // ── connection.update ─────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'connecting') {
      console.log(chalk.dim('  Connecting to WhatsApp...'));
    }

    if (connection === 'open') {
      retryCount    = 0;
      everConnected = true;

      // ── AUTO-DETECT OWNER from linked number (same as V4) ─────
      try {
        const me = sock.user?.id;
        if (me) {
          const detectedOwner = jidNormalizedUser(me).split('@')[0];
          config.OWNER = detectedOwner;
          console.log(chalk.bold.green('\n  ✅ CONNECTED TO WHATSAPP!'));
          console.log(chalk.yellow(`  📱 Number : ${detectedOwner}`));
          console.log(chalk.lime?.(`  👑 Owner   : ${detectedOwner} (auto-detected)`) || 
                      chalk.green(`  👑 Owner   : ${detectedOwner} (auto-detected)`));
          console.log(chalk.cyan(`  🤖 Bot    : ${config.BOT_NAME}\n`));

          sock.sendMessage(`${detectedOwner}@s.whatsapp.net`, {
            text:
              `╔══════════════════════╗\n` +
              `║  🤖 *ALMEERV5 ONLINE* ║\n` +
              `╚══════════════════════╝\n\n` +
              `✅ Bot connected!\n` +
              `📱 *Number:* ${detectedOwner}\n` +
              `👑 *Owner:* ${detectedOwner} _(auto-detected)_\n` +
              `🟢 *Node:* ${process.version}\n\n` +
              `_Type ${config.PREFIX}menu for commands_ 🚀`,
          }).catch(() => {});
        }
      } catch (err) {
        console.error(chalk.red('  Owner detect error:'), err.message);
      }
    }

    if (connection === 'close') {
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      console.log(chalk.yellow(`  Disconnected — ${reason}`));

      if (code === DisconnectReason.loggedOut) {
        console.log(chalk.red('\n  ❌ Logged out.'));
        if (!everConnected) {
          console.log(chalk.yellow('  Clearing failed session for fresh pairing...\n'));
          fs.emptyDirSync(config.SESSION_PATH);
        } else {
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

  // ── Store ALL messages for anti-delete ────────────────────────
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

  // ── AUTO VIEW + REACT STATUS ──────────────────────────────────
  // SEPARATE handler — NO type filter — status comes as type:'append'
  // V4 pattern: sender = msg.key.participant || msg.key.remoteJid
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.remoteJid !== 'status@broadcast') continue;

        const sender = msg.key.participant || msg.key.remoteJid;

        if (config.AUTO_VIEW_STATUS) {
          await sock.readMessages([msg.key]).catch(() => {});
          console.log(chalk.dim(`  👁️ Viewed status from ${sender.split('@')[0]}`));
        }

        if (config.AUTO_REACT_STATUS) {
          const emojis = ['❤️','🔥','😍','💯','👏','✨','🎯','🥰','💪','😎'];
          const emoji  = emojis[Math.floor(Math.random() * emojis.length)];
          // Send react TO the person who posted the status (V4 exact pattern)
          await sock.sendMessage(sender, {
            react: { text: emoji, key: msg.key },
          }).catch(() => {});
          console.log(chalk.dim(`  ${emoji} Reacted to status from ${sender.split('@')[0]}`));
        }
      } catch (_) {}
    }
  });

  // ── Anti-delete via messages.delete (V4 method) ───────────────
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

  // ── Anti-spam tracker ─────────────────────────────────────────
  const spamTracker = {};

  // ── MAIN message handler ──────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const raw of messages) {
      try {
        if (!raw.message) continue;

        // Ignore old messages from before bot started (V4 pattern)
        const msgTime = (raw.messageTimestamp || 0) * 1000;
        if (msgTime && msgTime < BOT_START_TIME) continue;

        // Skip system messages
        const msgType = getContentType(raw.message);
        if (['senderKeyDistributionMessage','protocolMessage'].includes(msgType)) continue;

        // Skip status — handled separately above
        if (raw.key.remoteJid === 'status@broadcast') continue;

        // ── Serialize ─────────────────────────────────────────────
        const m = serialize(sock, raw);
        if (!m) continue;

        // ── isOwner: fromMe = always owner (V4 exact logic) ───────
        const ownerNum = config.OWNER?.replace(/[^0-9]/g, '') || '';
        const isOwner  = raw.key.fromMe === true ||
                         (ownerNum && m.sender.includes(ownerNum));

        // ── Skip non-command messages from others ──────────────────
        // But DO process fromMe messages (owner using bot from their phone)
        if (!m.isCmd) {
          // Only skip if not a command
          if (config.AUTO_READ && !m.isGroup && !raw.key.fromMe)
            await sock.readMessages([m.key]).catch(() => {});
          continue;
        }

        // Anti-spam (skip for owner)
        if (!isOwner) {
          const now = Date.now();
          if (!spamTracker[m.sender]) spamTracker[m.sender] = [];
          spamTracker[m.sender] = spamTracker[m.sender].filter(t => now - t < config.ANTI_SPAM_WINDOW);
          spamTracker[m.sender].push(now);
          if (spamTracker[m.sender].length > config.ANTI_SPAM_LIMIT) continue;
        }

        if (config.AUTO_READ && !m.isGroup)
          await sock.readMessages([m.key]).catch(() => {});

        if (config.AUTO_TYPING)
          await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});

        await handleMessage(sock, m, isOwner);

        if (config.AUTO_TYPING)
          await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        console.error(chalk.red('  Error:'), err.message);
      }
    }
  });

  // ── Group welcome / goodbye ───────────────────────────────────
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

  // ── Antilink ──────────────────────────────────────────────────
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
