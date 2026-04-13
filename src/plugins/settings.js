import { settings } from '../index.js';
import config from '../config.js';

function tog(name, emoji, state, onNote, offNote) {
  return (
    `┏▣ ◈ *${emoji} ${name}* ◈\n` +
    `┃ *Status:* ${state ? '✅ ON' : '❌ OFF'}\n` +
    `┃ ${state ? onNote : offNote}\n` +
    `┗▣`
  );
}

export default [
  {
    name: 'autoviewstatus', aliases: ['autoview', 'viewstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto view all statuses',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *👁️ AUTO VIEW STATUS* ◈\n` +
          `┃ Current: ${settings.autoViewStatus ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}autoviewstatus on/off\n` +
          `┗▣`
        );
      settings.autoViewStatus = val === 'on';
      await m.reply(tog('AUTO VIEW STATUS', '👁️', settings.autoViewStatus,
        '_Bot will auto view all contacts statuses._',
        '_Auto status view disabled._'
      ));
    },
  },
  {
    name: 'autoreactstatus', aliases: ['autoreact', 'reactstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto react to all statuses',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *🔥 AUTO REACT STATUS* ◈\n` +
          `┃ Current: ${settings.autoReactStatus ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Emoji: ${settings.statusEmoji}\n` +
          `┃ Usage: ${config.PREFIX}autoreactstatus on/off\n` +
          `┗▣`
        );
      settings.autoReactStatus = val === 'on';
      await m.reply(tog('AUTO REACT STATUS', '🔥', settings.autoReactStatus,
        `_Bot will react with ${settings.statusEmoji} to every status._`,
        '_Auto react disabled._'
      ));
    },
  },
  {
    name: 'setstatusemoji', aliases: ['statusemoji'],
    category: 'settings', ownerOnly: true,
    description: 'Set emoji for status reactions',
    async run({ m, args }) {
      if (!args[0])
        return m.reply(
          `┏▣ ◈ *😀 STATUS EMOJI* ◈\n` +
          `┃ Current: ${settings.statusEmoji}\n` +
          `┃ Usage: ${config.PREFIX}setstatusemoji ❤️\n` +
          `┗▣`
        );
      settings.statusEmoji = args[0];
      await m.reply(`┏▣ ◈ *😀 STATUS EMOJI* ◈\n┃ Emoji set to: *${settings.statusEmoji}*\n┗▣`);
    },
  },
  {
    name: 'statusdelay', aliases: ['viewdelay'],
    category: 'settings', ownerOnly: true,
    description: 'Set delay before viewing status (ms)',
    async run({ m, args }) {
      const val = parseInt(args[0]);
      if (isNaN(val) || val < 0)
        return m.reply(
          `┏▣ ◈ *⏱️ STATUS DELAY* ◈\n` +
          `┃ Current: ${settings.statusDelay}ms\n` +
          `┃ Usage: ${config.PREFIX}statusdelay 2000\n` +
          `┗▣`
        );
      settings.statusDelay = val;
      await m.reply(`┏▣ ◈ *⏱️ STATUS DELAY* ◈\n┃ Delay set to: *${val}ms*\n┗▣`);
    },
  },
  {
    name: 'antidelete', aliases: ['antidel'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete DM messages',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *🛡️ ANTI-DELETE DM* ◈\n` +
          `┃ Current: ${settings.antiDeleteDM ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}antidelete on/off\n` +
          `┗▣`
        );
      settings.antiDeleteDM = val === 'on';
      await m.reply(tog('ANTI-DELETE DM', '🛡️', settings.antiDeleteDM,
        '_Deleted DM messages forwarded to you._',
        '_Anti-delete DM disabled._'
      ));
    },
  },
  {
    name: 'antideletestatus', aliases: ['antidelstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete status updates',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *🛡️ ANTI-DELETE STATUS* ◈\n` +
          `┃ Current: ${settings.antiDeleteStatus ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}antideletestatus on/off\n` +
          `┗▣`
        );
      settings.antiDeleteStatus = val === 'on';
      await m.reply(tog('ANTI-DELETE STATUS', '🛡️', settings.antiDeleteStatus,
        '_Deleted statuses forwarded to your DM._\n┃ ⚠️ Only statuses received AFTER enabling are protected.',
        '_Anti-delete status disabled._'
      ));
    },
  },
  {
    name: 'alwaysonline', aliases: ['online', 'presence'],
    category: 'settings', ownerOnly: true,
    description: 'Keep bot always online',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *🟢 ALWAYS ONLINE* ◈\n` +
          `┃ Current: ${settings.alwaysOnline ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}alwaysonline on/off\n` +
          `┗▣`
        );
      settings.alwaysOnline = val === 'on';
      await m.reply(tog('ALWAYS ONLINE', '🟢', settings.alwaysOnline,
        '_Bot presence set to always available._',
        '_Bot presence set to unavailable._'
      ));
    },
  },
  {
    name: 'autoread', aliases: ['readmsgs'],
    category: 'settings', ownerOnly: true,
    description: 'Auto read all DM messages',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *📖 AUTO READ* ◈\n` +
          `┃ Current: ${settings.autoRead ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}autoread on/off\n` +
          `┗▣`
        );
      settings.autoRead = val === 'on';
      config.AUTO_READ  = val === 'on';
      await m.reply(tog('AUTO READ', '📖', settings.autoRead,
        '_Bot will auto mark DMs as read._',
        '_Auto read disabled._'
      ));
    },
  },
  {
    name: 'autotype', aliases: ['autotyping', 'typing'],
    category: 'settings', ownerOnly: true,
    description: 'Show typing indicator before reply',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *⌨️ AUTO TYPING* ◈\n` +
          `┃ Current: ${settings.autoTyping ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}autotype on/off\n` +
          `┗▣`
        );
      settings.autoTyping = val === 'on';
      config.AUTO_TYPING  = val === 'on';
      await m.reply(tog('AUTO TYPING', '⌨️', settings.autoTyping,
        '_Bot shows typing indicator before replying._',
        '_Auto typing disabled._'
      ));
    },
  },
  {
    name: 'autoreact', aliases: ['reactmsgs'],
    category: 'settings', ownerOnly: true,
    description: 'Auto react to commands with ✅',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(
          `┏▣ ◈ *⚡ AUTO REACT* ◈\n` +
          `┃ Current: ${settings.autoReact ? '✅ ON' : '❌ OFF'}\n` +
          `┃ Usage: ${config.PREFIX}autoreact on/off\n` +
          `┗▣`
        );
      settings.autoReact = val === 'on';
      config.AUTO_REACT  = val === 'on';
      await m.reply(tog('AUTO REACT', '⚡', settings.autoReact,
        '_Bot reacts ✅ to every command._',
        '_Auto react disabled._'
      ));
    },
  },
  {
    name: 'mysettings', aliases: ['botsettings', 'getsettings'],
    category: 'settings', ownerOnly: true,
    description: 'Show all current settings',
    async run({ m }) {
      await m.reply(
        `┏▣ ◈ *⚙️ BOT SETTINGS* ◈\n` +
        `┃ 👁️  AutoView Status   : ${settings.autoViewStatus   ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🔥 AutoReact Status  : ${settings.autoReactStatus  ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 😀 Status Emoji      : ${settings.statusEmoji}\n` +
        `┃ ⏱️  Status Delay      : ${settings.statusDelay}ms\n` +
        `┃ 🛡️  AntiDelete DM    : ${settings.antiDeleteDM     ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🛡️  AntiDelete Status : ${settings.antiDeleteStatus ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🟢 Always Online     : ${settings.alwaysOnline     ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 📖 Auto Read         : ${settings.autoRead         ? '✅ ON' : '❌ OFF'}\n` +
        `┃ ⌨️  Auto Typing       : ${settings.autoTyping       ? '✅ ON' : '❌ OFF'}\n` +
        `┃ ⚡ Auto React        : ${settings.autoReact        ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🔑 Prefix            : ${config.PREFIX}\n` +
        `┃ 👑 Owner             : ${config.OWNER || 'Auto'}\n` +
        `┗▣`
      );
    },
  },
  {
    name: 'setprefix', aliases: ['prefix'],
    category: 'settings', ownerOnly: true,
    description: 'Change command prefix',
    async run({ m, args }) {
      if (!args[0])
        return m.reply(`┏▣ ◈ *⚙️ PREFIX* ◈\n┃ Current: \`${config.PREFIX}\`\n┃ Usage: ${config.PREFIX}setprefix <char>\n┗▣`);
      const old = config.PREFIX;
      config.PREFIX = args[0];
      await m.reply(
        `┏▣ ◈ *⚙️ PREFIX CHANGED* ◈\n` +
        `┃ *Old:* \`${old}\`\n` +
        `┃ *New:* \`${args[0]}\`\n` +
        `┃ _Update .env to make permanent_\n` +
        `┗▣`
      );
    },
  },
];