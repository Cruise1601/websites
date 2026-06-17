import 'dotenv/config';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;
const safaricomBaseUrl = process.env.SAFARICOM_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

app.use(express.json());
app.use(express.static(process.cwd()));

app.get('/', (req, res) => {
  res.sendFile(new URL('./index.html', import.meta.url).pathname);
});

app.post('/api/safaricom-callback', (req, res) => {
  console.log('Safaricom callback received:', JSON.stringify(req.body));
  res.sendStatus(200);
});

function normalizePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');

  if (digits.length === 10 && digits.startsWith('0')) {
    return `254${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('254')) {
    return digits;
  }

  if (digits.length === 9 && digits.startsWith('7')) {
    return `254${digits}`;
  }

  throw new Error('Use a Kenyan Safaricom number like 07XXXXXXXX, +2547XXXXXXXX, or 2547XXXXXXXX.');
}

function getNairobiTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function requireConfig() {
  const required = [
    'SAFARICOM_CONSUMER_KEY',
    'SAFARICOM_CONSUMER_SECRET',
    'SAFARICOM_SHORTCODE',
    'SAFARICOM_PASSKEY',
    'SAFARICOM_CALLBACK_URL',
  ];

  const missing = required.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing Safaricom config: ${missing.join(', ')}.`);
  }
}

function hasSafaricomConfig() {
  return [
    'SAFARICOM_CONSUMER_KEY',
    'SAFARICOM_CONSUMER_SECRET',
    'SAFARICOM_SHORTCODE',
    'SAFARICOM_PASSKEY',
    'SAFARICOM_CALLBACK_URL',
  ].every(name => Boolean(process.env[name]));
}

async function getAccessToken() {
  const auth = Buffer.from(`${process.env.SAFARICOM_CONSUMER_KEY}:${process.env.SAFARICOM_CONSUMER_SECRET}`).toString('base64');
  const response = await fetch(`${safaricomBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.errorMessage || 'Failed to get Safaricom access token.');
  }

  return payload.access_token;
}

async function sendStkPush({ amount, phoneNumber }) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    throw new Error('Enter a valid amount.');
  }

  if (!hasSafaricomConfig()) {
    if (process.env.NODE_ENV === 'production') {
      requireConfig();
    }

    return {
      ResponseCode: '0',
      ResponseDescription: 'Mock STK push created successfully.',
      MerchantRequestID: 'MOCK-MERCHANT-REQUEST-ID',
      CheckoutRequestID: 'MOCK-CHECKOUT-REQUEST-ID',
      CustomerMessage: 'Mock STK push sent. Configure Safaricom credentials for live payments.',
      isMock: true,
    };
  }

  requireConfig();

  const accessToken = await getAccessToken();
  const timestamp = getNairobiTimestamp();
  const shortcode = String(process.env.SAFARICOM_SHORTCODE);
  const password = Buffer.from(`${shortcode}${process.env.SAFARICOM_PASSKEY}${timestamp}`).toString('base64');

  const response = await fetch(`${safaricomBaseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amountNumber),
      PartyA: normalizedPhoneNumber,
      PartyB: shortcode,
      PhoneNumber: normalizedPhoneNumber,
      CallBackURL: process.env.SAFARICOM_CALLBACK_URL,
      AccountReference: process.env.SAFARICOM_ACCOUNT_REFERENCE || 'RGWC Isiolo',
      TransactionDesc: process.env.SAFARICOM_TRANSACTION_DESC || 'RGWC Isiolo Giving',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.errorMessage || payload.CustomerMessage || 'Failed to send Safaricom STK push.');
  }

  return payload;
}

app.post('/api/stk-push', async (req, res) => {
  try {
    const payload = await sendStkPush(req.body || {});
    res.json({
      success: true,
      phoneNumber: normalizePhoneNumber(req.body?.phoneNumber),
      amount: Math.round(Number(req.body?.amount)),
      data: payload,
      mockMode: Boolean(payload.isMock),
    });
  } catch (error) {
    const status = error.message?.startsWith('Missing Safaricom config') || error.message?.includes('access token') ? 500 : 400;
    res.status(status).json({
      success: false,
      error: error.message || 'Unable to send Safaricom STK push.',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});