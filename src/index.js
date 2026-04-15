import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore, getContentType, downloadContentFromMessage,
} from '@whiskeysockets/baileys';
import pino     from 'pino';
import chalk    from 'chalk';
import figlet   from 'figlet';
import gradient from 'gradient-string';
import fs       from 'fs-extra';
import readline from 'readline';

import config               from './config.js';
import store, { bindStore } from './lib/store.js';
import { serialize }        from './lib/serialize.js';
import { MessageQueue }     from './lib/queue.js';
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

// ── Hacker-style coloured logger ─────────────────────────────────────────────
export const log = {
  info:    (m) => console.log(chalk.bold.cyan(`  [INFO]   `) + chalk.white(m)),
  success: (m) => console.log(chalk.bold.green(`  [OK]     `) + chalk.greenBright(m)),
  warn:    (m) => console.log(chalk.bold.yellow(`  [WARN]   `) + chalk.yellow(m)),
  error:   (m) => console.log(chalk.bold.red(`  [ERR]    `) + chalk.red(m)),
  cmd:     (m) => console.log(chalk.bold.magenta(`  [CMD]    `) + chalk.magentaBright(m)),
  event:   (m) => console.log(chalk.bold.blue(`  [EVENT]  `) + chalk.blueBright(m)),
  status:  (m) => console.log(chalk.bold.hex('#00ffc8')(`  [STATUS] `) + chalk.hex('#00e6b3')(m)),
  delete:  (m) => console.log(chalk.bold.hex('#ff9900')(`  [DELETE] `) + chalk.hex('#ffb347')(m)),
  pair:    (m) => console.log(chalk.bold.hex('#bf00ff')(`  [PAIR]   `) + chalk.hex('#df80ff')(m)),
  msg:     (from, body) => console.log(
    chalk.bold.hex('#ff6ec7')(`  [MSG]    `) +
    chalk.hex('#ff9de2')(`${from}`) +
    chalk.dim(' → ') +
    chalk.white(String(body).slice(0, 60) + (body?.length > 60 ? '...' : ''))
  ),
  conn:    (m) => console.log(chalk.bold.hex('#39ff14')(`  [CONN]   `) + chalk.hex('#57ff2e')(m)),
  load:    (m) => console.log(chalk.bold.hex('#00bfff')(`  [LOAD]   `) + chalk.hex('#33ccff')(m)),
};

function printBanner() {
  try {
    console.log(gradient.rainbow(figlet.textSync('ALMEERV5', { font: 'ANSI Shadow' })));
  } catch {
    console.log(chalk.hex('#00ffc8')('=== ALMEERV5 ==='));
  }
  console.log(chalk.hex('#00ffc8')('  ' + '═'.repeat(50)));
  console.log(chalk.bold.hex('#00ffc8')('   ⚡  ALMEERV5') + chalk.hex('#bf00ff')(' WhatsApp Bot  ') + chalk.hex('#39ff14')('v5.0.0'));
  console.log(chalk.dim('   github.com/SIDER44  |  ALMEER Brand'));
  console.log(chalk.hex('#00ffc8')('  ' + '═'.repeat(50)) + '\n');
}

// ── Ask number in terminal (Pterodactyl / any terminal) ───────────────────────
function askPhoneInTerminal() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(chalk.bold.yellow('\n  ╔══════════════════════════════════════════╗'));
    console.log(chalk.bold.yellow('  ║      📱 ENTER YOUR WHATSAPP NUMBER       ║'));
    console.log(chalk.bold.yellow('  ╚══════════════════════════════════════════╝'));
    console.log(chalk.dim('  Include country code — no + or spaces'));
    console.log(chalk.dim('  Example: 254712345678\n'));
    rl.question(chalk.bold.hex('#00ffc8')('  ➤ Phone number: '), (input) => {
      rl.close();
      const clean = input.trim().replace(/[^0-9]/g, '');
      resolve(clean);
    });
  });
}

