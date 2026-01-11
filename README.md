# Service Bus Inspector

<div align="center">

**🚀 AI-Powered Autopilot for Azure Service Bus**

*Enterprise monitoring and automatic remediation platform*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![.NET](https://img.shields.io/badge/.NET-9.0-purple.svg)](https://dotnet.microsoft.com/)
[![Python](https://img.shields.io/badge/Python-3.11-green.svg)](https://www.python.org/)

</div>

---

## 🎯 Overview

Service Bus Inspector is an enterprise-grade monitoring platform for Azure Service Bus with AI-powered anomaly detection and automatic remediation capabilities.

### Key Features

- 🔍 **Real-Time Monitoring** - Live message streaming with SSE
- 🤖 **AI Anomaly Detection** - ML-powered pattern analysis
- ⚡ **Automatic Remediation** - One-click fixes with audit trail
- 📊 **Analytics Dashboard** - Comprehensive metrics and insights
- 🔐 **Enterprise Security** - Session-based auth, no credential storage

## 🏗️ Architecture

This is a monorepo using **PNPM workspaces** and **Turborepo** with four independent layers:

```
packages/
├── ui/          # Next.js 14 + React 18 + Tailwind CSS
├── api/         # .NET 9 + Clean Architecture
├── ai/          # Python FastAPI + Scikit-learn
└── shared/      # Contracts + Utilities (TypeScript/C#/Python)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ & PNPM 9+
- .NET SDK 9.0+ (for API development)
- Python 3.11+ (for AI development)
- Docker (optional, for containerized development)

### Setup

```bash
# Clone the repository
git clone https://github.com/debdevops/debg.eventdriven.git
cd debg.eventdriven

# Run setup script (installs all dependencies)
chmod +x setup.sh
./setup.sh

# Or manually
pnpm install
pnpm build
```

### Development

```bash
# Start all services
pnpm dev

# Or start individually
pnpm dev:ui    # UI at http://localhost:3000
pnpm dev:api   # API at http://localhost:5000
pnpm dev:ai    # AI at http://localhost:8000
```

### Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📦 Project Structure

```
servicebus-inspector/
├── packages/
│   ├── ui/                 # Next.js frontend
│   │   ├── src/app/        # App Router pages
│   │   ├── src/features/   # Feature modules
│   │   └── src/shared/     # Shared components
│   │
│   ├── api/                # .NET backend
│   │   ├── ServiceBusInspector.Api/
│   │   ├── ServiceBusInspector.Core/
│   │   └── ServiceBusInspector.Infrastructure/
│   │
│   ├── ai/                 # Python ML service
│   │   ├── src/api/        # FastAPI endpoints
│   │   ├── src/models/     # ML models
│   │   └── src/training/   # Training scripts
│   │
│   └── shared/             # Shared contracts
│       ├── contracts/      # Type definitions
│       ├── config/         # Shared configs
│       └── utils/          # Utility functions
│
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── docker-compose.yml      # Local development
├── turbo.json              # Turborepo config
└── pnpm-workspace.yaml     # PNPM workspace config
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & layer details |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow |
| [docs/guides/local-development.md](docs/guides/local-development.md) | Local setup guide |
| [packages/ui/README.md](packages/ui/README.md) | UI package docs |
| [packages/api/README.md](packages/api/README.md) | API package docs |
| [packages/ai/README.md](packages/ai/README.md) | AI package docs |

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all code |
| `pnpm type-check` | TypeScript validation |
| `pnpm clean` | Clean all build artifacts |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @servicebus-inspector/ui test
pnpm --filter @servicebus-inspector/api test
pnpm --filter @servicebus-inspector/ai test
```

## 🚢 Deployment

See deployment guides in [docs/guides/](docs/guides/):

- **Azure Container Apps** - Recommended for Azure environments
- **Kubernetes** - For K8s clusters
- **Docker Compose** - For simple deployments

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for the Azure Community**

[Documentation](docs/) · [Report Bug](issues) · [Request Feature](issues)

</div>
