let FAMILY_GROUPS = {};
let FAMILY_NAMES = {};
let ARCHETYPE_NAMES = {};
let QUESTIONS = [];
let RESULT_CARDS = {};
let CHECKPOINT_TEXT = {};

function makeInitialState() {
  return {
    fam: Object.fromEntries(Object.keys(FAMILY_NAMES).map((key) => [key, 0])),
    arch: Object.fromEntries(Object.keys(ARCHETYPE_NAMES).map((key) => [key, 0])),
    hunger: 0,
    tokens: { hair: {}, outfit: {}, accessory: {}, expression: {}, room: {}, aura: {}, posture: {} }
  };
}

function addScore(bucket, incoming) {
  for (const [key, value] of Object.entries(incoming || {})) {
    bucket[key] = (bucket[key] || 0) + value;
  }
}

function addTokens(tokenState, incoming) {
  for (const [category, tokenList] of Object.entries(incoming || {})) {
    if (!tokenState[category]) tokenState[category] = {};
    for (const token of tokenList) {
      tokenState[category][token] = (tokenState[category][token] || 0) + 1;
    }
  }
}

function applyAnswer(state, answer) {
  addScore(state.fam, answer.fam);
  addScore(state.arch, answer.arch);
  addTokens(state.tokens, answer.tokens);
  state.hunger += answer.hunger || 0;
}

function topKey(scoreObj, allowedKeys = null) {
  const entries = Object.entries(scoreObj).filter(([k]) => !allowedKeys || allowedKeys.includes(k));
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || null;
}

function resolveFamily(state) {
  return topKey(state.fam);
}

function resolveArchetype(state) {
  const topFamily = resolveFamily(state);
  const allowed = FAMILY_GROUPS[topFamily] || [];
  const bestInFamily = topKey(state.arch, allowed);
  const kaleidoTop = topKey(state.arch, FAMILY_GROUPS.K || []);
  const sortedFamilies = Object.entries(state.fam).sort((a, b) => b[1] - a[1]);
  const topFamScore = sortedFamilies[0]?.[1] || 0;
  const kaleidoScore = state.fam.K || 0;
  const katsumiUnlock = kaleidoTop === 'KB' && state.hunger >= 4 && kaleidoScore >= topFamScore - 2;
  if (katsumiUnlock) return 'KB';
  return bestInFamily;
}

