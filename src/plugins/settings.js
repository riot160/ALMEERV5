import { settings } from '../index.js';
import config from '../config.js';

function b(t) { return `◈━━━━ ${t} ━━━━◈`; }

export default [
  {
    name: 'autoviewstatus', aliases: ['autoview','viewstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto view all statuses on/off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoviewstatus on/off\nCurrent: ${settings.autoViewStatus ? '✅ ON' : '❌ OFF'}`);
      settings.autoViewStatus = val === 'on';
      await m.reply(`${b('👁️ AUTO VIEW STATUS')}\n\nStatus: ${val === 'on' ? '✅ *ON*\n_Bot will view all contacts statuses._' : '❌ *OFF*\n_Auto view disabled._'}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'autoreactstatus', aliases: ['autoreact','reactstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto react to all statuses on/off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoreactstatus on/off\nCurrent: ${settings.autoReactStatus ? '✅ ON' : '❌ OFF'}\nEmoji: ${settings.statusEmoji}`);
      settings.autoReactStatus = val === 'on';
      await m.reply(`${b('🔥 AUTO REACT STATUS')}\n\nStatus: ${val === 'on' ? `✅ *ON*\n_Bot will react with ${settings.statusEmoji} to every status._` : '❌ *OFF*\n_Auto react disabled._'}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'setstatusemoji', aliases: ['statusemoji'],
    category: 'settings', ownerOnly: true,
    description: 'Set emoji for status reactions',
    async run({ m, args }) {
      if (!args[0]) return m.reply(`Usage: ${config.PREFIX}setstatusemoji ❤️\nCurrent: ${settings.statusEmoji}`);
      settings.statusEmoji = args[0];
      await m.reply(`${b('😀 STATUS EMOJI')}\n\nEmoji set to: *${settings.statusEmoji}*\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'antidelete', aliases: ['antidel'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete DM messages on/off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}antidelete on/off\nCurrent: ${settings.antiDeleteDM ? '✅ ON' : '❌ OFF'}`);
      settings.antiDeleteDM = val === 'on';
      await m.reply(`${b('🛡️ ANTI-DELETE DM')}\n\nStatus: ${val === 'on' ? '✅ *ON*\n_Deleted DM messages forwarded to you._' : '❌ *OFF*\n_Anti-delete disabled._'}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'antideletestatus', aliases: ['antidelstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete status updates on/off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}antideletestatus on/off\nCurrent: ${settings.antiDeleteStatus ? '✅ ON' : '❌ OFF'}`);
      settings.antiDeleteStatus = val === 'on';
      await m.reply(
        `${b('🛡️ ANTI-DELETE STATUS')}\n\n` +
        `Status: ${val === 'on'
          ? '✅ *ON*\n_If someone deletes their status, you receive it in DM._\n\n⚠️ Only statuses received AFTER turning ON are protected.'
          : '❌ *OFF*\n_Status anti-delete disabled._'}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'alwaysonline', aliases: ['online','presence'],
    category: 'settings', ownerOnly: true,
    description: 'Keep bot always online on/off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}alwaysonline on/off\nCurrent: ${settings.alwaysOnline ? '✅ ON' : '❌ OFF'}`);
      settings.alwaysOnline = val === 'on';
      await m.reply(`${b('🟢 ALWAYS ONLINE')}\n\nStatus: ${val === 'on' ? '✅ *ON*\n_Bot presence set to always available._' : '❌ *OFF*\n_Bot presence set to unavailable._'}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'mysettings', aliases: ['botsettings','getsettings'],
    category: 'settings', ownerOnly: true,
    description: 'Show all current bot settings',
    async run({ m }) {
      await m.reply(
        `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n` +
        `  ⚙️ *BOT SETTINGS*\n` +
        `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n│\n` +
        `│ 👁️  AutoView Status   : ${settings.autoViewStatus  ? '✅ ON' : '❌ OFF'}\n` +
        `│ 🔥 AutoReact Status  : ${settings.autoReactStatus ? '✅ ON' : '❌ OFF'}\n` +
        `│ 😀 Status Emoji      : ${settings.statusEmoji}\n` +
        `│ 🛡️  AntiDelete DM    : ${settings.antiDeleteDM     ? '✅ ON' : '❌ OFF'}\n` +
        `│ 🛡️  AntiDelete Status : ${settings.antiDeleteStatus? '✅ ON' : '❌ OFF'}\n` +
        `│ 🟢 Always Online     : ${settings.alwaysOnline     ? '✅ ON' : '❌ OFF'}\n` +
        `│ 🔑 Prefix            : ${config.PREFIX}\n` +
        `│ 👑 Owner             : ${config.OWNER || 'Auto'}\n│\n` +
        `◈━━━━━━━━━━━━━━━━━━━━━━━◈\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'setprefix', aliases: ['prefix'],
    category: 'settings', ownerOnly: true,
    description: 'Change command prefix',
    async run({ m, args }) {
      if (!args[0]) return m.reply(`Usage: ${config.PREFIX}setprefix <char>`);
      const old = config.PREFIX;
      config.PREFIX = args[0];
      await m.reply(`${b('⚙️ PREFIX CHANGED')}\n\n*Old:* \`${old}\`\n*New:* \`${args[0]}\`\n\n_Resets on restart — update .env to make permanent_\n\n> _${config.BOT_NAME}_`);
    },
  },
];
