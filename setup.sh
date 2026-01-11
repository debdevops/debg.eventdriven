#!/bin/bash
# ============================================================================
# Service Bus Inspector - Setup Script
# ============================================================================
# This script initializes the monorepo for development
# 
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "=============================================="
echo "  Service Bus Inspector - Setup Script"
echo "  AI-Powered Autopilot for Azure Service Bus"
echo "=============================================="
echo ""

# ==========================================================================
# Check Prerequisites
# ==========================================================================
info "Checking prerequisites..."

# Node.js
if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js 20+ from https://nodejs.org"
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    error "Node.js 20+ is required. Current version: $(node -v)"
fi
success "Node.js $(node -v) ✓"

# PNPM
if ! command -v pnpm &> /dev/null; then
    warn "PNPM not found. Installing..."
    npm install -g pnpm@latest
fi
success "PNPM $(pnpm -v) ✓"

# .NET SDK (optional, for API development)
if command -v dotnet &> /dev/null; then
    DOTNET_VERSION=$(dotnet --version | cut -d'.' -f1)
    if [ "$DOTNET_VERSION" -ge 8 ]; then
        success ".NET SDK $(dotnet --version) ✓"
    else
        warn ".NET SDK 8+ recommended. Current: $(dotnet --version)"
    fi
else
    warn ".NET SDK not found. Required for API development."
fi

# Python (optional, for AI development)
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    success "Python $PYTHON_VERSION ✓"
else
    warn "Python 3.11+ not found. Required for AI service development."
fi

# Docker (optional, for containerized development)
if command -v docker &> /dev/null; then
    success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') ✓"
else
    warn "Docker not found. Required for docker-compose development."
fi

echo ""

# ==========================================================================
# Install Dependencies
# ==========================================================================
info "Installing Node.js dependencies..."
pnpm install

# ==========================================================================
# Build Shared Package
# ==========================================================================
info "Building shared package..."
pnpm --filter @servicebus-inspector/shared build

# ==========================================================================
# Setup UI Package
# ==========================================================================
info "Setting up UI package..."
cd packages/ui

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
# Service Bus Inspector UI - Local Environment
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AI_URL=http://localhost:8000
EOF
    success "Created packages/ui/.env.local"
fi

cd ../..

# ==========================================================================
# Setup Python Environment (if Python available)
# ==========================================================================
if command -v python3 &> /dev/null; then
    info "Setting up Python environment for AI service..."
    cd packages/ai
    
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
        success "Created Python virtual environment"
    fi
    
    # Activate and install dependencies
    source .venv/bin/activate 2>/dev/null || . .venv/bin/activate
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
    deactivate
    success "Installed Python dependencies"
    
    cd ../..
fi

# ==========================================================================
# Setup Git Hooks
# ==========================================================================
info "Setting up Git hooks..."
if [ -d ".git" ]; then
    # Create pre-commit hook
    mkdir -p .git/hooks
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run lint-staged for staged files
npx lint-staged
EOF
    chmod +x .git/hooks/pre-commit
    success "Git hooks configured"
else
    warn "Not a git repository, skipping Git hooks setup"
fi

# ==========================================================================
# Verify Setup
# ==========================================================================
echo ""
info "Verifying setup..."

# Check if turbo is available
if pnpm turbo --version &> /dev/null; then
    success "Turborepo configured ✓"
else
    warn "Turborepo not available. Run 'pnpm install' again."
fi

# ==========================================================================
# Summary
# ==========================================================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Setup Complete! 🎉${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Start development servers:"
echo "     ${BLUE}pnpm dev${NC}            # Start all services"
echo "     ${BLUE}pnpm dev:ui${NC}         # UI only (http://localhost:3000)"
echo ""
echo "  2. Or use Docker:"
echo "     ${BLUE}docker-compose up -d${NC}"
echo ""
echo "  3. Build for production:"
echo "     ${BLUE}pnpm build${NC}"
echo ""
echo "  4. Run tests:"
echo "     ${BLUE}pnpm test${NC}"
echo ""
echo "Documentation:"
echo "  - README.md         - Getting started"
echo "  - ARCHITECTURE.md   - System design"
echo "  - CONTRIBUTING.md   - Development guide"
echo ""
