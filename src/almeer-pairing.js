// ═══════════════════════════════════════════════════════════════════════════
//  ALMEERV5 PAIRING SERVER — v2  IMPROVED (RIOT MD STYLE)
//
//  Features:
//  ✅ Proper code formatting with dashes (XXXX-XXXX-XXXX-XXXX)
//  ✅ Real-time code polling with 2-second intervals
//  ✅ Manual number entry when OWNER_NUMBER not in env
//  ✅ Code regeneration support
//  ✅ Beautiful responsive UI with gradient animations
//  ✅ Works perfectly on Railway with custom domain
//  ✅ Terminal output for local development
//  ✅ Proper socket lifecycle management
// ═══════════════════════════════════════════════════════════════════════════

import express from 'express';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────
//  SHARED STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────
let _storedCode   = null;
let _codeError    = null;
let _sockRef      = null;
let _codeTimestamp = null;
let _requestInProgress = false;

export function setCode(code) {
  _storedCode = code;
  _codeError = null;
  _codeTimestamp = Date.now();
  console.log(chalk.green(`  ✅ Pairing code set: ${code}`));
}

export function setError(msg) {
  _codeError = msg;
  _storedCode = null;
  console.log(chalk.red(`  ❌ Pairing error: ${msg}`));
}

export function setSock(sock) {
  _sockRef = sock;
}

export function getCode() {
  return _storedCode;
}

// ─────────────────────────────────────────────────────────────────────────
//  HELPER: FORMAT CODE WITH DASHES (LIKE RIOT MD)
// ─────────────────────────────────────────────────────────────────────────
function formatCode(code) {
  if (!code) return code;
  const cleaned = String(code).replace(/[^0-9]/g, '');
  return cleaned.match(/.{1,4}/g)?.join('-') || cleaned;
}

