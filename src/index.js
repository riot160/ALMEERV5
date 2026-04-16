import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore, getContentType, downloadContentFromMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import fs from 'fs-extra';
import config from './config.js';
import store, { bindStore } from './lib/store.js';
import { serialize } from './lib/serialize.js';
import { MessageQueue } from './lib/queue.js';
import { handleMessage, loadPlugins } from './handler.js';
import { startPairingServer, updateSock } from './pairing.js';

export const errorLogs = [];
const logger = pino({ level: 'silent' });
const BOT_START_TIME = Date.now();

export const settings = {
  autoViewStatus:   true,
  autoReactStatus:  true,
  antiDeleteDM:     true,
  antiDeleteStatus: true,
  alwaysOnline:     false,
  statusEmoji:      '🔥',
  statusDelay:      1000,
  autoRead:         true,
  autoTyping:       true,
  autoReact:        true,
};

export const msgCache    = new Map();
export const statusCache = new Map();

let retryCount           = 0;
const MAX_RETRIES        = 5;
let pluginsLoaded        = false;
let pairingServerStarted = false;
let everConnected        = false;

function printBanner() {
  try {
    console.log(gradient.rainbow(figlet.textSync('ALMEERV5', { font: 'ANSI Shadow' })));
  } catch {
    console.log(chalk.cyan('=== ALMEERV5 ==='));
  }
  console.log(chalk.cyan('  ═'.repeat(28)));
  console.log(chalk.bold.green('   🤖  ALMEERV5 WhatsApp Bot  ') + chalk.yellow('v5.0.0'));
  console.log(chalk.dim('   github.com/SIDER44  |  ALMEER Brand'));
  console.log(chalk.cyan('  ═'.repeat(28)) + '\n');
}

// ── Status handler — exact RIOT2 pattern ─────────────────────────────────────
async function statusHandler(sock, msg) {
  // RIOT2 exact: msg.key.participant only — no remoteJid fallback
  const sender     = msg.key.participant || '';
  const senderNum  = sender.split('@')[0];
  const senderName = msg.pushName || senderNum;

  if (!sender) return;

  const hasImage  = !!msg.message?.imageMessage;
  const hasVideo  = !!msg.message?.videoMessage;
  const hasMedia  = hasImage || hasVideo;
  const mediaKey  = hasImage ? 'imageMessage' : 'videoMessage';
  const mediaType = hasImage ? 'image' : 'video';
  const caption   =
    msg.message?.imageMessage?.caption  ||
    msg.message?.videoMessage?.caption  ||
    msg.message?.conversation           ||
    msg.message?.extendedTextMessage?.text || null;

  // ── AUTO VIEW STATUS ──────────────────────────────────────────
  if (settings.autoViewStatus) {
    await new Promise(r => setTimeout(r, settings.statusDelay || 1000));
    try {
      await sock.sendReadReceipt(sender, null, [msg.key.id]);
      console.log(chalk.green(`  👁️  Viewed: ${senderName} (+${senderNum})`));
    } catch (e1) {
      try {
        await sock.readMessages([{
          remoteJid:   'status@broadcast',
          id:          msg.key.id,
          participant: sender,
        }]);
        console.log(chalk.dim(`  👁️  Viewed fallback: ${senderName}`));
      } catch (e2) {
        console.log(chalk.red(`  ⚠️  View failed: ${e2.message}`));
      }
    }
  }

  // ── AUTO REACT STATUS ─────────────────────────────────────────
  if (settings.autoReactStatus) {
    const emoji = settings.statusEmoji || '🔥';
    await new Promise(r => setTimeout(r, 500));
    try {
      await sock.sendMessage(sender, {
        react: {
          text: emoji,
          key: {
            remoteJid:   'status@broadcast',
            id:          msg.key.id,
            participant: sender,
            fromMe:      false,
          },
        },
      });
      console.log(chalk.green(`  ${emoji}  Reacted: ${senderName}`));
    } catch (e) {
      console.log(chalk.red(`  ⚠️  React failed: ${e.message}`));
    }
  }

  // ── CACHE FOR ANTI-DELETE STATUS ──────────────────────────────
  if (settings.antiDeleteStatus && hasMedia) {
    try {
      const stream = await downloadContentFromMessage(msg.message[mediaKey], mediaType);
      const chunks = [];
      for await (const c of stream) chunks.push(c);
      statusCache.set(msg.key.id, {
        buf: Buffer.concat(chunks), mediaType, caption,
        senderNum, senderName, time: Date.now(),
      });
      if (statusCache.size > 200)
        statusCache.delete(statusCache.keys().next().value);
    } catch (_) {}
  }
}

