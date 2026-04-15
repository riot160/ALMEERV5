import express from 'express';
import chalk   from 'chalk';
import { log } from './index.js';

let _sock = null;
export function updateSock(sock) { _sock = sock; }

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>ALMEERV5 — Pair Device</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Rajdhani',sans-serif;background:#060610;color:#e0e0ff;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    body::before{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 20%,rgba(0,255,200,.07) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(140,0,255,.09) 0%,transparent 50%);pointer-events:none;}
    .grid{position:fixed;inset:0;background-image:linear-gradient(rgba(0,255,200,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;}
    .card{background:rgba(10,10,30,.92);border:1px solid rgba(0,255,200,.18);border-radius:20px;padding:44px 40px;max-width:460px;width:90%;backdrop-filter:blur(20px);box-shadow:0 0 60px rgba(0,255,200,.08);position:relative;z-index:1;}
    h1{font-family:'Orbitron',monospace;font-weight:900;font-size:2.2rem;background:linear-gradient(135deg,#00ffc8,#8c00ff,#00b4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:4px;text-align:center;}
    .sub{color:rgba(0,255,200,.6);font-size:.82rem;letter-spacing:2px;text-align:center;margin-top:6px;}
    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,200,.4),transparent);margin:24px 0;}
    label{display:block;font-size:.78rem;letter-spacing:2px;color:rgba(0,255,200,.7);text-transform:uppercase;margin-bottom:8px;}
    input{width:100%;padding:14px 16px;background:rgba(0,255,200,.05);border:1px solid rgba(0,255,200,.2);border-radius:10px;color:#e0e0ff;font-size:1rem;outline:none;font-family:'Rajdhani',sans-serif;letter-spacing:1px;transition:border-color .3s;}
    input:focus{border-color:rgba(0,255,200,.6);box-shadow:0 0 18px rgba(0,255,200,.1);}
    input::placeholder{color:rgba(255,255,255,.22);}
    .hint{font-size:.72rem;color:rgba(255,255,255,.3);margin-top:5px;letter-spacing:1px;}
    .btn{width:100%;margin-top:22px;padding:15px;background:linear-gradient(135deg,#00ffc8,#8c00ff);border:none;border-radius:10px;color:#fff;font-family:'Orbitron',monospace;font-weight:700;font-size:.88rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 30px rgba(0,255,200,.25);transition:opacity .3s,transform .2s;}
    .btn:hover{opacity:.88;transform:translateY(-2px);}
    .btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
    .result{display:none;margin-top:26px;padding:22px 20px;background:rgba(0,255,200,.05);border:1px solid rgba(0,255,200,.25);border-radius:14px;text-align:center;}
    .result.show{display:block;}
    .rlabel{font-size:.72rem;letter-spacing:2px;color:rgba(0,255,200,.65);text-transform:uppercase;margin-bottom:10px;}
    .code{font-family:'Orbitron',monospace;font-size:2.2rem;font-weight:700;letter-spacing:8px;background:linear-gradient(135deg,#00ffc8,#8c00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .copy{margin-top:14px;padding:9px 22px;background:rgba(0,255,200,.1);border:1px solid rgba(0,255,200,.28);border-radius:8px;color:rgba(0,255,200,.9);font-family:'Rajdhani',sans-serif;font-size:.85rem;letter-spacing:2px;cursor:pointer;transition:background .2s;width:auto;box-shadow:none;}
    .copy:hover{background:rgba(0,255,200,.2);}
    .err{display:none;margin-top:14px;padding:12px 16px;background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.3);border-radius:8px;color:#ff8080;font-size:.85rem;}
    .err.show{display:block;}
    .steps{margin-top:24px;font-size:.75rem;color:rgba(255,255,255,.3);letter-spacing:1px;line-height:1.9;}
    .steps b{color:rgba(0,255,200,.6);}
    .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px;}
    @keyframes spin{to{transform:rotate(360deg);}}
  </style>
</head>
<body>
  <div class="grid"></div>
  <div class="card">
    <h1>ALMEERV5</h1>
    <p class="sub">WhatsApp Bot &middot; Pairing Portal</p>
    <div class="divider"></div>
    <label for="phone">Your WhatsApp Number</label>
    <input id="phone" type="tel" placeholder="e.g. 254712345678" autocomplete="off"/>
    <p class="hint">Full number with country code &mdash; no + or spaces</p>
    <button class="btn" id="btn" onclick="generate()">Generate Pairing Code</button>
    <div class="result" id="result">
      <div class="rlabel">Your Pairing Code</div>
      <div class="code" id="codeText"></div>
      <button class="copy" onclick="doCopy()">&#10113; Copy Code</button>
    </div>
    <div class="err" id="err"></div>
    <div class="steps">
      <b>HOW TO USE</b><br/>
      1. Enter your WhatsApp number above<br/>
      2. Click <b>Generate Pairing Code</b><br/>
      3. Open WhatsApp &rarr; <b>Linked Devices</b><br/>
      4. Tap <b>Link a Device</b> &rarr; <b>Link with phone number</b><br/>
      5. Enter the 8-digit code &mdash; you have 60 seconds
    </div>
  </div>
  <script>
    let lastCode = '';
    async function generate() {
      const phone = document.getElementById('phone').value.trim().replace(/[^0-9]/g,'');
      const btn   = document.getElementById('btn');
      const res   = document.getElementById('result');
      const err   = document.getElementById('err');
      res.classList.remove('show'); err.classList.remove('show');
      if (!phone || phone.length < 7) {
        err.textContent = '⚠ Enter your full WhatsApp number with country code.';
        err.classList.add('show'); return;
      }
      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner"></span>Generating (5s)...';
      try {
        const r    = await fetch('/pair', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({number:phone}) });
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'Server error');
        lastCode = data.code;
        document.getElementById('codeText').textContent = data.code;
        res.classList.add('show');
        btn.innerHTML = '↺ Regenerate Code';
      } catch (e) {
        err.textContent = '✖ ' + e.message;
        err.classList.add('show');
        btn.innerHTML = 'Generate Pairing Code';
      } finally { btn.disabled = false; }
    }
    function doCopy() {
      if (!lastCode) return;
      navigator.clipboard.writeText(lastCode).then(() => {
        const b = document.querySelector('.copy');
        b.textContent = '✔ Copied!';
        setTimeout(() => { b.innerHTML = '&#10113; Copy Code'; }, 2000);
      });
    }
  </script>
</body>
</html>`;

export function startPairingServer(port) {
  const app = express();
  app.use(express.json());

  app.get('/', (_req, res) => res.send(PAGE));

  app.post('/pair', async (req, res) => {
    try {
      let { number } = req.body;
      if (!number) return res.status(400).json({ error: 'Phone number is required' });
      number = number.replace(/[^0-9]/g, '');
      if (number.length < 7) return res.status(400).json({ error: 'Invalid number. Include country code.' });
      if (!_sock) return res.status(503).json({ error: 'Bot is starting up — wait a few seconds and try again.' });
      if (_sock.authState?.creds?.registered) return res.status(400).json({ error: 'Bot is already paired!' });

      log.pair(`Web pair request for: ${number}`);
      await new Promise(r => setTimeout(r, 3000));
      const code = await _sock.requestPairingCode(number);

      console.log(chalk.bold.hex('#39ff14')(`\n  ╔══════════════════════════════════════╗`));
      console.log(chalk.bold.hex('#39ff14')(`  ║  🔑 CODE: `) + chalk.bold.hex('#00ffc8')(code) + chalk.bold.hex('#39ff14')(`                      ║`));
      console.log(chalk.bold.hex('#39ff14')(`  ╚══════════════════════════════════════╝\n`));

      res.json({ code });
    } catch (err) {
      log.error(`Pairing error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(chalk.bold.hex('#00ffc8')('\n  ╔════════════════════════════════════════════╗'));
    console.log(chalk.bold.hex('#00ffc8')('  ║') + chalk.bold.white('  🌐 PAIRING SERVER STARTED                 ') + chalk.bold.hex('#00ffc8')('║'));
    console.log(chalk.bold.hex('#00ffc8')('  ║') + chalk.dim(`  URL  ▶  http://localhost:${port}`.padEnd(44)) + chalk.bold.hex('#00ffc8')('║'));
    console.log(chalk.bold.hex('#00ffc8')('  ║') + chalk.dim('  Visit your deployment URL to pair          ') + chalk.bold.hex('#00ffc8')('║'));
    console.log(chalk.bold.hex('#00ffc8')('  ╚════════════════════════════════════════════╝\n'));
  });
}