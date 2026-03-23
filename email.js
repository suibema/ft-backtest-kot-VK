function getTelegramUserId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
}

async function detectPlatformUser() {
  const telegramUserId = getTelegramUserId();

  if (telegramUserId) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    window.userPlatform = 'telegram';
    window.platformUserId = telegramUserId;
    window.tgUserId = telegramUserId;
    window.tgUserStartParam = tg.initDataUnsafe?.start_param || '';
    return;
  }

  if (window.vkBridge) {
    const bridge = window.vkBridge;
    await bridge.send('VKWebAppInit');
    const vkUser = await bridge.send('VKWebAppGetUserInfo');

    window.userPlatform = 'vk';
    window.platformUserId = vkUser?.id || null;
    window.vkUserId = vkUser?.id || null;
    window.tgUserStartParam = '';
    return;
  }

  throw new Error('Не удалось определить платформу. Открой форму из Telegram или VK.');
}

function getEmptyAnswerValue(questionNumber) {
  const checkboxQuestions = [29, 32, 47];
  return checkboxQuestions.includes(questionNumber) ? [] : '';
}

function buildIntroPayload(platform, userId) {
  const answers = {};

  for (let i = 1; i <= 50; i++) {
    answers[`q${i}`] = getEmptyAnswerValue(i);
  }

  const platformParams = {};

  if (platform === 'telegram') {
    platformParams.tg_id = Number(userId) || 0;
  } else if (platform === 'vk') {
    platformParams.vk_id = Number(userId) || 0;
  }

  return {
    params: {
      ...platformParams,
      score: null,
      stage_name: 'результат кот',
      ...answers
    }
  };
}

async function sendIntroRequest(platform, userId) {
  const payload = buildIntroPayload(platform, userId);

  const response = await fetch('https://webhooks.fut.ru/ft-dispather/requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let body = null;

  try {
    body = await response.json();
  } catch (_) {
    try {
      body = await response.text();
    } catch (_) {
      body = null;
    }
  }

  const duplicateMessage =
    body?.message === 'На данный этап запрещено повторно подавать заявку' ||
    body?.errors?.user_request?.includes('На данный этап запрещено повторно подавать заявку');

  return {
    ok: response.ok,
    status: response.status,
    body,
    isDuplicate: response.status === 422 && duplicateMessage
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await detectPlatformUser();

    console.log('platform:', window.userPlatform);
    console.log('platform-id:', window.platformUserId);
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('email-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const errorEl = document.getElementById('email-error');
  errorEl.textContent = '';

  const submitBtn = this.querySelector('button[type="submit"]');

  if (!window.platformUserId || !window.userPlatform) {
    errorEl.textContent = 'Не удалось получить ID пользователя. Открой форму снова из приложения.';
    return;
  }

  try {
    if (submitBtn) submitBtn.disabled = true;

    const result = await sendIntroRequest(window.userPlatform, window.platformUserId);
    console.log('Intro webhook result:', result);

    if (result.isDuplicate) {
      errorEl.textContent = 'Мы уже получили результат твоего теста и скоро вернёмся с ответом 😊';
      return;
    }

    if (!result.ok) {
      errorEl.textContent = 'Ошибка сервера. Повтори попытку позже.';
      return;
    }

    localStorage.setItem('test_email', String(window.platformUserId));
    window.location.href = 'test.html';
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'Ошибка сервера. Повтори попытку позже.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});
