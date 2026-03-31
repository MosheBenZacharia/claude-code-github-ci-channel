interface SetupPageData {
  githubLogin: string
  webhookUrl: string
  webhookSecret: string
  clientToken: string | null
  hasClientToken: boolean
}

const copyIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`

const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

export function setupPage(data: SetupPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub CI Channel — Setup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ECEAE4;
      --text: #1c1e21;
      --text-muted: #656d76;
      --card-bg: #ffffff;
      --card-border: #d8d8d4;
      --card-shadow: rgba(0,0,0,0.04);
      --input-bg: #f6f5f2;
      --input-border: #d8d8d4;
      --focus-color: #0969da;
      --focus-shadow: rgba(9,105,218,0.15);
      --btn-bg: #f6f5f2;
      --btn-hover: #e8e6e1;
      --btn-border: #d8d8d4;
      --copied-bg: #2da44e;
      --danger-color: #cf222e;
      --danger-border: #cf222e44;
      --danger-hover: #cf222e0d;
      --alert-bg: #dafbe1;
      --alert-border: #2da44e;
      --alert-text: #116329;
      --warn-bg: #fff8c5;
      --warn-border: #d4a72c;
      --warn-text: #7a4e05;
      --accent: #0969da;
      --muted-token: #8b949e;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --text: #e6edf3;
        --text-muted: #8b949e;
        --card-bg: #161b22;
        --card-border: #30363d;
        --card-shadow: rgba(0,0,0,0.2);
        --input-bg: #0d1117;
        --input-border: #30363d;
        --focus-color: #58a6ff;
        --focus-shadow: rgba(88,166,255,0.15);
        --btn-bg: #21262d;
        --btn-hover: #30363d;
        --btn-border: #30363d;
        --copied-bg: #238636;
        --danger-color: #f85149;
        --danger-border: #f8514966;
        --danger-hover: #f8514915;
        --alert-bg: #0e2a1f;
        --alert-border: #238636;
        --alert-text: #3fb950;
        --warn-bg: #2a1e0e;
        --warn-border: #d29922;
        --warn-text: #d29922;
        --accent: #58a6ff;
        --muted-token: #484f58;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 48px 16px;
    }

    .container {
      max-width: 640px;
      width: 100%;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 32px;
    }

    .header-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      object-fit: cover;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }

    .header-text h1 {
      font-size: 24px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 2px;
    }

    .header-text p {
      color: var(--text-muted);
      font-size: 14px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: 0 1px 2px var(--card-shadow);
    }

    .card h2 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }

    .field {
      margin-bottom: 16px;
    }

    .field:last-child {
      margin-bottom: 0;
    }

    .field label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .field-row {
      display: flex;
      gap: 8px;
    }

    .field-row input {
      flex: 1;
    }

    input[type="text"], .secret-display {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 8px;
      padding: 10px 12px;
      color: var(--text);
      font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      outline: none;
    }

    input[type="text"]:focus {
      border-color: var(--focus-color);
      box-shadow: 0 0 0 3px var(--focus-shadow);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--btn-border);
      background: var(--btn-bg);
      color: var(--text);
      transition: background 0.15s;
      white-space: nowrap;
    }

    .btn:hover {
      background: var(--btn-hover);
    }

    .btn-copy {
      min-width: 72px;
    }

    .btn-copy.copied {
      background: var(--copied-bg);
      border-color: var(--copied-bg);
      color: #ffffff;
    }

    .btn-danger {
      border-color: var(--danger-border);
      color: var(--danger-color);
    }

    .btn-danger:hover {
      background: var(--danger-hover);
    }

    .btn[title] {
      position: relative;
    }

    .alert {
      background: var(--alert-bg);
      border: 1px solid var(--alert-border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--alert-text);
    }

    .alert strong {
      display: block;
      margin-bottom: 4px;
    }

    .steps {
      margin-bottom: 16px;
    }

    .steps h2 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    .step {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .step-num {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      background: var(--btn-bg);
      border: 1px solid var(--card-border);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
    }

    .step-content {
      padding-top: 4px;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
    }

    .step-content code {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 1px 6px;
      font-family: "SF Mono", "Fira Code", Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .code-block {
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 8px;
      margin-top: 8px;
      overflow: hidden;
    }

    .code-line {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      gap: 8px;
      border-bottom: 1px solid var(--input-border);
    }

    .code-line:last-child {
      border-bottom: none;
    }

    .code-line code {
      flex: 1;
      font-family: "SF Mono", "Fira Code", Menlo, Consolas, monospace;
      font-size: 13px;
      color: var(--text);
      word-break: break-all;
      white-space: normal;
      background: none;
      border: none;
      padding: 0;
    }

    .code-line .copy-icon {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-muted);
      transition: background 0.15s, color 0.15s;
      padding: 0;
    }

    .copy-icon:hover {
      background: var(--btn-hover);
      color: var(--text);
    }

    .copy-icon.copied {
      color: var(--copied-bg);
    }

    .token-warning {
      background: var(--warn-bg);
      border: 1px solid var(--warn-border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      color: var(--warn-text);
    }

    .hidden-token {
      color: var(--muted-token);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/icon.jpg" alt="GitHub CI Channel" class="header-icon" />
      <div class="header-text">
        <h1>GitHub CI Channel</h1>
        <p>Signed in as <strong>${esc(data.githubLogin)}</strong></p>
      </div>
    </div>

    ${data.clientToken ? `
    <div class="alert">
      <strong>Your client token has been generated.</strong>
      Copy it now — it won't be shown again.
    </div>
    ` : ''}

    ${!data.clientToken && !data.hasClientToken ? `
    <div class="token-warning">
      No active client token. Generate one below to connect Claude Code.
    </div>
    ` : ''}

    <div class="card">
      <h2>Your Credentials</h2>

      <div class="field">
        <label>Webhook URL</label>
        <div class="field-row">
          <input type="text" readonly value="${esc(data.webhookUrl)}" id="webhookUrl" />
          <button class="btn btn-copy" onclick="copy('webhookUrl')">Copy</button>
        </div>
      </div>

      <div class="field">
        <label>Webhook Secret</label>
        <div class="field-row">
          <input type="text" readonly value="${esc(data.webhookSecret)}" id="webhookSecret" />
          <button class="btn btn-copy" onclick="copy('webhookSecret')">Copy</button>
          <button class="btn btn-danger" onclick="rotateWebhookSecret()" title="Rotate if compromised — you'll need to update your GitHub webhook settings">Rotate</button>
        </div>
      </div>

      <div class="field">
        <label>Client Token</label>
        ${data.clientToken ? `
        <div class="field-row">
          <input type="text" readonly value="${esc(data.clientToken)}" id="clientToken" />
          <button class="btn btn-copy" onclick="copy('clientToken')">Copy</button>
          <button class="btn btn-danger" onclick="rotateClientToken()" title="Revoke current token and generate a new one — disconnects active sessions">Rotate</button>
        </div>
        ` : `
        <div class="field-row">
          <input type="text" readonly value="" placeholder="${data.hasClientToken ? 'Token hidden — rotate to reveal a new one' : 'No token — generate one below'}" id="clientToken" class="hidden-token" />
          <button class="btn btn-copy" disabled>Copy</button>
          <button class="btn btn-danger" onclick="rotateClientToken()" title="${data.hasClientToken ? 'Revoke current token and generate a new one — disconnects active sessions' : 'Generate your first client token'}">${data.hasClientToken ? 'Rotate' : 'Generate'}</button>
        </div>
        `}
      </div>
    </div>

    <div class="card steps">
      <h2>Setup Instructions</h2>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          In your GitHub repo, go to <strong>Settings &rarr; Webhooks &rarr; Add webhook</strong>.<br/>
          Set <strong>Payload URL</strong> to your Webhook URL above.<br/>
          Set <strong>Content type</strong> to <code>application/json</code>.<br/>
          Set <strong>Secret</strong> to your Webhook Secret above.<br/>
          Under events, select <strong>"Let me select individual events"</strong> and check <strong>"Check runs"</strong>.
        </div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          In Claude Code, add the marketplace and install the plugin:
          <div class="code-block">
            <div class="code-line"><code>/plugin marketplace add MosheBenZacharia/claude-code-github-ci-channel</code><button class="copy-icon" onclick="copyCmd(this)" title="Copy">${copyIcon}</button></div>
            <div class="code-line"><code>/plugin install github-ci@github-ci-channel</code><button class="copy-icon" onclick="copyCmd(this)" title="Copy">${copyIcon}</button></div>
            <div class="code-line"><code>/reload-plugins</code><button class="copy-icon" onclick="copyCmd(this)" title="Copy">${copyIcon}</button></div>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          Configure the plugin with your client token:
          <div class="code-block">
            <div class="code-line"><code>/github-ci:configure &lt;your-client-token&gt;</code><button class="copy-icon" onclick="copyCmd(this)" title="Copy">${copyIcon}</button></div>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          Restart Claude Code with channels enabled:
          <div class="code-block">
            <div class="code-line"><code>claude --dangerously-load-development-channels --channels plugin:github-ci@github-ci-channel</code><button class="copy-icon" onclick="copyCmd(this)" title="Copy">${copyIcon}</button></div>
          </div>
          Push a commit or open a PR. When a CI check fails on your current repo and commit, Claude Code will be notified.
        </div>
      </div>
    </div>
  </div>

  <script>
    function copyCmd(btn) {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;
      navigator.clipboard.writeText(code.textContent);
      btn.innerHTML = '${checkIcon}';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '${copyIcon}';
        btn.classList.remove('copied');
      }, 2000);
    }

    function copy(id) {
      const input = document.getElementById(id);
      if (!input || !input.value) return;
      navigator.clipboard.writeText(input.value);
      const btn = input.parentElement.querySelector('.btn-copy');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    }

    async function rotateClientToken() {
      if (!confirm('This will revoke all existing client tokens and disconnect any active sessions. Continue?')) return;
      const res = await fetch('/me/rotate-client-token', { method: 'POST' });
      const data = await res.json();
      if (data.clientToken) {
        const input = document.getElementById('clientToken');
        input.value = data.clientToken;
        input.placeholder = '';
        input.classList.remove('hidden-token');
        const copyBtn = input.parentElement.querySelector('.btn-copy');
        if (copyBtn) {
          copyBtn.disabled = false;
        }
      }
    }

    async function rotateWebhookSecret() {
      if (!confirm('This will invalidate the current webhook secret. You will need to update the secret in your GitHub webhook settings. Continue?')) return;
      const res = await fetch('/me/rotate-webhook-secret', { method: 'POST' });
      const data = await res.json();
      if (data.webhookSecret) {
        document.getElementById('webhookSecret').value = data.webhookSecret;
      }
    }
  </script>
</body>
</html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
