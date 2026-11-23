plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val hasGoogleServices = file("google-services.json").exists()
if (hasGoogleServices) {
    apply(plugin = "com.google.gms.google-services")
}

val keystoreFile = file("keystore.jks")
val hasReleaseKeystore = keystoreFile.exists()

android {
    namespace = "app.lifemaker.school"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.lifemaker.school"
        minSdk = 24
        targetSdk = 34
        versionCode = (System.getenv("ANDROID_VERSION_CODE")?.toIntOrNull()) ?: 2
        versionName = System.getenv("ANDROID_VERSION_NAME") ?: "1.1.0"

        buildConfigField("boolean", "HAS_GOOGLE_SERVICES", hasGoogleServices.toString())
        buildConfigField("String", "APP_BASE_URL", "\"https://lmps27.vercel.app\"")
        buildConfigField("String", "RTDB_BASE_URL", "\"https://nst2512-6a2e4-default-rtdb.asia-southeast1.firebasedatabase.app\"")
    }

    if (hasReleaseKeystore) {
        signingConfigs {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: ""
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: ""
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.biometric:biometric:1.1.0")

    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
