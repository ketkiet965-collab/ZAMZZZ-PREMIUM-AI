// ============ PRESET ============
const PRESETS = {
  groq:   { url:'https://api.groq.com/openai/v1/chat/completions', model:'llama-3.3-70b-versatile' },
  openai: { url:'https://api.openai.com/v1/chat/completions',       model:'gpt-4o-mini' },
  ollama: { url:'http://localhost:11434/v1/chat/completions',       model:'llama3.2' },
  custom: { url:'',                                                  model:'' }
};

// ============ CONFIG ============
let CONFIG = {
  provider:'groq',
  url:PRESETS.groq.url,
  key:'',
  model:PRESETS.groq.model,
  sysPrompt:'Bạn là ZAMZZZ - trợ lý AI thông minh, thân thiện, trả lời bằng tiếng Việt, dùng markdown.'
};

// Load config từ localStorage
try {
  const saved = JSON.parse(localStorage.getItem('zamzzz_config') || '{}');
  CONFIG = Object.assign(CONFIG, saved);
} catch(e) { console.warn('Config load error:', e); }

// ============ STATE ============
let messages = [{ role:'system', content:CONFIG.sysPrompt }];
let isLoading = false;
let pendingFile = null;

// ============ DOM ============
const $ = id => document.getElementById(id);
const chat = $('chat');
const input = $('userInput');
const sendBtn = $('sendBtn');
const settingsModal = $('settingsModal');

// ============ HELPERS ============
function escapeHtml(s) {
  return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const id = 'c' + Math.random().toString(36).slice(2,9);
      return `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode('${id}')">📋 Copy</button></div><pre id="${id}"><code>${escapeHtml(code.trim())}</code></pre></div>`;
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

window.copyCode = (id) => {
  const code = document.getElementById(id).innerText;
  navigator.clipboard.writeText(code);
  event.target.textContent = '✅ Đã copy';
  setTimeout(() => event.target.textContent = '📋 Copy', 1500);
};

function scrollBottom() { chat.scrollTop = chat.scrollHeight; }

function addBubble(text, sender) {
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;
  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = sender === 'user' ? '🫵' : '😈';
  const bb = document.createElement('div');
  bb.className = 'bubble';
  if (sender === 'bot') bb.innerHTML = renderMarkdown(text);
  else bb.textContent = text;
  msg.append(av, bb);
  chat.appendChild(msg);
  scrollBottom();
  return bb;
}

// ============ SETTINGS MODAL ============
function openSettings() {
  $('provider').value = CONFIG.provider;
  $('apiUrl').value = CONFIG.url;
  $('apiKey').value = CONFIG.key;
  $('model').value = CONFIG.model;
  $('sysPrompt').value = CONFIG.sysPrompt;
  settingsModal.classList.add('show');
}

function closeSettings() {
  settingsModal.classList.remove('show');
}

function saveSettingsFn() {
  CONFIG.provider = $('provider').value;
  CONFIG.url = $('apiUrl').value.trim();
  CONFIG.key = $('apiKey').value.trim();
  CONFIG.model = $('model').value.trim();
  CONFIG.sysPrompt = $('sysPrompt').value;

  localStorage.setItem('zamzzz_config', JSON.stringify(CONFIG));

  messages[0] = { role:'system', content:CONFIG.sysPrompt };
  updateModelLabel();
  closeSettings();
  alert('✅ Đã lưu cài đặt!');
}

function updateModelLabel() {
  const label = $('modelLabel');
  if (!CONFIG.key && CONFIG.provider !== 'ollama') {
    label.textContent = '⚠️ Chưa nhập API key';
  } else {
    label.textContent = `${CONFIG.provider} / ${CONFIG.model}`;
  }
}

// Provider đổi → auto-fill URL + model
$('provider').addEventListener('change', () => {
  const p = PRESETS[$('provider').value];
  $('apiUrl').value = p.url;
  $('model').value = p.model;
});

// ============ API CALL ============
async function callAI(userText) {
  messages.push({ role:'user', content:userText });

  if (!CONFIG.key && CONFIG.provider !== 'ollama') {
    return '⚠️ Bạn chưa nhập API key! Bấm **⚙️** góc phải trên để nhập key Groq (miễn phí tại console.groq.com/keys).';
  }

  const headers = { 'Content-Type':'application/json' };
  if (CONFIG.key) headers['Authorization'] = 'Bearer ' + CONFIG.key;

  const res = await fetch(CONFIG.url, {
    method:'POST',
    headers,
    body: JSON.stringify({
      model: CONFIG.model,
      messages: messages,
      temperature: 0.7,
      stream: false
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(không có phản hồi)';
  messages.push({ role:'assistant', content:reply });
  return reply;
}

// ============ SEND ============
async function handleSend() {
  const text = input.value.trim();
  if ((!text && !pendingFile) || isLoading) return;

  let finalText = text;
  if (pendingFile) {
    finalText = `[File: ${pendingFile.name}]\n\`\`\`\n${pendingFile.content}\n\`\`\`\n\n${text}`;
    pendingFile = null;
    $('filePreview').classList.remove('show');
    $('filePreview').textContent = '';
  }

  addBubble(finalText, 'user');
  input.value = '';
  input.style.height = 'auto';
  isLoading = true;
  sendBtn.disabled = true;

  // Typing indicator
  const msgEl = document.createElement('div');
  msgEl.className = 'message bot';
  msgEl.id = 'typingMsg';
  msgEl.innerHTML = `<div class="avatar">😈</div><div class="bubble typing"><span></span><span></span><span></span></div>`;
  chat.appendChild(msgEl);
  scrollBottom();

  try {
    const reply = await callAI(finalText);
    document.getElementById('typingMsg')?.remove();
    addBubble(reply, 'bot');
  } catch (err) {
    document.getElementById('typingMsg')?.remove();
    addBubble('❌ Lỗi: ' + err.message, 'bot');
    console.error(err);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// ============ FILE UPLOAD ============
function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    let content = e.target.result;
    if (content.length > 30000) content = content.slice(0, 30000) + '\n...[đã cắt bớt]';
    pendingFile = { name:file.name, content };
    const fp = $('filePreview');
    fp.textContent = `📎 Đã đính kèm: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    fp.classList.add('show');
  };
  reader.readAsText(file);
}

// ============ EVENTS ============
$('settingsBtn').onclick = openSettings;
$('cancelBtn').onclick = closeSettings;
$('saveBtn').onclick = saveSettingsFn;

// Click ngoài modal để đóng
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

$('clearBtn').onclick = () => {
  if (!confirm('Xóa toàn bộ chat?')) return;
  messages = [{ role:'system', content:CONFIG.sysPrompt }];
  chat.innerHTML = '';
  addBubble('Đã xóa! Bắt đầu lại nhé! 😈', 'bot');
};

sendBtn.onclick = handleSend;

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

$('uploadBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => handleFile(e.target.files[0]);

// ============ INIT ============
updateModelLabel();
