// ============ PROVIDERS ============
const PROVIDERS = {
  groq: {
    url:'https://api.groq.com/openai/v1/chat/completions',
    models:[
      'deepseek-r1-distill-llama-70b',
      'deepseek-r1-distill-qwen-32b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.2-90b-vision-preview',
      'llama-3.2-11b-vision-preview',
      'mixtral-8x7b-32768'
    ]
  },
  openai: {
    url:'https://api.openai.com/v1/chat/completions',
    models:['gpt-4o-mini','gpt-4o','o1-mini','gpt-3.5-turbo']
  },
  ollama: {
    url:'http://localhost:11434/v1/chat/completions',
    models:['deepseek-r1:7b','deepseek-r1:14b','llama3.2','llava','qwen2.5']
  },
  custom: { url:'', models:[] }
};

let CONFIG = {
  provider:'groq',
  url:PROVIDERS.groq.url,
  key:'',
  model:PROVIDERS.groq.models[0],
  systemPrompt:'Bạn là Zamzzz AI - trợ lý thông minh, thân thiện, trả lời chính xác bằng tiếng Việt. Dùng markdown để định dạng câu trả lời.',
  temperature:0.7,
  useMemory:true,
  showThinking:true,
  forceThinking:false
};

try {
  const saved = JSON.parse(localStorage.getItem('zamzzz_config') || '{}');
  CONFIG = { ...CONFIG, ...saved };
} catch {}

// ============ STATE ============
let conversations = JSON.parse(localStorage.getItem('zamzzz_convs') || '[]');
let currentConvId = null;
let isLoading = false;
let speakingEnabled = false;
let pendingFile = null;
let memory = JSON.parse(localStorage.getItem('zamzzz_memory') || '{}');

// ============ DOM ============
const $ = id => document.getElementById(id);
const chat = $('chat'), input = $('userInput'), sendBtn = $('sendBtn');
const clearBtn = $('clearBtn'), newChatBtn = $('newChatBtn'), convList = $('convList');
const themeBtn = $('themeBtn'), settingsBtn = $('settingsBtn'), exportBtn = $('exportBtn');
const settingsModal = $('settingsModal'), saveSettings = $('saveSettings'), cancelSettings = $('cancelSettings');
const providerSelect = $('providerSelect'), apiUrl = $('apiUrl'), apiKey = $('apiKey');
const modelName = $('modelName'), modelCustom = $('modelCustom'), systemPrompt = $('systemPrompt');
const temperature = $('temperature'), tempVal = $('tempVal');
const speakToggle = $('speakToggle'), micBtn = $('micBtn'), uploadBtn = $('uploadBtn'), fileInput = $('fileInput');
const filePreview = $('filePreview'), menuBtn = $('menuBtn'), sidebar = $('sidebar'), modelLabel = $('modelLabel');

// ============ STORAGE ============
const saveConvs = () => localStorage.setItem('zamzzz_convs', JSON.stringify(conversations));
const saveConfig = () => localStorage.setItem('zamzzz_config', JSON.stringify(CONFIG));
const saveMemory = () => localStorage.setItem('zamzzz_memory', JSON.stringify(memory));

// ============ MARKDOWN ============
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const id = 'code-' + Math.random().toString(36).slice(2,9);
      return `<div class="code-block"><div class="code-header"><span>${lang||'code'}</span><button class="copy-btn" onclick="copyCode('${id}')">📋 Copy</button></div><pre id="${id}"><code>${escapeHtml(code.trim())}</code></pre></div>`;
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n/g, '<br>');
  return html;
}

window.copyCode = (id) => {
  const code = document.getElementById(id).innerText;
  navigator.clipboard.writeText(code);
  event.target.textContent = '✅ Đã copy';
  setTimeout(() => event.target.textContent = '📋 Copy', 1500);
};

function escapeHtml(s) { return (s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'