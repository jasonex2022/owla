#!/bin/bash

# OVERWHELM - Quick Deploy Script
# Deploy your own instance in minutes

echo "
╔═══════════════════════════════════════╗
║      OVERWHELM - QUICK DEPLOY         ║
║   Pop-up Protest Coordination Tool    ║
╚═══════════════════════════════════════╝
"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        echo "Please install $1 before running this script"
        exit 1
    fi
}

echo "🔍 Checking prerequisites..."
check_command node
check_command npm
check_command git

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ required (you have $(node -v))${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "\n📦 Installing dependencies..."
    npm install
fi

# Run setup if .env.local doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "\n🔧 Running setup..."
    npm run setup
    
    if [ ! -f ".env.local" ]; then
        echo -e "${RED}❌ Setup was not completed${NC}"
        exit 1
    fi
fi

# Build the project
echo -e "\n🏗️  Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "\n${YELLOW}📥 Installing Vercel CLI...${NC}"
    npm i -g vercel
fi

# Deploy to Vercel
echo -e "\n🚀 Deploying to Vercel..."
echo -e "${YELLOW}Note: You'll need to add environment variables in Vercel dashboard after deployment${NC}"

vercel --prod

if [ $? -eq 0 ]; then
    echo -e "
${GREEN}╔═══════════════════════════════════════╗
║         DEPLOYMENT COMPLETE!          ║
╚═══════════════════════════════════════╝${NC}

Next steps:

1. Go to your Vercel dashboard
2. Navigate to Settings → Environment Variables
3. Add all variables from .env.local
4. Redeploy for changes to take effect

Your Overwhelm instance is now live!

Remember: They can see where we are. They can't stop us all.
"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "Please check the error messages above"
fi