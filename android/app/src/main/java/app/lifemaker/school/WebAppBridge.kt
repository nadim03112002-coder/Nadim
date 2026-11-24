package app.lifemaker.school

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.MediaScannerConnection
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class WebAppBridge(private val activity: MainActivity) {

    @Volatile
    var isTrustedHostActive: Boolean = true

    @JavascriptInterface
    fun isNativeApp(): Boolean = true

    @JavascriptInterface
    fun getBatteryStatus(): String {
        if (!isTrustedHostActive) return """{"supported":false,"level":-1,"charging":false}"""
        return try {
            val batteryIntent: Intent? = activity.registerReceiver(
                null,
                IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            )
            val rawLevel = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val pct = if (rawLevel >= 0 && scale > 0) {
                ((rawLevel * 100f) / scale.toFloat()).toInt().coerceIn(0, 100)
            } else {
                val bm = activity.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
                bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.coerceIn(0, 100) ?: -1
            }
            val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL ||
                plugged != 0
            JSONObject().apply {
                put("supported", pct >= 0)
                put("level", pct)
                put("charging", isCharging)
            }.toString()
        } catch (_: Exception) {
            """{"supported":false,"level":-1,"charging":false}"""
        }
    }

    @JavascriptInterface
    fun getNativeFcmToken(): String {
        if (!isTrustedHostActive) return ""
        return AppPrefs.getFcmToken(activity.applicationContext)
    }

    @JavascriptInterface
    fun getPersistentDeviceId(): String {
        if (!isTrustedHostActive) return ""
        return AppPrefs.getPersistentHardwareDeviceId(activity.applicationContext)
    }

    @JavascriptInterface
    fun isVoiceGuardEnabled(): Boolean {
        if (!isTrustedHostActive) return false
        return AppPrefs.isVoiceGuardEnabled(activity.applicationContext)
    }

    @JavascriptInterface
    fun setVoiceGuardEnabled(enabled: Boolean) {
        if (!isTrustedHostActive) return
        AppPrefs.setVoiceGuardEnabled(activity.applicationContext, enabled)
        activity.runOnUiThread {
            if (enabled) {
                VoiceGuardService.startOrUpdate(activity.applicationContext)
            } else {
                VoiceGuardService.stop(activity.applicationContext)
            }
        }
    }

    @JavascriptInterface
    fun speakNativeVoice(text: String, dedupeKey: String?) {
        if (!isTrustedHostActive) return
        VoiceAnnouncer.speakDirect(activity.applicationContext, text, dedupeKey)
    }

    @JavascriptInterface
    fun triggerHaptic(kind: String?) {
        if (!isTrustedHostActive) return
        activity.runOnUiThread {
            activity.performNativeHaptic(kind ?: "light")
        }
    }

    @JavascriptInterface
    fun shareText(title: String?, text: String?, url: String?) {
        if (!isTrustedHostActive) return
        activity.runOnUiThread {
            activity.shareNativeContent(title.orEmpty(), text.orEmpty(), url.orEmpty())
        }
    }

    @JavascriptInterface
    fun openBatteryOptimizationSettings() {
        if (!isTrustedHostActive) return
        activity.runOnUiThread {
            activity.requestBatteryOptimizationExemption()
        }
    }

    @JavascriptInterface
    fun authenticateBiometric(promptTitle: String?, jsCallbackName: String?) {
        if (!isTrustedHostActive) return
        val safeCb = (jsCallbackName ?: "__onLifeMakerBiometricResult")
            .replace(Regex("[^a-zA-Z0-9_]"), "")
            .ifBlank { "__onLifeMakerBiometricResult" }
        activity.runOnUiThread {
            activity.launchBiometricPrompt(
                promptTitle?.takeIf { it.isNotBlank() } ?: "SCHOOL+ Unlock",
                safeCb
            )
        }
    }

    @JavascriptInterface
    fun syncIdentity(jsonStr: String) {
        if (!isTrustedHostActive) return
        try {
            val obj = JSONObject(jsonStr)
            val userId = obj.optString("userId", "").trim()
            val schoolId = obj.optString("schoolId", "").trim()
            val arr = obj.optJSONArray("studentIds")
            val studentIds = buildList {
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        val s = arr.optString(i, "").trim()
                        if (s.isNotEmpty()) add(s)
                    }
                }
            }
            AppPrefs.saveIdentity(activity.applicationContext, userId, schoolId, studentIds)
            activity.runOnUiThread {
                if (userId.isEmpty() && studentIds.isEmpty()) {
                    VoiceGuardService.stop(activity.applicationContext)
                } else if (AppPrefs.isVoiceGuardEnabled(activity.applicationContext)) {
                    VoiceGuardService.startOrUpdate(activity.applicationContext)
                }
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun printCurrentPage() {
        if (!isTrustedHostActive) return
        activity.runOnUiThread {
            activity.printWebView()
        }
    }

    @JavascriptInterface
    fun printCurrentPageWithOptions(orientation: String?, jobName: String?) {
        if (!isTrustedHostActive) return
        activity.runOnUiThread {
            activity.printWebView(orientation, jobName)
        }
    }

    @JavascriptInterface
    fun openInChrome(url: String?) {
        if (!isTrustedHostActive) return
        val target = url?.trim().orEmpty()
        if (target.isEmpty()) return
        activity.runOnUiThread {
            activity.openUrlInChromeBrowser(target)
        }
    }

    @JavascriptInterface
    fun saveBase64Download(base64Data: String, rawFileName: String?, rawMimeType: String?) {
        if (!isTrustedHostActive) return
        try {
            val pureBase64 = base64Data.substringAfter("base64,", base64Data)
            val bytes = Base64.decode(pureBase64, Base64.DEFAULT)
            val safeFileName = (rawFileName ?: "LifeMaker_Document_${System.currentTimeMillis()}.pdf")
                .replace(Regex("[^a-zA-Z0-9._-]"), "_")
                .ifBlank { "LifeMaker_Document_${System.currentTimeMillis()}.pdf" }
            val mimeType = rawMimeType?.takeIf { it.isNotBlank() } ?: "application/octet-stream"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeFileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val resolver = activity.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { it.write(bytes) }
                }
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val outFile = File(downloadsDir, safeFileName)
                FileOutputStream(outFile).use { it.write(bytes) }
                MediaScannerConnection.scanFile(activity, arrayOf(outFile.absolutePath), arrayOf(mimeType), null)
            }

            activity.runOnUiThread {
                Toast.makeText(activity, "Downloaded: $safeFileName", Toast.LENGTH_SHORT).show()
            }
        } catch (_: Exception) {
            activity.runOnUiThread {
                Toast.makeText(activity, "Download failed", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
