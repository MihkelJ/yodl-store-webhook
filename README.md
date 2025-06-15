# 🍺 yodl-store-webhook

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A Node.js microservice that connects blockchain payments to physical beer dispensing through IoT integration. 🚀

## 📑 Table of Contents

- [Overview](#overview)
- [Features](#features-)
- [Tech Stack](#tech-stack-)
- [Prerequisites](#prerequisites-)
- [Quick Start](#quick-start-)
- [Configuration](#configuration-)
- [Development](#development-)
- [API Documentation](#api-documentation-)
- [License](#license-)
- [Author](#author-)

## Overview

yodl-store-webhook connects blockchain transactions to physical IoT devices. It processes payment notifications from the YODL platform and activates beer taps through the Blynk IoT platform, dispensing beer based on transaction amounts. 🎯

## Features ✨

- Webhook endpoint for blockchain transaction notifications 📡
- Authentication and transaction validation middleware 🔒
- Integration with Blynk IoT platform 🤖
- Configurable beer taps with custom transaction validation rules ⚙️
- Support for multiple beer taps with different configurations 🎛️

## Tech Stack 🛠️

- Node.js (>=20) ⚡
- TypeScript 📘
- Express.js 🚂
- express-zod-api (for API schema validation) ✅
- Blynk (IoT platform) 🔌

## Prerequisites 📋

- Node.js 20 or higher ⚡
- Yarn package manager 🧶
- A Blynk account and configured device(s) 🤖
- YODL platform webhook endpoint credentials 🔑
- Environment variables (see below) ⚙️

## Quick Start 🚀

```bash
# Clone and set up
git clone https://github.com/MihkelJ/yodl-store-webhook.git
cd yodl-store-webhook
yarn install

# Configure environment variables
cp .env.example .env
# Edit .env with your specific values

# Start the service
yarn build && yarn start
```

## Configuration ⚙️

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Yodl Configuration
YODL_INDEXER_URL="https://tx.yodl.me/api"
YODL_ADDRESS=0x66a31Aa400dd8C11f9af054c3b7bCcB783B4901B

# Beer Taps Configuration
BEER_TAPS='[
  {
    "transactionReceiverEns": "marketplace.ipecity.eth",
    "transactionMemo": "Chopp",
    "transactionCurrency": "BRL",
    "transactionAmount": "10",
    "blynkDeviceToken": "YOUR_BLYNK_TOKEN",
    "blynkDevicePin": "V1",
    "blynkDevicePinValue": "1",
    "blynkServer": "https://blynk.cloud"
  }
]'
```

### Beer Tap Configuration Parameters 🍺

| Parameter                | Description                                                    | Required |
| ------------------------ | -------------------------------------------------------------- | -------- |
| `transactionReceiverEns` | The ENS name that should receive the transaction 📝            | Yes      |
| `transactionMemo`        | The identifier that must be present in the transaction memo 🏷️ | Yes      |
| `transactionCurrency`    | The expected currency for the transaction 💰                   | Yes      |
| `transactionAmount`      | The minimum amount required for the transaction 💵             | Yes      |
| `blynkDeviceToken`       | Your Blynk device token 🔑                                     | Yes      |
| `blynkDevicePin`         | The Blynk pin to control (must start with 'V') 📌              | Yes      |
| `blynkDevicePinValue`    | The value to send to the Blynk pin 🔢                          | Yes      |
| `blynkServer`            | The Blynk server URL 🌐                                        | No       |

## Development 👨‍💻

```bash
# Run in development mode with hot reloading
yarn dev

# Build the project
yarn build

# Start the server
yarn start
```

## API Documentation 🌐

### POST /v1/callback

Webhook endpoint for processing YODL transactions.

#### Required Headers

- `txHash`: Transaction hash 🔑
- Authentication token (configured through middleware) 🔒

#### Validation Checks ✅

- Transaction memo contains the configured identifier 📝
- Transaction currency matches the configuration 💰
- Receiver ENS name matches the configuration 📋
- Transaction amount meets the minimum requirement 💵

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author 👨‍💻

[MihkelJ](https://github.com/MihkelJ)
