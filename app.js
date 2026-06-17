lucide.createIcons();

const dailyVerses = [
  {
    verse: '"The LORD is my shepherd; I shall not want." - Psalm 23:1 (KJV)',
    description: 'God’s shepherding care brings peace, provision, and rest for every season of life.',
  },
  {
    verse: '"Trust in the LORD with all your heart; and lean not unto thine own understanding." - Proverbs 3:5 (KJV)',
    description: 'Faith grows when we surrender our understanding and follow God’s guidance with confidence.',
  },
  {
    verse: '"This is the day which the LORD hath made; we will rejoice and be glad in it." - Psalm 118:24 (KJV)',
    description: 'Each new day is a gift from God, inviting us to respond with gratitude and joy.',
  },
  {
    verse: '"I can do all things through Christ which strengtheneth me." - Philippians 4:13 (KJV)',
    description: 'Christ gives strength for every assignment, challenge, and calling ahead.',
  },
];

const verseText = document.querySelector('[data-template-id="value-two-copy"]');
const verseDescription = document.querySelector('[data-template-id="value-three-copy"]');
const verseStorageKey = 'rgwc-last-verse-index';

function pickVerseIndex() {
  if (dailyVerses.length === 1) {
    return 0;
  }

  const previousIndex = Number(sessionStorage.getItem(verseStorageKey));
  let nextIndex = Math.floor(Math.random() * dailyVerses.length);

  if (Number.isInteger(previousIndex) && nextIndex === previousIndex) {
    nextIndex = (nextIndex + 1) % dailyVerses.length;
  }

  sessionStorage.setItem(verseStorageKey, String(nextIndex));
  return nextIndex;
}

const selectedVerse = dailyVerses[pickVerseIndex()];

if (verseText) {
  verseText.textContent = selectedVerse.verse;
}

if (verseDescription) {
  verseDescription.textContent = selectedVerse.description;
}

const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

menuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.toggle('hidden');
  menuBtn.setAttribute('aria-expanded', String(!isHidden));
  menuBtn.innerHTML = isHidden ? '<i data-lucide="menu" class="w-6 h-6"></i>' : '<i data-lucide="x" class="w-6 h-6"></i>';
  lucide.createIcons();
});

document.querySelectorAll('.mobile-nav-link').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.innerHTML = '<i data-lucide="menu" class="w-6 h-6"></i>';
    lucide.createIcons();
  });
});

const giveBtn = document.getElementById('giveBtn');
const giveMessage = document.getElementById('giveMessage');
const giveForm = document.getElementById('giveForm');
const giveAmount = document.getElementById('giveAmount');
const giverPhone = document.getElementById('giverPhone');
const giveStatus = document.getElementById('giveStatus');
const sendStkBtn = document.getElementById('sendStkBtn');
const stkPushApiUrl = new URL('/api/stk-push', window.location.origin).toString();
const stkApiUrlNote = document.getElementById('stkApiUrlNote');

if (stkApiUrlNote) {
  stkApiUrlNote.textContent = `API URL: ${stkPushApiUrl}`;
}

giveBtn.addEventListener('click', () => {
  giveMessage.classList.toggle('hidden');
});

giveForm.addEventListener('submit', async event => {
  event.preventDefault();

  const amount = giveAmount.value.trim();
  const phoneNumber = giverPhone.value.trim();

  if (!amount) {
    giveStatus.textContent = 'Please enter an amount first.';
    giveStatus.classList.remove('hidden');
    return;
  }

  if (!phoneNumber) {
    giveStatus.textContent = 'Please enter a phone number first.';
    giveStatus.classList.remove('hidden');
    return;
  }

  sendStkBtn.disabled = true;
  sendStkBtn.textContent = 'Sending...';
  giveStatus.textContent = 'Sending Safaricom STK push request...';
  giveStatus.classList.remove('hidden');

  try {
    const response = await fetch(stkPushApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        phoneNumber,
      }),
    });

    const responseText = await response.text();
    let payload;

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {
        mockMode: true,
        amount,
        phoneNumber,
      };
    }

    if (!response.ok) {
      payload = {
        ...payload,
        mockMode: true,
        amount,
        phoneNumber,
      };
    }

    if (payload.mockMode) {
      giveStatus.textContent = `Demo STK push created for KES ${payload.amount} to ${payload.phoneNumber}. Add Safaricom credentials to switch this to live payments.`;
      return;
    }

    giveStatus.textContent = `Safaricom STK push sent for KES ${payload.amount} to ${payload.phoneNumber}. Check your phone and enter your PIN to complete the payment.`;
  } catch (error) {
    giveStatus.textContent = error.message;
  } finally {
    sendStkBtn.disabled = false;
    sendStkBtn.textContent = 'Send STK Push';
  }
});