// ── messages.delete handler ───────────────────────────────────────────────────
async function deletedMsgHandler(sock, item) {
  const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
  if (!ownerNum) return;
  const ownerJid = `${ownerNum}@s.whatsapp.net`;

  for (const key of (item.keys || [])) {
    if (key.remoteJid === 'status@broadcast') {
      if (!settings.antiDeleteStatus) continue;
      const cached = statusCache.get(key.id);
      if (!cached) continue;
      try {
        let cap = `🗑️ *Deleted Status*\n👤 From: ${cached.senderName} (+${cached.senderNum})\n⏰ Deleted before 24h`;
        if (cached.caption) cap += `\n📝 ${cached.caption}`;
        await sock.sendMessage(ownerJid, { [cached.mediaType]: cached.buf, caption: cap });
      } catch (_) {}
      statusCache.delete(key.id);
      continue;
    }
    if (!settings.antiDeleteDM) continue;
    const cached = msgCache.get(key.id);
    if (!cached) continue;
    try {
      await sock.sendMessage(ownerJid, {
        text:
          `🛡️ *Anti-Delete*\n` +
          `👤 *From:* ${cached.name}\n` +
          `📍 *Chat:* ${key.remoteJid?.endsWith('@g.us') ? 'Group' : 'DM'}\n\n` +
          `🗑️ *Deleted:*\n${cached.text || '[media]'}`,
      });
    } catch (_) {}
  }
}

// ── messages.update handler ───────────────────────────────────────────────────
async function msgUpdateHandler(sock, updates) {
  const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
  if (!ownerNum) return;
  const ownerJid = `${ownerNum}@s.whatsapp.net`;

  for (const update of updates) {
    const remoteJid = update.key?.remoteJid || '';
    const stubType  = update.update?.messageStubType;

    if (remoteJid === 'status@broadcast' && stubType === 1) {
      if (!settings.antiDeleteStatus) continue;
      const cached = statusCache.get(update.key?.id);
      if (!cached) continue;
      try {
        let cap = `🗑️ *Deleted Status*\n👤 From: ${cached.senderName} (+${cached.senderNum})`;
        if (cached.caption) cap += `\n📝 ${cached.caption}`;
        await sock.sendMessage(ownerJid, { [cached.mediaType]: cached.buf, caption: cap });
        console.log(chalk.dim(`  🗑️  Deleted status → owner DM`));
      } catch (_) {}
      statusCache.delete(update.key.id);
      continue;
    }

    if (stubType === 1 && remoteJid !== 'status@broadcast') {
      if (!settings.antiDeleteDM) continue;
      const cached = msgCache.get(update.key?.id);
      if (!cached) continue;
      try {
        await sock.sendMessage(ownerJid, {
          text:
            `🛡️ *Anti-Delete*\n` +
            `👤 *From:* ${cached.name}\n` +
            `📍 *Chat:* ${remoteJid.endsWith('@g.us') ? 'Group' : 'DM'}\n\n` +
            `🗑️ *Deleted:*\n${cached.text || '[media]'}`,
        });
      } catch (_) {}
    }
  }
}

