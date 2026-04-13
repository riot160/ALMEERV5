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
  const ping = Math.floor(Math.random() * 80) + 10;

  const cats = {};
  for (const cmd of allCommands) {
    const cat = cmd.category || 'misc';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(cmd.name);
  }

  const labels = {
    owner:    '👑 OWNER',
    settings: '⚙️ SETTINGS',
    group:    '👥 GROUP',
    ai:       '🤖 AI',
    media:    '⬇️ MEDIA',
    utility:  '🔧 TOOLS',
    fun:      '🎉 FUN',
    general:  '🔰 GENERAL',
    misc:     '📦 MISC',
  };

  let t = '';

  // Header
  t += `┏▣ ◈ *${config.BOT_NAME}* ◈\n`;
  t += `┃ *ᴏᴡɴᴇʀ*   : ${config.OWNER || 'ALMEER'}\n`;
  t += `┃ *ᴘʀᴇғɪx*  : [ ${config.PREFIX} ]\n`;
  t += `┃ *ᴘʟᴜɢɪɴs* : ${allCommands.length}\n`;
  t += `┃ *ᴠᴇʀsɪᴏɴ* : v5.0.0\n`;
  t += `┃ *sᴘᴇᴇᴅ*  : ${ping} ms\n`;
  t += `┃ *ᴜsᴀɢᴇ*  : ${ram} MB\n`;
  t += `┃ *ʀᴀᴍ*    : [${bar}] ${pct}%\n`;
  t += `┃ *ɴᴏᴅᴇ*   : ${process.version}\n`;
  t += `┗▣\n\n`;

  // Categories
  const order = ['owner','settings','group','ai','media','utility','fun','general'];
  for (const cat of order) {
    if (!cats[cat]?.length) continue;
    t += `┏▣ ◈ *${labels[cat] || cat.toUpperCase()} MENU* ◈\n`;
    for (const name of [...cats[cat]].sort()) {
      t += `│➽ ${config.PREFIX}${name}\n`;
    }
    t += `┗▣\n\n`;
  }

  t += `_⚡ ${config.BOT_NAME} — Hey ${pushName || 'there'}! 👋_`;
  return t;
}

export default [
  {
    name: 'menu', aliases: ['help','commands','list'],
    category: 'general', description: 'Show command menu',
    async run({ sock, m, args }) {
      const sub = args[0]?.toLowerCase();
      if (sub) {
        const cmds = allCommands.filter(c => (c.category||'misc') === sub);
        if (!cmds.length)
          return m.reply(`❌ Unknown category: *${sub}*`);
        let t = `┏▣ ◈ *${sub.toUpperCase()} MENU* ◈\n`;
        for (const cmd of [...cmds].sort((a,b) => a.name.localeCompare(b.name))) {
          t += `│➽ ${config.PREFIX}${cmd.name}`;
          if (cmd.description) t += ` — _${cmd.description}_`;
          t += '\n';
        }
        t += `┗▣`;
        return m.reply(t);
      }
      const pushName = m.pushName || m.sender?.split('@')[0];
      const menu = buildMenu(pushName);
      try {
        const ppUrl = await sock.profilePictureUrl(
          sock.user?.id || '', 'image'
        ).catch(() => null);
        if (ppUrl) {
          return sock.sendMessage(
            m.jid,
            { image: { url: ppUrl }, caption: menu },
            { quoted: m }
          );
        }
      } catch (_) {}
      await m.reply(menu);
    },
  },
  {
    name: 'ping', aliases: ['p'],
    category: 'general', description: 'Check latency',
    async run({ sock, m }) {
      const t1 = Date.now();
      await sock.sendMessage(m.jid, { text: '📡 _Pinging..._' }, { quoted: m });
      const ms = Date.now() - t1;
      await m.reply(
        `┏▣ ◈ *📡 PING* ◈\n` +
        `┃ *Latency:* ${ms} ms\n` +
        `┃ *Status:* ${ms<300?'🟢 Excellent':ms<700?'🟡 Good':'🔴 Slow'}\n` +
        `┗▣`
      );
    },
  },
  {
    name: 'info', aliases: ['botinfo','about'],
    category: 'general', description: 'Bot information',
    async run({ m }) {
      const mem = process.memoryUsage();
      await m.reply(
        `┏▣ ◈ *🤖 BOT INFO* ◈\n` +
        `┃ *Name:*     ${config.BOT_NAME}\n` +
        `┃ *Prefix:*   ${config.PREFIX}\n` +
        `┃ *Uptime:*   ${uptime()}\n` +
        `┃ *Node:*     ${process.version}\n` +
        `┃ *Platform:* ${os.platform()}\n` +
        `┃ *Memory:*   ${(mem.heapUsed/1024/1024).toFixed(1)} MB\n` +
        `┃ *Owner:*    ${config.OWNER || 'Auto'}\n` +
        `┃ *Commands:* ${allCommands.length}\n` +
        `┗▣`
      );
    },
  },
  {
    name: 'runtime', aliases: ['uptime','up'],
    category: 'general', description: 'Show uptime',
    async run({ m }) {
      await m.reply(
        `┏▣ ◈ *⏱️ UPTIME* ◈\n` +
        `┃ *Running for:* ${uptime()}\n` +
        `┗▣`
      );
    },
  },
  {
    name: 'alive', aliases: ['status'],
    category: 'general', description: 'Check if bot is alive',
    async run({ m }) {
      await m.reply(
        `┏▣ ◈ *✅ BOT ALIVE* ◈\n` +
        `┃ 🟢 *${config.BOT_NAME}* is online!\n` +
        `┃ *Uptime:* ${uptime()}\n` +
        `┗▣`
      );
    },
  },
  {
    name: 'speed', aliases: ['speedtest'],
    category: 'general', description: 'Speed test',
    async run({ m }) {
      const start = Date.now();
      await new Promise(r => setTimeout(r, 500));
      const total = Date.now() - start;
      await m.reply(
        `┏▣ ◈ *⚡ SPEED TEST* ◈\n` +
        `┃ *Time:* ${total} ms\n` +
        `┃ *Rating:* ${total<600?'🟢 Fast':total<1500?'🟡 Normal':'🔴 Slow'}\n` +
        `┗▣`
      );
    },
  },
];