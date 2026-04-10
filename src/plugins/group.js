import config from '../config.js';
import store  from '../lib/store.js';

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}
function resolveJid(m, args) {
  if (m.mentions?.length) return m.mentions[0];
  if (args[0]) return `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`;
  if (m.quoted?.sender) return m.quoted.sender;
  return null;
}
async function isBotAdmin(sock, jid) {
  try {
    const meta   = await sock.groupMetadata(jid);
    const botNum = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
    return meta.participants.some(p => p.id===botNum && p.admin);
  } catch { return false; }
}

export default [
  {
    name: 'kick', aliases: ['remove','ban'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Remove member', usage: '.kick @user',
    async run({ sock, m, args }) {
      if (!await isBotAdmin(sock,m.jid)) return m.reply('❌ Bot needs admin privileges.');
      const target = resolveJid(m, args);
      if (!target) return m.reply('Please @mention the user to kick.');
      await sock.groupParticipantsUpdate(m.jid, [target], 'remove');
      await m.reply(`${border('👢 KICKED')}\n\n@${target.split('@')[0]} removed.\n\n> _${config.BOT_NAME}_`, { mentions:[target] });
    },
  },
  {
    name: 'add', aliases: ['addmember'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Add member', usage: '.add <number>',
    async run({ sock, m, args }) {
      if (!args[0]) return m.reply(`Usage: ${config.PREFIX}add <number>`);
      if (!await isBotAdmin(sock,m.jid)) return m.reply('❌ Bot needs admin privileges.');
      const jid = `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`;
      await sock.groupParticipantsUpdate(m.jid, [jid], 'add');
      await m.reply(`${border('➕ ADDED')}\n\n@${jid.split('@')[0]} added!\n\n> _${config.BOT_NAME}_`, { mentions:[jid] });
    },
  },
  {
    name: 'promote', aliases: ['makeadmin'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Promote to admin', usage: '.promote @user',
    async run({ sock, m, args }) {
      if (!await isBotAdmin(sock,m.jid)) return m.reply('❌ Bot needs admin privileges.');
      const target = resolveJid(m, args);
      if (!target) return m.reply('Please @mention the user.');
      await sock.groupParticipantsUpdate(m.jid, [target], 'promote');
      await m.reply(`${border('⬆️ PROMOTED')}\n\n@${target.split('@')[0]} is now admin! 👑\n\n> _${config.BOT_NAME}_`, { mentions:[target] });
    },
  },
  {
    name: 'demote', aliases: ['removeadmin'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Remove admin', usage: '.demote @user',
    async run({ sock, m, args }) {
      if (!await isBotAdmin(sock,m.jid)) return m.reply('❌ Bot needs admin privileges.');
      const target = resolveJid(m, args);
      if (!target) return m.reply('Please @mention the user.');
      await sock.groupParticipantsUpdate(m.jid, [target], 'demote');
      await m.reply(`${border('⬇️ DEMOTED')}\n\n@${target.split('@')[0]} removed from admin.\n\n> _${config.BOT_NAME}_`, { mentions:[target] });
    },
  },
  {
    name: 'mute', aliases: ['lock'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Admins only mode', usage: '.mute',
    async run({ sock, m }) {
      await sock.groupSettingUpdate(m.jid, 'announcement');
      await m.reply(`${border('🔇 MUTED')}\n\nOnly admins can send messages.\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'unmute', aliases: ['unlock'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Allow all messages', usage: '.unmute',
    async run({ sock, m }) {
      await sock.groupSettingUpdate(m.jid, 'not_announcement');
      await m.reply(`${border('🔊 UNMUTED')}\n\nAll members can send messages.\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'link', aliases: ['grouplink'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Group invite link', usage: '.link',
    async run({ sock, m }) {
      const code = await sock.groupInviteCode(m.jid);
      await m.reply(`${border('🔗 GROUP LINK')}\n\nhttps://chat.whatsapp.com/${code}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'revoke', aliases: ['resetlink'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Revoke invite link', usage: '.revoke',
    async run({ sock, m }) {
      await sock.groupRevokeInvite(m.jid);
      await m.reply(`${border('♻️ REVOKED')}\n\n_Old link revoked. Use_ ${config.PREFIX}link _for a new one._\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'tagall', aliases: ['mentionall'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Mention all members', usage: '.tagall',
    async run({ sock, m, text }) {
      const meta    = await sock.groupMetadata(m.jid);
      const members = meta.participants.map(p => p.id);
      const tags    = members.map(id => `@${id.split('@')[0]}`).join(' ');
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { text: `${border('📢 TAG ALL')}\n\n${text||'Attention!'}\n\n${tags}\n\n> _${config.BOT_NAME}_`, mentions: members })
      );
    },
  },
  {
    name: 'hidetag', aliases: ['htag'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Silent tag all', usage: '.hidetag <message>',
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}hidetag <message>`);
      const meta    = await sock.groupMetadata(m.jid);
      const members = meta.participants.map(p => p.id);
      await sock.MQ.add(() => sock.sendMessage(m.jid, { text, mentions: members }));
    },
  },
  {
    name: 'groupinfo', aliases: ['ginfo'], category: 'group', groupOnly: true,
    description: 'Group statistics', usage: '.groupinfo',
    async run({ sock, m }) {
      const meta    = await sock.groupMetadata(m.jid);
      const admins  = meta.participants.filter(p => p.admin).length;
      const created = new Date(meta.creation*1000).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
      await m.reply(
        `${border('👥 GROUP INFO')}\n\n*Name:* ${meta.subject}\n*Members:* ${meta.participants.length}\n` +
        `*Admins:* ${admins}\n*Created:* ${created}\n*Desc:*\n${meta.desc||'_No description._'}\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'antilink', aliases: ['nolinks'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Toggle anti-link', usage: '.antilink on|off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val)) return m.reply(`Usage: ${config.PREFIX}antilink on|off`);
      store.antilink[m.jid] = val==='on';
      await m.reply(`${border('🔗 ANTI-LINK')}\n\nAnti-link is now *${val.toUpperCase()}*.\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'setwelcome', aliases: ['welcomemsg'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Set welcome message', usage: '.setwelcome <msg> (use {user} {group})',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}setwelcome Hello {user}!`);
      store.welcomeMessages[m.jid] = text;
      await m.reply(`${border('👋 WELCOME SET')}\n\nCustom welcome saved!\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'welcome', aliases: ['welcometoggle'], category: 'group', groupOnly: true, adminOnly: true,
    description: 'Toggle welcome messages', usage: '.welcome on|off',
    async run({ m, args }) {
      const val = args[0]?.toLowerCase();
      if (!['on','off'].includes(val)) return m.reply(`Usage: ${config.PREFIX}welcome on|off`);
      store.welcomeToggle[m.jid] = val==='on';
      await m.reply(`${border('👋 WELCOME')}\n\nWelcome messages *${val.toUpperCase()}*.\n\n> _${config.BOT_NAME}_`);
    },
  },
];