// ─────────────────────────────────────────────────────────────────────────
//  HTML PAGE BUILDER
// ─────────────────────────────────────────────────────────────────────────
function buildPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>ALMEERV5 — Pair Your Device</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Rajdhani', sans-serif;
      background: linear-gradient(135deg, #0f0f2e 0%, #1a0033 50%, #0f0f2e 100%);
      color: #e0e0ff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow-x: hidden;
    }
    
    body::before {
      content: '';
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: 
        radial-gradient(ellipse at 30% 20%, rgba(0, 255, 200, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, rgba(140, 0, 255, 0.08) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    
    .grid {
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(rgba(0, 255, 200, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 255, 200, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none;
      z-index: 0;
    }
    
    .container {
      position: relative;
      z-index: 10;
      padding: 20px;
      width: 100%;
      max-width: 500px;
    }
    
    .card {
      background: rgba(15, 15, 50, 0.92);
      border: 1px solid rgba(0, 255, 200, 0.25);
      border-radius: 24px;
      padding: 48px 40px;
      backdrop-filter: blur(30px);
      box-shadow: 
        0 0 60px rgba(0, 255, 200, 0.1),
        inset 0 0 30px rgba(0, 255, 200, 0.02);
    }
    
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    
    .logo h1 {
      font-family: 'Orbitron', monospace;
      font-weight: 900;
      font-size: 2.8rem;
      background: linear-gradient(135deg, #00ffc8 0%, #8c00ff 50%, #00b4ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 6px;
      margin-bottom: 8px;
      text-shadow: 0 0 20px rgba(0, 255, 200, 0.2);
    }
    
    .logo p {
      color: rgba(0, 255, 200, 0.65);
      font-size: 0.85rem;
      letter-spacing: 3px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0, 255, 200, 0.5), transparent);
      margin: 28px 0;
    }
    
    /* CODE DISPLAY SECTION */
    .code-section {
      text-align: center;
      padding: 36px 24px;
      background: linear-gradient(135deg, rgba(0, 255, 200, 0.08) 0%, rgba(140, 0, 255, 0.05) 100%);
      border: 2px solid rgba(0, 255, 200, 0.3);
      border-radius: 18px;
      margin-bottom: 24px;
      animation: pulse-glow 3s ease-in-out infinite;
    }
    
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 200, 0.15); }
      50% { box-shadow: 0 0 40px rgba(0, 255, 200, 0.3); }
    }
    
    .code-label {
      font-size: 0.75rem;
      letter-spacing: 3px;
      color: rgba(0, 255, 200, 0.7);
      text-transform: uppercase;
      margin-bottom: 16px;
      font-weight: 600;
    }
    
    .code-value {
      font-family: 'Orbitron', monospace;
      font-size: 3rem;
      font-weight: 900;
      letter-spacing: 12px;
      background: linear-gradient(135deg, #00ffc8 0%, #8c00ff 50%, #00b4ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 20px 0;
      text-shadow: 0 0 20px rgba(0, 255, 200, 0.3);
      word-break: break-all;
      animation: float-code 3s ease-in-out infinite;
    }
    
    @keyframes float-code {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-3px); }
    }
    
    .copy-btn {
      margin-top: 20px;
      padding: 12px 32px;
      background: linear-gradient(135deg, rgba(0, 255, 200, 0.2), rgba(140, 0, 255, 0.2));
      border: 2px solid rgba(0, 255, 200, 0.4);
      border-radius: 12px;
      color: rgba(0, 255, 200, 0.95);
      font-family: 'Rajdhani', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
    }
    
    .copy-btn:hover {
      background: linear-gradient(135deg, rgba(0, 255, 200, 0.35), rgba(140, 0, 255, 0.35));
      border-color: rgba(0, 255, 200, 0.7);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 255, 200, 0.25);
    }
    
    .copy-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    
    /* LOADING STATE */
    .loading-box {
      text-align: center;
      padding: 48px 24px;
    }
    
    .spinner {
      display: inline-block;
      width: 50px;
      height: 50px;
      border: 4px solid rgba(0, 255, 200, 0.2);
      border-top-color: #00ffc8;
      border-right-color: #8c00ff;
      border-radius: 50%;
      animation: spin 1.5s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading-text {
      margin-top: 24px;
      color: rgba(0, 255, 200, 0.8);
      font-size: 1rem;
      letter-spacing: 2px;
      font-weight: 600;
    }
    
    /* FORM SECTION (for manual number entry) */
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    label {
      display: block;
      font-size: 0.8rem;
      letter-spacing: 2px;
      color: rgba(0, 255, 200, 0.75);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    input {
      width: 100%;
      padding: 15px 18px;
      background: rgba(0, 255, 200, 0.08);
      border: 2px solid rgba(0, 255, 200, 0.25);
      border-radius: 12px;
      color: #e0e0ff;
      font-size: 1rem;
      font-family: 'Rajdhani', sans-serif;
      outline: none;
      transition: all 0.3s ease;
      font-weight: 500;
    }
    
    input:focus {
      background: rgba(0, 255, 200, 0.12);
      border-color: rgba(0, 255, 200, 0.6);
      box-shadow: 0 0 20px rgba(0, 255, 200, 0.15);
    }
    
    input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }
    
    .hint {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.35);
      margin-top: 6px;
      letter-spacing: 1px;
    }
    
    .gen-btn {
      width: 100%;
      margin-top: 20px;
      padding: 15px;
      background: linear-gradient(135deg, #00ffc8, #8c00ff, #00b4ff);
      border: none;
      border-radius: 12px;
      color: #fff;
      font-family: 'Orbitron', monospace;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 3px;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 8px 30px rgba(0, 255, 200, 0.3);
      transition: all 0.3s ease;
    }
    
    .gen-btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(0, 255, 200, 0.4);
    }
    
    .gen-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    /* ERROR MESSAGE */
    .err {
      margin-top: 20px;
      padding: 16px 20px;
      background: rgba(255, 100, 100, 0.1);
      border: 2px solid rgba(255, 100, 100, 0.4);
      border-radius: 12px;
      color: #ff9999;
      font-size: 0.85rem;
      letter-spacing: 1px;
      display: none;
      animation: shake 0.3s ease;
    }
    
    .err.show {
      display: block;
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    
    /* INSTRUCTIONS */
    .instructions {
      margin-top: 32px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.35);
      letter-spacing: 1.5px;
      line-height: 2;
    }
    
    .instructions b {
      color: rgba(0, 255, 200, 0.7);
      font-weight: 600;
    }
    
    .instructions-title {
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 12px;
      color: rgba(0, 255, 200, 0.8);
    }
    
    /* REGEN LINK */
    .regen {
      margin-top: 24px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.3);
      text-align: center;
      letter-spacing: 1px;
    }
    
    .regen a {
      color: rgba(0, 255, 200, 0.6);
      cursor: pointer;
      text-decoration: underline;
      transition: color 0.3s ease;
      font-weight: 600;
    }
    
    .regen a:hover {
      color: rgba(0, 255, 200, 0.95);
    }
    
    /* RESPONSIVE */
    @media (max-width: 480px) {
      .card {
        padding: 36px 24px;
      }
      
      .logo h1 {
        font-size: 2rem;
        letter-spacing: 3px;
      }
      
      .code-value {
        font-size: 2rem;
        letter-spacing: 6px;
      }
    }
  </style>
