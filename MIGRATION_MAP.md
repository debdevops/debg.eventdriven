# Migration Map

## Overview

This document maps the existing codebase (`src/`) to the new Clean Architecture structure (`packages/`).

## Current Structure → New Structure

### Legend
- ✅ **Direct Move** - File moves with minimal changes
- 🔄 **Refactor** - File needs significant refactoring
- 📦 **Split** - File splits into multiple files
- 🆕 **New** - New file created

---

## UI Migration (src/ui → packages/ui)

### Components → Features

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/components/MessageTable.tsx` | `packages/ui/src/features/messages/components/MessageTable.tsx` | ✅ |
| `src/ui/src/components/MessageRow.tsx` | `packages/ui/src/features/messages/components/MessageRow.tsx` | ✅ |
| `src/ui/src/components/MessageDetailPanel.tsx` | `packages/ui/src/features/messages/components/MessageDetailPanel.tsx` | ✅ |
| `src/ui/src/components/MessageModal.tsx` | `packages/ui/src/features/messages/components/MessageModal.tsx` | ✅ |
| `src/ui/src/components/MessagePreviewModal.tsx` | `packages/ui/src/features/messages/components/MessagePreviewModal.tsx` | ✅ |
| `src/ui/src/components/MessageSender.tsx` | `packages/ui/src/features/messages/components/MessageSender.tsx` | ✅ |
| `src/ui/src/components/MessageAgeDistribution.tsx` | `packages/ui/src/features/messages/components/MessageAgeDistribution.tsx` | ✅ |
| `src/ui/src/components/AISuggestionsPanel.tsx` | `packages/ui/src/features/anomalies/components/AISuggestionsPanel.tsx` | ✅ |
| `src/ui/src/components/AiInsightsInspector.tsx` | `packages/ui/src/features/anomalies/components/AiInsightsInspector.tsx` | ✅ |
| `src/ui/src/components/AiInsightsPanel.tsx` | `packages/ui/src/features/anomalies/components/AiInsightsPanel.tsx` | ✅ |
| `src/ui/src/components/AnomalyBadge.tsx` | `packages/ui/src/features/anomalies/components/AnomalyBadge.tsx` | ✅ |
| `src/ui/src/components/AnomalyActionButtons.tsx` | `packages/ui/src/features/anomalies/components/AnomalyActionButtons.tsx` | ✅ |
| `src/ui/src/components/BulkAnomalyActions.tsx` | `packages/ui/src/features/anomalies/components/BulkAnomalyActions.tsx` | ✅ |
| `src/ui/src/components/anomaly/*.tsx` | `packages/ui/src/features/anomalies/components/*.tsx` | ✅ |
| `src/ui/src/components/NamespaceView.tsx` | `packages/ui/src/features/namespaces/components/NamespaceView.tsx` | ✅ |
| `src/ui/src/components/NamespaceSwitcher.tsx` | `packages/ui/src/features/namespaces/components/NamespaceSwitcher.tsx` | ✅ |
| `src/ui/src/components/NamespaceTabs.tsx` | `packages/ui/src/features/namespaces/components/NamespaceTabs.tsx` | ✅ |
| `src/ui/src/components/NamespaceSummary.tsx` | `packages/ui/src/features/namespaces/components/NamespaceSummary.tsx` | ✅ |
| `src/ui/src/components/EntityCard.tsx` | `packages/ui/src/features/namespaces/components/EntityCard.tsx` | ✅ |
| `src/ui/src/components/EntityList.tsx` | `packages/ui/src/features/namespaces/components/EntityList.tsx` | ✅ |
| `src/ui/src/components/ConnectForm.tsx` | `packages/ui/src/features/namespaces/components/ConnectForm.tsx` | ✅ |
| `src/ui/src/components/ConnectModal.tsx` | `packages/ui/src/features/namespaces/components/ConnectModal.tsx` | ✅ |

### Shared UI Components

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/components/Toast.tsx` | `packages/ui/src/shared/ui/molecules/Toast.tsx` | ✅ |
| `src/ui/src/components/Tooltip.tsx` | `packages/ui/src/shared/ui/atoms/Tooltip.tsx` | ✅ |
| `src/ui/src/components/GradientButton.tsx` | `packages/ui/src/shared/ui/atoms/GradientButton.tsx` | ✅ |
| `src/ui/src/components/StatusDot.tsx` | `packages/ui/src/shared/ui/atoms/StatusDot.tsx` | ✅ |
| `src/ui/src/components/Pagination.tsx` | `packages/ui/src/shared/ui/molecules/Pagination.tsx` | ✅ |
| `src/ui/src/components/TopBar.tsx` | `packages/ui/src/shared/ui/organisms/TopBar.tsx` | ✅ |
| `src/ui/src/components/BreadcrumbBar.tsx` | `packages/ui/src/shared/ui/molecules/BreadcrumbBar.tsx` | ✅ |
| `src/ui/src/components/MultiFab.tsx` | `packages/ui/src/shared/ui/molecules/MultiFab.tsx` | ✅ |
| `src/ui/src/components/JsonModal.tsx` | `packages/ui/src/shared/ui/molecules/JsonModal.tsx` | ✅ |
| `src/ui/src/components/CompareModal.tsx` | `packages/ui/src/shared/ui/molecules/CompareModal.tsx` | ✅ |
| `src/ui/src/components/AuthErrorBanner.tsx` | `packages/ui/src/shared/ui/molecules/AuthErrorBanner.tsx` | ✅ |
| `src/ui/src/components/IdleWarningBanner.tsx` | `packages/ui/src/shared/ui/molecules/IdleWarningBanner.tsx` | ✅ |
| `src/ui/src/components/SessionExpiredModal.tsx` | `packages/ui/src/shared/ui/molecules/SessionExpiredModal.tsx` | ✅ |

### Hooks → Feature APIs

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/hooks/queries/useMessagesQuery.ts` | `packages/ui/src/features/messages/api/useMessages.ts` | 🔄 |
| `src/ui/src/hooks/mutations/useMessageMutations.ts` | `packages/ui/src/features/messages/api/useMessageActions.ts` | 🔄 |
| `src/ui/src/hooks/queries/useEntitiesQuery.ts` | `packages/ui/src/features/namespaces/api/useEntities.ts` | 🔄 |
| `src/ui/src/hooks/mutations/useNamespaceMutations.ts` | `packages/ui/src/features/namespaces/api/useNamespaceActions.ts` | 🔄 |
| `src/ui/src/hooks/queries/useAIAnalysisQuery.ts` | `packages/ui/src/features/anomalies/api/useAIAnalysis.ts` | 🔄 |
| `src/ui/src/hooks/mutations/useRemediationMutations.ts` | `packages/ui/src/features/anomalies/api/useRemediationActions.ts` | 🔄 |

### Stores → Feature Stores

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/store/messageStore.ts` | `packages/ui/src/features/messages/store/messagesStore.ts` | 🔄 |
| `src/ui/src/store/namespaceStore.ts` | `packages/ui/src/features/namespaces/store/namespaceStore.ts` | 🔄 |
| `src/ui/src/store/aiInsightsStore.ts` | `packages/ui/src/features/anomalies/store/aiInsightsStore.ts` | 🔄 |
| `src/ui/src/store/uiStore.ts` | `packages/ui/src/shared/store/uiStore.ts` | ✅ |

### Types → Shared Contracts

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/types/index.ts` | `packages/shared/contracts/typescript/index.ts` | 📦 |
| `src/ui/src/types/anomaly.ts` | `packages/shared/contracts/typescript/index.ts` | 📦 |
| `src/ui/src/types/remediation.ts` | `packages/shared/contracts/typescript/index.ts` | 📦 |

### API Client

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/api/client.ts` | `packages/ui/src/shared/api/client.ts` | 🔄 |
| `src/ui/src/api/errors.ts` | `packages/ui/src/shared/api/errors.ts` | ✅ |
| `src/ui/src/config/api.ts` | `packages/ui/src/shared/api/config.ts` | ✅ |
| `src/ui/src/config/queryClient.ts` | `packages/ui/src/shared/api/queryClient.ts` | ✅ |

### App Entry Points

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/App.tsx` | `packages/ui/src/app/page.tsx` | 🔄 |
| `src/ui/src/main.tsx` | `packages/ui/src/app/layout.tsx` | 🔄 |
| `src/ui/src/index.css` | `packages/ui/src/styles/globals.css` | 🔄 |

### Utilities

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ui/src/utils/formatters.ts` | `packages/shared/utils/typescript/index.ts` | 📦 |
| `src/ui/src/utils/validation.ts` | `packages/shared/utils/typescript/index.ts` | 📦 |
| `src/ui/src/utils/debounce.ts` | `packages/ui/src/shared/lib/debounce.ts` | ✅ |
| `src/ui/src/utils/correlation.ts` | `packages/ui/src/shared/lib/correlation.ts` | ✅ |
| `src/ui/src/utils/eventTypeExtractor.ts` | `packages/ui/src/shared/lib/eventTypeExtractor.ts` | ✅ |
| `src/ui/src/utils/logger.ts` | `packages/ui/src/shared/lib/logger.ts` | ✅ |

---

## API Migration (src/ServiceBusInspectorApi → packages/api)

### Main Application

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ServiceBusInspectorApi/Program.cs` | `packages/api/ServiceBusInspector.Api/Program.cs` | 📦 |
| `src/ServiceBusInspectorApi/appsettings.Development.json` | `packages/api/ServiceBusInspector.Api/appsettings.Development.json` | ✅ |

### Models → Entities/DTOs

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ServiceBusInspectorApi/Models/AiInsightsModels.cs` | `packages/api/ServiceBusInspector.Core/DTOs/AiInsightsDto.cs` | 🔄 |
| `src/ServiceBusInspectorApi/Models/AuditEntry.cs` | `packages/api/ServiceBusInspector.Core/Entities/AuditEntry.cs` | ✅ |
| `src/ServiceBusInspectorApi/Models/SessionInfo.cs` | `packages/api/ServiceBusInspector.Api/Program.cs` | 📦 |
| `src/ServiceBusInspectorApi/Models/TokenMapping.cs` | `packages/api/ServiceBusInspector.Core/DTOs/TokenMapping.cs` | ✅ |

### Services → Core/Infrastructure

| Current File | New Location | Action |
|--------------|--------------|--------|
| `src/ServiceBusInspectorApi/Services/AiInsightsService.cs` | `packages/api/ServiceBusInspector.Infrastructure/AI/AiInsightsClient.cs` | 🔄 |
| `src/ServiceBusInspectorApi/Services/AuditStore.cs` | `packages/api/ServiceBusInspector.Infrastructure/Database/AuditRepository.cs` | 🔄 |
| `src/ServiceBusInspectorApi/Services/KeyVaultService.cs` | `packages/api/ServiceBusInspector.Infrastructure/KeyVault/KeyVaultService.cs` | ✅ |
| `src/ServiceBusInspectorApi/Services/ServiceBusProvisioningService.cs` | `packages/api/ServiceBusInspector.Infrastructure/ServiceBus/ServiceBusClientFactory.cs` | 📦 |
| `src/ServiceBusInspectorApi/Services/ServiceBusErrorClassifier.cs` | `packages/api/ServiceBusInspector.Core/Services/ErrorClassifierService.cs` | 🔄 |
| `src/ServiceBusInspectorApi/Services/ProblemResults.cs` | `packages/api/ServiceBusInspector.Core/DTOs/ProblemResult.cs` | ✅ |

### New Files (Clean Architecture)

| New File | Purpose |
|----------|---------|
| `packages/api/ServiceBusInspector.Core/Interfaces/IMessageService.cs` | 🆕 Service contract |
| `packages/api/ServiceBusInspector.Core/Interfaces/IAnomalyService.cs` | 🆕 Service contract |
| `packages/api/ServiceBusInspector.Core/Services/MessageService.cs` | 🆕 Business logic |
| `packages/api/ServiceBusInspector.Core/Services/AnomalyService.cs` | 🆕 Business logic |
| `packages/api/ServiceBusInspector.Infrastructure/ServiceBus/ServiceBusRepository.cs` | 🆕 Data access |
| `packages/api/ServiceBusInspector.Api/Middleware/ErrorHandlingMiddleware.cs` | 🆕 Error handling |
| `packages/api/ServiceBusInspector.Api/Middleware/SessionMiddleware.cs` | 🆕 Session validation |
| `packages/api/ServiceBusInspector.Api/Controllers/MessagesController.cs` | 🆕 Message endpoints |
| `packages/api/ServiceBusInspector.Api/Controllers/AnomaliesController.cs` | 🆕 Anomaly endpoints |

---

## Shared Contracts

### TypeScript Types

| Source | Target |
|--------|--------|
| `src/ui/src/types/index.ts` | `packages/shared/contracts/typescript/index.ts` |
| `src/ui/src/types/anomaly.ts` | `packages/shared/contracts/typescript/index.ts` |

### C# DTOs

| Source | Target |
|--------|--------|
| `src/ServiceBusInspectorApi/Models/*.cs` | `packages/shared/contracts/csharp/Contracts.cs` |

### Python Schemas

| Target (New) | Purpose |
|--------------|---------|
| `packages/shared/contracts/python/schemas.py` | 🆕 Pydantic models |

---

## Migration Commands

### Step 1: Preserve Git History

```bash
# Create backup branch
git checkout -b backup-before-migration

# Return to main branch
git checkout dglocal-sbai-110126
```

### Step 2: Move Files (preserving history)

```bash
# Example: Move MessageTable
git mv src/ui/src/components/MessageTable.tsx packages/ui/src/features/messages/components/MessageTable.tsx
git mv src/ui/src/components/MessageTable.css packages/ui/src/features/messages/components/MessageTable.css
```

### Step 3: Update Imports

After moving files, update import paths:

```typescript
// Before
import { MessageEnvelope } from '../types';
import { apiClient } from '../api/client';

// After
import { MessageEnvelope } from '@servicebus-inspector/shared';
import { apiClient } from '@/shared/api/client';
```

### Step 4: Verify Build

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
```

---

## Migration Priority

### Phase 2a: Shared Contracts (Day 1)
1. Move types to `packages/shared/contracts/typescript`
2. Build shared package
3. Update UI imports to use `@servicebus-inspector/shared`

### Phase 2b: UI Components (Days 2-3)
1. Move components to feature folders
2. Update imports
3. Verify UI builds and works

### Phase 2c: API Structure (Days 4-5)
1. Create Clean Architecture projects
2. Move and refactor services
3. Extract business logic to Core
4. Move infrastructure concerns

### Phase 2d: Integration (Day 6-7)
1. Wire up all layers
2. End-to-end testing
3. Fix any remaining issues

---

## Files to Delete After Migration

Once migration is verified working:

```bash
# Remove old UI source
rm -rf src/ui

# Remove old API source
rm -rf src/ServiceBusInspectorApi

# Keep these for reference/tools
# - scripts/
# - tests/ (move to package test folders)
```

## Notes

- **Do not delete original files** until new structure is fully tested
- **Commit frequently** during migration
- **Keep both structures** working in parallel during transition
- **Run tests** after each major move
