import axios  from 'axios';
import config from '../config.js';

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}

const history = {};
const MAX_HISTORY = 10;

function getHistory(jid) {
  if (!history[jid]) history[jid] = [];
  return history[jid];
}
function pushHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  if (h.length > MAX_HISTORY * 2) h.splice(0, 2);
}

async function pollinationsChat(jid, userMsg) {
  pushHistory(jid, 'user', userMsg);
  const messages = [
    { role: 'system', content: `You are ${config.BOT_NAME}, a helpful WhatsApp assistant by ALMEER. Be concise.` },
    ...getHistory(jid),
  ];
  const res = await axios.post(
    'https://text.pollinations.ai/',
    { messages, model: 'openai', seed: Math.floor(Math.random() * 9999) },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
  );
  const reply = typeof res.data === 'string' ? res.data.trim() : JSON.stringify(res.data);
  pushHistory(jid, 'assistant', reply);
  return reply;
}

async function geminiChat(prompt) {
  if (!config.GEMINI_KEY) throw new Error('GEMINI_KEY not set.');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI  = new GoogleGenerativeAI(config.GEMINI_KEY);
  const model  = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export default [
  {
    name: 'ai', aliases: ['gpt','chat','ask'], category: 'ai',
    description: 'Chat with AI (Pollinations)', usage: '.ai <prompt>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}ai <question>`);
      await m.reply(`${border('🤖 AI THINKING')}\n\n_Processing..._\n\n> _${config.BOT_NAME}_`);
      const reply = await pollinationsChat(m.jid, text);
      await m.reply(`${border('🤖 AI RESPONSE')}\n\n${reply}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'imagine', aliases: ['dalle','image','draw'], category: 'ai',
    description: 'Generate AI image', usage: '.imagine <prompt>',
    cooldown: 10000,
    async run({ sock, m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}imagine <description>`);
      await m.reply(`${border('🎨 GENERATING')}\n\n_Prompt:_ *${text}*\n\n_Please wait..._\n\n> _${config.BOT_NAME}_`);
      const encoded = encodeURIComponent(text);
      const seed    = Math.floor(Math.random() * 99999);
      const url     = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&seed=${seed}&nologo=true`;
      const res     = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, {
          image:   Buffer.from(res.data),
          caption: `${border('🎨 AI IMAGE')}\n\n*Prompt:* ${text}\n\n> _${config.BOT_NAME}_`,
        }, { quoted: m })
      );
    },
  },
  {
    name: 'gemini', aliases: ['gem'], category: 'ai',
    description: 'Chat with Google Gemini', usage: '.gemini <prompt>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}gemini <prompt>`);
      if (!config.GEMINI_KEY) return m.reply('❌ Add GEMINI_KEY to your .env');
      await m.reply(`${border('✨ GEMINI')}\n\n_Thinking..._\n\n> _${config.BOT_NAME}_`);
      const reply = await geminiChat(text);
      await m.reply(`${border('✨ GEMINI RESPONSE')}\n\n${reply}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'clearchat', aliases: ['resetai','newchat'], category: 'ai',
    description: 'Reset AI conversation', usage: '.clearchat',
    async run({ m }) {
      history[m.jid] = [];
      await m.reply(`${border('🗑️ CLEARED')}\n\n_AI history reset._\n\n> _${config.BOT_NAME}_`);
    },
  },
];
