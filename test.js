const form = document.getElementById('test-form');
const resultEl = document.getElementById('result');
const errorEl = document.getElementById('error');
const timeDisplay = document.getElementById('time-display');
const DURATION = 15 * 60;

const correctAnswers = {
  q1: 'a', q2: 'c', q3: 'd', q4: 'b', q5: 'скрипка', q6: 'c', q7: 'c', q8: 'c', q9: 'c', q10: '125',
  q11: 'ста', q12: '80', q13: 'c', q14: 'd', q15: '0,07', q16: 'никогда', q17: 'a', q18: '2', q19: 'ласка', q20: 'a',
  q21: '25', q22: '75', q23: 'a', q24: 'c', q25: '0,27', q26: 'b', q27: '150', q28: 'c', q29: 'abd', q30: 'a',
  q31: '12546', q32: 'ad', q33: '1,33', q34: 'a', q35: 'дельфин', q36: 'c', q37: '480', q38: 'c', q39: '20', q40: '1/6',
  q41: 'c', q42: '0,1', q43: 'a', q44: '50', q45: '25', q46: '3500', q47: 'be', q48: 'c', q49: '2', q50: '17'
};

const questionTypes = {};
['q1', 'q2', 'q3', 'q4', 'q6', 'q7', 'q8', 'q9', 'q13', 'q14', 'q17', 'q20', 'q23', 'q24', 'q26', 'q28', 'q30', 'q34', 'q36', 'q38', 'q41', 'q43', 'q48'].forEach(q => questionTypes[q] = 'dropdown');
['q5', 'q10', 'q11', 'q12', 'q15', 'q16', 'q18', 'q19', 'q21', 'q22', 'q25', 'q27', 'q31', 'q33', 'q35', 'q37', 'q39', 'q40', 'q42', 'q44', 'q45', 'q46', 'q49', 'q50'].forEach(q => questionTypes[q] = 'text');
['q29', 'q32', 'q47'].forEach(q => questionTypes[q] = 'checkbox');

// Redirect if no tg_id
const email = localStorage.getItem('test_email');
if (!email) window.location.href = 'index.html';

// Save form data
function saveForm() {
  const formData = new FormData(form);
  const data = {};

  for (let i = 1; i <= 50; i++) {
    const qName = `q${i}`;
    if (questionTypes[qName] === 'checkbox') {
      data[qName] = Array.from(formData.getAll(qName));
    } else {
      data[qName] = formData.get(qName) || '';
    }
  }

  localStorage.setItem('test_data', JSON.stringify(data));
}

// Restore form data
function restoreForm() {
  const saved = JSON.parse(localStorage.getItem('test_data') || '{}');

  for (let i = 1; i <= 50; i++) {
    const qName = `q${i}`;

    if (questionTypes[qName] === 'checkbox' && Array.isArray(saved[qName])) {
      saved[qName].forEach(value => {
        const checkbox = document.querySelector(`input[name="${qName}"][value="${value}"]`);
        if (checkbox) checkbox.checked = true;
      });
    } else if (['dropdown', 'text'].includes(questionTypes[qName]) && saved[qName]) {
      const input = form.elements[qName];
      if (input) input.value = saved[qName];
    }
  }
}

// Format time as MM:SS
function formatTime(seconds) {
  const min = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = (seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

// Timer logic
function startTimer() {
  if (!localStorage.getItem('start_time')) {
    localStorage.setItem('start_time', Date.now());
  }

  const checkInterval = setInterval(() => {
    const start = parseInt(localStorage.getItem('start_time'), 10);
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = Math.max(0, DURATION - elapsed);

    localStorage.setItem('remaining_time', remaining);
    timeDisplay.textContent = formatTime(remaining);

    if (remaining <= 0) {
      clearInterval(checkInterval);
      timeDisplay.parentElement.style.display = 'none';
      submitForm(true);
    }
  }, 1000);
}

// Get answers from form
function collectAnswers() {
  const formData = new FormData(form);
  const data = {};

  for (let i = 1; i <= 50; i++) {
    const qName = `q${i}`;
    if (questionTypes[qName] === 'checkbox') {
      data[qName] = Array.from(formData.getAll(qName));
    } else {
      data[qName] = formData.get(qName) || '';
    }
  }

  return data;
}

// Calculate score
function calculateScore(data) {
  let score = 0;

  for (let i = 1; i <= 50; i++) {
    const qName = `q${i}`;
    const answer = data[qName];
    const correct = correctAnswers[qName];

    if (questionTypes[qName] === 'checkbox') {
      const normalizedAnswer = Array.isArray(answer) ? [...answer].sort() : [];
      const normalizedCorrect = correct.split('').sort();

      if (JSON.stringify(normalizedAnswer) === JSON.stringify(normalizedCorrect)) {
        score++;
      }
    } else if (questionTypes[qName] === 'dropdown') {
      if (answer === correct) score++;
    } else if (questionTypes[qName] === 'text') {
      if ((answer || '').trim().toLowerCase() === correct.toString().toLowerCase()) {
        score++;
      }
    }
  }

  return score;
}

function buildFinalPayload(tgId, data, score) {
  return {
    params: {
      tg_id: Number(tgId),
      score: score,
      stage_name: 'результат кот',
      ...data
    }
  };
}

async function sendFinalRequest(tgId, data, score) {
  const payload = buildFinalPayload(tgId, data, score);

  const response = await fetch('https://webhooks.fut.ru/ft-dispather/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let responseBody = null;

  try {
    responseBody = await response.json();
  } catch (_) {
    try {
      responseBody = await response.text();
    } catch (_) {
      responseBody = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody
  };
}

// Submit form
async function submitForm(auto = false) {
  const data = collectAnswers();
  const tgId = email;
  const score = calculateScore(data);

  console.log('Submitting final test payload', { tg_id: tgId, score, ...data });

  const submitBtn = document.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'ОТПРАВЛЯЕТСЯ...';
  }

  try {
    const result = await sendFinalRequest(tgId, data, score);

    if (!result.ok) {
      console.error('Final webhook error:', result);
      errorEl.textContent = 'Ошибка отправки теста. Пожалуйста, попробуй ещё раз.';
      return;
    }

    localStorage.setItem('test_submitted', 'true');
    localStorage.removeItem('start_time');
    localStorage.removeItem('test_data');
    localStorage.removeItem('remaining_time');
    localStorage.removeItem('time_elapsed');

    form.style.display = 'none';
    timeDisplay.parentNode.style.display = 'none';
    errorEl.textContent = '';

    window.location.href = 'bye.html';
  } catch (err) {
    console.error('Submission error:', err);
    errorEl.textContent = 'Ошибка отправки теста';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ЗАВЕРШИТЬ';
    }
  }
}

// Event listeners
form.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
  }
});

form.addEventListener('input', saveForm);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  submitForm(false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const start = parseInt(localStorage.getItem('start_time') || '0', 10);
    if (start) {
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      localStorage.setItem('time_elapsed', elapsed);
    }
  }
});

// Initialize
restoreForm();
startTimer();
