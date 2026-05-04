# ⚡ Quick Start Guide

## 🎯 Immediate Action Required

### 1. Update Render Start Command (2 minutes)

Your app is deployed but needs a configuration fix:

1. Go to: https://dashboard.render.com
2. Click: **medical-rag-system-o9zc**
3. Click: **Settings** → **Build & Deploy**
4. Change **Start Command** to:
   ```
   node .next/standalone/server.js
   ```
5. Click **Save Changes**

### 2. Rotate API Keys (Security)

Your API keys were briefly in Git history. Rotate them:

**Groq**: https://console.groq.com/keys
**Pinecone**: https://app.pinecone.io/

Then update in Render: Dashboard → Environment

## 🧪 Test Your App

1. **Health**: https://medical-rag-system-o9zc.onrender.com/api/health
2. **Chat**: https://medical-rag-system-o9zc.onrender.com/chat
3. **First request**: Wait 30-60 seconds

## 📊 What to Expect

- ✅ First request: 30-60 seconds (loading model)
- ✅ Next requests: 2-5 seconds (fast)
- ⚠️ Free tier: 512MB RAM (may be slow)
- 💡 Starter tier: 2GB RAM (recommended)

## 🐛 If Something's Wrong

1. Check logs: Dashboard → Logs
2. Check health: `/api/health` endpoint
3. Verify env vars: Dashboard → Environment
4. Wait 60 seconds on first request

## 📚 Full Documentation

- `DEPLOYMENT_SUMMARY.md` - Complete deployment guide
- `FIXES_APPLIED.md` - What was fixed and why
- `README.md` - Project overview