// ── Status handler ────────────────────────────────────────────────────────────
async function statusHandler(sock, msg) {
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

  if (settings.autoViewStatus) {
    await new Promise(r => setTimeout(r, settings.statusDelay || 1000));
    try {
      await sock.sendReadReceipt(sender, null, [msg.key.id]);
      log.status(`👁️  Viewed: ${senderName} (+${senderNum})`);
    } catch {
      try {
        await sock.readMessages([{ remoteJid: 'status@broadcast', id: msg.key.id, participant: sender }]);
        log.status(`👁️  Viewed (fallback): ${senderName}`);
      } catch (e2) {
        log.warn(`View failed: ${e2.message}`);
      }
    }
  }

  if (settings.autoReactStatus) {
    const emoji = settings.statusEmoji || '🔥';
    await new Promise(r => setTimeout(r, 500));
    try {
      await sock.sendMessage(sender, {
        react: {
          text: emoji,
          key: { remoteJid: 'status@broadcast', id: msg.key.id, participant: sender, fromMe: false },
        },
      });
      log.status(`${emoji}  Reacted: ${senderName}`);
    } catch (e) {
      log.warn(`React failed: ${e.message}`);
    }
  }

  if (settings.antiDeleteStatus && hasMedia) {
    try {
      const stream = await downloadContentFromMessage(msg.message[mediaKey], mediaType);
      const chunks = []; for await (const c of stream) chunks.push(c);
      statusCache.set(msg.key.id, { buf: Buffer.concat(chunks), mediaType, caption, senderNum, senderName, time: Date.now() });
      if (statusCache.size > 200) statusCache.delete(statusCache.keys().next().value);
    } catch (_) {}
  }
}

// ── Anti-delete handlers ──────────────────────────────────────────────────────
async function deletedMsgHandler(sock, item) {
  const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
  if (!ownerNum) return;
  const ownerJid = `${ownerNum}@s.whatsapp.net`;
  for (const key of (item.keys || [])) {
    if (key.remoteJid === 'status@broadcast') {
      if (!settings.antiDeleteStatus) continue;
      const cached = statusCache.get(key.id); if (!cached) continue;
      try {
        let cap = `🗑️ *Deleted Status*\n👤 From: ${cached.senderName} (+${cached.senderNum})\n⏰ Deleted before 24h`;
        if (cached.caption) cap += `\n📝 ${cached.caption}`;
        await sock.sendMessage(ownerJid, { [cached.mediaType]: cached.buf, caption: cap });
        log.delete(`Status deleted by ${cached.senderName} → forwarded to owner`);
      } catch (_) {}
      statusCache.delete(key.id); continue;
    }
    if (!settings.antiDeleteDM) continue;
    const cached = msgCache.get(key.id); if (!cached) continue;
    try {
      await sock.sendMessage(ownerJid, {
        text: `🛡️ *Anti-Delete*\n👤 *From:* ${cached.name}\n📍 *Chat:* ${key.remoteJid?.endsWith('@g.us') ? 'Group' : 'DM'}\n\n🗑️ *Deleted:*\n${cached.text || '[media]'}`,
      });
      log.delete(`Msg deleted by ${cached.name} → forwarded to owner`);
    } catch (_) {}
  }
}

