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
  const files = readdirSync(pluginDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod  = await import(pathToFileURL(join(pluginDir, file)).href);
      const cmds = mod.default || mod.commands || [];
      if (Array.isArray(cmds)) {
        commands.push(...cmds);
        console.log(chalk.green(`  ✅ Loaded: ${file} (${cmds.length} commands)`));
      }
    } catch (err) { console.error(chalk.red(`  ❌ Failed: ${file}`), err.message); }
  }
  console.log(chalk.cyan(`\n  📦 Total: ${commands.length} commands loaded\n`));
}

const cooldowns = new Map();

export async function handleMessage(sock, m, isOwner = false) {
  const { command, sender, jid, isGroup } = m;
  if (!command) return;

  const cmd = commands.find(
    c => c.name === command || (Array.isArray(c.aliases) && c.aliases.includes(command))
  );
  if (!cmd) return;

  if (!isOwner) {
    const coolKey = `${sender}:${command}`;
    const now     = Date.now();
    const coolEnd = cooldowns.get(coolKey) || 0;
    if (now < coolEnd) {
      const rem = ((coolEnd - now) / 1000).toFixed(1);
      return m.reply(
        `◈━━━━ ⏳ *COOLDOWN* ━━━━◈\n\nWait *${rem}s* before using *${config.PREFIX}${command}* again.\n\n> _${config.BOT_NAME}_`
      );
    }
    cooldowns.set(coolKey, now + (cmd.cooldown || config.COOLDOWN));
  }

  if (cmd.ownerOnly && !isOwner)
    return m.reply(`◈━━━━ 👑 *OWNER ONLY* ━━━━◈\n\nThis command is for the bot owner only.\n\n> _${config.BOT_NAME}_`);

  if (cmd.groupOnly && !isGroup)
    return m.reply(`◈━━━━ 👥 *GROUPS ONLY* ━━━━◈\n\nThis command only works in groups.\n\n> _${config.BOT_NAME}_`);

  if (cmd.adminOnly && isGroup) {
    try {
      const meta   = await sock.groupMetadata(jid);
      const admins = meta.participants.filter(p => p.admin).map(p => p.id);
      if (!admins.includes(sender))
        return m.reply(`◈━━━━ 🛡️ *ADMINS ONLY* ━━━━◈\n\nOnly group admins can use this.\n\n> _${config.BOT_NAME}_`);
    } catch (_) {}
  }

  try {
    await cmd.run({
      sock, m, args: m.args, text: m.text,
      isOwner, config,
      pushName: m.pushName || sender.split('@')[0],
    });
    if (config.AUTO_REACT) await m.react('✅').catch(() => {});
  } catch (err) {
    errorLogs.push({ time: new Date().toISOString(), error: err.message, command });
    if (errorLogs.length > 100) errorLogs.shift();
    console.error(chalk.red(`  ❌ [${command}]:`), err.message);
    await m.react('❌').catch(() => {});
    await m.reply(
      `◈━━━━ ❌ *ERROR* ━━━━◈\n\n_${err.message}_\n\n> _${config.BOT_NAME}_`
    );
  }
}
