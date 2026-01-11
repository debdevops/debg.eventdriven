#!/bin/bash
# fix-shared-ui-imports.sh - Fix imports in shared/ui components

set -e

echo "🔧 Fixing imports in shared/ui..."

cd /Users/debasisghosh/Github/debg.eventdriven/packages/ui/src/shared/ui

# Fix all shared/ui components
find . -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
  # Fix imports from ../types to @/shared/types
  sed -i '' "s|from ['\"]../types['\"]|from '@/shared/types'|g" "$file"
  sed -i '' "s|from ['\"]../../types['\"]|from '@/shared/types'|g" "$file"
  sed -i '' "s|from ['\"]../types/|from '@/shared/types/|g" "$file"
  
  # Fix imports from ../features to @/features
  sed -i '' "s|from ['\"]../features/|from '@/features/|g" "$file"
  sed -i '' "s|from ['\"]../../features/|from '@/features/|g" "$file"
  
  # Fix relative component imports within shared/ui
  sed -i '' "s|from ['\"]\./\([^'\"]*\)['\"]|from '@/shared/ui/molecules/\1'|g" "$file"
  
  # Fix specific component imports
  sed -i '' "s|from '@/shared/ui/molecules/BreadcrumbBar'|from './BreadcrumbBar'|g" "$file"
  sed -i '' "s|from '@/shared/ui/molecules/Toast'|from './Toast'|g" "$file"
  sed -i '' "s|from '@/shared/ui/molecules/StatusDot'|from './StatusDot'|g" "$file"
  sed -i '' "s|from '@/shared/ui/molecules/PayloadSummary'|from './PayloadSummary'|g" "$file"
  sed -i '' "s|from '@/shared/ui/molecules/SnapshotControl'|from './SnapshotControl'|g" "$file"
done

echo "✅ shared/ui imports fixed"

# Fix shared/lib imports
cd ../lib

find . -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
  sed -i '' "s|from ['\"]../types['\"]|from '@/shared/types'|g" "$file"
  sed -i '' "s|from ['\"]../../types['\"]|from '@/shared/types'|g" "$file"
  sed -i '' "s|from ['\"]../types/|from '@/shared/types/|g" "$file"
done

echo "✅ shared/lib imports fixed"
