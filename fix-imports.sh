#!/bin/bash
# fix-imports.sh - Automated import path fixer

set -e

echo "🔧 Fixing import paths in packages/ui/src..."

cd packages/ui/src

# Count files to process
total_files=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l)
echo "📝 Processing $total_files TypeScript files..."

count=0

# Fix relative imports to use path aliases
find . -type f \( -name "*.ts" -o -name "*.tsx" \) | while IFS= read -r file; do
  count=$((count + 1))
  
  # Components imports - adjust to feature-specific paths
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/components/([^'\''"]+)['\''"]|from "@/shared/ui/\1"|g' \
    -e 's|from ['\''"]\.\.\/components/([^'\''"]+)['\''"]|from "@/shared/ui/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Hooks imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/hooks/([^'\''"]+)['\''"]|from "@/shared/hooks/\1"|g' \
    -e 's|from ['\''"]\.\.\/hooks/([^'\''"]+)['\''"]|from "@/shared/hooks/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Utils/lib imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/utils/([^'\''"]+)['\''"]|from "@/shared/lib/utils/\1"|g' \
    -e 's|from ['\''"]\.\.\/utils/([^'\''"]+)['\''"]|from "@/shared/lib/utils/\1"|g' \
    -e 's|from ['\''"]\.\.\/\.\.\/services/([^'\''"]+)['\''"]|from "@/shared/lib/services/\1"|g' \
    -e 's|from ['\''"]\.\.\/services/([^'\''"]+)['\''"]|from "@/shared/lib/services/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Store imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/store/([^'\''"]+)['\''"]|from "@/shared/store/\1"|g' \
    -e 's|from ['\''"]\.\.\/store/([^'\''"]+)['\''"]|from "@/shared/store/\1"|g' \
    "$file" 2>/dev/null || true
  
  # API imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/api/([^'\''"]+)['\''"]|from "@/shared/api/\1"|g' \
    -e 's|from ['\''"]\.\.\/api/([^'\''"]+)['\''"]|from "@/shared/api/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Config imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/config/([^'\''"]+)['\''"]|from "@/shared/config/\1"|g' \
    -e 's|from ['\''"]\.\.\/config/([^'\''"]+)['\''"]|from "@/shared/config/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Types imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/types/([^'\''"]+)['\''"]|from "@/shared/types/\1"|g' \
    -e 's|from ['\''"]\.\.\/types/([^'\''"]+)['\''"]|from "@/shared/types/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Contexts imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/contexts/([^'\''"]+)['\''"]|from "@/shared/contexts/\1"|g' \
    -e 's|from ['\''"]\.\.\/contexts/([^'\''"]+)['\''"]|from "@/shared/contexts/\1"|g' \
    "$file" 2>/dev/null || true
  
  # Entities imports
  sed -i '' -E \
    -e 's|from ['\''"]\.\.\/\.\.\/entities/([^'\''"]+)['\''"]|from "@/shared/entities/\1"|g' \
    -e 's|from ['\''"]\.\.\/entities/([^'\''"]+)['\''"]|from "@/shared/entities/\1"|g' \
    "$file" 2>/dev/null || true
done

cd ../../..

echo "✅ Import path fixing complete!"
echo "📊 Processed $total_files files"
