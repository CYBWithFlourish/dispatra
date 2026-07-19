# SUMSUB_SETUP.md - Sumsub KYC Integration

Sumsub provides identity verification (KYC) for Dispatra. This guide covers
sandbox setup for development and testing.

---

## 1. Create a Sumsub Account

1. Go to https://sumsub.com
2. Click **Sign Up** and create an account
3. Verify your email

You'll land in the Sumsub dashboard. The default environment is **Sandbox** -
this is what you want for development.

---

## 2. Get API Keys (Sandbox)

1. In the Sumsub dashboard, go to **Dashboard → Settings → API keys**
2. You'll see two keys:
   - **App token** - used on the client side (for the KYC widget)
   - **Secret key** - used on the server side (API calls)
3. Copy both keys

Add them to `api/.env`:

```env
SUMSUB_APP_TOKEN=your-app-token-here
SUMSUB_SECRET_KEY=your-secret-key-here
SUMSUB_BASE_URL=https://api.sumsub.com
```

> **Important:** Sandbox keys and production keys are different. Make sure you're
> using sandbox keys during development.

---

## 3. Configure Webhook URL

Sumsub sends KYC status updates via webhooks. You need to configure the URL
where Dispatra's API listens for these events.

### For local development (use ngrok or similar):

1. Install ngrok: `npm install -g ngrok`
2. Start your API: `cd api && npm run dev`
3. Start ngrok: `ngrok http 3001`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. In Sumsub dashboard → **Settings → Webhooks → Add webhook**
6. Set the URL to: `https://abc123.ngrok.io/kyc/webhook`
7. Enable events: `applicantReviewed`, `applicantPending`

### For production:

Set the webhook URL to your deployed API endpoint:
```
https://your-api-domain.com/kyc/webhook
```

---

## 4. Test KYC in Sandbox

Sumsub sandbox mode allows testing without real documents. You can use test
data to simulate verification.

### Sandbox Test Data

Use these values in the Sumsub KYC widget during testing:

#### Document Verification (National ID)

| Field | Test Value |
|-------|------------|
| Document type | National ID |
| Country | Any supported country |
| First name | `Test` |
| Last name | `User` |
| Document number | `AA1234567` |
| Date of birth | `01/01/1990` |

#### Sandbox Document Upload

For sandbox, you can upload any image file as a document. Sumsub will
automatically approve it. Use a sample image (any JPG/PNG).

#### Sandbox Verification Flow

1. Create an applicant via the API:
   ```bash
   curl -X POST http://localhost:3001/kyc/create-applicant \
     -H "Content-Type: application/json" \
     -d '{"address": "0xYourTestAddress", "role": "sender"}'
   ```

2. Get the access token:
   ```bash
   curl http://localhost:3001/kyc/token/0xYourTestAddress
   ```

3. Use the token in the Sumsub widget (client-side) to complete verification.

4. Check status:
   ```bash
   curl http://localhost:3001/kyc/status/0xYourTestAddress
   ```

### Automatic Sandbox Behavior

In sandbox mode, Sumsub has these behaviors:

- **All documents are auto-approved** - no manual review needed
- **No liveness check required** - skip the selfie step
- **Instant verification** - status changes to `verified` immediately after upload
- **Test documents accepted** - any image file works

---

## 5. Sumsub Dashboard Settings

### KYC Levels (configured in dashboard)

Dispatra uses role-based KYC levels:

| Role | Level | Verification |
|------|-------|--------------|
| Sender | `sender-verification` | National ID |
| Rider | `rider-verification` | National ID + Driver's license |

To set up levels in Sumsub:
1. Go to **Dashboard → Settings → Verification levels**
2. Create a level named `sender-verification`
3. Add the "ID document" step
4. Create a level named `rider-verification`
5. Add the "ID document" step (NIN + driver's license)

### Webhook Events

Sumsub sends these events that Dispatra handles:

| Event | Description |
|-------|-------------|
| `applicantPending` | Applicant submitted documents, under review |
| `applicantReviewed` | Review completed (approved/rejected) |
| `applicantOnHold` | Additional documents needed |
| `applicantDeclined` | Verification failed |

---

## 6. Production Checklist

Before going live:

- [ ] Switch `SUMSUB_BASE_URL` to `https://api.sumsub.com` (same for sandbox and production)
- [ ] Generate **production** API keys in Sumsub dashboard
- [ ] Update `SUMSUB_APP_TOKEN` and `SUMSUB_SECRET_KEY` with production keys
- [ ] Set webhook URL to your production API
- [ ] Configure verification levels with proper document requirements
- [ ] Enable webhook signature verification for security
- [ ] Test the full flow end-to-end on testnet with production keys

---

## 7. Dispatra KYC Integration Points

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/kyc/create-applicant` | POST | Create Sumsub applicant for a wallet address |
| `/kyc/status/:address` | GET | Check KYC verification status |
| `/kyc/webhook` | POST | Receive Sumsub webhook events |
| `/kyc/token/:address` | GET | Get Sumsub access token for client widget |

### Flow

```
1. User connects wallet → POST /auth/login (SIWE)
2. User clicks "Start Verification" → POST /kyc/create-applicant
3. API creates Sumsub applicant → returns applicant ID
4. Client gets access token → GET /kyc/token/:address
5. Client opens Sumsub widget with token
6. User uploads documents in widget
7. Sumsub reviews → POST /kyc/webhook
8. API updates user's KYC status in database
9. User can now create/accept jobs
```

---

## 8. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Webhook not received | Wrong URL or ngrok not running | Check ngrok is running, URL matches |
| 401 from Sumsub API | Wrong API keys | Verify sandbox vs production keys |
| Applicant not created | Missing `SUMSUB_SECRET_KEY` | Check `api/.env` |
| Widget doesn't load | Wrong app token | Verify `SUMSUB_APP_TOKEN` in `.env` |
| Verification stuck in pending | Sandbox mode limitation | Manually trigger via Sumsub dashboard |

---

## 9. Sumsub Dashboard Quick Links

- **Dashboard:** https://cockpit.sumsub.com
- **API Reference:** https://developers.sumsub.com/api-reference/
- **Sandbox docs:** https://developers.sumsub.com/sandbox/
- **Webhooks:** https://developers.sumsub.com/webhooks/
