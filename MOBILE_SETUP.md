# 📱 APB Tippspil - Mobile App Setup Guide

## 🎯 Yfirlit

Þessi guide útskýrir hvernig á að umbreyta APB Tippspil vefappinu í native mobile app fyrir iOS og Android með Capacitor.

---

## 📋 Forsendur

### Almennar kröfur:
- Node.js 16+ og npm
- Git
- Vefútgáfa af appinu virk

### iOS þróun:
- macOS tölva
- Xcode 14+ (frá App Store)
- Apple Developer account ($99/ár fyrir distribution)
- CocoaPods: `sudo gem install cocoapods`

### Android þróun:
- Android Studio (Windows/Mac/Linux)
- Java JDK 11+
- Android SDK (kemur með Android Studio)

---

## 🚀 Skref-fyrir-skref uppsetningu

### 1️⃣ Uppsetning á project

```bash
# Búa til project möppu
mkdir apb-tippspil-mobile
cd apb-tippspil-mobile

# Afrita skrárnar þínar
# - index.html
# - app.js
# - firebase.js
# - manifest.json
# - sw.js

# Setja upp npm dependencies
npm install

# Búa til www möppu
mkdir www
```

---

### 2️⃣ Capacitor Initialization

```bash
# Capacitor CLI
npm install -g @capacitor/cli

# Initialize Capacitor (ef ekki þegar gert)
npx cap init "APB Tippspil" "is.apb.tippspil"

# Búa til web assets
npm run build
```

---

### 3️⃣ iOS Setup

```bash
# Bæta við iOS platform
npm run cap:add:ios

# Sync kóða
npm run cap:sync

# Opna í Xcode
npm run cap:open:ios
```

**Í Xcode:**

1. Velja "Runner" project í vinstri hlið
2. Fara í "Signing & Capabilities"
3. Velja Team (Apple Developer account)
4. Breyta Bundle Identifier ef þarf: `is.apb.tippspil`
5. Bæta við capabilities:
   - Push Notifications
   - Background Modes (Remote notifications)
6. Velja device eða simulator
7. Ýta á Play til að keyra

**Fyrir App Store:**
1. Í Xcode: Product → Archive
2. Distribute App → App Store Connect
3. Fylgja leiðbeiningum

---

### 4️⃣ Android Setup

```bash
# Bæta við Android platform
npm run cap:add:android

# Sync kóða
npm run cap:sync

# Opna í Android Studio
npm run cap:open:android
```

**Í Android Studio:**

1. Bíða eftir Gradle sync
2. Fara í `File → Project Structure → Modules`
3. Velja rétta SDK (API 33+)
4. Build → Make Project
5. Velja emulator eða physical device
6. Run → Run 'app'

**Fyrir Google Play:**
1. Build → Generate Signed Bundle / APK
2. Velja Android App Bundle
3. Búa til signing key eða nota núverandi
4. Fylgja leiðbeiningum

---

### 5️⃣ Firebase Configuration fyrir Mobile

**Android (`android/app/google-services.json`):**

1. Fara á Firebase Console
2. Project Settings → Add app → Android
3. Package name: `is.apb.tippspil`
4. Download `google-services.json`
5. Setja í `android/app/`

**iOS (`ios/App/GoogleService-Info.plist`):**

1. Firebase Console → Add app → iOS
2. Bundle ID: `is.apb.tippspil`
3. Download `GoogleService-Info.plist`
4. Setja í `ios/App/App/`

---

## 🔧 Nauðsynlegar breytingar á kóða

### index.html - Meta tags fyrir mobile

```html
<head>
  <!-- Bæta við þessu -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  
  <!-- Safe areas fyrir iPhone með notch -->
  <style>
    body {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }
  </style>
</head>
```

### app.js - Bæta við Capacitor imports

```javascript
// Efst í skránni
import { Capacitor } from '@capacitor/core';

// Athuga platform
const platform = Capacitor.getPlatform(); // 'ios', 'android', eða 'web'
const isNative = Capacitor.isNativePlatform();
```

---

## 📱 Platform-specific features

### Notifications

```javascript
import { LocalNotifications } from '@capacitor/local-notifications';

async function scheduleNotification(title, body, date) {
  await LocalNotifications.schedule({
    notifications: [{
      title: title,
      body: body,
      id: Math.floor(Math.random() * 100000),
      schedule: { at: date },
      sound: 'default'
    }]
  });
}
```

