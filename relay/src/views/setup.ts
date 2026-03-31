interface SetupPageData {
  githubLogin: string
  webhookUrl: string
  webhookSecret: string
  clientToken: string | null
  hasClientToken: boolean
}

export function setupPage(data: SetupPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GitHub CI Channel — Setup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #e6edf3;
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
      margin-bottom: 32px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .header p {
      color: #8b949e;
      font-size: 14px;
    }

    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .card h2 {
      font-size: 14px;
      font-weight: 600;
      color: #8b949e;
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
      color: #8b949e;
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
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 10px 12px;
      color: #e6edf3;
      font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
      font-size: 13px;
      outline: none;
    }

    input[type="text"]:focus {
      border-color: #58a6ff;
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
      border: 1px solid #30363d;
      background: #21262d;
      color: #e6edf3;
      transition: background 0.15s;
      white-space: nowrap;
    }

    .btn:hover {
      background: #30363d;
    }

    .btn-copy {
      min-width: 72px;
    }

    .btn-copy.copied {
      background: #238636;
      border-color: #238636;
    }

    .btn-danger {
      border-color: #f8514966;
      color: #f85149;
    }

    .btn-danger:hover {
      background: #f8514915;
    }

    .rotate-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #30363d;
    }

    .rotate-row span {
      font-size: 12px;
      color: #8b949e;
    }

    .alert {
      background: #0e2a1f;
      border: 1px solid #238636;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #3fb950;
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
      color: #8b949e;
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
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: #58a6ff;
    }

    .step-content {
      padding-top: 4px;
      font-size: 14px;
      line-height: 1.5;
      color: #c9d1d9;
    }

    .step-content code {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 4px;
      padding: 1px 6px;
      font-family: "SF Mono", "Fira Code", Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .code-block {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px 16px;
      font-family: "SF Mono", "Fira Code", Menlo, Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
      margin-top: 8px;
      color: #c9d1d9;
    }

    .token-warning {
      background: #2a1e0e;
      border: 1px solid #d29922;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #d29922;
    }

    .hidden-token {
      color: #484f58;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>GitHub CI Channel</h1>
      <p>Signed in as <strong>${esc(data.githubLogin)}</strong></p>
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
        </div>
        <div class="rotate-row">
          <span>Rotate if compromised</span>
          <button class="btn btn-danger" onclick="rotateWebhookSecret()">Rotate Secret</button>
        </div>
      </div>

      <div class="field">
        <label>Client Token</label>
        ${data.clientToken ? `
        <div class="field-row">
          <input type="text" readonly value="${esc(data.clientToken)}" id="clientToken" />
          <button class="btn btn-copy" onclick="copy('clientToken')">Copy</button>
        </div>
        ` : `
        <div class="field-row">
          <input type="text" readonly value="" placeholder="${data.hasClientToken ? 'Token hidden — rotate to reveal a new one' : 'No token — generate one below'}" id="clientToken" class="hidden-token" />
          <button class="btn btn-copy" disabled>Copy</button>
        </div>
        `}
        <div class="rotate-row">
          <span>${data.hasClientToken ? 'Rotate to revoke old token and get a new one' : 'Generate your first client token'}</span>
          <button class="btn btn-danger" onclick="rotateClientToken()">${data.hasClientToken ? 'Rotate Token' : 'Generate Token'}</button>
        </div>
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
          In Claude Code, install the plugin and configure with your client token:
          <div class="code-block">/github-ci:configure &lt;your-client-token&gt;</div>
        </div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          Push a commit or open a PR. When a CI check fails on your current repo and commit, Claude Code will be notified automatically.
        </div>
      </div>
    </div>
  </div>

  <script>
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
