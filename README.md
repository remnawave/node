# Remnawave Node

A Node.js backend service for managing Xray core instances with NestJS framework.

## Overview

Remnawave Node is a service that provides REST API endpoints for managing Xray core instances, handling user management, and collecting statistics. It's built using NestJS and includes JWT authentication.

## Features

- Xray core management (start/stop/status)
- User management (add/remove/list users)
- Statistics collection (system/user/inbound/outbound)
- JWT-based authentication
- Zod-based validation
- Error handling
- Helmet security
- Docker support

## Prerequisites

- Node.js 20+
- npm/yarn
- Docker (optional)
- Xray core

## Installation

1. Clone the repository:

```bash
git clone https://github.com/remnawave/remnawave-node.git
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` file with required environment variables:

```env
NODE_ENV=development
APP_PORT=3002
API_PREFIX=api/v1
SSL_CERT=<your-ssl-cert> (get from Remnawave Panel)
XTLS_IP=127.0.0.1 (DON'T EDIT FOR NOW)
XTLS_PORT=61000 (DON'T EDIT FOR NOW)
```

## Running the Application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

### Using Docker

```bash
docker-compose -f docker-compose-prod.yml up -d
```

## API Endpoints

### Xray Management

- `POST /api/v1/xray/start` - Start Xray core
- `GET /api/v1/xray/stop` - Stop Xray core
- `GET /api/v1/xray/status` - Get Xray status and version

### User Management

- `POST /api/v1/handler/add-user` - Add new user
- `POST /api/v1/handler/remove-user` - Remove user
- `POST /api/v1/handler/get-inbound-users` - Get list of inbound users
- `POST /api/v1/handler/get-inbound-users-count` - Get count of inbound users

### Statistics

- `POST /api/v1/stats/get-user-online-status` - Get user online status
- `POST /api/v1/stats/get-users-stats` - Get users statistics
- `POST /api/v1/stats/get-system-stats` - Get system statistics
- `POST /api/v1/stats/get-inbound-stats` - Get inbound statistics
- `POST /api/v1/stats/get-outbound-stats` - Get outbound statistics

## Project Structure

```
├── src/
│   ├── modules/
│   │   ├── handler/     # User management
│   │   ├── stats/       # Statistics collection
│   │   └── xray-core/   # Xray core management
│   ├── common/          # Shared utilities and configs
│   └── app.module.ts    # Main application module
├── libs/
│   └── contract/        # Shared contracts and types
└── docker-compose-prod.yml
```

## Security

The application implements several security measures:

- JWT authentication
- Helmet middleware for HTTP security headers
- Input validation using Zod
- Exception filters
- Environment configuration validation

## Development

### Available Scripts

- `npm run build` - Build the application
- `npm run format` - Format code using Prettier
- `npm run lint` - Lint code using ESLint
- `npm test` - Run tests
- `npm run start:dev` - Start in development mode
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start in production mode

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the repository or contact the maintainers.
