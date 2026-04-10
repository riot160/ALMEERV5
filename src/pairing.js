import express from 'express';
import chalk from 'chalk';

export function startPairingServer(sock, port) {
  const app = express();
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ALMEERV5 — Pair Device</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Rajdhani',sans-serif;background:#060610;color:#e0e0ff;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
    body::before{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 20%,rgba(0,255,200,0.06) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(140,0,255,0.08) 0%,transparent 50%);animation:bgPulse 8s ease-in-out infinite alternate;pointer-events:none;}
    @keyframes bgPulse{0%{transform:scale(1) rotate(0deg);}100%{transform:scale(1.05) rotate(2deg);}}
    .grid-overlay{position:fixed;inset:0;background-image:linear-gradient(rgba(0,255,200,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.03) 1px,transparent 1px);background-size:40px 40px;pointer-events:none;}
    .card{background:rgba(10,10,30,0.85);border:1px solid rgba(0,255,200,0.18);border-radius:20px;padding:48px 40px;max-width:460px;width:90%;backdrop-filter:blur(20px);box-shadow:0 0 60px rgba(0,255,200,0.08),0 0 120px rgba(140,0,255,0.06);position:relative;z-index:1;}
    .logo{text-align:center;margin-bottom:32px;}
    .logo h1{font-family:'Orbitron',monospace;font-weight:900;font-size:2.4rem;background:linear-gradient(135deg,#00ffc8 0%,#8c00ff 50%,#00b4ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:4px;text-transform:uppercase;}
    .logo p{color:rgba(0,255,200,0.6);font-size:0.85rem;letter-spacing:2px;margin-top:6px;}
    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,200,0.4),transparent);margin:24px 0;}
    label{display:block;font-size:0.8rem;letter-spacing:2px;color:rgba(0,255,200,0.7);text-transform:uppercase;margin-bottom:8px;}
    input{width:100%;padding:14px 18px;background:rgba(0,255,200,0.05);border:1px solid rgba(0,255,200,0.2);border-radius:10px;color:#e0e0ff;font-family:'Rajdhani',sans-serif;font-size:1rem;letter-spacing:1px;outline:none;transition:border-color .3s,box-shadow .3s;}
    input:focus{border-color:rgba(0,255,200,0.6);box-shadow:0 0 20px rgba(0,255,200,0.1);}
    input::placeholder{color:rgba(255,255,255,0.25);}
    .hint{font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:6px;letter-spacing:1px;}
    button{width:100%;margin-top:24px;padding:15px;background:linear-gradient(135deg,#00ffc8,#8c00ff);border:none;border-radius:10px;color:#fff;font-family:'Orbitron',monospace;font-weight:700;font-size:0.9rem;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:opacity .3s,transform .2s,box-shadow .3s;box-shadow:0 4px 30px rgba(0,255,200,0.25);}
    button:hover{opacity:.88;transform:translateY(-2px);}
    button:disabled{opacity:.45;cursor:not-allowed;transform:none;}
    .result-box{display:none;margin-top:28px;padding:20px 24px;background:rgba(0,255,200,0.05);border:1px solid rgba(0,255,200,0.25);border-radius:12px;text-align:center;}
    .result-box.visible{display:block;}
    .result-label{font-size:0.75rem;letter-spacing:2px;color:rgba(0,255,200,0.6);text-transform:uppercase;margin-bottom:10px;}
    .code{font-family:'Orbitron',monospace;font-size:2rem;font-weight:700;letter-spacing:6px;background:linear-gradient(135deg,#00ffc8,#8c00ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .copy-btn{margin-top:14px;padding:8px 20px;background:rgba(0,255,200,0.12);border:1px solid rgba(0,255,200,0.3);border-radius:8px;color:rgba(0,255,200,0.9);font-family:'Rajdhani',sans-serif;font-size:0.85rem;letter-spacing:2px;cursor:pointer;width:auto;box-shadow:none;}
    .error-msg{display:none;margin-top:14px;padding:12px 16px;background:rgba(255,80,80,0.08);border:1px solid rgba(255,80,80,0.3);border-radius:8px;color:#ff8080;font-size:0.85rem;}
    .error-msg.visible{display:block;}
    .steps{margin-top:24px;font-size:0.78rem;color:rgba(255,255,255,0.35);letter-spacing:1px;line-height:1.8;}
    .steps span{color:rgba(0,255,200,0.6);}
    .spinner{display:inline-block;width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px;}
    @keyframes spin{to{transform:rotate(360deg);}}
  </style>
</head>
<body>
  <div class="grid-overlay"></div>
  <div class="card">
    <div class="logo">
      <h1>ALMEERV5</h1>
      <p>WhatsApp Bot · Pairing Portal</p>
    </div>
    <div class="divider"></div>
    <label for="phone">WhatsApp Number</label>
    <input id="phone" type="tel" placeholder="e.g. 254712345678" autocomplete="off"/>
    <p class="hint">Include country code — no spaces, no + symbol</p>
    <button id="pairBtn" onclick="generateCode()">Generate Pairing Code</button>
    <div class="result-box" id="resultBox">
      <div class="result-label">Your Pairing Code</div>
      <div class="code" id="codeDisplay"></div>
      <button class="copy-btn" onclick="copyCode()">⊡ Copy to Clipboard</button>
    </div>
    <div class="error-msg" id="errorMsg"></div>
    <div class="steps">
      <span>HOW TO PAIR</span><br/>
      1. Open WhatsApp → Linked Devices<br/>
      2. Tap "Link a Device" → "Link with Phone Number"<br/>
      3. Enter the code above within 60 seconds
    </div>
  </div>
  <script>
    let currentCode = '';
    async function generateCode() {
      const phone   = document.getElementById('phone').value.trim().replace(/[^0-9]/g,'');
      const btn     = document.getElementById('pairBtn');
      const result  = document.getElementById('resultBox');
      const errBox  = document.getElementById('errorMsg');
      const display = document.getElementById('codeDisplay');
      result.classList.remove('visible');
      errBox.classList.remove('visible');
      if (!phone || phone.length < 7) {
        errBox.textContent = '⚠ Please enter a valid phone number with country code.';
        errBox.classList.add('visible');
        return;
      }
      btn.disabled  = true;
      btn.innerHTML = '<span class="spinner"></span>Generating...';
      try {
        const res  = await fetch('/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone }),
        });
        const data = await res.json();
        if (data.code) {
          currentCode = data.code;
          display.textContent = data.code;
          result.classList.add('visible');
          btn.innerHTML = '↺ Regenerate Code';
        } else {
          throw new Error(data.error || 'Failed to generate code');
        }
      } catch (e) {
        errBox.textContent = '✖ ' + e.message;
        errBox.classList.add('visible');
        btn.innerHTML = 'Generate Pairing Code';
      } finally {
        btn.disabled = false;
      }
    }
    function copyCode() {
      if (!currentCode) return;
      navigator.clipboard.writeText(currentCode).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✔ Copied!';
        setTimeout(() => btn.textContent = '⊡ Copy to Clipboard', 2000);
      });
    }
  </script>
</body>
</html>`);
  });

  app.post('/pair', async (req, res) => {
    try {
      let { number } = req.body;
      if (!number) return res.status(400).json({ error: 'Number is required' });
      number = number.replace(/[^0-9]/g, '');
      const code = await sock.requestPairingCode(number);
      console.log(chalk.green(`\n  📲 Pairing code: `) + chalk.bold.cyan(code));
      res.json({ code });
    } catch (err) {
      console.error(chalk.red('  Pairing error:'), err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(chalk.cyan('\n  ╔══════════════════════════════════╗'));
    console.log(chalk.cyan('  ║') + chalk.yellow('  🌐 PAIRING SERVER STARTED') + chalk.cyan('        ║'));
    console.log(chalk.cyan('  ║') + chalk.white(`  URL: http://localhost:${port}`) + chalk.cyan('         ║'));
    console.log(chalk.cyan('  ╚══════════════════════════════════╝\n'));
  });
             }
