# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Essential Scripts
- `yarn dev` - Start development server with hot reloading (uses nodemon + tsx)
- `yarn build` - Build TypeScript to JavaScript (uses tsc + tsc-alias)
- `yarn start` - Start production server (runs built JS from public/)
- `yarn typecheck` - Run TypeScript type checking without emitting files
- `yarn watch` - Watch mode for TypeScript compilation

### Dependencies
- **Runtime**: Express.js server with express-zod-api for API validation
- **Blockchain**: Uses `viem` for Ethereum signature verification
- **IoT**: Integrates with Blynk platform for hardware control
- **Validation**: Zod schemas for environment and request validation

## Architecture Overview

This is a webhook microservice that processes blockchain payments and triggers IoT beer taps. The architecture follows a middleware-based approach:

### Core Flow
1. **Webhook Endpoint** (`/v1/callback`) receives transaction notifications
2. **Authentication Middleware** verifies requests are signed by YODL platform
3. **Validation Middleware** validates transaction meets beer tap requirements
4. **Blynk Service** communicates with IoT devices to dispense beer

### Key Components

#### Configuration (`src/config/index.ts`)
- Environment validation using Zod schemas
- Beer tap configuration with transaction validation rules
- YODL platform settings and Blynk device parameters

#### Middleware Chain
- **Auth Middleware**: Verifies `x-yodl-signature` header using viem's `verifyMessage`
- **Validation Middleware**: Checks transaction memo, currency, receiver ENS, and amount

#### Services
- **Transaction Service**: Fetches transaction details from YODL indexer API
- **Blynk Service**: Sends HTTP requests to Blynk cloud to control IoT devices

### Beer Tap Configuration
Each beer tap requires:
- `transactionReceiverEns`: ENS name that should receive payment
- `transactionMemo`: Required text in transaction memo
- `transactionCurrency`: Expected currency (e.g., "BRL")
- `transactionAmount`: Minimum payment amount
- `blynkDeviceToken`: Blynk device authentication token
- `blynkDevicePin`: Virtual pin (must start with 'V')
- `blynkDevicePinValue`: Value to send to pin

### Environment Variables
Required variables are defined in the config with Zod validation:
- `YODL_INDEXER_URL`: API endpoint for transaction data
- `YODL_ADDRESS`: Ethereum address for signature verification
- `BEER_TAPS`: JSON array of beer tap configurations

## Project Structure
- `src/server.ts` - Main server entry point using express-zod-api
- `src/config/` - Environment validation and configuration
- `src/routes/` - API endpoint definitions (health check and webhook)
- `src/middlewares/` - Authentication and validation middleware
- `src/services/` - External API communication (YODL, Blynk)
- `src/schemas/` - Zod validation schemas
- `src/types/` - TypeScript type definitions

## Testing and Validation
- Use `yarn typecheck` to verify TypeScript correctness
- The project uses express-zod-api for runtime validation
- All middleware includes comprehensive error handling with HTTP status codes

## Deployment
- Built files go to `public/` directory
- Uses ES modules (type: "module" in package.json)
- Requires Node.js >=20
- Configured for Vercel deployment (vercel.json present)