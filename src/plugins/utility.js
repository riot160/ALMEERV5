import axios  from 'axios';
import sharp  from 'sharp';
import QRCode from 'qrcode';
import { evaluate } from 'mathjs';
import { createRequire } from 'module';
import config from '../config.js';

const require    = createRequire(import.meta.url);
const ffmpeg     = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}

async function toWebp(buf) {
  return sharp(buf).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:80}).toBuffer();
}

export default [
  {
    name: 'sticker', aliases: ['s','stiker'], category: 'utility',
    description: 'Image/video to sticker', usage: '.sticker (reply to media)',
    async run({ sock, m }) {
      const quoted  = m.quoted;
      const type    = m.type;
      const isMedia = ['imageMessage','videoMessage','stickerMessage'].includes(type)
                   || (quoted && ['imageMessage','videoMessage','stickerMessage'].includes(quoted.type));
      if (!isMedia) return m.reply(`Reply to an image with ${config.PREFIX}sticker`);
      const source  = quoted || m;
      const buf     = await source.download();
      const webp    = await toWebp(buf);
      await sock.MQ.add(() => sock.sendMessage(m.jid, { sticker: webp }, { quoted: m }));
    },
  },
  {
    name: 'toimg', aliases: ['toimage'], category: 'utility',
    description: 'Sticker to image', usage: '.toimg (reply to sticker)',
    async run({ sock, m }) {
      const source = m.quoted || m;
      if (!['stickerMessage'].includes(source.type || m.type)) return m.reply('Reply to a sticker.');
      const buf = await (m.quoted ? m.quoted.download() : m.download());
      const png = await sharp(buf).png().toBuffer();
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: png, caption: `${border('🖼️ STICKER → IMAGE')}\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
  {
    name: 'resize', aliases: ['resizeimg'], category: 'utility',
    description: 'Resize image', usage: '.resize <w> <h> (reply to image)',
    async run({ sock, m, args }) {
      const [w, h] = [parseInt(args[0]), parseInt(args[1])];
      if (!w || !h) return m.reply(`Usage: ${config.PREFIX}resize 300 300`);
      const source = m.quoted || m;
      if (!['imageMessage'].includes(source.type || m.type)) return m.reply('Reply to an image.');
      const buf = await (m.quoted ? m.quoted.download() : m.download());
      const out = await sharp(buf).resize(w, h).jpeg({ quality: 90 }).toBuffer();
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: out, caption: `${border('📐 RESIZED')}\n\n*Size:* ${w}×${h}px\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
  {
    name: 'enhance', aliases: ['sharpen'], category: 'utility',
    description: 'Enhance image', usage: '.enhance (reply to image)',
    async run({ sock, m }) {
      const source = m.quoted || m;
      if (!['imageMessage'].includes(source.type || m.type)) return m.reply('Reply to an image.');
      const buf = await (m.quoted ? m.quoted.download() : m.download());
      const out = await sharp(buf).sharpen({sigma:1.5}).modulate({brightness:1.05,saturation:1.1}).jpeg({quality:95}).toBuffer();
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: out, caption: `${border('✨ ENHANCED')}\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
  {
    name: 'ocr', aliases: ['readtext'], category: 'utility',
    description: 'Extract text from image', usage: '.ocr (reply to image)',
    async run({ m }) {
      const source = m.quoted || m;
      if (!['imageMessage'].includes(source.type || m.type)) return m.reply('Reply to an image.');
      await m.reply(`${border('🔍 OCR')}\n\n_Extracting text..._\n\n> _${config.BOT_NAME}_`);
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        const buf    = await (m.quoted ? m.quoted.download() : m.download());
        const { data: { text } } = await worker.recognize(buf);
        await worker.terminate();
        await m.reply(`${border('🔍 OCR RESULT')}\n\n${text.trim()||'_No text detected._'}\n\n> _${config.BOT_NAME}_`);
      } catch (e) {
        await m.reply(`❌ OCR failed. Install: npm i tesseract.js`);
      }
    },
  },
  {
    name: 'translate', aliases: ['tr'], category: 'utility',
    description: 'Translate text', usage: '.translate <lang> <text>',
    async run({ m, args }) {
      if (args.length < 2) return m.reply(`Usage: ${config.PREFIX}translate sw Hello`);
      const lang = args[0].toLowerCase();
      const text = args.slice(1).join(' ');
      const res  = await axios.get('https://api.mymemory.translated.net/get', { params: { q: text, langpair: `en|${lang}` }, timeout: 10000 });
      const out  = res.data.responseData.translatedText;
      await m.reply(`${border('🌐 TRANSLATE')}\n\n*Original:* ${text}\n*Language:* ${lang}\n*Translated:* ${out}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'tts', aliases: ['speak'], category: 'utility',
    description: 'Text to speech', usage: '.tts <text>',
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}tts <text>`);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
      const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { audio: Buffer.from(res.data), mimetype: 'audio/mpeg', ptt: false }, { quoted: m })
      );
    },
  },
  {
    name: 'weather', aliases: ['w'], category: 'utility',
    description: 'Current weather', usage: '.weather <city>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}weather <city>`);
      const res  = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=j1`, { timeout: 10000 });
      const cur  = res.data.current_condition[0];
      const near = res.data.nearest_area?.[0];
      const city = near?.areaName?.[0]?.value || text;
      await m.reply(
        `${border(`🌤️ WEATHER`)}\n\n*Location:* ${city}\n*Condition:* ${cur.weatherDesc[0].value}\n` +
        `*Temp:* ${cur.temp_C}°C / ${cur.temp_F}°F\n*Humidity:* ${cur.humidity}%\n*Wind:* ${cur.windspeedKmph} km/h\n\n> _${config.BOT_NAME}_`
      );
    },
  },
  {
    name: 'time', aliases: ['clock'], category: 'utility',
    description: 'Current time in a city', usage: '.time <city>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}time <city>`);
      try {
        const res   = await axios.get('https://worldtimeapi.org/api/timezone', { timeout: 8000 });
        const match = res.data.find(t => t.toLowerCase().includes(text.toLowerCase()));
        if (!match) return m.reply(`_Timezone not found for "${text}"._`);
        const tzRes = await axios.get(`https://worldtimeapi.org/api/timezone/${match}`, { timeout: 8000 });
        const dt    = new Date(tzRes.data.datetime);
        const fmt   = dt.toLocaleString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        await m.reply(`${border('🕐 TIME')}\n\n*Location:* ${text}\n*Timezone:* ${match}\n*Time:* ${fmt}\n\n> _${config.BOT_NAME}_`);
      } catch (e) {
        await m.reply(`❌ Could not fetch time.`);
      }
    },
  },
  {
    name: 'calc', aliases: ['calculate','math'], category: 'utility',
    description: 'Calculator', usage: '.calc 2+2',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}calc <expression>`);
      try {
        const result = evaluate(text);
        await m.reply(`${border('🧮 CALCULATOR')}\n\n*Expression:* \`${text}\`\n*Result:* \`${result}\`\n\n> _${config.BOT_NAME}_`);
      } catch {
        await m.reply(`❌ Invalid expression: \`${text}\``);
      }
    },
  },
  {
    name: 'shorten', aliases: ['short','tinyurl'], category: 'utility',
    description: 'Shorten URL', usage: '.shorten <url>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}shorten <url>`);
      const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`, { timeout: 10000 });
      await m.reply(`${border('🔗 URL SHORTENER')}\n\n*Original:* ${text}\n*Short:* ${res.data}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'qr', aliases: ['qrcode'], category: 'utility',
    description: 'Generate QR code', usage: '.qr <text>',
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}qr <text>`);
      const buf = await QRCode.toBuffer(text, { type: 'png', width: 400, margin: 2 });
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: buf, caption: `${border('📷 QR CODE')}\n\n*Data:* ${text}\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
  {
    name: 'base64', aliases: ['b64'], category: 'utility',
    description: 'Encode/decode Base64', usage: '.base64 encode <text>',
    async run({ m, args }) {
      const mode = args[0]?.toLowerCase();
      const text = args.slice(1).join(' ');
      if (!mode || !text || !['encode','decode'].includes(mode)) {
        return m.reply(`Usage:\n${config.PREFIX}base64 encode <text>\n${config.PREFIX}base64 decode <base64>`);
      }
      try {
        const result = mode==='encode' ? Buffer.from(text).toString('base64') : Buffer.from(text,'base64').toString('utf8');
        await m.reply(`${border('🔐 BASE64')}\n\n*Mode:* ${mode}\n*Input:* ${text}\n*Output:* \`${result}\`\n\n> _${config.BOT_NAME}_`);
      } catch {
        await m.reply('❌ Invalid input.');
      }
    },
  },
  {
    name: 'color', aliases: ['colour','hex'], category: 'utility',
    description: 'Color swatch', usage: '.color #FF5500',
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}color #FF5500`);
      const hex = text.replace('#','').trim();
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return m.reply('❌ Invalid hex. Example: #FF5500');
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      const buf = await sharp({ create: { width:200, height:200, channels:3, background:{r,g,b} } }).png().toBuffer();
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: buf, caption: `${border('🎨 COLOR')}\n\n*Hex:* #${hex.toUpperCase()}\n*RGB:* rgb(${r},${g},${b})\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
];