function topToken(tokenBucket) {
  const entries = Object.entries(tokenBucket || {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || null;
}

function getCheckpointLook(state, checkpoint = 15) {
  const base = {
    hair: topToken(state.tokens.hair),
    expression: topToken(state.tokens.expression),
    aura: topToken(state.tokens.aura)
  };
  if (checkpoint >= 10) {
    base.outfit = topToken(state.tokens.outfit);
    base.accessory = topToken(state.tokens.accessory);
    base.posture = topToken(state.tokens.posture);
  }
  if (checkpoint >= 15) {
    base.room = topToken(state.tokens.room);
    base.resultCode = resolveArchetype(state);
    base.resultName = ARCHETYPE_NAMES[base.resultCode];
  }
  return base;
}

function buildFinalResult(state) {
  const look = getCheckpointLook(state, 15);
  const card = RESULT_CARDS[look.resultCode] || {};
  return {
    code: look.resultCode,
    family: Object.entries(FAMILY_GROUPS).find(([_, vals]) => vals.includes(look.resultCode))?.[0] || null,
    title: card.title || ARCHETYPE_NAMES[look.resultCode] || 'Unknown Result',
    subtitle: card.subtitle || 'Test subtitle',
    blurb: card.testBlurb || 'Test blurb placeholder.',
    imageHints: card.imageHints || [],
    look
  };
}

const els = {
  heroEyebrow: document.getElementById('heroEyebrow'),
  heroTitle: document.getElementById('heroTitle'),
  heroCopy: document.getElementById('heroCopy'),
  startTitle: document.getElementById('startTitle'),
  startCopy: document.getElementById('startCopy'),
  infoList: document.getElementById('infoList'),
  sideTitle: document.getElementById('sideTitle'),
  sideCopy: document.getElementById('sideCopy'),
  startScreen: document.getElementById('startScreen'),
  quizScreen: document.getElementById('quizScreen'),
  checkpointScreen: document.getElementById('checkpointScreen'),
  resultScreen: document.getElementById('resultScreen'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  restartTop: document.getElementById('restartTop'),
  continueBtn: document.getElementById('continueBtn'),
  questionCounter: document.getElementById('questionCounter'),
  familyHint: document.getElementById('familyHint'),
  progressBar: document.getElementById('progressBar'),
  questionPrompt: document.getElementById('questionPrompt'),
  answers: document.getElementById('answers'),
  trackerLook: document.getElementById('trackerLook'),
  topFamilyNow: document.getElementById('topFamilyNow'),
  hungerNow: document.getElementById('hungerNow'),
  checkpointEyebrow: document.getElementById('checkpointEyebrow'),
  checkpointTitle: document.getElementById('checkpointTitle'),
  checkpointCopy: document.getElementById('checkpointCopy'),
  checkpointLook: document.getElementById('checkpointLook'),
  resultTitle: document.getElementById('resultTitle'),
  resultSubtitle: document.getElementById('resultSubtitle'),
  resultBlurb: document.getElementById('resultBlurb'),
  finalLook: document.getElementById('finalLook'),
  imageHints: document.getElementById('imageHints'),
  debugFamilies: document.getElementById('debugFamilies'),
  debugArchetypes: document.getElementById('debugArchetypes')
};

let state = null;
let currentQuestionIndex = 0;
let awaitingCheckpointAfter = null;

function showPanel(name) {
  ['startScreen', 'quizScreen', 'checkpointScreen', 'resultScreen'].forEach((id) => {
    const panel = els[id];
    if (!panel) return;
    panel.hidden = id !== name;
  });
}

function titleCaseFromToken(token) {
  if (!token) return 'Unformed';
  return token.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function renderLookGrid(target, look, fields) {
  target.innerHTML = '';
  fields.forEach(({ key, label }) => {
    const value = look?.[key];
    const card = document.createElement('div');
    card.className = 'look-card';
    card.innerHTML = `<strong>${label}</strong><span>${titleCaseFromToken(value)}</span>`;
    target.appendChild(card);
  });
}

function applyMeta(content) {
  els.heroEyebrow.textContent = content.meta.eyebrow;
  els.heroTitle.textContent = content.meta.title;
  document.title = content.meta.title;
  els.heroCopy.textContent = content.meta.heroCopy;
  els.startTitle.textContent = content.meta.startTitle;
  els.startCopy.textContent = content.meta.startCopy;
  els.sideTitle.textContent = content.meta.sideTitle;
  els.sideCopy.textContent = content.meta.sideCopy;
  els.infoList.innerHTML = '';
  (content.meta.infoList || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    els.infoList.appendChild(li);
  });
}

function updateSidebar() {
  const look = getCheckpointLook(state, currentQuestionIndex >= 10 ? 10 : currentQuestionIndex >= 5 ? 5 : 0);
  renderLookGrid(els.trackerLook, look, [
    { key: 'hair', label: 'Hair' },
    { key: 'expression', label: 'Expression' },
    { key: 'aura', label: 'Aura' },
    { key: 'outfit', label: 'Outfit' },
    { key: 'accessory', label: 'Accessory' },
    { key: 'room', label: 'Room' }
  ]);

  const famCode = resolveFamily(state);
  els.topFamilyNow.textContent = famCode ? `${FAMILY_NAMES[famCode]} (${famCode})` : 'Unsettled';
  els.hungerNow.textContent = String(state.hunger);
}

function renderQuestion() {
  const q = QUESTIONS[currentQuestionIndex];
  const progress = (currentQuestionIndex / QUESTIONS.length) * 100;
  els.questionCounter.textContent = `Question ${currentQuestionIndex + 1} / ${QUESTIONS.length}`;
  const famCode = resolveFamily(state);
  els.familyHint.textContent = famCode ? `Family weather: ${FAMILY_NAMES[famCode]}` : 'Family weather: unsettled';
  els.progressBar.style.width = `${progress}%`;
  els.questionPrompt.textContent = q.prompt;
  els.answers.innerHTML = '';

  q.answers.forEach((answer) => {
    const button = document.createElement('button');
    button.className = 'answer-btn';
    button.type = 'button';
    button.innerHTML = `<span class="answer-id">${answer.id}</span>${answer.text}`;
    button.addEventListener('click', () => onAnswer(answer));
    els.answers.appendChild(button);
  });
}

function onAnswer(answer) {
  applyAnswer(state, answer);
  currentQuestionIndex += 1;
  updateSidebar();

  if (currentQuestionIndex === 5 || currentQuestionIndex === 10) {
    awaitingCheckpointAfter = currentQuestionIndex;
    renderCheckpoint();
    return;
  }

  if (currentQuestionIndex >= QUESTIONS.length) {
    renderResult();
    return;
  }

  renderQuestion();
}

function renderCheckpoint() {
  const phase = awaitingCheckpointAfter === 5 ? 5 : 10;
  const look = getCheckpointLook(state, phase);
  const checkpoint = CHECKPOINT_TEXT[String(phase)] || {};
  showPanel('checkpointScreen');
  els.restartTop.hidden = false;
  els.checkpointEyebrow.textContent = checkpoint.eyebrow || 'Checkpoint';
  els.checkpointTitle.textContent = checkpoint.title || 'The mirror shifts.';
  els.checkpointCopy.textContent = checkpoint.copy || '';

  renderLookGrid(els.checkpointLook, look, phase === 5
    ? [
        { key: 'hair', label: 'Hair' },
        { key: 'expression', label: 'Expression' },
        { key: 'aura', label: 'Aura' }
      ]
    : [
        { key: 'hair', label: 'Hair' },
        { key: 'expression', label: 'Expression' },
        { key: 'aura', label: 'Aura' },
        { key: 'outfit', label: 'Outfit' },
        { key: 'accessory', label: 'Accessory' },
        { key: 'posture', label: 'Posture' }
      ]);
}

function renderResult() {
  const result = buildFinalResult(state);
  showPanel('resultScreen');
  els.restartTop.hidden = false;
  els.progressBar.style.width = '100%';
  els.resultTitle.textContent = result.title;
  els.resultSubtitle.textContent = result.subtitle;
  els.resultBlurb.textContent = result.blurb;

  renderLookGrid(els.finalLook, result.look, [
    { key: 'hair', label: 'Hair' },
    { key: 'expression', label: 'Expression' },
    { key: 'aura', label: 'Aura' },
    { key: 'outfit', label: 'Outfit' },
    { key: 'accessory', label: 'Accessory' },
    { key: 'posture', label: 'Posture' },
    { key: 'room', label: 'Room' }
  ]);

  els.imageHints.innerHTML = '';
  result.imageHints.forEach((hint) => {
    const li = document.createElement('li');
    li.textContent = hint;
    els.imageHints.appendChild(li);
  });

  els.debugFamilies.textContent = JSON.stringify(state.fam, null, 2);
  els.debugArchetypes.textContent = JSON.stringify(state.arch, null, 2);
}

function restartQuiz() {
  state = makeInitialState();
  currentQuestionIndex = 0;
  awaitingCheckpointAfter = null;
  els.restartTop.hidden = true;
  updateSidebar();
  showPanel('startScreen');
}

els.startBtn.addEventListener('click', () => {
  currentQuestionIndex = 0;
  updateSidebar();
  showPanel('quizScreen');
  els.restartTop.hidden = false;
  renderQuestion();
});

els.restartBtn.addEventListener('click', restartQuiz);
els.restartTop.addEventListener('click', restartQuiz);
els.continueBtn.addEventListener('click', () => {
  if (currentQuestionIndex >= QUESTIONS.length) {
    renderResult();
  } else {
    showPanel('quizScreen');
    renderQuestion();
  }
});

(async function init() {
  const response = await fetch('mirror_quiz_content.json');
  const content = await response.json();
  FAMILY_GROUPS = content.families.groups;
  FAMILY_NAMES = content.families.names;
  ARCHETYPE_NAMES = content.archetypeNames;
  QUESTIONS = content.questions;
  RESULT_CARDS = content.resultCards;
  CHECKPOINT_TEXT = content.checkpointText;
  applyMeta(content);
  restartQuiz();
})();
