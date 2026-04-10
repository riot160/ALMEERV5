import fs     from 'fs-extra';
import config from '../config.js';
import store  from '../lib/store.js';
import { errorLogs } from '../index.js';

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}

export default [
  {
    name: 'broadcast', aliases: ['bc'], category: 'owner', ownerOnly: true,
    description: 'Broadcast to all chats', usage: '.broadcast <message>',
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}broadcast <message>`);
      const chats = Object.keys(store.chats);
      if (!chats.length) return m.reply('❌ No chats in store yet.');
      await m.reply(`_Sending to ${chats.length} chats..._`);
      let sent = 0, failed = 0;
      for (const jid of chats) {
        try {
          await sock.sendMessage(jid, { text: `╔══════════════════╗\n║  📢 *BROADCAST*\n╚══════════════════╝\n\n${text}\n\n> _${config.BOT_NAME}_` });
          sent++;
          await new Promise(r => setTimeout(r, 1200 + Math.random()*400));
        } catch { failed++; }
      }
      await m.reply(`${border('📡 DONE')}\n\n*Sent:* ${sent}\n*Failed:* ${failed}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'block', aliases: ['blockuser'], category: 'owner', ownerOnly: true,
    description: 'Block a number', usage: '.block @user',
    async run({ sock, m, args }) {
      const target = m.mentions[0] || (args[0]?`${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`:null) || m.quoted?.sender;
      if (!target) return m.reply('Please @mention or provide a number.');
      await sock.updateBlockStatus(target, 'block');
      await m.reply(`${border('🚫 BLOCKED')}\n\n@${target.split('@')[0]} blocked.\n\n> _${config.BOT_NAME}_`, { mentions:[target] });
    },
  },
  {
    name: 'unblock', aliases: ['unblockuser'], category: 'owner', ownerOnly: true,
    description: 'Unblock a number', usage: '.unblock @user',
    async run({ sock, m, args }) {
      const target = m.mentions[0] || (args[0]?`${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`:null) || m.quoted?.sender;
      if (!target) return m.reply('Please @mention or provide a number.');
      await sock.updateBlockStatus(target, 'unblock');
      await m.reply(`${border('✅ UNBLOCKED')}\n\n@${target.split('@')[0]} unblocked.\n\n> _${config.BOT_NAME}_`, { mentions:[target] });
    },
  },
  {
    name: 'clearsession', aliases: ['delsession'], category: 'owner', ownerOnly: true,
    description: 'Clear session files', usage: '.clearsession',
    async run({ m }) {
      await m.reply(`_Clearing session in 3 seconds..._`);
      await new Promise(r => setTimeout(r, 3000));
      await fs.emptyDir(config.SESSION_PATH);
      await m.reply('✅ Session cleared. Bot will restart.');
      process.exit(0);
    },
  },
  {
    name: 'setprefix', aliases: ['prefix'], category: 'owner', ownerOnly: true,
    description: 'Change command prefix', usage: '.setprefix <char>',
    async run({ m, args }) {
      const p = args[0];
      if (!p || p.length > 3) return m.reply('Usage: .setprefix <character>');
      const old = config.PREFIX;
      config.PREFIX = p;
      await m.reply(`${border('⚙️ PREFIX')}\n\n*Old:* \`${old}\`\n*New:* \`${p}\`\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'restart', aliases: ['reboot','rs'], category: 'owner', ownerOnly: true,
    description: 'Restart the bot', usage: '.restart',
    async run({ m }) {
      await m.reply(`${border('🔄 RESTARTING')}\n\n_Bot restarting..._\n\n> _${config.BOT_NAME}_`);
      await new Promise(r => setTimeout(r, 1500));
      process.exit(0);
    },
  },
  {
    name: 'eval', aliases: ['exec','>'], category: 'owner', ownerOnly: true,
    description: 'Execute JS code', usage: '.eval <code>',
    async run({ sock, m, text }) {
      if (!text) return m.reply('Usage: .eval <code>');
      try {
        let result = await eval(`(async () => { ${text} })()`);
        if (typeof result === 'object') result = JSON.stringify(result, null, 2);
        await m.reply(`${border('💻 EVAL')}\n\n\`\`\`${String(result).slice(0,3000)}\`\`\`\n\n> _${config.BOT_NAME}_`);
      } catch (e) {
        await m.reply(`${border('❌ EVAL ERROR')}\n\n\`\`\`${e.message}\`\`\`\n\n> _${config.BOT_NAME}_`);
      }
    },
  },
  {
    name: 'logs', aliases: ['errorlogs'], category: 'owner', ownerOnly: true,
    description: 'View error logs', usage: '.logs',
    async run({ m }) {
      if (!errorLogs.length) return m.reply(`${border('📋 LOGS')}\n\n_No errors logged._ ✅\n\n> _${config.BOT_NAME}_`);
      const recent = errorLogs.slice(-10).reverse();
      const lines  = recent.map((e,i) => `*${i+1}.* [${e.time}]\n_${e.command||'system'}:_ ${e.error}`).join('\n\n');
      await m.reply(`${border('📋 ERROR LOGS')}\n\n${lines}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'store', aliases: ['storeinfo'], category: 'owner', ownerOnly: true,
    description: 'Store statistics', usage: '.store',
    async run({ m }) {
      const msgs = Object.values(store.messages).reduce((a,v)=>a+Object.keys(v).length,0);
      await m.reply(
        `${border('🗄️ STORE')}\n\n*Contacts:* ${Object.keys(store.contacts).length}\n*Chats:* ${Object.keys(store.chats).length}\n` +
        `*Messages:* ${msgs}\n*Status:* ${Object.keys(store.statusMessages).length}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
];
