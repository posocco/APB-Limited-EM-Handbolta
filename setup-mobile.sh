#!/bin/bash

# APB Tippspil Mobile - Quick Start Script
# Þetta script setur upp allt sem þarf fyrir mobile development

set -e

echo "🚀 APB Tippspil Mobile Setup"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js er ekki uppsett!${NC}"
    echo "Settu upp Node.js frá: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm er ekki uppsett!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm version: $(npm --version)${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}📦 Setja upp npm packages...${NC}"
npm install

# Install Capacitor CLI globally
echo -e "${YELLOW}📦 Setja upp Capacitor CLI...${NC}"
npm install -g @capacitor/cli

# Create www directory
echo -e "${YELLOW}📁 Búa til www möppu...${NC}"
mkdir -p www

# Build web assets
echo -e "${YELLOW}🔨 Byggja web assets...${NC}"
npm run build

echo ""
echo -e "${GREEN}✅ Grunnuppsetning kláruð!${NC}"
echo ""
echo "Næstu skref:"
echo ""
echo "📱 Fyrir iOS:"
echo "   1. npm run cap:add:ios"
echo "   2. npm run cap:sync"
echo "   3. npm run cap:open:ios"
echo ""
echo "🤖 Fyrir Android:"
echo "   1. npm run cap:add:android"
echo "   2. npm run cap:sync"
echo "   3. npm run cap:open:android"
echo ""

# Check for Xcode (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v xcodebuild &> /dev/null; then
        echo -e "${GREEN}✅ Xcode fannst: $(xcodebuild -version | head -n 1)${NC}"
        echo ""
        echo "Viltu setja upp iOS núna? (y/n)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            echo -e "${YELLOW}🍎 Setja upp iOS...${NC}"
            npm run cap:add:ios
            npm run cap:sync
            echo -e "${GREEN}✅ iOS uppsett! Opna Xcode með: npm run cap:open:ios${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Xcode fannst ekki. Settu upp Xcode úr App Store fyrir iOS þróun.${NC}"
    fi
fi

# Check for Android Studio
if command -v android &> /dev/null || [ -d "$HOME/Library/Android/sdk" ] || [ -d "/usr/local/android-sdk" ]; then
    echo -e "${GREEN}✅ Android SDK fannst${NC}"
    echo ""
    echo "Viltu setja upp Android núna? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}🤖 Setja upp Android...${NC}"
        npm run cap:add:android
        npm run cap:sync
        echo -e "${GREEN}✅ Android uppsett! Opna Android Studio með: npm run cap:open:android${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Android Studio fannst ekki. Settu upp Android Studio fyrir Android þróun.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup lokið!${NC}"
echo ""
echo "📚 Lesa meira í MOBILE_SETUP.md"
echo ""