</head>
<body>
<div class="grid"></div>
<div class="container">
  <div class="card">
    <div class="header">
      <div class="logo">
        <h1>ALMEERV5</h1>
        <p>WhatsApp Bot Pairing Portal</p>
      </div>
    </div>
    <div class="divider"></div>
    
    <div id="app"><!-- Content will be injected here --></div>
    
    <div class="instructions">
      <div class="instructions-title">📱 HOW TO PAIR</div>
      1. Open WhatsApp on your phone<br/>
      2. Go to <b>Settings → Linked Devices</b><br/>
      3. Tap <b>Link a Device</b> → <b>Link with Phone Number</b><br/>
      4. Enter the code below within <b>60 seconds</b><br/>
      5. Verify on WhatsApp and you're done!
    </div>
  </div>
</div>

<script>
  let pollTimer = null;
  
  function showLoading(msg) {
    document.getElementById('app').innerHTML =
      '<div class="loading-box">' +
      '<div class="spinner"></div>' +
      '<div class="loading-text">' + msg + '</div>' +
      '</div>';
  }
  
  function showCode(code) {
    const display = code.toString().replace(/([0-9]{4})/g, '$1-').replace(/-$/, '');
    document.getElementById('app').innerHTML =
      '<div class="code-section">' +
      '<div class="code-label">Your Pairing Code</div>' +
      '<div class="code-value" id="codeVal">' + display + '</div>' +
      '<button class="copy-btn" onclick="copyCode()">📋 Copy Code</button>' +
      '<div style="color: rgba(255, 255, 255, 0.25); font-size: 0.75rem; margin-top: 12px; letter-spacing: 1px;">' +
      'Code expires in 60 seconds' +
      '</div>' +
      '</div>' +
      '<div class="regen">Code expired? <a onclick="requestNew()">Get a new code</a></div>';
  }
  
  function showForm() {
    document.getElementById('app').innerHTML =
      '<div class="form-section">' +
      '<label for="ph">WhatsApp Phone Number</label>' +
      '<input id="ph" type="tel" placeholder="e.g., 254712345678" autocomplete="off"/>' +
      '<p class="hint">Include country code, no + or spaces</p>' +
      '<button class="gen-btn" id="gb" onclick="submitForm()">⚡ Generate Code</button>' +
      '<div class="err" id="errBox"></div>' +
      '</div>';
  }
  
  function showError(msg) {
    document.getElementById('app').innerHTML =
      '<div class="err show" style="display: block;">' + msg + '</div>' +
      '<div class="regen" style="margin-top: 20px;"><a onclick="requestNew()">Try again</a></div>';
  }
  
  async function submitForm() {
    const ph = document.getElementById('ph')?.value?.trim()?.replace(/[^0-9]/g, '');
    const btn = document.getElementById('gb');
    const err = document.getElementById('errBox');
    
    if (!ph || ph.length < 7) {
      err.textContent = '❌ Please enter a valid phone number with country code';
      err.className = 'err show';
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Requesting...';
    err.className = 'err';
    
    try {
      const r = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: ph }),
      });
      const d = await r.json();
      if (d.code) {
        showCode(d.code);
      } else {
        throw new Error(d.error || 'Failed to generate code');
      }
    } catch(e) {
      err.textContent = '❌ ' + (e.message || 'Error generating code');
      err.className = 'err show';
      btn.disabled = false;
      btn.textContent = '⚡ Generate Code';
    }
  }
  
  async function requestNew() {
    showLoading('⚡ Generating new code...');
    try {
      const r = await fetch('/api/regen', { method: 'POST' });
      const d = await r.json();
      if (d.code) {
        showCode(d.code);
      } else {
        showLoading('⏳ Waiting for code...');
        pollCode();
      }
    } catch {
      showLoading('⏳ Waiting for code...');
      pollCode();
    }
  }
  
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
  
  function copyCode() {
    const v = document.getElementById('codeVal')?.textContent?.trim();
    if (!v) return;
    navigator.clipboard.writeText(v).then(() => {
      const b = document.querySelector('.copy-btn');
      const orig = b.textContent;
      b.textContent = '✅ Copied!';
      setTimeout(() => b.textContent = orig, 2000);
    }).catch(() => {
      alert('Could not copy: ' + v);
    });
  }
  
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
  
  window.onload = async () => {
    try {
      const r = await fetch('/api/code');
      const d = await r.json();
      if (d.code) {
        showCode(d.code);
      } else if (d.error) {
        showError(d.error);
      } else if (d.noOwner) {
        showForm();
      } else {
        showLoading('⚡ Generating pairing code...');
        pollCode();
      }
    } catch {
      showLoading('🔗 Connecting...');
      pollCode();
    }
  };
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────
//  EXPRESS SERVER
// ─────────────────────────────────────────────────────────────────────────
export function startPairingServer(getSock, port) {
  const app = express();
  app.use(express.json());

  // Main page
  app.get('/', (_req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(buildPage());
  });

  // API: Get current code
  app.get('/api/code', (_req, res) => {
    if (_storedCode) {
      return res.json({ code: formatCode(_storedCode) });
    }
    if (_codeError) {
      return res.json({ error: _codeError });
    }
    
    const owner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    if (!owner) {
      return res.json({ noOwner: true });
    }
    
    return res.json({ code: null });
  });

  // API: Generate code from phone number (manual form)
  app.post('/api/pair', async (req, res) => {
    try {
      let { number } = req.body;
      if (!number) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      number = number.replace(/[^0-9]/g, '');
      if (number.length < 7) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      if (_requestInProgress) {
        return res.status(429).json({ error: 'A code generation is already in progress' });
      }

      _requestInProgress = true;
      const sock = getSock();
      if (!sock) {
        _requestInProgress = false;
        return res.status(503).json({ error: 'Bot is not ready yet. Please try again.' });
      }

      try {
        // Wait before requesting (Baileys requirement)
        await new Promise(r => setTimeout(r, 3000));
        const code = await sock.requestPairingCode(number);
        setCode(code);
        res.json({ code: formatCode(code) });
      } finally {
        _requestInProgress = false;
      }
    } catch (err) {
      _requestInProgress = false;
      const errorMsg = err.message || 'Failed to generate pairing code';
      console.error(chalk.red(`  ❌ Pairing error: ${errorMsg}`));
      res.status(500).json({ error: errorMsg });
    }
  });

  // API: Regenerate code
  app.post('/api/regen', async (req, res) => {
    try {
      const owner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
      if (!owner) {
        return res.status(400).json({ 
          error: 'OWNER_NUMBER not configured. Please use the form to enter your number.' 
        });
      }

      if (_requestInProgress) {
        return res.status(429).json({ error: 'A code generation is already in progress' });
      }

      _requestInProgress = true;
      const sock = getSock();
      if (!sock) {
        _requestInProgress = false;
        return res.status(503).json({ error: 'Bot is not ready yet' });
      }

      try {
        _storedCode = null;
        await new Promise(r => setTimeout(r, 1000));
        const code = await sock.requestPairingCode(owner);
        setCode(code);
        res.json({ code: formatCode(code) });
      } finally {
        _requestInProgress = false;
      }
    } catch (err) {
      _requestInProgress = false;
      const errorMsg = err.message || 'Failed to regenerate pairing code';
      console.error(chalk.red(`  ❌ Regen error: ${errorMsg}`));
      res.status(500).json({ error: errorMsg });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', codeActive: !!_storedCode });
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(chalk.cyan('\n  ╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('  ║') + chalk.yellow('  🌐 PAIRING SERVER ONLINE               ') + chalk.cyan('║'));
    console.log(chalk.cyan('  ║') + chalk.white(`  ▶  http://localhost:${port}`) + chalk.cyan('         ║'));
    console.log(chalk.cyan('  ║') + chalk.green('  ✓ Open URL to pair your device         ') + chalk.cyan('║'));
    console.log(chalk.cyan('  ╚════════════════════════════════════════╝\n'));
  });

  return server;
}
