import axios  from 'axios';
import config from '../config.js';

function border(t) {
  const line = '═'.repeat(Math.max(18, t.length + 4));
  return `╔${line}╗\n║  ${t.padEnd(line.length-2)}║\n╚${line}╝`;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const EIGHT_BALL = ['It is certain.','It is decidedly so.','Without a doubt.','Yes, definitely!','Most likely.','Outlook good.','Yes!','Reply hazy, try again.','Ask again later.','Cannot predict now.',"Don't count on it.",'My reply is no.','Outlook not so good.','Very doubtful.'];
const ROASTS     = ["You're the reason GPS was invented — you're always lost.","I'd roast you more, but I ran out of adjectives.","You're like a cloud — when you disappear, it's beautiful.","I've met stones sharper than your wit.","Your WiFi signal is stronger than your personality.","You're the human equivalent of a participation trophy."];
const COMPLIMENTS= ["You light up every room you walk into! ✨","Your smile could power the whole grid! 😊","You're genuinely one of a kind. 💫","The world is better with you in it. 🌍","Your kindness is contagious! 🤍","You handle everything with such grace. 👑"];
const RIZZ       = ["Are you a magnet? I keep finding myself drawn to you.","If you were a song, you'd be on repeat forever. 🎵","Is your name Google? You have everything I've been searching for.","You're like WiFi — I feel connected the moment I see you.","Are you a star? The night sky is jealous of you."];
const DARES      = ["Do 20 push-ups right now.","Change your profile picture to a random emoji for 10 minutes.","Send a voice note singing your favourite song.","Say the alphabet backwards in under 30 seconds.","Text your last contact 'I miss you' and show the reaction."];
const TRUTHS     = ["What's the most embarrassing thing you've done in public?","Have you ever lied to get out of trouble?","Who in this group do you have a crush on?","What's one secret you've never told anyone?","Have you ever stalked someone's social media?"];
const FACTS      = ["Honey never spoils — archaeologists found 3,000-year-old honey in Egyptian tombs.","A group of flamingos is called a 'flamboyance'.","Octopuses have three hearts and blue blood.","Sharks are older than trees — they've existed for over 400 million years.","Bananas are berries, but strawberries are not."];

export default [
  {
    name: 'joke', aliases: ['j'], category: 'fun', description: 'Random joke', usage: '.joke',
    async run({ m }) {
      let setup, punchline;
      try {
        const res = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 8000 });
        setup = res.data.setup; punchline = res.data.punchline;
      } catch { setup = "Why don't scientists trust atoms?"; punchline = "Because they make up everything!"; }
      await m.reply(`${border('😂 JOKE')}\n\n*Setup:*\n${setup}\n\n*Punchline:*\n_${punchline}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'meme', aliases: ['randmeme'], category: 'fun', description: 'Random meme', usage: '.meme',
    async run({ sock, m }) {
      const res = await axios.get('https://meme-api.com/gimme', { timeout: 10000 });
      const { title, url } = res.data;
      const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      await sock.MQ.add(() =>
        sock.sendMessage(m.jid, { image: Buffer.from(img.data), caption: `${border('😂 MEME')}\n\n*${title}*\n\n> _${config.BOT_NAME}_` }, { quoted: m })
      );
    },
  },
  {
    name: 'quote', aliases: ['inspo'], category: 'fun', description: 'Inspirational quote', usage: '.quote',
    async run({ m }) {
      let q, a;
      try {
        const res = await axios.get('https://api.quotable.io/random', { timeout: 8000 });
        q = res.data.content; a = res.data.author;
      } catch { q = 'The only way to do great work is to love what you do.'; a = 'Steve Jobs'; }
      await m.reply(`${border('💭 QUOTE')}\n\n_"${q}"_\n\n*— ${a}*\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'fact', aliases: ['funfact'], category: 'fun', description: 'Random fact', usage: '.fact',
    async run({ m }) {
      let fact;
      try {
        const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: 8000 });
        fact = res.data.text;
      } catch { fact = pick(FACTS); }
      await m.reply(`${border('🧠 FACT')}\n\n${fact}\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: '8ball', aliases: ['eightball'], category: 'fun', description: 'Magic 8-ball', usage: '.8ball <question>',
    async run({ m, text }) {
      if (!text) return m.reply(`Usage: ${config.PREFIX}8ball <question>`);
      await m.reply(`${border('🎱 MAGIC 8-BALL')}\n\n*Question:* ${text}\n\n*Answer:* _${pick(EIGHT_BALL)}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'ship', aliases: ['love'], category: 'fun', description: 'Ship compatibility', usage: '.ship <n1> <n2>',
    async run({ m, args }) {
      if (args.length < 2) return m.reply(`Usage: ${config.PREFIX}ship <name1> <name2>`);
      const [n1, n2] = [args[0], args[1]];
      const hash = [...(n1+n2).toLowerCase()].reduce((a,c) => a+c.charCodeAt(0), 0);
      const pct  = hash % 101;
      const bar  = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10));
      const verdict = pct>=80?'💞 Perfect match!':pct>=60?'💕 Great couple!':pct>=40?'😊 Good chemistry.':pct>=20?'🤔 Needs work.':'💔 Not the best.';
      await m.reply(`${border('💘 SHIP METER')}\n\n*${n1}* 💞 *${n2}*\n\n[${bar}] *${pct}%*\n\n_${verdict}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'roast', aliases: ['burn'], category: 'fun', description: 'Roast a user', usage: '.roast @user',
    async run({ m }) {
      const target = m.mentions[0];
      const name   = target ? `@${target.split('@')[0]}` : 'you';
      await m.reply(`${border('🔥 ROASTED')}\n\n${name} — ${pick(ROASTS)}\n\n> _${config.BOT_NAME}_`, { mentions: target?[target]:[] });
    },
  },
  {
    name: 'compliment', aliases: ['praise'], category: 'fun', description: 'Compliment a user', usage: '.compliment @user',
    async run({ m }) {
      const target = m.mentions[0];
      const name   = target ? `@${target.split('@')[0]}` : 'you';
      await m.reply(`${border('💐 COMPLIMENT')}\n\n${name} — ${pick(COMPLIMENTS)}\n\n> _${config.BOT_NAME}_`, { mentions: target?[target]:[] });
    },
  },
  {
    name: 'rizz', aliases: ['pickup'], category: 'fun', description: 'Pickup line', usage: '.rizz',
    async run({ m }) {
      await m.reply(`${border('😏 RIZZ LINE')}\n\n_${pick(RIZZ)}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'dare', aliases: ['d'], category: 'fun', description: 'Random dare', usage: '.dare',
    async run({ m }) {
      await m.reply(`${border('🎲 DARE')}\n\n_${pick(DARES)}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'truth', aliases: ['t'], category: 'fun', description: 'Random truth', usage: '.truth',
    async run({ m }) {
      await m.reply(`${border('🤔 TRUTH')}\n\n_${pick(TRUTHS)}_\n\n> _${config.BOT_NAME}_`);
    },
  },
  {
    name: 'rps', aliases: ['rockpaperscissors'], category: 'fun', description: 'Rock Paper Scissors', usage: '.rps <rock|paper|scissors>',
    async run({ m, args }) {
      const choices = ['rock','paper','scissors'];
      const emojis  = { rock:'🪨', paper:'📄', scissors:'✂️' };
      const player  = args[0]?.toLowerCase();
      if (!choices.includes(player)) return m.reply(`Usage: ${config.PREFIX}rps <rock|paper|scissors>`);
      const bot = pick(choices);
      let result = '🤝 *Draw!*';
      if ((player==='rock'&&bot==='scissors')||(player==='paper'&&bot==='rock')||(player==='scissors'&&bot==='paper')) result = '🏆 *You win!*';
      else if (player !== bot) result = '😈 *Bot wins!*';
      await m.reply(`${border('✂️ ROCK PAPER SCISSORS')}\n\n*You:* ${emojis[player]} ${player}\n*Bot:* ${emojis[bot]} ${bot}\n\n${result}\n\n> _${config.BOT_NAME}_`);
    },
  },
];
