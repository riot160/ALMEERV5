import { settings } from '../index.js';
import config from '../config.js';

// Helper: toggle reply
function toggleReply(name, emoji, state, onNote, offNote) {
  return (
    `┏▣ ◈ *${emoji} ${name}* ◈\n` +
    `┃ *Status:* ${state ? '✅ ON' : '❌ OFF'}\n` +
    `┃ ${state ? onNote : offNote}\n` +
    `┗▣`
  );
}

export default [
  // ── autoviewstatus ────────────────────────────────────────────
  {
    name: 'autoviewstatus', aliases: ['autoview','viewstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto view all statuses',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoviewstatus on/off\nCurrent: ${settings.autoViewStatus ? '✅ ON' : '❌ OFF'}`);
      settings.autoViewStatus = val === 'on';
      await m.reply(toggleReply('AUTO VIEW STATUS','👁️', settings.autoViewStatus,
        '_Bot will automatically view all contacts statuses._',
        '_Auto status view disabled._'
      ));
    },
  },
  // ── autoreactstatus ───────────────────────────────────────────
  {
    name: 'autoreactstatus', aliases: ['autoreact','reactstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Auto react to all statuses',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoreactstatus on/off\nCurrent: ${settings.autoReactStatus ? '✅ ON' : '❌ OFF'}`);
      settings.autoReactStatus = val === 'on';
      await m.reply(toggleReply('AUTO REACT STATUS','🔥', settings.autoReactStatus,
        `_Bot will react with ${settings.statusEmoji} to every status._`,
        '_Auto react disabled._'
      ));
    },
  },
  // ── setstatusemoji ────────────────────────────────────────────
  {
    name: 'setstatusemoji', aliases: ['statusemoji'],
    category: 'settings', ownerOnly: true,
    description: 'Set emoji for status reactions',
    async run({ m, args }) {
      if (!args[0]) return m.reply(`Usage: ${config.PREFIX}setstatusemoji ❤️\nCurrent: ${settings.statusEmoji}`);
      settings.statusEmoji = args[0];
      await m.reply(`┏▣ ◈ *😀 STATUS EMOJI* ◈\n┃ Emoji set to: *${settings.statusEmoji}*\n┗▣`);
    },
  },
  // ── antidelete ────────────────────────────────────────────────
  {
    name: 'antidelete', aliases: ['antidel'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete DM messages',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}antidelete on/off\nCurrent: ${settings.antiDeleteDM ? '✅ ON' : '❌ OFF'}`);
      settings.antiDeleteDM = val === 'on';
      await m.reply(toggleReply('ANTI-DELETE DM','🛡️', settings.antiDeleteDM,
        '_Deleted DM messages will be forwarded to you._',
        '_Anti-delete disabled._'
      ));
    },
  },
  // ── antideletestatus ──────────────────────────────────────────
  {
    name: 'antideletestatus', aliases: ['antidelstatus'],
    category: 'settings', ownerOnly: true,
    description: 'Anti-delete status updates',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}antideletestatus on/off\nCurrent: ${settings.antiDeleteStatus ? '✅ ON' : '❌ OFF'}`);
      settings.antiDeleteStatus = val === 'on';
      await m.reply(toggleReply('ANTI-DELETE STATUS','🛡️', settings.antiDeleteStatus,
        '_Deleted statuses forwarded to your DM._\n┃ ⚠️ Only statuses received AFTER turning ON are protected.',
        '_Status anti-delete disabled._'
      ));
    },
  },
  // ── alwaysonline ──────────────────────────────────────────────
  {
    name: 'alwaysonline', aliases: ['online','presence'],
    category: 'settings', ownerOnly: true,
    description: 'Keep bot always online',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}alwaysonline on/off\nCurrent: ${settings.alwaysOnline ? '✅ ON' : '❌ OFF'}`);
      settings.alwaysOnline = val === 'on';
      await m.reply(toggleReply('ALWAYS ONLINE','🟢', settings.alwaysOnline,
        '_Bot presence set to always available._',
        '_Bot presence set to unavailable._'
      ));
    },
  },
  // ── autoread ──────────────────────────────────────────────────
  {
    name: 'autoread', aliases: ['readmsgs'],
    category: 'settings', ownerOnly: true,
    description: 'Auto read all DM messages',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoread on/off\nCurrent: ${settings.autoRead ? '✅ ON' : '❌ OFF'}`);
      settings.autoRead = val === 'on';
      config.AUTO_READ = val === 'on';
      await m.reply(toggleReply('AUTO READ','📖', settings.autoRead,
        '_Bot will automatically mark DMs as read._',
        '_Auto read disabled._'
      ));
    },
  },
  // ── autotyping ────────────────────────────────────────────────
  {
    name: 'autotype', aliases: ['autotyping','typing'],
    category: 'settings', ownerOnly: true,
    description: 'Show typing indicator before reply',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autotype on/off\nCurrent: ${settings.autoTyping ? '✅ ON' : '❌ OFF'}`);
      settings.autoTyping = val === 'on';
      config.AUTO_TYPING = val === 'on';
      await m.reply(toggleReply('AUTO TYPING','⌨️', settings.autoTyping,
        '_Bot will show typing indicator before replying._',
        '_Auto typing disabled._'
      ));
    },
  },
  // ── autoreact ─────────────────────────────────────────────────
  {
    name: 'autoreact', aliases: ['reactmsgs'],
    category: 'settings', ownerOnly: true,
    description: 'Auto react to all messages',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val))
        return m.reply(`Usage: ${config.PREFIX}autoreact on/off\nCurrent: ${settings.autoReact ? '✅ ON' : '❌ OFF'}`);
      settings.autoReact = val === 'on';
      config.AUTO_REACT = val === 'on';
      await m.reply(toggleReply('AUTO REACT','⚡', settings.autoReact,
        '_Bot will react ✅ to every command._',
        '_Auto react disabled._'
      ));
    },
  },
  // ── mysettings ────────────────────────────────────────────────
  {
    name: 'mysettings', aliases: ['botsettings','getsettings'],
    category: 'settings', ownerOnly: true,
    description: 'Show all current bot settings',
    async run({ m }) {
      await m.reply(
        `┏▣ ◈ *⚙️ BOT SETTINGS* ◈\n` +
        `┃ 👁️  AutoView Status   : ${settings.autoViewStatus  ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🔥 AutoReact Status  : ${settings.autoReactStatus ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 😀 Status Emoji      : ${settings.statusEmoji}\n` +
        `┃ 🛡️  AntiDelete DM    : ${settings.antiDeleteDM     ? '✅ ON' : '❌ OFF'}\n` +
        `┃ 🛡️  AntiDelete Status : ${settings.antiDeleteStatus? '✅ ON' : '❌ OFF'}\n` +
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
  // ── setprefix ─────────────────────────────────────────────────
  {
    name: 'setprefix', aliases: ['prefix'],
    category: 'settings', ownerOnly: true,
    description: 'Change command prefix',
    async run({ m, args }) {
      if (!args[0]) return m.reply(`Usage: ${config.PREFIX}setprefix <char>`);
      const old = config.PREFIX;
      config.PREFIX = args[0];
      await m.reply(`┏▣ ◈ *⚙️ PREFIX* ◈\n┃ *Old:* \`${old}\`\n┃ *New:* \`${args[0]}\`\n┗▣`);
    },
  },
];
// ── statusdelay ───────────────────────────────────────────────
  {
    name: 'statusdelay', aliases: ['viewdelay'],
    category: 'settings', ownerOnly: true,
    description: 'Set delay (ms) before viewing status (e.g. 2000)',
    async run({ m, args }) {
      const val = parseInt(args[0]);
      if (isNaN(val) || val < 0)
        return m.reply(`Usage: ${config.PREFIX}statusdelay 2000\nCurrent: ${settings.statusDelay || 1000}ms`);
      settings.statusDelay = val;
      await m.reply(
        `┏▣ ◈ *⏱️ STATUS DELAY* ◈\n` +
        `┃ Delay set to: *${val}ms*\n` +
        `┗▣`
      );
    },
  },
