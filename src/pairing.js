import express from 'express';
import chalk from 'chalk';

// ── Shared state between index.js and pairing server ─────────────────────────
let _storedCode   = null;
let _codeError    = null;
let _sockRef      = null;

export function setCode(code)  { _storedCode = code; _codeError = null; }
export function setError(msg)  { _codeError  = msg;  }
export function setSock(sock)  { _sockRef    = sock;  }

// ── HTML page ─────────────────────────────────────────────────────────────────
function buildPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>ALMEERV5 — Pair Device</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Rajdhani',sans-serif;background:#060610;color:#e0e0ff;
         min-height:100vh;display:flex;align-items:center;justify-content:center;}
    body::before{content:'';position:fixed;top:-50%;left:-50%;width:200%;height:200%;
      background:radial-gradient(ellipse at 30% 20%,rgba(0,255,200,.06) 0%,transparent 50%),
                 radial-gradient(ellipse at 70% 80%,rgba(140,0,255,.08) 0%,transparent 50%);
      pointer-events:none;}
    .grid{position:fixed;inset:0;
      background-image:linear-gradient(rgba(0,255,200,.03) 1px,transparent 1px),
                       linear-gradient(90deg,rgba(0,255,200,.03) 1px,transparent 1px);
      background-size:40px 40px;pointer-events:none;}
    .card{background:rgba(10,10,30,.88);border:1px solid rgba(0,255,200,.18);
          border-radius:20px;padding:44px 40px;max-width:460px;width:90%;
          backdrop-filter:blur(20px);box-shadow:0 0 60px rgba(0,255,200,.08);
          position:relative;z-index:1;}
    .logo h1{font-family:'Orbitron',monospace;font-weight:900;font-size:2.2rem;
      background:linear-gradient(135deg,#00ffc8,#8c00ff,#00b4ff);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;letter-spacing:4px;text-align:center;}
    .logo p{color:rgba(0,255,200,.6);font-size:.82rem;letter-spacing:2px;
            margin-top:6px;text-align:center;}
    .divider{height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,200,.4),transparent);
             margin:24px 0;}
    /* code display */
    .code-box{text-align:center;padding:28px 20px;
      background:rgba(0,255,200,.05);border:1px solid rgba(0,255,200,.25);
      border-radius:14px;margin-top:8px;}
    .code-label{font-size:.75rem;letter-spacing:2px;color:rgba(0,255,200,.65);
                text-transform:uppercase;margin-bottom:12px;}
    .code-value{font-family:'Orbitron',monospace;font-size:2.2rem;font-weight:700;
      letter-spacing:8px;background:linear-gradient(135deg,#00ffc8,#8c00ff);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;}
    .copy-btn{margin-top:16px;padding:9px 24px;
      background:rgba(0,255,200,.1);border:1px solid rgba(0,255,200,.3);
      border-radius:8px;color:rgba(0,255,200,.9);
      font-family:'Rajdhani',sans-serif;font-size:.85rem;letter-spacing:2px;
      cursor:pointer;transition:background .2s;}
    .copy-btn:hover{background:rgba(0,255,200,.2);}
    /* loading */
    .loading-box{text-align:center;padding:36px 20px;}
    .spinner{display:inline-block;width:40px;height:40px;
      border:3px solid rgba(0,255,200,.15);border-top-color:#00ffc8;
      border-radius:50%;animation:spin 1s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg);}}
    .loading-text{margin-top:16px;color:rgba(0,255,200,.7);
                  font-size:.9rem;letter-spacing:2px;}
    /* form (fallback when no OWNER_NUMBER) */
    label{display:block;font-size:.78rem;letter-spacing:2px;
          color:rgba(0,255,200,.7);text-transform:uppercase;margin-bottom:8px;}
    input{width:100%;padding:13px 16px;background:rgba(0,255,200,.05);
          border:1px solid rgba(0,255,200,.2);border-radius:10px;
          color:#e0e0ff;font-size:.95rem;outline:none;
          font-family:'Rajdhani',sans-serif;transition:border-color .3s;}
    input:focus{border-color:rgba(0,255,200,.6);}
    input::placeholder{color:rgba(255,255,255,.22);}
    .hint{font-size:.72rem;color:rgba(255,255,255,.3);margin-top:5px;letter-spacing:1px;}
    .gen-btn{width:100%;margin-top:22px;padding:14px;
      background:linear-gradient(135deg,#00ffc8,#8c00ff);border:none;
      border-radius:10px;color:#fff;font-family:'Orbitron',monospace;
      font-weight:700;font-size:.85rem;letter-spacing:2px;
      text-transform:uppercase;cursor:pointer;
      box-shadow:0 4px 30px rgba(0,255,200,.25);transition:opacity .3s,transform .2s;}
    .gen-btn:hover{opacity:.88;transform:translateY(-2px);}
    .gen-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
    .err{margin-top:14px;padding:12px 16px;background:rgba(255,80,80,.08);
         border:1px solid rgba(255,80,80,.3);border-radius:8px;
         color:#ff8080;font-size:.82rem;display:none;}
    .err.show{display:block;}
    /* steps */
    .steps{margin-top:24px;font-size:.76rem;color:rgba(255,255,255,.32);
           letter-spacing:1px;line-height:1.9;}
    .steps b{color:rgba(0,255,200,.65);}
    /* regen */
    .regen{margin-top:18px;font-size:.75rem;color:rgba(255,255,255,.28);
           text-align:center;letter-spacing:1px;}
    .regen a{color:rgba(0,255,200,.5);cursor:pointer;text-decoration:underline;}
  </style>
</head>
<body>
<div class="grid"></div>
<div class="card">
  <div class="logo">
    <h1>ALMEERV5</h1>
    <p>WhatsApp Bot &middot; Pairing Portal</p>
  </div>
  <div class="divider"></div>

  <div id="app"><!-- filled by JS --></div>

  <div class="steps">
    <b>HOW TO PAIR</b><br/>
    1. Open WhatsApp &rarr; <b>Linked Devices</b><br/>
    2. Tap <b>Link a Device</b> &rarr; <b>Link with Phone Number</b><br/>
    3. Enter the code shown above within 60 seconds
  </div>
</div>

<script>
  let pollTimer = null;

  // Poll /api/code every 2 seconds until we get a code
  function pollCode() {
    pollTimer = setInterval(async () => {
      try {
        const r = await fetch('/api/code');
        const d = await r.json();
        if (d.code) {
          clearInterval(pollTimer);
          showCode(d.code);
        } else if (d.error) {
          clearInterval(pollTimer);
          showError(d.error);
        }
      } catch {}
    }, 2000);
  }

  function showLoading(msg) {
    document.getElementById('app').innerHTML =
      '<div class="loading-box">' +
      '<div class="spinner"></div>' +
      '<div class="loading-text">' + msg + '</div>' +
      '</div>';
  }

  function showCode(code) {
    document.getElementById('app').innerHTML =
      '<div class="code-box">' +
      '<div class="code-label">Your Pairing Code</div>' +
      '<div class="code-value" id="codeVal">' + code + '</div>' +
      '<button class="copy-btn" onclick="copyCode()">&#10113; Copy to Clipboard</button>' +
      '</div>' +
      '<div class="regen">Code expired? <a onclick="requestNew()">Generate a new code</a></div>';
  }

  function showForm() {
    document.getElementById('app').innerHTML =
      '<label for="ph">WhatsApp Number</label>' +
      '<input id="ph" type="tel" placeholder="e.g. 254712345678" autocomplete="off"/>' +
      '<p class="hint">Country code included &mdash; no + or spaces</p>' +
      '<button class="gen-btn" id="gb" onclick="submitForm()">Generate Pairing Code</button>' +
      '<div class="err" id="errBox"></div>';
  }

  function showError(msg) {
    document.getElementById('app').innerHTML =
      '<div class="err show" style="display:block">' + msg + '</div>' +
      '<div class="regen" style="margin-top:12px"><a onclick="requestNew()">Try again</a></div>';
  }

  async function submitForm() {
    const ph  = document.getElementById('ph')?.value?.trim()?.replace(/[^0-9]/g,'');
    const btn = document.getElementById('gb');
    const err = document.getElementById('errBox');
    if (!ph || ph.length < 7) {
      err.textContent = 'Please enter a valid phone number with country code.';
      err.className = 'err show'; return;
    }
    btn.disabled = true;
    btn.textContent = 'Requesting...';
    err.className = 'err';
    try {
      const r = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: ph }),
      });
      const d = await r.json();
      if (d.code) { showCode(d.code); }
      else { throw new Error(d.error || 'Failed'); }
    } catch(e) {
      err.textContent = e.message;
      err.className = 'err show';
      btn.disabled = false;
      btn.textContent = 'Generate Pairing Code';
    }
  }

  async function requestNew() {
    showLoading('Requesting new code...');
    try {
      const r = await fetch('/api/regen', { method: 'POST' });
      const d = await r.json();
      if (d.code) { showCode(d.code); }
      else { showLoading('Waiting for code...'); pollCode(); }
    } catch {
      showLoading('Waiting for code...');
      pollCode();
    }
  }

  function copyCode() {
    const v = document.getElementById('codeVal')?.textContent;
    if (!v) return;
    navigator.clipboard.writeText(v).then(() => {
      const b = document.querySelector('.copy-btn');
      b.textContent = '✔ Copied!';
      setTimeout(() => b.textContent = '⊡ Copy to Clipboard', 2000);
    });
  }

  // On page load: check if code already exists, else show loading + poll
  window.onload = async () => {
    try {
      const r = await fetch('/api/code');
      const d = await r.json();
      if (d.code)        { showCode(d.code); }
      else if (d.error)  { showError(d.error); }
      else if (d.noOwner){ showForm(); }
      else               { showLoading('Generating pairing code...'); pollCode(); }
    } catch {
      showLoading('Connecting...'); pollCode();
    }
  };