async function msgUpdateHandler(sock, updates) {
  const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
  if (!ownerNum) return;
  const ownerJid = `${ownerNum}@s.whatsapp.net`;
  for (const update of updates) {
    const remoteJid = update.key?.remoteJid || '';
    const stubType  = update.update?.messageStubType;
    if (remoteJid === 'status@broadcast' && stubType === 1) {
      if (!settings.antiDeleteStatus) continue;
      const cached = statusCache.get(update.key?.id); if (!cached) continue;
      try {
        let cap = `🗑️ *Deleted Status*\n👤 From: ${cached.senderName} (+${cached.senderNum})`;
        if (cached.caption) cap += `\n📝 ${cached.caption}`;
        await sock.sendMessage(ownerJid, { [cached.mediaType]: cached.buf, caption: cap });
        log.delete(`Status deleted → owner DM (${cached.senderName})`);
      } catch (_) {}
      statusCache.delete(update.key.id); continue;
    }
    if (stubType === 1 && remoteJid !== 'status@broadcast') {
      if (!settings.antiDeleteDM) continue;
      const cached = msgCache.get(update.key?.id); if (!cached) continue;
      try {
        await sock.sendMessage(ownerJid, {
          text: `🛡️ *Anti-Delete*\n👤 *From:* ${cached.name}\n📍 *Chat:* ${remoteJid.endsWith('@g.us') ? 'Group' : 'DM'}\n\n🗑️ *Deleted:*\n${cached.text || '[media]'}`,
        });
        log.delete(`Msg deleted → owner DM (${cached.name})`);
      } catch (_) {}
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
async function startBot() {
  printBanner();
  await fs.ensureDir(config.SESSION_PATH);
  await fs.ensureDir('./downloads');

  const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_PATH);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  log.info(`Baileys v${version.join('.')} — ${isLatest ? 'latest ✓' : 'update available'}`);

  if (!pluginsLoaded) {
    await loadPlugins();
    pluginsLoaded = true;
  }

  const sock = makeWASocket({
    version, logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
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

  // ── Start web pairing server (OPTION 1: URL) ──────────────────
  if (!pairingServerStarted) {
    pairingServerStarted = true;
    startPairingServer(config.PORT);
  }

  // ── Pairing logic — 3 options ─────────────────────────────────
  if (!sock.authState.creds.registered) {

    // ── OPTION 2: Auto-pair from OWNER_NUMBER env ─────────────────
    const envNumber = process.env.OWNER_NUMBER?.replace(/[^0-9]/g, '');
    if (envNumber) {
      log.pair(`OWNER_NUMBER found in env → auto-generating pairing code for ${envNumber}...`);
      try {
        await new Promise(r => setTimeout(r, 3000));
        const code = await sock.requestPairingCode(envNumber);
        config.OWNER = envNumber;
        console.log(chalk.bold.hex('#39ff14')('\n  ╔══════════════════════════════════════════════╗'));
        console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.bold.white('   🔑 PAIRING CODE  ') + chalk.bold.hex('#00ffc8')(code) + chalk.bold.hex('#39ff14')('         ║'));
        console.log(chalk.bold.hex('#39ff14')('  ╚══════════════════════════════════════════════╝'));
        console.log(chalk.dim('  → WhatsApp → Linked Devices → Link with phone number\n'));
        log.pair(`Web URL also available at your Railway/Pterodactyl domain`);
      } catch (err) {
        log.error(`Auto-pair failed: ${err.message}`);
      }

    } else {
      // ── OPTION 3: Ask in terminal ─────────────────────────────────
      log.pair('No OWNER_NUMBER in env — prompting terminal input...');
      log.info(`Web pairing also available at your deployment URL`);
      const termNumber = await askPhoneInTerminal();
      if (termNumber && termNumber.length >= 7) {
        log.pair(`Terminal number: ${termNumber} → requesting code...`);
        try {
          await new Promise(r => setTimeout(r, 3000));
          const code = await sock.requestPairingCode(termNumber);
          config.OWNER = termNumber;
          console.log(chalk.bold.hex('#39ff14')('\n  ╔══════════════════════════════════════════════╗'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.bold.white('   🔑 PAIRING CODE  ') + chalk.bold.hex('#00ffc8')(code) + chalk.bold.hex('#39ff14')('         ║'));
          console.log(chalk.bold.hex('#39ff14')('  ╚══════════════════════════════════════════════╝'));
          console.log(chalk.dim('  → WhatsApp → Linked Devices → Link with phone number\n'));
        } catch (err) {
          log.error(`Terminal pair failed: ${err.message}`);
          log.info(`Use the web URL instead to pair manually`);
        }
      } else {
        log.warn('No number entered — use the web URL to pair');
      }
    }
  } else {
    log.success('Existing session found — connecting directly...');
  }

  // ── Always-online heartbeat ───────────────────────────────────
  const presenceInterval = setInterval(async () => {
    if (sock.user) {
      await sock.sendPresenceUpdate(settings.alwaysOnline ? 'available' : 'unavailable').catch(() => {});
    }
  }, 30000);

  // ── connection.update ─────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'connecting')
      log.conn('Connecting to WhatsApp...');

    if (connection === 'open') {
      retryCount = 0; everConnected = true;
      try {
        const myNumber = (sock.user?.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
        if (myNumber) {
          config.OWNER = myNumber;
          console.log('');
          console.log(chalk.bold.hex('#39ff14')('  ╔══════════════════════════════════════════════╗'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.bold.hex('#00ffc8')('   ✅  CONNECTED TO WHATSAPP               ') + chalk.bold.hex('#39ff14')('║'));
          console.log(chalk.bold.hex('#39ff14')('  ╠══════════════════════════════════════════════╣'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.white(`   📱 Number  : ${myNumber}`.padEnd(46)) + chalk.bold.hex('#39ff14')('║'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.white(`   👑 Owner   : ${myNumber}`.padEnd(46)) + chalk.bold.hex('#39ff14')('║'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.white(`   🤖 Bot     : ${config.BOT_NAME}`.padEnd(46)) + chalk.bold.hex('#39ff14')('║'));
          console.log(chalk.bold.hex('#39ff14')('  ║') + chalk.white(`   🟢 Node    : ${process.version}`.padEnd(46)) + chalk.bold.hex('#39ff14')('║'));
          console.log(chalk.bold.hex('#39ff14')('  ╚══════════════════════════════════════════════╝'));
          console.log('');
          sock.sendMessage(`${myNumber}@s.whatsapp.net`, {
            text:
              `╭─────────────────────╮\n│  🤖 *ALMEERV5 ONLINE* │\n╰─────────────────────╯\n\n` +
              `✅ Bot connected!\n📱 *Number:* ${myNumber}\n👑 *Owner:* ${myNumber}\n🟢 *Node:* ${process.version}\n\n` +
              `_Type ${config.PREFIX}menu for commands_ 🚀`,
          }).catch(() => {});
        }
      } catch (e) { log.error(`Owner detect: ${e.message}`); }
    }

    if (connection === 'close') {
      clearInterval(presenceInterval);
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      log.warn(`Disconnected — ${reason}`);
      if (code === DisconnectReason.loggedOut) {
        log.error('Logged out of WhatsApp.');
        if (!everConnected) { log.warn('Clearing failed session...'); fs.emptyDirSync(config.SESSION_PATH); }
        process.exit(1);
      } else if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        log.warn(`Retry ${retryCount}/${MAX_RETRIES} in ${delay/1000}s...`);
        setTimeout(startBot, delay);
      } else {
        log.error('Max retries reached. Exiting.');
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ── Main message handler ──────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const msgTime = (msg.messageTimestamp || 0) * 1000;
        if (msgTime && msgTime < BOT_START_TIME) continue;
        const jid = msg.key.remoteJid;

        if (jid === 'status@broadcast') { await statusHandler(sock, msg); continue; }

        if (!msg.key.fromMe) {
          const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text
            || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || '';
          msgCache.set(msg.key.id, {
            text: body, jid, sender: msg.key.participant || jid,
            name: msg.pushName || (msg.key.participant || jid).split('@')[0],
            time: Date.now(), rawMessage: msg.message,
          });
          if (msgCache.size > 500) msgCache.delete(msgCache.keys().next().value);
        }

        const msgType = getContentType(msg.message);
        if (msgType === 'protocolMessage') {
          const proto = msg.message.protocolMessage;
          if (proto?.type === 0 && settings.antiDeleteDM) {
            const cached   = msgCache.get(proto.key?.id);
            const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
            if (cached && ownerNum) {
              await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, {
                text: `🛡️ *Anti-Delete*\n👤 *From:* ${cached.name}\n📍 *Chat:* ${cached.jid?.endsWith('@g.us') ? 'Group' : 'DM'}\n\n🗑️ *Deleted:*\n${cached.text || '[media]'}`,
              }).catch(() => {});
              log.delete(`Msg deleted by ${cached.name} → forwarded`);
            }
          }
          continue;
        }
        if (['senderKeyDistributionMessage'].includes(msgType)) continue;
        if (type !== 'notify') continue;

        const m = serialize(sock, msg); if (!m) continue;

        const ownerNum = config.OWNER?.replace(/[^0-9]/g, '');
        const isOwner  = msg.key.fromMe === true || (ownerNum && m.sender.includes(ownerNum));

        if (settings.autoRead && !m.isGroup) await sock.readMessages([m.key]).catch(() => {});

        if (!m.isCmd) continue;

        // Log incoming commands
        log.cmd(`.${m.command} | ${isOwner ? 'OWNER' : m.sender.split('@')[0]} | ${m.jid.split('@')[0]}`);

        if (settings.autoTyping) await sock.sendPresenceUpdate('composing', m.jid).catch(() => {});
        await handleMessage(sock, m, isOwner);
        if (settings.autoTyping) await sock.sendPresenceUpdate('paused', m.jid).catch(() => {});

      } catch (err) {
        errorLogs.push({ time: new Date().toISOString(), error: err.message });
        if (errorLogs.length > 100) errorLogs.shift();
        log.error(`Message error: ${err.message}`);
      }
    }
  });

  sock.ev.on('messages.delete', (item) => deletedMsgHandler(sock, item).catch(() => {}));
  sock.ev.on('messages.update', (updates) => msgUpdateHandler(sock, updates).catch(() => {}));

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    try {
      if (store.welcomeToggle?.[id] === false) return;
      const meta = await sock.groupMetadata(id).catch(() => null); if (!meta) return;
      for (const pJid of participants) {
        const num = pJid.split('@')[0];
        if (action === 'add') {
          log.event(`${num} joined ${meta.subject}`);
          const text = store.welcomeMessages?.[id]
            ? store.welcomeMessages[id].replace('{user}',`@${num}`).replace('{group}',meta.subject)
            : `╭──────────────────╮\n│  🎉 *WELCOME*\n╰──────────────────╯\n\nHello @${num}! 👋\nWelcome to *${meta.subject}*!\n\n> _${config.BOT_NAME}_`;
          await sock.sendMessage(id, { text, mentions: [pJid] });
        } else if (action === 'remove') {
          log.event(`${num} left ${meta.subject}`);
          await sock.sendMessage(id, {
            text: `╭──────────────────╮\n│  👋 *GOODBYE*\n╰──────────────────╯\n\n@${num} left. Take care! 🌟\n\n> _${config.BOT_NAME}_`,
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
        const body = raw.message.conversation || raw.message.extendedTextMessage?.text || raw.message.imageMessage?.caption || '';
        if (!/(https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)/i.test(body)) continue;
        const meta   = await sock.groupMetadata(raw.key.remoteJid).catch(() => null); if (!meta) continue;
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        const sender = raw.key.participant || raw.participant;
        if (admins.includes(sender)) continue;
        await sock.sendMessage(raw.key.remoteJid, { delete: raw.key }).catch(() => {});
        await sock.sendMessage(raw.key.remoteJid, { text: `@${sender.split('@')[0]} ⚠️ Links not allowed!`, mentions: [sender] });
        log.event(`Anti-link deleted message from ${sender.split('@')[0]}`);
      } catch (_) {}
    }
  });
}

startBot().catch(err => { log.error(`Fatal: ${err.message}`); process.exit(1); });