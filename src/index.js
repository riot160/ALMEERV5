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
import { startPairingServer, setCode, setError, setSock } from './pairing.js';

export const errorLogs = [];
const logger = pino({ level: 'silent' });

// Shared socket reference so pairing server can access it
let _currentSock = null;
function getSock() { return _currentSock; }

function printBanner() {
  try {
    const banner = figlet.textSync('ALMEERV5', { font: 'ANSI Shadow' });
    console.log(gradient.rainbow(banner));
  } catch { 
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan('   ALMEERV5 WHATSAPP BOT'));
    console.log(chalk.cyan('═'.repeat(50)));
  }
  console.log(chalk.bold.green('   🤖  ALMEERV5 WhatsApp Bot') + chalk.yellow(' v5.0.0'));
  console.log(chalk.dim('   github.com/SIDER44  |  ALMEER Brand'));
  console.log(chalk.cyan('═'.repeat(50)) + '\n');
}

// ── Main bot startup ──────────────────────────────────────────────────────────
let pairingServerStarted = false;

async function startBot() {
  printBanner();
  await fs.ensureDir(config.SESSION_PATH);
  await fs.ensureDir('./downloads');

  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_PATH);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(chalk.dim(`  📦 Baileys v${version.join('.')} — ${isLatest ? chalk.green('latest ✓') : chalk.yellow('update available')}\n`));

  // ── Create socket with optimized configuration ─────────────────
  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser:                        ['ALMEERV5', 'Chrome', '125.0'],
    printQRInTerminal:              false,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect:            true,
    syncFullHistory:                false,
    shouldIgnoreJid:                () => false,
    // Proper message retrieval for decryption
    getMessage: async (key) => {
      const jid = key.remoteJid;
      return (
        store.messages[jid]?.[key.id]?.message ||
        store.statusMessages?.[key.id]?.message ||
        { conversation: '' }
      );
    },
  });

  _currentSock = sock;
  setSock(sock);  // Important: Let pairing server know about socket
  sock.MQ = new MessageQueue();
  bindStore(sock);
  await loadPlugins();

  // ── Start pairing server ONCE ─────────────────────────────────
  if (!pairingServerStarted) {
    pairingServerStarted = true;
    startPairingServer(getSock, config.PORT);
  }

  // ── PAIRING CODE GENERATION ────────────────────────────────────
  // Generate code when device is not paired
  if (!sock.authState.creds.registered) {
    const owner = config.OWNER?.replace(/[^0-9]/g, '');
    
    if (owner) {
      console.log(chalk.yellow('  🔐 Device not paired. Generating pairing code...\n'));
      try {
        // Critical 3-second wait before requesting (Baileys requirement)
        await new Promise(r => setTimeout(r, 3000));
        const code = await sock.requestPairingCode(owner);
        const formatted = code.match(/.{1,4}/g)?.join('-') || code;
        
        setCode(code);
        
        // Display in terminal
        console.log(chalk.bold.cyan('\n  ╔════════════════════════════════════════╗'));
        console.log(chalk.bold.cyan('  ║') + chalk.bold.yellow('   🔑 PAIRING CODE') + chalk.bold.cyan('                    ║'));
        console.log(chalk.bold.cyan('  ├════════════════════════════════════════┤'));
        console.log(chalk.bold.cyan('  ║') + chalk.bold.green(`  ${formatted}`) + chalk.bold.cyan('  ║'));
        console.log(chalk.bold.cyan('  ├════════════════════════════════════════┤'));
        console.log(chalk.bold.cyan('  ║') + chalk.white('  1. Open WhatsApp on your phone         ') + chalk.bold.cyan('║'));
        console.log(chalk.bold.cyan('  ║') + chalk.white('  2. Go to Linked Devices                ') + chalk.bold.cyan('║'));
        console.log(chalk.bold.cyan('  ║') + chalk.white('  3. Link with Phone Number              ') + chalk.bold.cyan('║'));
        console.log(chalk.bold.cyan('  ║') + chalk.white('  4. Enter code above (60 seconds)       ') + chalk.bold.cyan('║'));
        console.log(chalk.bold.cyan('  ╚════════════════════════════════════════╝\n'));
        
        console.log(chalk.cyan(`  🌐 Also available at: http://localhost:${config.PORT}\n`));
        
      } catch (err) {
        setError(err.message);
        console.error(chalk.red('  ❌ Pairing Error:'), chalk.yellow(err.message));
        console.error(chalk.gray('  💡 Tip: Make sure the phone number is correct and WhatsApp is installed\n'));
      }
    } else {
      console.log(chalk.yellow('  ⚠️  OWNER_NUMBER not set in environment'));
      console.log(chalk.cyan(`  🌐 Open http://localhost:${config.PORT} to pair your device\n`));
    }
  } else {
    console.log(chalk.green('  ✅ Device already paired — connecting directly...\n'));
  }

  // ── Connection Status Handler ─────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'connecting') {
      process.stdout.write(chalk.dim('  ⏳ Connecting to WhatsApp... '));
    }
    
    if (connection === 'open') {
      console.log(chalk.green('✓\n'));
      const user = sock.user?.id?.split(':')[0] || 'unknown';
      console.log(chalk.bold.green('  ✅ CONNECTED TO WHATSAPP\n'));
      console.log(chalk.yellow(`  📱 Number: ${user}`));
      console.log(chalk.cyan(`  🤖 Bot:    ${config.BOT_NAME}`));
      console.log(chalk.green(`  ⚡ Status: ONLINE\n`));

      // Startup message to owner
      if (config.OWNER) {
        const ownerJid = `${config.OWNER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
        sock.sendMessage(ownerJid, {
          text:
            `╔══════════════════════╗\n` +
            `║  🤖 *ALMEERV5 ONLINE* ║\n` +
            `╚══════════════════════╝\n\n` +
            `✅ Bot is now connected!\n` +
            `📱 *Number:* ${user}\n` +
            `🟢 *Node:* ${process.version}\n` +
            `⏰ *Time:* ${new Date().toLocaleString()}\n\n` +
            `_Ready to receive commands_ 🚀`,
        }).catch(() => {});
      }
    }
    
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log(chalk.red('  ❌ Logged out from WhatsApp'));
        console.log(chalk.yellow('  🔄 Clearing session and restarting...\n'));
        fs.emptyDirSync(config.SESSION_PATH);
      } else {
        console.log(chalk.yellow(`  ⚠️  Connection closed (code: ${code})`));
        console.log(chalk.cyan('  🔄 Reconnecting in 3 seconds...\n'));
      }
      setTimeout(startBot, 3000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Store Messages for Features ────────────────────────────────
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

  // ── Anti-Delete Feature ────────────────────────────────────────
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
              text: caption + `\n📝 *Text:* ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage) {
            const t      = m.imageMessage ? 'image' : m.videoMessage ? 'video' : 'audio';
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
              text: caption + `\n📝 *Message:* ${m.conversation || m.extendedTextMessage.text}`,
            });
          } else if (m.imageMessage || m.videoMessage || m.audioMessage || m.stickerMessage) {
            const t      = m.imageMessage ? 'image' : m.videoMessage ? 'video'
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

  // ── Spam Tracker ───────────────────────────────────────────────
  const spamTracker = {};

  // ── Main Message Handler ───────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const raw of messages) {
      try {
        if (!raw.message) continue;

        const msgType = getContentType(raw.message);
        if (['protocolMessage','senderKeyDistributionMessage'].includes(msgType)) continue;

        // Auto view + react status
        if (raw.key.remoteJid === 'status@broadcast') {
          if (config.AUTO_VIEW_STATUS)  await sock.readMessages([raw.key]).catch(() => {});
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

        if (config.AUTO_READ && !m.isGroup) await sock.readMessages([m.key]).catch(() => {});

        // Anti-spam check
        const now = Date.now();
        if (!spamTracker[m.sender]) spamTracker[m.sender] = [];
        spamTracker[m.sender] = spamTracker[m.sender].filter(t => now - t < config.ANTI_SPAM_WINDOW);
        spamTracker[m.sender].push(now);
        if (spamTracker[m.sender].length > config.ANTI_SPAM_LIMIT) continue;

        if (!m.isCmd) continue;

        if (config.AUTO_TYPING) await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});
        await handleMessage(sock, m);
        if (config.AUTO_TYPING) await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        console.error(chalk.red('  ❌ Error:'), err.message);
      }
    }
  });

  // ── Group Welcome / Goodbye ────────────────────────────────────
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (store.welcomeToggle?.[id] === false) return;
      const meta = await sock.groupMetadata(id).catch(() => null);
      if (!meta) return;
      for (const pJid of participants) {
        const num = pJid.split('@')[0];
        if (action === 'add') {
          const custom  = store.welcomeMessages?.[id];
          const text    = custom
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

  // ── Antilink ───────────────────────────────────────────────────
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
          text: `@${sender.split('@')[0]} ⚠️ Links are not allowed here!`,
          mentions: [sender],
        });
      } catch (_) {}
    }
  });
}

startBot().catch(err => {
  console.error(chalk.red('\n  ❌ Fatal Error:'), chalk.yellow(err.message));
  console.error(chalk.gray(err.stack));
  process.exit(1);
});
