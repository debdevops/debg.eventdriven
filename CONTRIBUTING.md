# Contributing to Service Bus Inspector

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

Please be respectful and constructive in all interactions.

## Development Setup

### Prerequisites

- **Node.js 20+** - JavaScript runtime
- **PNPM 9+** - Package manager
- **.NET SDK 9.0** - For API development
- **Python 3.11+** - For AI service development
- **Docker** - For containerized development

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/debdevops/debg.eventdriven.git
cd debg.eventdriven

# Run setup script
chmod +x setup.sh
./setup.sh
```

### Starting Development Servers

```bash
# Start all services
pnpm dev

# Or individually
pnpm dev:ui    # http://localhost:3000
pnpm dev:api   # http://localhost:5000
pnpm dev:ai    # http://localhost:8000
```

## Project Structure

```
packages/
├── ui/          # Next.js frontend
├── api/         # .NET backend
├── ai/          # Python ML service
└── shared/      # Shared contracts
```

### UI Package (`packages/ui`)

```
src/
├── app/              # Next.js App Router pages
├── features/         # Feature modules
│   ├── messages/     # Message browsing
│   │   ├── api/      # TanStack Query hooks
│   │   ├── components/
│   │   ├── store/    # Zustand slices
│   │   └── types/
│   ├── anomalies/
│   └── namespaces/
└── shared/           # Shared components
    ├── api/          # HTTP client
    ├── ui/           # Design system
    └── lib/          # Utilities
```

### API Package (`packages/api`)

```
ServiceBusInspector.Api/          # HTTP layer
ServiceBusInspector.Core/         # Business logic
ServiceBusInspector.Infrastructure/ # External services
```

### AI Package (`packages/ai`)

```
src/
├── api/              # FastAPI endpoints
│   └── routes/
├── models/           # ML models
├── training/         # Training scripts
└── utils/            # Utilities
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

Follow the coding standards below and ensure:
- Code compiles without errors
- All tests pass
- Linting passes

### 3. Test Your Changes

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @servicebus-inspector/ui test
pnpm --filter @servicebus-inspector/api test
pnpm --filter @servicebus-inspector/ai test

# Type checking
pnpm type-check

# Linting
pnpm lint
```

### 4. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat(ui): add anomaly badge component"
git commit -m "fix(api): correct session timeout handling"
git commit -m "docs: update contributing guidelines"
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Scopes: `ui`, `api`, `ai`, `shared`, `docs`

## Coding Standards

### TypeScript/JavaScript

- **Strict mode** enabled
- Use **TypeScript** for all new code
- Follow **ESLint** configuration
- Use **Prettier** for formatting

```typescript
// Good: Explicit types, meaningful names
function analyzeMessage(message: MessageEnvelope): AnomalyResult {
  const indicators: AnomalyIndicator[] = [];
  // ...
  return { messageId: message.messageId, indicators };
}

// Bad: Any types, cryptic names
function analyze(m: any): any {
  const i: any[] = [];
  // ...
}
```

### C# (.NET)

- Follow **C# coding conventions**
- Use **nullable reference types**
- Use **records** for DTOs
- Async/await everywhere

```csharp
// Good: Records, async, explicit types
public record MessageDto(
    string MessageId,
    int DeliveryCount,
    string Body
);

public async Task<MessageDto> GetMessageAsync(
    string entityPath,
    CancellationToken cancellationToken = default)
{
    // ...
}
```

### Python

- Follow **PEP 8**
- Use **type hints**
- Use **Pydantic** for validation
- Use **async/await** for I/O

```python
# Good: Type hints, Pydantic models
from pydantic import BaseModel

class MessageInput(BaseModel):
    message_id: str
    delivery_count: int
    body: str

async def analyze_message(message: MessageInput) -> AnalysisResult:
    # ...
```

## Pull Request Process

1. **Update documentation** if you've changed APIs
2. **Add tests** for new functionality
3. **Ensure all checks pass** (lint, test, build)
4. **Fill out the PR template** completely
5. **Request review** from maintainers

### PR Title Format

```
type(scope): description

Examples:
feat(ui): add real-time message streaming
fix(api): handle session expiry correctly
docs: update architecture diagram
```

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All CI checks pass
- [ ] Linked related issues

## Need Help?

- Check existing [issues](../../issues)
- Review [documentation](docs/)
- Ask in pull request comments

---

Thank you for contributing! 🎉
