# 🍺 YODL Beer Tap Webhook

A specialized webhook service that connects YODL payments to your beer tap through Blynk. When someone pays you through YODL, it automatically triggers your beer tap to pour a refreshing beverage! 🍻

## ✨ Features

- 🍺 Automatic beer tap control via Blynk
- 💸 YODL payment integration
- 🔐 Secure webhook handling
- 🛠️ Three flow settings for different pour sizes
- 📱 Remote monitoring and control

## 🎯 Prerequisites

Before you start, make sure you have:

- 💚 Node.js (v20 or higher)
- 📦 npm or yarn
- 🔌 A Blynk-compatible beer tap setup
- 🔑 A Blynk account and device token

## 🔧 Setup Guide

### 1. Environment Configuration

Create a `.env` file with the following variables:

```bash
# Blynk Configuration
BLYNK_SERVER=https://your-blynk-server.com
BEER_TAP_TOKEN=your-blynk-device-token

# Server Configuration
PORT=3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. ENS Configuration

Configure your ENS text record with the `me.yodl` key. The value should be a JSON object containing:

```json
{
  "tokenSymbols": ["USDT", "USDC"],
  "webhooks": [
    "https://your-server.com/callback"
  ]
}
```

### 4. Blynk Setup

1. Create a Blynk account at [Blynk.io](https://blynk.io)
2. Set up your beer tap device in the Blynk app
3. Configure virtual pin `v2` for beer tap control
4. Note down your device token and server URL

## 🍺 Beer Tap Control

The service supports three different flow settings:

- `1`: Light flow (small pour)
- `2`: Medium flow (standard pour)
- `3`: Heavy flow (large pour)

When a payment is received, the service automatically triggers the beer tap with the appropriate flow setting.

## 🚀 Running the Service

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🛠️ Troubleshooting

### Beer Tap Not Responding?

1. Check your Blynk configuration:
   - Verify server URL and device token
   - Ensure device is online
   - Confirm virtual pin `v2` is properly configured

2. Check webhook configuration:
   - Verify ENS text record is correctly set
   - Ensure webhook URL is accessible
   - Check server logs for errors

## 📜 License

MIT License - Feel free to use and modify as needed!

---

Made with 🍺 and a passion for automated beverages
