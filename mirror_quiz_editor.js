const DEFAULT_JSON_PATH = 'mirror_quiz_content.json';
const STORAGE_KEY = 'mirror-quiz-editor-draft-v1';

const tabs = document.querySelectorAll('.tab');
const tabPanels = {
  meta: document.getElementById('metaTab'),
  questions: document.getElementById('questionsTab'),
  results: document.getElementById('resultsTab')
};

let content = null;
let currentQuestionIndex = 0;
let currentResultKey = null;

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

async function boot() {
  const draft = localStorage.getItem(STORAGE_KEY);
  if (draft) {
    content = JSON.parse(draft);
  } else {
    const response = await fetch(DEFAULT_JSON_PATH);
    content = await response.json();
  }
  initTabs();
  initMeta();
  initQuestions();
  initResults();
  initButtons();
  refreshAll();
}

function initTabs() {
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(other => other.classList.remove('active'));
      btn.classList.add('active');
      Object.values(tabPanels).forEach(panel => panel.hidden = true);
      tabPanels[btn.dataset.tab].hidden = false;
    });
  });
}

function initMeta() {
  const bind = (id, key) => {
    const el = document.getElementById(id);
    el.value = content.meta[key] || '';
    el.addEventListener('input', () => {
      content.meta[key] = el.value;
      refreshPreviewHeader();
      refreshJsonPreview();
    });
  };
  bind('metaTitle', 'title');
  bind('metaEyebrow', 'eyebrow');
  bind('metaHero', 'heroCopy');
  bind('metaStartTitle', 'startTitle');
  bind('metaStartCopy', 'startCopy');
}

function initQuestions() {
  const select = document.getElementById('questionSelect');
  select.innerHTML = '';
  content.questions.forEach((q, idx) => {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = `${q.id}. ${q.prompt.slice(0, 48)}`;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    currentQuestionIndex = Number(select.value);
    renderQuestionEditor();
    refreshQuestionPreview();
    refreshJsonPreview();
  });
  currentQuestionIndex = 0;
  renderQuestionEditor();
}

function renderQuestionEditor() {
  const q = content.questions[currentQuestionIndex];
  document.getElementById('questionPrompt').value = q.prompt;
  document.getElementById('questionPrompt').oninput = (e) => {
    q.prompt = e.target.value;
    syncQuestionSelectLabel();
    refreshQuestionPreview();
    refreshJsonPreview();
  };

  const container = document.getElementById('answersEditor');
  container.innerHTML = '';

  q.answers.forEach((answer, idx) => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.innerHTML = `
      <div class="answer-head">
        <strong>Answer ${answer.id}</strong>
        <span class="tiny">Hunger: ${answer.hunger || 0}</span>
      </div>
      <label>Answer text <textarea data-field="text">${escapeHtml(answer.text)}</textarea></label>
      <div class="row">
        <label>Family scores JSON <textarea data-field="fam">${escapeHtml(JSON.stringify(answer.fam || {}, null, 2))}</textarea></label>
        <label>Archetype scores JSON <textarea data-field="arch">${escapeHtml(JSON.stringify(answer.arch || {}, null, 2))}</textarea></label>
      </div>
      <label>Tokens JSON <textarea data-field="tokens">${escapeHtml(JSON.stringify(answer.tokens || {}, null, 2))}</textarea></label>
    `;
    container.appendChild(card);

    card.querySelectorAll('textarea').forEach(area => {
      area.addEventListener('input', () => {
        const field = area.dataset.field;
        try {
          if (field === 'text') {
            answer.text = area.value;
          } else {
            answer[field] = JSON.parse(area.value || '{}');
          }
          area.style.borderColor = 'rgba(255,255,255,.08)';
          refreshQuestionPreview();
          refreshJsonPreview();
        } catch {
          area.style.borderColor = '#ff8181';
        }
      });
    });
  });
}

function syncQuestionSelectLabel() {
  const select = document.getElementById('questionSelect');
  const q = content.questions[currentQuestionIndex];
  select.options[currentQuestionIndex].textContent = `${q.id}. ${q.prompt.slice(0, 48)}`;
}

