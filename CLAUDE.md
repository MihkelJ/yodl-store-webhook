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
- **Queue**: Redis for persistence and job queue management

## Architecture Overview

This is a webhook microservice that processes blockchain payments and triggers IoT beer taps. The architecture follows a middleware-based approach:

### Core Flow
1. **Webhook Endpoint** (`/v1/callback`) receives transaction notifications
2. **Authentication Middleware** verifies requests are signed by YODL platform
3. **Validation Middleware** validates transaction meets beer tap requirements
4. **Queue System** enqueues transactions for processing
5. **Status Manager** monitors beer tap availability via Blynk V5 pin
6. **Queue Integration** processes items when beer taps are ready

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
- **Redis Service**: Manages queue persistence and pub/sub for real-time updates
- **Status Service**: Monitors beer tap availability with caching and deduplication
- **Queue Service**: Handles FIFO processing with retry logic and concurrency control
- **Queue Integration**: Orchestrates beer tap workflow and status management

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
- `REDIS_URL`: Redis connection string for queue persistence
- `DEV_DISABLE_AUTH`: Development flag to bypass authentication
- `QUEUE_*`: Queue configuration (max attempts, delays, concurrency, etc.)

## Project Structure
- `src/server.ts` - Main server entry point using express-zod-api
- `src/config/` - Environment validation and configuration
- `src/routes/` - API endpoint definitions (health check and webhook)
- `src/middlewares/` - Authentication and validation middleware
- `src/services/` - External API communication (YODL, Blynk, Redis, Queue)
- `src/schemas/` - Zod validation schemas
- `src/types/` - TypeScript type definitions
- `docker-compose.yml` - Redis container configuration

## Testing and Validation
- Use `yarn typecheck` to verify TypeScript correctness
- The project uses express-zod-api for runtime validation
- All middleware includes comprehensive error handling with HTTP status codes

## Deployment
- Built files go to `public/` directory
- Uses ES modules (type: "module" in package.json)
- Requires Node.js >=20
- Configured for Vercel deployment (vercel.json present)
- Redis required for queue functionality (use Docker Compose for development)

## express-zod-api Framework Guidelines

### Core Principles
This project uses express-zod-api, a TypeScript-first framework for building APIs with robust input/output validation:

- **Schema-First**: All endpoints use Zod schemas for input/output validation
- **Type Safety**: Automatic TypeScript type inference from schemas
- **Middleware Chain**: Composable middleware for cross-cutting concerns
- **Error Handling**: Consistent HTTP error responses with configurable detail levels

### API Structure Patterns

#### Endpoint Definition
```typescript
export const endpoint = defaultEndpointsFactory
  .addMiddleware(authMiddleware)
  .addMiddleware(validationMiddleware)
  .build({
    method: 'post',
    input: inputSchema,
    output: outputSchema,
    handler: async ({ input, options, logger }) => {
      // Handler logic
      return result;
    },
    description: 'Endpoint description for docs'
  });
```

#### Middleware Pattern
```typescript
const middleware = new Middleware({
  input: z.object({ /* input schema */ }),
  handler: async ({ input, request, logger }) => {
    // Middleware logic
    return { /* options for endpoints */ };
  }
});
```

### Input/Output Validation
- Use Zod schemas in `src/schemas/` directory
- Input validation occurs before handler execution
- Output validation ensures response consistency
- Failed validation returns appropriate HTTP error codes

### Error Handling
- Use `http-errors` package for consistent error responses
- Middleware can throw HTTP errors that are automatically handled
- Production mode generalizes error messages for security
- Development mode provides detailed error information

### Best Practices
1. **Schema Organization**: Keep schemas in dedicated files under `src/schemas/`
2. **Middleware Composition**: Use middleware for authentication, validation, and cross-cutting concerns
3. **Type Safety**: Leverage TypeScript inference from Zod schemas
4. **Error Consistency**: Use createHttpError for consistent error responses
5. **Documentation**: Provide clear descriptions for auto-generated API docs
6. **Testing**: Use built-in testing utilities for endpoint and middleware testing

### Common Patterns
- **Authentication**: Verify signatures/tokens in middleware, provide user context
- **Validation**: Check business rules in middleware, provide validated data
- **Error Handling**: Throw HTTP errors with appropriate status codes
- **Logging**: Use provided logger for structured logging
- **Async Operations**: Handle promises properly in handlers and middleware