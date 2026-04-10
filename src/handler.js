import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import chalk from 'chalk';
import config from './config.js';
import { errorLogs } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const commands = [];

export async function loadPlugins() {
  const pluginDir = join(__dirname, 'plugins');
  const files     = readdirSync(pluginDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod  = await import(pathToFileURL(join(pluginDir, file)).href);
      const cmds = mod.default || mod.commands || [];
      if (Array.isArray(cmds)) {
        commands.push(...cmds);
        console.log(chalk.green(`  ✅ Loaded: ${file} (${cmds.length} commands)`));
      }
    } catch (err) {
      console.error(chalk.red(`  ❌ Failed: ${file}`), err.message);
    }
  }
  console.log(chalk.cyan(`\n  📦 Total: ${commands.length} commands loaded\n`));
}

const cooldowns = new Map();

export async function handleMessage(sock, m) {
  const { command, sender, jid, isGroup } = m;
  if (!command) return;

  const cmd = commands.find(
    c => c.name === command || (Array.isArray(c.aliases) && c.aliases.includes(command))
  );
  if (!cmd) return;

  const coolKey    = `${sender}:${command}`;
  const now        = Date.now();
  const cooldownMs = cmd.cooldown || config.COOLDOWN;
  const coolEnd    = cooldowns.get(coolKey) || 0;
  if (now < coolEnd) {
    const remaining = ((coolEnd - now) / 1000).toFixed(1);
    return m.reply(
      `╔══════════════════╗\n║  ⏳ *COOLDOWN*\n╚══════════════════╝\n\n` +
      `Wait *${remaining}s* before using *${config.PREFIX}${command}* again.\n\n> _${config.BOT_NAME}_`
    );
  }
  cooldowns.set(coolKey, now + cooldownMs);

  const isOwner = config.OWNER && sender.includes(config.OWNER.replace(/[^0-9]/g, ''));

  if (cmd.ownerOnly && !isOwner) {
    return m.reply(
      `╔══════════════════╗\n║  👑 *OWNER ONLY*\n╚══════════════════╝\n\n` +
      `This command is reserved for the bot owner.\n\n> _${config.BOT_NAME}_`
    );
  }

  if (cmd.groupOnly && !isGroup) {
    return m.reply(
      `╔══════════════════╗\n║  👥 *GROUPS ONLY*\n╚══════════════════╝\n\n` +
      `This command only works in group chats.\n\n> _${config.BOT_NAME}_`
    );
  }

  if (cmd.adminOnly && isGroup) {
    try {
      const meta   = await sock.groupMetadata(jid);
      const admins = meta.participants.filter(p => p.admin).map(p => p.id);
      if (!admins.includes(sender)) {
        return m.reply(
          `╔══════════════════╗\n║  🛡️ *ADMINS ONLY*\n╚══════════════════╝\n\n` +
          `Only group admins can use this command.\n\n> _${config.BOT_NAME}_`
        );
      }
    } catch (_) {}
  }

  try {
    await cmd.run({ sock, m, args: m.args, text: m.text, isOwner, config });
    if (config.AUTO_REACT) await m.react('✅').catch(() => {});
  } catch (err) {
    errorLogs.push({ time: new Date().toISOString(), error: err.message, command });
    if (errorLogs.length > 100) errorLogs.shift();
    console.error(chalk.red(`  ❌ [${command}]:`), err.message);
    await m.react('❌').catch(() => {});
    await m.reply(
      `╔══════════════════╗\n║  ❌ *ERROR*\n╚══════════════════╝\n\n` +
      `_${err.message}_\n\n> _${config.BOT_NAME}_`
    );
  }
                                                  }
