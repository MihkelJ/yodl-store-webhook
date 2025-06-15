# yodl-store-webhook

A Node.js microservice that connects blockchain payments to physical beer dispensing through IoT integration.

## Overview

yodl-store-webhook connects blockchain transactions to physical IoT devices. It processes payment notifications from the YODL platform and activates beer taps through the Blynk IoT platform, dispensing beer based on transaction amounts.

## Features

- Webhook endpoint for blockchain transaction notifications
- Authentication and transaction validation middleware
- Integration with Blynk IoT platform
- Configurable beer taps with custom transaction validation rules
- Support for multiple beer taps with different configurations

## Tech Stack

- Node.js (>=20)
- TypeScript
- Express.js
- express-zod-api (for API schema validation)
- Blynk (IoT platform)

## Prerequisites

- Node.js 20 or higher
- Yarn package manager
- A Blynk account and configured device(s)
- YODL platform webhook endpoint credentials
- Environment variables (see below)

## Quick Start

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

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
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

Each beer tap configuration requires:

- `transactionReceiverEns`: The ENS name that should receive the transaction
- `transactionMemo`: The identifier that must be present in the transaction memo
- `transactionCurrency`: The expected currency for the transaction
- `transactionAmount`: The minimum amount required for the transaction
- `blynkDeviceToken`: Your Blynk device token
- `blynkDevicePin`: The Blynk pin to control (must start with 'V')
- `blynkDevicePinValue`: The value to send to the Blynk pin
- `blynkServer`: The Blynk server URL (optional, defaults to https://blynk.cloud)

## Development

```bash
# Run in development mode with hot reloading
yarn dev

# Build the project
yarn build

# Start the server
yarn start
```

## API Endpoints

### POST /v1/callback

Webhook endpoint for processing YODL transactions. Requires:

- `txHash` header with the transaction hash
- Authentication (configured through middleware)

The endpoint validates:

- Transaction memo contains the configured identifier
- Transaction currency matches the configuration
- Receiver ENS name matches the configuration
- Transaction amount meets the minimum requirement

## License

MIT

## Author

MihkelJ
