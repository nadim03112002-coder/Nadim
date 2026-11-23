# LIFE MAKER — Native Android App (`https://lmps27.vercel.app`)

Yeh folder **LIFE MAKER** ka poora Native Android Kotlin project hai (`applicationId: app.lifemaker.school`).

## Features Included
- **Main Domain**: Seedhe `https://lmps27.vercel.app` ko full-screen edge-to-edge Android WebView me open karta hai.
- **Animated Splash + Live Reconnect Banner + Adaptive Icon**:
  - Orbiting golden halo ring aur smooth fade-out transition splash screen par.
  - Internet jaane/aane par top live reconnection banner bina poori screen khoye.
  - Adaptive Icon (`mipmap-anydpi-v26`) taaki har Android launcher me icon sharp dikhe.
- **Lock-Screen Hindi Voice Alerts (`VoiceAnnouncer` + `TextToSpeech`)**:
  - Phone **band/locked** hone par bhi Face Attendance (In/Out), Fee Receipt, Notice aur Messages ko saaf **Hindi (`hi-IN`)** me bolkar sunata hai.
  - **2-Layer Protection**: `VoiceGuardService` (bina `google-services.json` ke bhi turant chalta hai) + `LifeMakerMessagingService` (Data-Only FCM wakeup).
- **Native Hardware & Play-Store UX**:
  - **Camera & Mic**: Face Attendance Kiosk & QR scanner permissions.
  - **Haptics, Native Share Sheet, Print/PDF & Fingerprint Biometric Bridge**: `window.LifeMakerAndroid` ke zariye integrated.

---

## APK Kaise Banayein?

### Tarika 1: GitHub Actions Se 1-Click Cloud Build
1. Code ko apne GitHub repository me push karein.
2. GitHub par **Actions** tab me jayein → **Build LIFE MAKER Android APK** → **Run workflow** click karein.
3. ~2 minute me **Artifacts** me **`LIFE-MAKER-Android-APK`** (`LIFE-MAKER.apk`) download ho jayega.

---

## Permanent Keystore Setup (Taaki Future Updates Bina Uninstall Kiye Install Hon)
Agar aap chahte hain ki har naya APK **purane app ke upar direct "Update"** ho (aur Play Store `.aab` bhi bane), toh sirf **ek baar** apna Release Keystore banayein:

```bash
keytool -genkey -v -keystore lifemaker-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias lifemaker
base64 -w 0 lifemaker-release.jks
```

Phir GitHub Repository → **Settings → Secrets and variables → Actions** me yeh 4 secrets add karein:
- `ANDROID_KEYSTORE_BASE64`: (upar wala base64 string)
- `ANDROID_KEYSTORE_PASSWORD`: (aapka keystore password)
- `ANDROID_KEY_ALIAS`: `lifemaker`
- `ANDROID_KEY_PASSWORD`: (aapka key password)

Iske baad GitHub Actions automatically **Signed `LIFE-MAKER.apk`** aur **Play Store `LIFE-MAKER.aab`** dono banayega!

---

## Optional: `google-services.json` (Zero-Battery FCM Wakeup)
1. Firebase Console (`nst2512-6a2e4`) → **Add App → Android** (`app.lifemaker.school`).
2. `google-services.json` ko `android/app/google-services.json` me rakhein ya GitHub Secret `ANDROID_GOOGLE_SERVICES_JSON` me save karein.