</script>
</body>
</html>`;
}

// ── Start Express server ──────────────────────────────────────────────────────
export function startPairingServer(getSock, port) {
  const app = express();
  app.use(express.json());

  // Page
  app.get('/', (_req, res) => res.send(buildPage()));

  // Polling endpoint — returns code, error, or null
  app.get('/api/code', (_req, res) => {
    if (_storedCode)  return res.json({ code: _storedCode });
    if (_codeError)   return res.json({ error: _codeError });
    // Check if OWNER_NUMBER is set — if not, tell client to show form
    const owner = process.env.OWNER_NUMBER?.replace(/[^0-9]/g, '');
    if (!owner)       return res.json({ noOwner: true });
    return res.json({ code: null });   // still generating
  });

  // Manual form submission (when OWNER_NUMBER not set)
  app.post('/api/pair', async (req, res) => {
    try {
      let { number } = req.body;
      if (!number) return res.status(400).json({ error: 'Number is required' });
      number = number.replace(/[^0-9]/g, '');
      if (number.length < 7) return res.status(400).json({ error: 'Invalid number' });

      const sock = getSock();
      if (!sock) return res.status(503).json({ error: 'Bot not ready yet' });

      // Mirror V4: wait 3 seconds before requesting
      await new Promise(r => setTimeout(r, 3000));
      const code = await sock.requestPairingCode(number);
      setCode(code);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Regenerate code
  app.post('/api/regen', async (req, res) => {
    try {
      const owner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
      if (!owner) return res.status(400).json({ error: 'Set OWNER_NUMBER in env to regenerate' });
      const sock = getSock();
      if (!sock) return res.status(503).json({ error: 'Bot not ready' });
      _storedCode = null;
      await new Promise(r => setTimeout(r, 1000));
      const code = await sock.requestPairingCode(owner);
      setCode(code);
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(chalk.cyan('\n  ╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('  ║') + chalk.yellow('  🌐 PAIRING SERVER STARTED              ') + chalk.cyan('║'));
    console.log(chalk.cyan('  ║') + chalk.white(`  URL ▶  http://localhost:${port}`) + chalk.cyan('              ║'));
    console.log(chalk.cyan('  ║') + chalk.green('  Open the URL to view your pairing code') + chalk.cyan(' ║'));
    console.log(chalk.cyan('  ╚════════════════════════════════════════╝\n'));
  });
}
