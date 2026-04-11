import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  isJidBroadcast,
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
import { startPairingServer }         from './pairing.js';

export const errorLogs = [];
const logger = pino({ level: 'silent' });

function printBanner() {
  const banner = figlet.textSync('ALMEERV5', { font: 'ANSI Shadow' });
  console.log(gradient.rainbow(banner));
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

  // ── FIX 1: Add getMessage like V4 does ───────────────────────
  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser:                    ['ALMEERV5', 'Chrome', '125.0'],
    printQRInTerminal:          false,
    syncFullHistory:            false,
    markOnlineOnConnect:        true,
    generateHighQualityLinkPreview: true,
    defaultQueryTimeoutMs:      60000,
    shouldIgnoreJid:            () => false,
    getMessage: async (key) => {
      const jid = key.remoteJid;
      return (
        store.messages[jid]?.[key.id]?.message ||
        store.statusMessages[key.id]?.message ||
        { conversation: '' }
      );
    },
  });

  sock.MQ = new MessageQueue();
  bindStore(sock);
  await loadPlugins();

  // ── Pairing server (only if not yet registered) ───────────────
  if (!state.creds.registered) {
    startPairingServer(sock, config.PORT);
  } else {
    console.log(chalk.green('  ✅ Session found — connecting...\n'));
  }

  // ── connection.update ─────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const user = sock.user?.id?.split(':')[0] || 'unknown';
      console.log(chalk.bold.green('\n  ✅ Connected!'));
      console.log(chalk.yellow(`  📱 Number: ${user}`));
      console.log(chalk.cyan(`  🤖 Bot:    ${config.BOT_NAME}\n`));

      // Send startup message to owner
      if (config.OWNER) {
        const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
        sock.sendMessage(ownerJid, {
          text:
            `╔══════════════════════╗\n` +
            `║  🤖 *ALMEERV5 ONLINE* ║\n` +
            `╚══════════════════════╝\n\n` +
            `✅ Bot is now connected!\n` +
            `📱 *Number:* ${user}\n` +
            `🟢 *Node:* ${process.version}\n\n` +
            `_Ready to receive commands_ 🚀`,
        }).catch(() => {});
      }
    } else if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log(chalk.red('  ❌ Logged out. Clearing session...'));
        fs.emptyDirSync(config.SESSION_PATH);
      } else {
        console.log(chalk.yellow('  🔄 Reconnecting in 3s...'));
      }
      setTimeout(startBot, 3000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Store messages (for anti-delete) ─────────────────────────
  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid;
      if (jid === 'status@broadcast') {
        store.statusMessages[msg.key.id] = msg;
        const sKeys = Object.keys(store.statusMessages);
        if (sKeys.length > 500) delete store.statusMessages[sKeys[0]];
      } else {
        if (!store.messages[jid]) store.messages[jid] = {};
        const keys = Object.keys(store.messages[jid]);
        if (keys.length >= 200) delete store.messages[jid][keys[0]];
        store.messages[jid][msg.key.id] = msg;
      }
    }
  });

  // ── FIX 2: Anti-delete using messages.delete (like V4) ───────
  // V4 uses this event — it's the correct Baileys event for deletions.
  // V5 was wrongly trying to detect deletes via protocolMessage.
  sock.ev.on('messages.delete', async (item) => {
    try {
      if (!('keys' in item)) return;
      for (const key of item.keys) {
        const isStatus = key.remoteJid === 'status@broadcast';

        // ── Anti-delete STATUS ──────────────────────────────────
        if (isStatus) {
          if (!config.ANTI_DELETE_STATUS) continue;
          const deleted = store.statusMessages[key.id];
          if (!deleted?.message) continue;
          const sender  = deleted.key.participant || deleted.key.remoteJid;
          const caption = `╔══════════════════╗\n║  🗑️ *ANTI-DELETE STATUS*\n╚══════════════════╝\n\n*From:* wa.me/${sender.split('@')[0]}\n_Someone deleted their status._\n\n> _${config.BOT_NAME}_`;
          if (!config.OWNER) continue;
          const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
          const m = deleted.message;
          if (m.conversation || m.extendedTextMessage?.text) {
            await sock.sendMessage(ownerJid, {
              text: caption + `\n📝 *Text:* ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage) {
            const type   = m.imageMessage ? 'image' : m.videoMessage ? 'video' : 'audio';
            const stream = await downloadContentFromMessage(m[`${type}Message`], type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            await sock.sendMessage(ownerJid, { [type]: Buffer.concat(chunks), caption });
          } else {
            await sock.sendMessage(ownerJid, { text: caption });
          }
        } else {
          // ── Anti-delete DM ──────────────────────────────────────
          if (!config.ANTI_DELETE_DM) continue;
          if (isJidGroup(key.remoteJid)) continue; // DM only
          const jid     = key.remoteJid;
          const msgs    = store.messages[jid];
          if (!msgs) continue;
          const deleted = msgs[key.id];
          if (!deleted?.message) continue;
          const sender  = deleted.key.participant || deleted.key.remoteJid;
          if (!config.OWNER) continue;
          const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
          const caption  = `╔══════════════════╗\n║  🗑️ *ANTI-DELETE DM*\n╚══════════════════╝\n\n*From:* wa.me/${sender.split('@')[0]}\n\n> _${config.BOT_NAME}_`;
          const m = deleted.message;
          if (m.conversation || m.extendedTextMessage?.text) {
            await sock.sendMessage(ownerJid, {
              text: caption + `\n📝 *Message:* ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage || m.stickerMessage) {
            const type   = m.imageMessage ? 'image' : m.videoMessage ? 'video'
                         : m.audioMessage ? 'audio' : 'sticker';
            const stream = await downloadContentFromMessage(m[`${type}Message`], type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);
            await sock.sendMessage(ownerJid,
              type === 'sticker' ? { sticker: buffer } : { [type]: buffer, caption }
            );
          } else {
            await sock.sendMessage(ownerJid, { text: caption + '\n📦 [Media message]' });
          }
        }
      }
    } catch (err) {
      errorLogs.push({ time: new Date().toISOString(), error: err.message });
      console.error(chalk.red('  Anti-delete error:'), err.message);
    }
  });

  // ── Anti-spam tracker ─────────────────────────────────────────
  const spamTracker = {};

  // ── FIX 3: Main messages.upsert — clean, no protocolMessage ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const raw of messages) {
      try {
        if (!raw.message) continue;

        // Skip protocol/system messages — delete is handled by messages.delete
        const msgType = getContentType(raw.message);
        if (['protocolMessage', 'senderKeyDistributionMessage'].includes(msgType)) continue;

        // ── Auto view & react to status ──────────────────────────
        if (raw.key.remoteJid === 'status@broadcast') {
          if (config.AUTO_VIEW_STATUS) {
            await sock.readMessages([raw.key]).catch(() => {});
          }
          if (config.AUTO_REACT_STATUS) {
            const reacts = ['❤️','🔥','😍','💯','👏','✨','🎯'];
            const emoji  = reacts[Math.floor(Math.random() * reacts.length)];
            await sock.sendMessage(
              raw.key.participant || raw.key.remoteJid,
              { react: { text: emoji, key: raw.key } }
            ).catch(() => {});
          }
          continue;
        }

        if (raw.key.fromMe) continue;

        const m = serialize(sock, raw);
        if (!m) continue;

        if (config.AUTO_READ && !m.isGroup) {
          await sock.readMessages([m.key]).catch(() => {});
        }

        // Anti-spam
        const now = Date.now();
        if (!spamTracker[m.sender]) spamTracker[m.sender] = [];
        spamTracker[m.sender] = spamTracker[m.sender].filter(t => now - t < config.ANTI_SPAM_WINDOW);
        spamTracker[m.sender].push(now);
        if (spamTracker[m.sender].length > config.ANTI_SPAM_LIMIT) continue;

        if (!m.isCmd) continue;

        if (config.AUTO_TYPING) {
          await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});
        }
        await handleMessage(sock, m);
        if (config.AUTO_TYPING) {
          await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});
        }

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        console.error(chalk.red('  Error:'), err.message);
      }
    }
  });

  // ── Group welcome/goodbye ─────────────────────────────────────
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (store.welcomeToggle?.[id] === false) return;
      const meta = await sock.groupMetadata(id).catch(() => null);
      if (!meta) return;
      for (const pJid of participants) {
        const num = pJid.split('@')[0];
        if (action === 'add') {
          const custom  = store.welcomeMessages?.[id];
          const welcome = custom
            ? custom.replace('{user}', `@${num}`).replace('{group}', meta.subject)
            : `╔══════════════════╗\n║  🎉 *WELCOME*\n╚══════════════════╝\n\n` +
              `Hello @${num}! 👋\nWelcome to *${meta.subject}*!\n\n> _${config.BOT_NAME}_`;
          await sock.sendMessage(id, { text: welcome, mentions: [pJid] });
        } else if (action === 'remove') {
          await sock.sendMessage(id, {
            text:
              `╔══════════════════╗\n║  👋 *GOODBYE*\n╚══════════════════╝\n\n` +
              `@${num} has left *${meta.subject}*. Take care! 🌟\n\n> _${config.BOT_NAME}_`,
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
        if (!raw.message || !raw.key.remoteJid?.endsWith('@g.us')) continue;
        if (raw.key.fromMe) continue;
        if (!store.antilink?.[raw.key.remoteJid]) continue;
        const text =
          raw.message.conversation ||
          raw.message.extendedTextMessage?.text ||
          raw.message.imageMessage?.caption || '';
        const hasLink = /(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i.test(text);
        if (!hasLink) continue;
        const meta   = await sock.groupMetadata(raw.key.remoteJid).catch(() => null);
        if (!meta) continue;
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        const sender = raw.key.participant || raw.participant;
        if (admins.includes(sender)) continue;
        await sock.sendMessage(raw.key.remoteJid, { delete: raw.key }).catch(() => {});
        await sock.sendMessage(raw.key.remoteJid, {
          text: `@${sender.split('@')[0]} ⚠️ Links are not allowed in this group!`,
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
