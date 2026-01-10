# 📱 APB Limited Getraunaleikur EM í Handbolta - Mobile App

## 🎯 Um appið

APB Tippspil er getraunaleikur fyrir Evrópumeistaramótið í handbolta. Appið gerir notendum kleift að:

- ⚽ Tippa úrslit leikja
- 🏆 Keppa í deildum með vinum
- 💬 Spjalla við aðra í deildinni
- 🎁 Svara bónusspurningum fyrir auka stig
- 📊 Fylgjast með stigatöflu í rauntíma
- 🔔 Fá tilkynningar fyrir komandi leiki

## 🚀 Snöggt Setup

### Option 1: Automatic Setup (Mælt með)

```bash
# 1. Clone/Download project
git clone [your-repo-url]
cd apb-tippspil-mobile

# 2. Keyra setup script
chmod +x setup-mobile.sh
./setup-mobile.sh

# 3. Fylgja leiðbeiningum á skjánum
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Build web assets
npm run build

# 3. Add platforms
npm run cap:add:ios      # Fyrir iOS
npm run cap:add:android  # Fyrir Android

# 4. Sync og opna
npm run cap:sync
npm run cap:open:ios     # Fyrir iOS
npm run cap:open:android # Fyrir Android
```

## 📋 Forsendur

### Fyrir alla:
- Node.js 16+ 
- npm
- Git

### Fyrir iOS:
- macOS
- Xcode 14+
- Apple Developer account
- CocoaPods

### Fyrir Android:
- Android Studio
- Java JDK 11+
- Android SDK

## 📱 Platform Specific Setup

### iOS Development

```bash
# 1. Add iOS platform
npm run cap:add:ios

# 2. Sync
npm run cap:sync

# 3. Open in Xcode
npm run cap:open:ios
```

**Í Xcode:**
1. Velja Team (Apple Developer account)
2. Breyta Bundle Identifier: `is.apb.tippspil`
3. Bæta við capabilities:
   - Push Notifications
   - Background Modes
4. Keyra á simulator eða device

### Android Development

```bash
# 1. Add Android platform
npm run cap:add:android

# 2. Sync
npm run cap:sync

# 3. Open in Android Studio
npm run cap:open:android
```

**Í Android Studio:**
1. Bíða eftir Gradle sync
2. Velja SDK version (API 33+)
3. Build project
4. Keyra á emulator eða device

## 🔧 Configuration Files

### Firebase Setup

**Android:** Setja `google-services.json` í:
```
android/app/google-services.json
```

**iOS:** Setja `GoogleService-Info.plist` í:
```
ios/App/App/GoogleService-Info.plist
```

### Capacitor Config

Breyta `capacitor.config.json` ef þörf:

```json
{
  "appId": "is.apb.tippspil",
  "appName": "APB Tippspil",
  "webDir": "www"
}
```

## 🎨 Assets & Icons

### App Icons

**iOS:** 1024x1024 PNG
- Setja í: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Android:** 512x512 PNG
- Nota Android Studio: `File → New → Image Asset`

### Splash Screens

```bash
npm install -g cordova-res
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

## 🔄 Development Workflow

```bash
# 1. Gera breytingar á kóða (index.html, app.js, etc.)

# 2. Build
npm run build

# 3. Sync með platforms
npm run cap:sync

# 4. Test
npm run cap:open:ios      # Fyrir iOS
npm run cap:open:android  # Fyrir Android
```

## 📦 Project Structure

```
apb-tippspil-mobile/
├── android/              # Android native project
├── ios/                  # iOS native project
├── www/                  # Built web assets
├── index.html           # Main HTML
├── app.js               # Main JavaScript
├── firebase.js          # Firebase config
├── capacitor.config.json # Capacitor config
├── package.json         # Dependencies
└── MOBILE_SETUP.md      # Detailed setup guide
```

## 🚢 Release Process

### iOS (TestFlight & App Store)

```bash
# 1. Uppfæra version í Xcode
# 2. Archive: Product → Archive
# 3. Distribute App → App Store Connect
# 4. Submit til review
```

### Android (Google Play)

```bash
# 1. Uppfæra version í build.gradle
# 2. Build → Generate Signed Bundle
# 3. Upload til Google Play Console
# 4. Submit til review
```

## 🔔 Features

### Core Features
- ✅ Firebase Authentication (Email & Google)
- ✅ Real-time database sync
- ✅ Live chat system
- ✅ Push notifications
- ✅ Offline support
- ✅ Haptic feedback

### Mobile-Specific Features
- 📱 Native navigation
- 🔔 Local notifications
- 📲 Share functionality
- ⚡ Haptic feedback
- 📊 Native keyboard handling
- 🎨 Dark mode support

## 🐛 Troubleshooting

### "Plugin not found" error
```bash
npm install @capacitor/[plugin-name]
npx cap sync
```

### Firebase not working
- Athuga `google-services.json` location
- Rebuild project completely

### iOS build fails
```bash
cd ios/App
pod install
cd ../..
npm run cap:sync
```

### Android build fails
```bash
cd android
./gradlew clean
cd ..
npm run cap:sync
```

## 📚 Documentation

- [Detailed Setup Guide](MOBILE_SETUP.md) - Ítarlegar leiðbeiningar
- [Capacitor Docs](https://capacitorjs.com/docs) - Official docs
- [Firebase Docs](https://firebase.google.com/docs) - Firebase documentation

## 🔐 Security

- ✅ API keys í `.env` (ekki í repo)
- ✅ Firebase Security Rules configured
- ✅ HTTPS only
- ✅ ProGuard enabled (Android)
- ✅ Code obfuscation (iOS)

## 📊 Testing

### iOS
```bash
# Simulator
npm run cap:run:ios

# Device
Open Xcode → Select device → Run
```

### Android
```bash
# Emulator
npm run cap:run:android

# Device
Enable USB debugging → Run from Android Studio
```

## 🎯 NPM Scripts

```json
{
  "build": "Build web assets",
  "cap:sync": "Sync web → native",
  "cap:open:ios": "Open Xcode",
  "cap:open:android": "Open Android Studio",
  "deploy:ios": "Build + Sync + Open iOS",
  "deploy:android": "Build + Sync + Open Android"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License - Sjá [LICENSE](LICENSE) skrá

## 👥 Support

- 📧 Email: support@apb.is
- 💬 Discord: [Join our server]
- 🐛 Issues: [GitHub Issues]

## 🎉 Version History

### v1.0.0 (2025-01-10)
- 🎉 Initial mobile release
- ✅ iOS & Android support
- ✅ Firebase integration
- ✅ Real-time features
- ✅ Push notifications

---

**Gangi þér vel með appið! 🚀⚽🏆**
