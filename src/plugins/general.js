import os from 'os';
import { commands as allCommands } from '../handler.js';
import config from '../config.js';

const startTime = Date.now();

function uptime() {
  const ms = Date.now() - startTime;
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const h  = Math.floor(m / 60);
  const d  = Math.floor(h / 24);
  return `${d}d ${h%24}h ${m%60}m ${s%60}s`;
}

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}

function buildMenu() {
  const categories = {};
  for (const cmd of allCommands) {
    const cat = cmd.category || 'misc';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  }
  const icons = { general:'🔰', media:'🎵', ai:'🤖', fun:'😂', utility:'🛠️', group:'👥', owner:'👑', misc:'📦' };
  let menu = border(`${config.BOT_NAME} — COMMAND MENU`) + '\n\n';
  menu += `*Prefix:* \`${config.PREFIX}\`   *Commands:* ${allCommands.length}\n`;
  menu += `*Uptime:* ${uptime()}\n\n`;
  for (const [cat, cmds] of Object.entries(categories)) {
    menu += `${icons[cat]||'📦'} *${cat.toUpperCase()}*\n`;
    for (const cmd of cmds) {
      menu += `  • \`${config.PREFIX}${cmd.name}\`` + (cmd.description ? ` — _${cmd.description}_` : '') + '\n';
    }
    menu += '\n';
  }
  menu += `> _${config.BOT_NAME} v${config.VERSION}_`;
  return menu;
}

export default [
  {
    name: 'menu', aliases: ['help','commands'], category: 'general',
    description: 'Show all commands', usage: '.menu',
    async run({ m }) { await m.reply(buildMenu()); },
  },
  {
    name: 'ping', aliases: ['p'], category: 'general',
    description: 'Check latency', usage: '.ping',
    async run({ sock, m }) {
      const t1  = Date.now();
      await sock.sendMessage(m.jid, { text: '📡 _Pinging..._' }, { quoted: m });
      const ms  = Date.now() - t1;
      await m.reply(
        `${border('📡 PING')}\n\n*Latency:* \`${ms} ms\`\n*Status:* ${ms<300?'🟢 Excellent':ms<700?'🟡 Good':'🔴 Slow'}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'info', aliases: ['botinfo','about'], category: 'general',
    description: 'Bot information', usage: '.info',
    async run({ m }) {
      const mem = process.memoryUsage();
      await m.reply(
        `${border('🤖 BOT INFO')}\n\n*Name:* ${config.BOT_NAME}\n*Version:* ${config.VERSION}\n` +
        `*Prefix:* ${config.PREFIX}\n*Uptime:* ${uptime()}\n*Node.js:* ${process.version}\n` +
        `*Platform:* ${os.platform()}\n*Memory:* ${(mem.heapUsed/1024/1024).toFixed(1)} MB\n` +
        `*Owner:* ${config.OWNER||'Not set'}\n*Commands:* ${allCommands.length}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'runtime', aliases: ['uptime','up'], category: 'general',
    description: 'Show uptime', usage: '.runtime',
    async run({ m }) {
      await m.reply(`${border('⏱️ UPTIME')}\n\n*Running for:* \`${uptime()}\`\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'alive', aliases: ['status'], category: 'general',
    description: 'Check if bot is alive', usage: '.alive',
    async run({ m }) {
      await m.reply(
        `${border('✅ BOT ALIVE')}\n\n🟢 *${config.BOT_NAME}* is online!\n\n*Uptime:* ${uptime()}\n*Version:* ${config.VERSION}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'speed', aliases: ['speedtest'], category: 'general',
    description: 'Connection speed test', usage: '.speed',
    async run({ m }) {
      const start = Date.now();
      const samples = [];
      for (let i = 0; i < 5; i++) {
        const t = Date.now();
        await new Promise(r => setTimeout(r, 50));
        samples.push(Date.now() - t - 50);
      }
      const total = Date.now() - start;
      const avg   = (samples.reduce((a,b)=>a+b,0)/samples.length).toFixed(1);
      await m.reply(
        `${border('⚡ SPEED TEST')}\n\n*Total:* \`${total} ms\`\n*Avg jitter:* \`${avg} ms\`\n` +
        `*Rating:* ${total<500?'🟢 Fast':total<1500?'🟡 Normal':'🔴 Slow'}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
];