// ═══════════════════════════════════════════════════════════════
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

  // NO browser override
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
      const cached = msgCache.get(key.id);
      if (cached?.rawMessage) return cached.rawMessage;
      return store.messages[key.remoteJid]?.[key.id]?.message || { conversation: '' };
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

  // Always-online heartbeat
  const presenceInterval = setInterval(async () => {
    if (sock.user) {
      await sock.sendPresenceUpdate(
        settings.alwaysOnline ? 'available' : 'unavailable'
      ).catch(() => {});
    }
  }, 30000);

  // ── connection.update ─────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'connecting')
      console.log(chalk.dim('  Connecting to WhatsApp...'));

    if (connection === 'open') {
      retryCount = 0;
      everConnected = true;
      try {
        const myNumber = (sock.user?.id || '')
          .split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (myNumber) {
          config.OWNER = myNumber;
          console.log(chalk.bold.green('\n  ✅ CONNECTED TO WHATSAPP!'));
          console.log(chalk.yellow(`  📱 Number : ${myNumber}`));
          console.log(chalk.green(`  👑 Owner  : ${myNumber} (auto-detected)\n`));
          sock.sendMessage(`${myNumber}@s.whatsapp.net`, {
            text:
              `╭─────────────────────╮\n` +
              `│  🤖 *ALMEERV5 ONLINE* │\n` +
              `╰─────────────────────╯\n\n` +
              `✅ Bot connected!\n` +
              `📱 *Number:* ${myNumber}\n` +
              `👑 *Owner:* ${myNumber}\n` +
              `🟢 *Node:* ${process.version}\n\n` +
              `_Type ${config.PREFIX}menu for commands_ 🚀`,
          }).catch(() => {});
        }
      } catch (e) {
        console.error(chalk.red('  Owner detect:'), e.message);
      }
    }

    if (connection === 'close') {
      clearInterval(presenceInterval);
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      console.log(chalk.yellow(`  Disconnected — ${reason}`));

      if (code === DisconnectReason.loggedOut) {
        console.log(chalk.red('\n  ❌ Logged out.'));
        if (!everConnected) {
          console.log(chalk.yellow('  Clearing failed session...\n'));
          fs.emptyDirSync(config.SESSION_PATH);
        }
        process.exit(1);
      } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        console.log(chalk.yellow(`  🔄 Retry ${retryCount}/${MAX_RETRIES} in ${delay/1000}s...`));
        setTimeout(startBot, delay);
      } else {
        console.log(chalk.red('\n  ❌ Max retries. Exiting.\n'));
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Main message event — accepts notify AND append ────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // RIOT2 exact: accept both notify and append
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        // Skip old replayed messages
        const msgTime = (msg.messageTimestamp || 0) * 1000;
        if (msgTime && msgTime < BOT_START_TIME) continue;

        const jid = msg.key.remoteJid;

        // Route status to statusHandler
        if (jid === 'status@broadcast') {
          await statusHandler(sock, msg);
          continue;
        }

        // Cache all non-fromMe messages for anti-delete
        if (!msg.key.fromMe) {
          const body =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption || '';
          msgCache.set(msg.key.id, {
            text:       body,
            jid,
            sender:     msg.key.participant || jid,
            name:       msg.pushName || (msg.key.participant || jid).split('@')[0],
            time:       Date.now(),
            rawMessage: msg.message,
          });
          if (msgCache.size > 500)
            msgCache.delete(msgCache.keys().next().value);
        }

        // Anti-delete DM via protocolMessage REVOKE
        const msgType = getContentType(msg.message);
        if (msgType === 'protocolMessage') {
          const proto = msg.message.protocolMessage;
          if (proto?.type === 0 && settings.antiDeleteDM) {
            const cached   = msgCache.get(proto.key?.id);
            const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
            if (cached && ownerNum) {
              await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, {
                text:
                  `🛡️ *Anti-Delete*\n` +
                  `👤 *From:* ${cached.name}\n` +
                  `📍 *Chat:* ${cached.jid?.endsWith('@g.us') ? 'Group' : 'DM'}\n\n` +
                  `🗑️ *Deleted:*\n${cached.text || '[media]'}`,
              }).catch(() => {});
            }
          }
          continue;
        }

        if (['senderKeyDistributionMessage'].includes(msgType)) continue;

        // Only process commands on notify type
        if (type !== 'notify') continue;

        const m = serialize(sock, msg);
        if (!m) continue;

        const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
        const isOwner  = msg.key.fromMe === true ||
                         (ownerNum && m.sender.includes(ownerNum));

        if (settings.autoRead && !m.isGroup)
          await sock.readMessages([m.key]).catch(() => {});

        if (!m.isCmd) continue;

        if (settings.autoTyping)
          await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});

        await handleMessage(sock, m, isOwner);

        if (settings.autoTyping)
          await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        console.error(chalk.red('  Error:'), err.message);
      }
    }
  });

  sock.ev.on('messages.delete', (item) =>
    deletedMsgHandler(sock, item).catch(() => {})
  );

  sock.ev.on('messages.update', (updates) =>
    msgUpdateHandler(sock, updates).catch(() => {})
  );

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
            ? custom.replace('{user}', `@${num}`).replace('{group}', meta.subject)
            : `╭──────────────────╮\n│  🎉 *WELCOME*\n╰──────────────────╯\n\nHello @${num}! 👋\nWelcome to *${meta.subject}*!\n\n> _${config.BOT_NAME}_`;
          await sock.sendMessage(id, { text, mentions: [pJid] });
        } else if (action === 'remove') {
          await sock.sendMessage(id, {
            text:
              `╭──────────────────╮\n│  👋 *GOODBYE*\n╰──────────────────╯\n\n` +
              `@${num} left. Take care! 🌟\n\n> _${config.BOT_NAME}_`,
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
