# yodl-store-webhook

A Node.js microservice that connects blockchain payments to physical beer dispensing through IoT integration.

## Overview

yodl-store-webhook connects blockchain transactions to physical IoT devices. It processes payment notifications from the YODL platform and activates a beer tap through the Blynk IoT platform, dispensing beer based on transaction amounts.

## Features

- Webhook endpoint for blockchain transaction notifications
- Authentication and transaction validation middleware
- Integration with Blynk IoT platform
- Configurable beer dispensing based on transaction values

## Tech Stack

- Node.js (>=20)
- TypeScript
- Express.js
- express-zod-api (for API schema validation)
- Blynk (IoT platform)

## Prerequisites

- Node.js 20 or higher
- Yarn package manager
- A Blynk account and configured device
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
# Yodl Configuration
YODL_INDEXER_URL="https://tx.yodl.me/api"
YODL_ADDRESS=0x66a31Aa400dd8C11f9af054c3b7bCcB783B4901B

# BLYNK
BLYNK_SERVER="https://blynk.cloud"
BEER_TAP_TOKEN=XXX

# BEER
BEER_IDENTIFIER="Chopp"
RECEIVER_ENS_PRIMARY_NAME=marketplace.ipecity.eth
INVOICE_CURRENCY=BRL
```

## Installation

```bash
# Clone the repository
git clone https://github.com/MihkelJ/yodl-store-webhook.git
cd yodl-store-webhook

# Install dependencies
yarn install

# Build the project
yarn build
```

## Development

```bash
# Run in development mode with hot reloading
yarn dev

# Build the project
yarn build

# Start the server
yarn start
```

## License

MIT

## Author

MihkelJ
