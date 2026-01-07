#!/bin/bash

# Deploy script með automatic versioning

echo "🚀 Deploying APB Handball App..."

# Búa til nýtt version number (timestamp)
VERSION=$(date +%Y%m%d%H%M%S)

echo "📦 Version: $VERSION"

# Uppfæra CACHE_VERSION í sw.js
sed -i.bak "s/const CACHE_VERSION = 'v[0-9]*'/const CACHE_VERSION = 'v$VERSION'/" sw.js
echo "✅ Updated sw.js cache version"

# Deploy til Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy --only hosting

echo "✅ Deploy complete!"
echo "🎉 Version $VERSION is now live!"

# Hreinsa backup skrár
rm -f sw.js.bak

echo ""
echo "ℹ️  Notendur munu sjá popup til að uppfæra næst þegar þeir heimsækja síðuna"
