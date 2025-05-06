# yodl-store-webhook

A Node.js service that listens for blockchain transaction webhooks and controls a beer tap through Blynk API.

## Overview

yodl-store-webhook is a microservice that acts as a bridge between blockchain transactions and IoT devices. It receives transaction callbacks and triggers a beer tap connected via the Blynk platform based on the transaction parameters.

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
- Environment variables (see below)

## Environment Variables

```
PORT=3000
BLYNK_SERVER=https://blynk-cloud.com
BEER_TAP_TOKEN=your_blynk_token
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

## API Endpoints

### POST /v1/callback

Webhook endpoint that receives transaction data and triggers the beer tap.

**Authentication required**

**Request Body:**
```json
{
  "beerValue": "1" // Possible values: "1", "2", "3"
}
```

**Response:**
```json
{
  "status": "OK"
}
```

### GET /v1/health

Health check endpoint.

**Response:**
```json
{
  "status": "OK"
}
```

## Docker

A `docker-compose.yml` file is provided for easy deployment:

```bash
docker-compose up -d
```

## License

MIT

## Author

MihkelJ