function initResults() {
  const select = document.getElementById('resultSelect');
  const keys = Object.keys(content.resultCards);
  currentResultKey = keys[0];
  select.innerHTML = '';
  keys.forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${key} · ${content.resultCards[key].title}`;
    select.appendChild(option);
  });
  select.value = currentResultKey;
  select.addEventListener('change', () => {
    currentResultKey = select.value;
    renderResultEditor();
    refreshResultPreview();
    refreshJsonPreview();
  });
  renderResultEditor();
}

function renderResultEditor() {
  const card = content.resultCards[currentResultKey];
  const title = document.getElementById('resultTitle');
  const subtitle = document.getElementById('resultSubtitle');
  const blurb = document.getElementById('resultBlurb');
  const hints = document.getElementById('resultHints');

  title.value = card.title || '';
  subtitle.value = card.subtitle || '';
  blurb.value = card.testBlurb || '';
  hints.value = (card.imageHints || []).join(', ');

  title.oninput = () => { card.title = title.value; syncResultSelectLabel(); refreshResultPreview(); refreshJsonPreview(); };
  subtitle.oninput = () => { card.subtitle = subtitle.value; refreshResultPreview(); refreshJsonPreview(); };
  blurb.oninput = () => { card.testBlurb = blurb.value; refreshResultPreview(); refreshJsonPreview(); };
  hints.oninput = () => {
    card.imageHints = hints.value.split(',').map(x => x.trim()).filter(Boolean);
    refreshResultPreview();
    refreshJsonPreview();
  };
}

function syncResultSelectLabel() {
  const select = document.getElementById('resultSelect');
  const card = content.resultCards[currentResultKey];
  select.querySelector(`option[value="${currentResultKey}"]`).textContent = `${currentResultKey} · ${card.title}`;
}

function refreshPreviewHeader() {
  document.getElementById('previewEyebrow').textContent = content.meta.eyebrow || '';
  document.getElementById('previewTitle').textContent = content.meta.title || '';
  document.getElementById('previewHero').textContent = content.meta.heroCopy || '';
}

function refreshQuestionPreview() {
  const q = content.questions[currentQuestionIndex];
  document.getElementById('previewQuestionPrompt').textContent = q.prompt;
  const container = document.getElementById('previewAnswers');
  container.innerHTML = '';
  q.answers.forEach(answer => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.innerHTML = `<strong>${answer.id}</strong><div>${escapeHtml(answer.text)}</div><div class="tiny">fam ${escapeHtml(JSON.stringify(answer.fam || {}))} · arch ${escapeHtml(JSON.stringify(answer.arch || {}))}</div>`;
    container.appendChild(card);
  });
}

function refreshResultPreview() {
  const card = content.resultCards[currentResultKey];
  document.getElementById('previewResultTitle').textContent = card.title || '';
  document.getElementById('previewResultSubtitle').textContent = card.subtitle || '';
  document.getElementById('previewResultBlurb').textContent = card.testBlurb || '';
  const hints = document.getElementById('previewHints');
  hints.innerHTML = '';
  (card.imageHints || []).forEach(hint => {
    const div = document.createElement('div');
    div.className = 'look-card';
    div.innerHTML = `<strong>Hint</strong><span>${escapeHtml(hint)}</span>`;
    hints.appendChild(div);
  });
}

function refreshJsonPreview() {
  document.getElementById('jsonPreview').textContent = JSON.stringify(content, null, 2);
}

function refreshAll() {
  refreshPreviewHeader();
  refreshQuestionPreview();
  refreshResultPreview();
  refreshJsonPreview();
}

function initButtons() {
  document.getElementById('saveDraft').addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    alert('Draft saved in this browser.');
  });

  document.getElementById('downloadJson').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mirror_quiz_content.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('resetDraft').addEventListener('click', async () => {
    if (!confirm('Throw away the saved browser draft?')) return;
    localStorage.removeItem(STORAGE_KEY);
    const response = await fetch(DEFAULT_JSON_PATH);
    content = await response.json();
    initMeta();
    initQuestions();
    initResults();
    refreshAll();
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

boot();
