import { createRequire } from 'module';
import { PassThrough }   from 'stream';
import fs                from 'fs-extra';
import path              from 'path';
import { fileURLToPath } from 'url';
import ytsr              from 'ytsr';
import config            from '../config.js';

const require    = createRequire(import.meta.url);
const ytdl       = require('@distube/ytdl-core');
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await fs.ensureDir(path.join(__dirname, '../../downloads'));

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length - 2)}║\n╚${line}╝`;
}

/** Search YouTube using ytsr, return first video result */
async function searchYT(query) {
  const results = await ytsr(query, { limit: 5 });
  const video   = results.items.find(i => i.type === 'video');
  return video || null;
}

/** Convert YouTube URL to MP3 buffer via ffmpeg */
function ytToMp3Buffer(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pass   = new PassThrough();
    ffmpeg(ytdl(url, { filter: 'audioonly', quality: 'highestaudio' }))
      .audioBitrate(128)
      .format('mp3')
      .on('error', reject)
      .pipe(pass);
    pass.on('data',  c => chunks.push(c));
    pass.on('end',   () => resolve(Buffer.concat(chunks)));
    pass.on('error', reject);
  });
}

/** Convert YouTube URL to MP4 buffer */
function ytToMp4Buffer(url) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = ytdl(url, {
      filter:  f => f.container === 'mp4' && f.hasAudio && f.hasVideo,
      quality: 'lowest',
    });
    stream.on('data',  c => chunks.push(c));
    stream.on('end',   () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** Parse ytsr duration string "m:ss" → seconds */
function durationToSeconds(dur) {
  if (!dur) return 0;
  const parts = dur.split(':').map(Number).reverse();
  return (parts[0] || 0) + (parts[1] || 0) * 60 + (parts[2] || 0) * 3600;
}

export default [
  // ── .play ──────────────────────────────────────────────────
  {
    name:        'play',
    aliases:     ['song'],
    category:    'media',
    description: 'Search and download YouTube audio',
    usage:       '.play <song name>',
    cooldown:    15000,
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}play <song name>`);

      await m.reply(
        `${border('🎵 SEARCHING')}\n\n_Looking for:_ *${text}*\n\n> _${config.BOT_NAME}_`
      );

      const video = await searchYT(text);
      if (!video) return m.reply('❌ No results found for that search.');

      const secs = durationToSeconds(video.duration);
      if (secs > 600) return m.reply('❌ Song is too long (max 10 min).');

      await m.reply(
        `${border('🎵 DOWNLOADING')}\n\n` +
        `*Title:*    ${video.title}\n` +
        `*Duration:* ${video.duration || 'Unknown'}\n` +
        `*Channel:*  ${video.author?.name || 'Unknown'}\n\n` +
        `_Downloading audio..._\n\n> _${config.BOT_NAME}_`
      );

      const buffer = await ytToMp3Buffer(video.url);
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, {
          audio:    buffer,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`,
        }, { quoted: m })
      );
    },
  },

  // ── .video ─────────────────────────────────────────────────
  {
    name:        'video',
    aliases:     ['vid'],
    category:    'media',
    description: 'Download YouTube video (max 50 MB)',
    usage:       '.video <query>',
    cooldown:    20000,
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}video <query>`);

      await m.reply(
        `${border('🎬 SEARCHING')}\n\n_Looking for:_ *${text}*\n\n> _${config.BOT_NAME}_`
      );

      const video = await searchYT(text);
      if (!video) return m.reply('❌ No results found.');

      const secs = durationToSeconds(video.duration);
      if (secs > 300) return m.reply('❌ Video too long (max 5 min).');

      await m.reply(
        `${border('🎬 DOWNLOADING')}\n\n` +
        `*Title:*    ${video.title}\n` +
        `*Duration:* ${video.duration || 'Unknown'}\n\n` +
        `_Downloading video..._\n\n> _${config.BOT_NAME}_`
      );

      const buffer = await ytToMp4Buffer(video.url);
      if (buffer.length > 50 * 1024 * 1024) return m.reply('❌ File too large (>50 MB).');

      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, {
          video:    buffer,
          mimetype: 'video/mp4',
          fileName: `${video.title}.mp4`,
          caption:  `🎬 *${video.title}*\n\n> _${config.BOT_NAME}_`,
        }, { quoted: m })
      );
    },
  },

  // ── .ytmp3 ─────────────────────────────────────────────────
  {
    name:        'ytmp3',
    aliases:     ['mp3'],
    category:    'media',
    description: 'Convert YouTube URL to MP3',
    usage:       '.ytmp3 <url>',
    cooldown:    15000,
    async run({ sock, m, text }) {
      if (!text || !text.includes('youtu')) {
        return m.reply(`Usage: ${config.PREFIX}ytmp3 <youtube url>`);
      }
      await m.reply(
        `${border('🎵 YT → MP3')}\n\n_Processing URL..._\n\n> _${config.BOT_NAME}_`
      );
      let info;
      try { info = await ytdl.getInfo(text); }
      catch { return m.reply('❌ Invalid or unavailable YouTube URL.'); }

      const title = info.videoDetails.title;
      if (parseInt(info.videoDetails.lengthSeconds) > 600) {
        return m.reply('❌ Too long (max 10 min).');
      }
      await m.reply(`_Downloading:_ *${title}*`);
      const buffer = await ytToMp3Buffer(text);
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, {
          audio:    buffer,
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`,
        }, { quoted: m })
      );
    },
  },

  // ── .ytmp4 ─────────────────────────────────────────────────
  {
    name:        'ytmp4',
    aliases:     ['mp4'],
    category:    'media',
    description: 'Convert YouTube URL to MP4',
    usage:       '.ytmp4 <url>',
    cooldown:    20000,
    async run({ sock, m, text }) {
      if (!text || !text.includes('youtu')) {
        return m.reply(`Usage: ${config.PREFIX}ytmp4 <youtube url>`);
      }
      await m.reply(
        `${border('🎬 YT → MP4')}\n\n_Processing URL..._\n\n> _${config.BOT_NAME}_`
      );
      let info;
      try { info = await ytdl.getInfo(text); }
      catch { return m.reply('❌ Invalid or unavailable YouTube URL.'); }

      const title = info.videoDetails.title;
      if (parseInt(info.videoDetails.lengthSeconds) > 300) {
        return m.reply('❌ Too long (max 5 min).');
      }
      const buffer = await ytToMp4Buffer(text);
      if (buffer.length > 50 * 1024 * 1024) return m.reply('❌ File too large.');

      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, {
          video:    buffer,
          mimetype: 'video/mp4',
          fileName: `${title}.mp4`,
          caption:  `🎬 *${title}*\n\n> _${config.BOT_NAME}_`,
        }, { quoted: m })
      );
    },
  },
];
