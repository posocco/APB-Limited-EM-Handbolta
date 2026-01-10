# 🚀 QUICKSTART GUIDE - APB Tippspil Mobile

## ⚡ Fljótleg uppsetning (5-10 mínútur)

### Skref 1: Forsendur ✅

**Athugaðu að þú hafir:**
- ✅ Node.js 16+ uppsett: `node --version`
- ✅ npm uppsett: `npm --version`
- ✅ (Fyrir iOS) Xcode uppsett á Mac
- ✅ (Fyrir Android) Android Studio uppsett

### Skref 2: Sækja og setja upp 📥

```bash
# 1. Búa til project möppu
mkdir apb-tippspil-mobile
cd apb-tippspil-mobile

# 2. Afrita allar skrárnar þínar hingað:
#    - index.html (uppfærða útgáfu með mobile CSS)
#    - app.js (þinn núverandi kóði)
#    - firebase.js (þinn Firebase config)
#    - manifest.json
#    - sw.js
#    - capacitor.config.json (nýja skráin)
#    - package.json (nýja skráin)

# 3. Setja upp dependencies
npm install

# 4. Setja upp Capacitor CLI globally
npm install -g @capacitor/cli
```

### Skref 3: Byggja Web Assets 🔨

```bash
# Búa til www möppu og build
npm run build
```

### Skref 4A: iOS Setup (ef þú ert á Mac) 🍎

```bash
# 1. Bæta við iOS platform
npm run cap:add:ios

# 2. Setja Firebase config
# Afrita GoogleService-Info.plist í: ios/App/App/

# 3. Sync
npm run cap:sync

# 4. Opna í Xcode
npm run cap:open:ios
```

**Í Xcode:**
1. Smella á "Runner" project í vinstri hlið
2. Fara í "Signing & Capabilities" tab
3. Velja þinn Team (Apple Developer account)
4. Breyta Bundle Identifier í `is.apb.tippspil` (eða eitthvað annað unique)
5. Velja simulator (t.d. iPhone 15 Pro)
6. Ýta á ▶️ Play til að keyra

### Skref 4B: Android Setup 🤖

```bash
# 1. Bæta við Android platform
npm run cap:add:android

# 2. Setja Firebase config
# Afrita google-services.json í: android/app/

# 3. Sync
npm run cap:sync

# 4. Opna í Android Studio
npm run cap:open:android
```

**Í Android Studio:**
1. Bíða eftir Gradle sync (getur tekið nokkrar mínútur)
2. Fara í `Tools → Device Manager`
3. Búa til eða velja emulator
4. Smella á ▶️ Run til að keyra appið

## 🎯 Hratt Test

### Prófun á iOS Simulator

```bash
# Einfaldasta leiðin
npm run deploy:ios
```

Þetta mun:
1. Byggja web assets
2. Sync-a með iOS
3. Opna Xcode

### Prófun á Android Emulator

```bash
# Einfaldasta leiðin
npm run deploy:android
```

Þetta mun:
1. Byggja web assets
2. Sync-a með Android
3. Opna Android Studio

## 🔧 Algeng vandamál & lausnir

### "capacitor: command not found"
```bash
npm install -g @capacitor/cli
```

### "CocoaPods not installed" (iOS)
```bash
sudo gem install cocoapods
cd ios/App
pod install
```

### "SDK not found" (Android)
```bash
# Í Android Studio:
# File → Project Structure → SDK Location
# Velja Android SDK path
```

### Firebase virkar ekki
```bash
# Athuga að config skrár séu á réttum stað:
# iOS: ios/App/App/GoogleService-Info.plist
# Android: android/app/google-services.json

# Endurbyggja
npm run build
npm run cap:sync
```

## 📝 Breytingar á núverandi kóða

### 1. Bæta við mobile CSS í index.html

Opna `index.html` og bæta við þessu **fyrir neðan** `</style>` tagið:

```html
<!-- Mobile Optimizations -->
<link rel="stylesheet" href="mobile-styles.css">
```

### 2. Bæta við Capacitor í app.js

Efst í `app.js`, bæta við:

```javascript
// Check if running in native app
const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

if (isNative) {
  console.log('Running in native app!');
  // Bæta við native-only features hér
}
```

### 3. Breyta notifications til að virka á mobile

Finna `sendNotification` fallið og uppfæra:

```javascript
async function sendNotification(title, body) {
  if (isNative && window.Capacitor.Plugins.LocalNotifications) {
    // Use Capacitor notifications
    await window.Capacitor.Plugins.LocalNotifications.schedule({
      notifications: [{
        title: title,
        body: body,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date(Date.now() + 1000) }
      }]
    });
  } else if (Notification.permission === "granted") {
    // Use web notifications
    new Notification(title, { body: body });
  }
}
```

## 🎨 Næstu skref

### 1. Customize App Icons

```bash
# Setja 1024x1024 PNG mynd í:
# - icon.png (í root)

# Generate öll sizes
npm install -g cordova-res
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

### 2. Customize Splash Screen

Búa til `splash.png` (2732x2732 PNG) og keyra:

```bash
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

### 3. Test á raunverulegu tæki

**iOS:**
1. Tengja iPhone við Mac með USB
2. Í Xcode, velja þitt device í stað simulator
3. Ýta á Play (gæti þurft að trust developer á tækinu)

**Android:**
1. Enable Developer Options á Android tæki:
   - Settings → About Phone → Tap "Build Number" 7x
2. Enable USB Debugging
3. Tengja með USB
4. Í Android Studio, velja þitt device
5. Run

## 🚢 Deploy til App Stores

### TestFlight (iOS Beta)

```bash
# Í Xcode:
1. Product → Archive
2. Window → Organizer
3. Distribute App → App Store Connect → Upload
4. Fara á App Store Connect online
5. TestFlight → Add beta testers
```

### Google Play Internal Testing (Android Beta)

```bash
# Í Android Studio:
1. Build → Generate Signed Bundle / APK
2. Android App Bundle
3. Create new keystore eða use existing
4. Build
5. Upload .aab file til Google Play Console
6. Release → Testing → Internal testing
```

## 📊 Monitoring & Analytics

Bæta við Firebase Analytics:

```bash
npm install @capacitor-firebase/analytics
npx cap sync
```

Í `app.js`:

```javascript
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

// Log events
await FirebaseAnalytics.logEvent({
  name: 'tip_submitted',
  params: {
    game_id: gameId,
    league_id: leagueId
  }
});
```

## 🎉 Til hamingju!

Þú ert núna með fullvirkt mobile app! 

### Næstu features sem hægt er að bæta við:

- 📸 Camera integration fyrir profile pictures
- 🌍 Geolocation fyrir staðbundna deildir
- 📱 Biometric authentication (Face ID / Fingerprint)
- 🎮 Gamification með badges og achievements
- 📊 Advanced analytics og insights
- 💾 Offline mode með background sync
- 🔄 Pull-to-refresh
- 🎨 Theme customization

### Hjálp & Support:

- 📚 Lesa [MOBILE_SETUP.md](MOBILE_SETUP.md) fyrir ítarlegri upplýsingar
- 💬 Spyrja á Capacitor Discord: https://discord.gg/UPYYRhtyzp
- 🐛 Report issues á GitHub
- 📧 Hafa samband: support@apb.is

---

**Gangi þér vel! 🚀📱⚽**
