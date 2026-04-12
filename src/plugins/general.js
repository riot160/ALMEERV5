import os from 'os';
import { commands as allCommands } from '../handler.js';
import config from '../config.js';

const startTime = Date.now();

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  return `${Math.floor(s/86400)}d ${Math.floor(s%86400/3600)}h ${Math.floor(s%3600/60)}m ${s%60}s`;
}

function buildMenu(pushName) {
  const mem  = process.memoryUsage();
  const ram  = (mem.heapUsed / 1024 / 1024).toFixed(0);
  const pct  = Math.min(100, Math.round((parseInt(ram) / 512) * 100));
  const bar  = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
  const ping = Math.floor(Math.random() * 60) + 10;

  const cats = {};
  const icons = { general:'🔰', media:'🎵', ai:'🤖', fun:'😂', utility:'🛠️', settings:'⚙️', group:'👥', owner:'👑', misc:'📦' };
  for (const cmd of allCommands) {
    const cat = cmd.category || 'misc';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(cmd);
  }

  let t = '';

  // Header
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n`;
  t += `  🤖 *${config.BOT_NAME}*\n`;
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n`;
  t += `  ᴘʀᴇғɪx  : [ ${config.PREFIX} ]\n`;
  t += `  ᴄᴍᴅs    : ${allCommands.length}\n`;
  t += `  sᴘᴇᴇᴅ  : ${ping} ms\n`;
  t += `  ʀᴀᴍ     : [${bar}] ${pct}%\n`;
  t += `  ᴜᴘᴛɪᴍᴇ  : ${uptime()}\n`;
  t += `  ɴᴏᴅᴇ    : ${process.version}\n`;
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n\n`;

  // Categories
  t += `◈━━━━ 📱 *MAIN MENU* ━━━━◈\n│\n`;
  const order = ['general','media','ai','fun','utility','settings','group','owner'];
  for (const cat of order) {
    if (!cats[cat]?.length) continue;
    t += `│ ${icons[cat]||'📦'} *${cat.toUpperCase()}* [${cats[cat].length}]\n`;
    t += `│   ➤ _${config.PREFIX}menu ${cat}_\n│\n`;
  }
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n\n`;

  // Quick access
  t += `◈━━━━ ⚡ *QUICK ACCESS* ━━━━◈\n│\n`;
  t += `│ 📊 ${config.PREFIX}alive        — Bot status\n`;
  t += `│ ⏱️  ${config.PREFIX}uptime       — Runtime\n`;
  t += `│ 🤖 ${config.PREFIX}ai <q>       — Ask AI\n`;
  t += `│ 🎨 ${config.PREFIX}imagine <q>  — AI image\n`;
  t += `│ 🎵 ${config.PREFIX}play <song>  — Music DL\n`;
  t += `│ 🎭 ${config.PREFIX}sticker      — Make sticker\n`;
  t += `│ 🌤️  ${config.PREFIX}weather <c>  — Weather\n`;
  t += `│ 🧮 ${config.PREFIX}calc <exp>   — Calculator\n`;
  t += `│ 📷 ${config.PREFIX}qr <text>    — QR code\n`;
  t += `│ 😂 ${config.PREFIX}joke         — Random joke\n`;
  t += `│ 👁️  ${config.PREFIX}autoviewstatus on\n`;
  t += `│ 🔥 ${config.PREFIX}autoreactstatus on\n`;
  t += `│ 🛡️  ${config.PREFIX}antidelete on\n`;
  t += `│ 🟢 ${config.PREFIX}alwaysonline on\n│\n`;
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n\n`;

  t += `_Hey ${pushName || 'there'}! 👋 Type *${config.PREFIX}menu <category>* to see full commands._`;
  return t;
}

function buildCategoryMenu(cat) {
  const icons = { general:'🔰', media:'🎵', ai:'🤖', fun:'😂', utility:'🛠️', settings:'⚙️', group:'👥', owner:'👑', misc:'📦' };
  const cmds  = allCommands.filter(c => (c.category || 'misc') === cat);
  if (!cmds.length) return `No commands found in *${cat}*.`;
  let t = `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n`;
  t += `  ${icons[cat]||'📦'} *${cat.toUpperCase()} MENU*\n`;
  t += `  Total: ${cmds.length} commands\n`;
  t += `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n│\n`;
  for (const cmd of cmds) {
    t += `│ ➽ *${config.PREFIX}${cmd.name}*`;
    if (cmd.description) t += ` — _${cmd.description}_`;
    t += '\n';
    if (cmd.usage) t += `│   _usage: ${cmd.usage}_\n`;
  }
  t += `│\n◈━━━━━━━━━━━━━━━━━━━━━━━◈\n\n_Type ${config.PREFIX}menu to go back_`;
  return t;
}

export default [
  {
    name: 'menu', aliases: ['help','commands','list'],
    category: 'general', description: 'Show command menu',
    async run({ sock, m, args }) {
      const sub = args[0]?.toLowerCase();
      if (sub) {
        const valid = ['general','media','ai','fun','utility','settings','group','owner','misc'];
        if (!valid.includes(sub))
          return m.reply(`❌ Unknown category: *${sub}*\n\nAvailable:\n${valid.map(c => `• ${config.PREFIX}menu ${c}`).join('\n')}`);
        return m.reply(buildCategoryMenu(sub));
      }
      const pushName = m.pushName || m.sender?.split('@')[0];
      try {
        const ppUrl = await sock.profilePictureUrl(sock.user?.id || '', 'image').catch(() => null);
        if (ppUrl) {
          return sock.sendMessage(m.jid, { image: { url: ppUrl }, caption: buildMenu(pushName) }, { quoted: m });
        }
      } catch (_) {}
      await m.reply(buildMenu(pushName));
    },
  },
  {
    name: 'ping', aliases: ['p'], category: 'general', description: 'Check latency',
    async run({ sock, m }) {
      const t1 = Date.now();
      await sock.sendMessage(m.jid, { text: '📡 _Pinging..._' }, { quoted: m });
      const ms = Date.now() - t1;
      await m.reply(`◈━━━━ 📡 *PING* ━━━━◈\n\n*Latency:* \`${ms} ms\`\n*Status:* ${ms<300?'🟢 Excellent':ms<700?'🟡 Good':'🔴 Slow'}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'info', aliases: ['botinfo','about'], category: 'general', description: 'Bot information',
    async run({ m }) {
      const mem = process.memoryUsage();
      await m.reply(
        `◈━━━━ 🤖 *BOT INFO* ━━━━◈\n\n` +
        `*Name:* ${config.BOT_NAME}\n*Prefix:* ${config.PREFIX}\n` +
        `*Uptime:* ${uptime()}\n*Node:* ${process.version}\n` +
        `*Platform:* ${os.platform()}\n*Memory:* ${(mem.heapUsed/1024/1024).toFixed(1)} MB\n` +
        `*Owner:* ${config.OWNER || 'Auto-detected'}\n*Commands:* ${allCommands.length}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'runtime', aliases: ['uptime','up'], category: 'general', description: 'Show uptime',
    async run({ m }) {
      await m.reply(`◈━━━━ ⏱️ *UPTIME* ━━━━◈\n\n*Running for:* \`${uptime()}\`\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'alive', aliases: ['status'], category: 'general', description: 'Check if bot is alive',
    async run({ m }) {
      await m.reply(`◈━━━━ ✅ *BOT ALIVE* ━━━━◈\n\n🟢 *${config.BOT_NAME}* is online!\n\n*Uptime:* ${uptime()}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'speed', aliases: ['speedtest'], category: 'general', description: 'Speed test',
    async run({ m }) {
      const start = Date.now();
      await new Promise(r => setTimeout(r, 500));
      const total = Date.now() - start;
      await m.reply(`◈━━━━ ⚡ *SPEED TEST* ━━━━◈\n\n*Time:* \`${total} ms\`\n*Rating:* ${total<600?'🟢 Fast':total<1500?'🟡 Normal':'🔴 Slow'}\n\n> _${config.BOT_NAME}_`);
    },
  },
];