### Haptic Feedback

```javascript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Light tap
await Haptics.impact({ style: ImpactStyle.Light });

// Medium tap
await Haptics.impact({ style: ImpactStyle.Medium });

// Heavy tap
await Haptics.impact({ style: ImpactStyle.Heavy });
```

### Share funktionalitet

```javascript
import { Share } from '@capacitor/share';

async function shareLeague(code) {
  await Share.share({
    title: 'APB Tippspil',
    text: `Ganstu í deildina! Kóði: ${code}`,
    dialogTitle: 'Deila'
  });
}
```

---

## 🎨 Icon & Splash Screen

### App Icons

**iOS:**
- 1024x1024 PNG (App Store)
- Setja í: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Android:**
- 512x512 PNG fyrir launcher icon
- Nota Android Studio: `File → New → Image Asset`

### Splash Screens

```bash
# Install splash screen generator
npm install -g cordova-res

# Generate all sizes
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

---

## 🔄 Uppfærsluferli

```bash
# 1. Breyta kóða
# 2. Build
npm run build

# 3. Sync með mobile platforms
npm run cap:sync

# 4. Test í Xcode/Android Studio
npm run cap:open:ios
npm run cap:open:android
```

---

## 🐛 Algengustu villur & lausnir

### "Plugin not found"
```bash
npm install @capacitor/[plugin-name]
npx cap sync
```

### Firebase ekki að virka
- Athuga að `google-services.json` og `GoogleService-Info.plist` séu á réttum stað
- Rebuild project

### Keyboard ekki að haga sér rétt
```javascript
import { Keyboard } from '@capacitor/keyboard';

Keyboard.setAccessoryBarVisible({ isVisible: true });
Keyboard.setScroll({ isDisabled: false });
```

### Push notifications virka ekki
- Athuga certificates á Apple Developer
- Android: Athuga Firebase Cloud Messaging setup

---

## 📦 Build fyrir production

### iOS

```bash
# 1. Uppfæra version number í Xcode
# 2. Archive
# Product → Archive í Xcode

# 3. Upload til App Store Connect
# Window → Organizer → Distribute App
```

### Android

```bash
# 1. Uppfæra version í android/app/build.gradle
versionCode 1
versionName "1.0.0"

# 2. Generate signed bundle
# Build → Generate Signed Bundle / APK

# 3. Upload til Google Play Console
```

---

## 🔐 Security Checklist

- ✅ API keys ekki í kóða
- ✅ Firebase security rules rétt settar
- ✅ SSL/HTTPS fyrir allar API calls
- ✅ ProGuard enabled fyrir Android
- ✅ Code obfuscation fyrir iOS

---

## 📊 Analytics & Monitoring

```bash
# Firebase Analytics
npm install @capacitor-firebase/analytics

# Crashlytics
npm install @capacitor-firebase/crashlytics
```

---

## 🎯 Next Steps

1. **Testing:**
   - TestFlight fyrir iOS
   - Google Play Internal Testing fyrir Android

2. **Beta þátttakendur:**
   - Bjóða notendum í beta test
   - Safna feedback

3. **Launch:**
   - Submit til App Store
   - Submit til Google Play
   - Bíða eftir review (1-3 dagar iOS, nokkrar klukkustundir Android)

---

## 📞 Hjálp & Support

**Capacitor Docs:**
- https://capacitorjs.com/docs

**Firebase Docs:**
- https://firebase.google.com/docs

**Common Issues:**
- https://github.com/ionic-team/capacitor/issues

---

## ✅ Checklist fyrir release

### iOS
- [ ] Xcode project buildar
- [ ] App icons settar
- [ ] Splash screen sett
- [ ] Firebase configured
- [ ] Push notifications tested
- [ ] App Store screenshots
- [ ] Privacy Policy URL
- [ ] Terms of Service URL
- [ ] App Store description
- [ ] Submit til review

### Android
- [ ] Android Studio buildar
- [ ] App icons settar
- [ ] Splash screen sett
- [ ] Firebase configured
- [ ] Push notifications tested
- [ ] Google Play screenshots
- [ ] Privacy Policy URL
- [ ] Google Play description
- [ ] Submit til review

---

**Gangi þér vel! 🚀**
