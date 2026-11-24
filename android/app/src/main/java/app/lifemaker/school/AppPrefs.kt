package app.lifemaker.school

import android.content.Context
import android.provider.Settings
import org.json.JSONArray
import java.security.MessageDigest
import java.util.UUID

object AppPrefs {
    private const val PREF_NAME = "life_maker_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_SCHOOL_ID = "school_id"
    private const val KEY_STUDENT_IDS = "student_ids_json"
    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_VOICE_GUARD_ENABLED = "voice_guard_enabled"
    private const val KEY_SEEN_IDS = "seen_notif_ids_json"

    private val SAFE_KEY_REGEX = Regex("[.#$\\[\\]/\\s]")

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun sanitizeRtdbKey(raw: String): String =
        raw.trim().replace(SAFE_KEY_REGEX, "_")

    fun getPersistentHardwareDeviceId(context: Context): String {
        val androidId = try {
            Settings.Secure.getString(
                context.applicationContext.contentResolver,
                Settings.Secure.ANDROID_ID
            )?.trim().orEmpty()
        } catch (_: Exception) {
            ""
        }
        if (androidId.isNotEmpty() && androidId != "9774d56d682e549c") {
            return try {
                val digest = MessageDigest.getInstance("SHA-256")
                    .digest("schoolplus_hw_v1:$androidId".toByteArray(Charsets.UTF_8))
                val hex = digest.joinToString("") { "%02x".format(it) }.take(32)
                "and_$hex"
            } catch (_: Exception) {
                "and_${sanitizeRtdbKey(androidId)}"
            }
        }
        return getOrCreateDeviceId(context)
    }

    fun getOrCreateDeviceId(context: Context): String {
        val p = prefs(context)
        val existing = p.getString(KEY_DEVICE_ID, null)
        if (!existing.isNullOrBlank()) return existing
        val created = "lm_android_" + UUID.randomUUID().toString().replace("-", "").take(16)
        p.edit().putString(KEY_DEVICE_ID, created).apply()
        return created
    }

    fun saveIdentity(context: Context, userId: String, schoolId: String, studentIds: List<String>) {
        val arr = JSONArray()
        studentIds.map { it.trim() }.filter { it.isNotEmpty() }.distinct().forEach { arr.put(it) }
        prefs(context).edit()
            .putString(KEY_USER_ID, userId.trim())
            .putString(KEY_SCHOOL_ID, schoolId.trim())
            .putString(KEY_STUDENT_IDS, arr.toString())
            .apply()
    }

    fun getUserId(context: Context): String =
        prefs(context).getString(KEY_USER_ID, "")?.trim() ?: ""

    fun getSchoolId(context: Context): String =
        prefs(context).getString(KEY_SCHOOL_ID, "")?.trim() ?: ""

    fun getStudentIds(context: Context): List<String> {
        val raw = prefs(context).getString(KEY_STUDENT_IDS, "[]") ?: "[]"
        return try {
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val v = arr.optString(i).trim()
                    if (v.isNotEmpty()) add(v)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun getInboxKeys(context: Context): List<String> {
        val keys = linkedSetOf<String>()
        val uid = getUserId(context)
        if (uid.isNotEmpty()) keys.add(sanitizeRtdbKey(uid))
        getStudentIds(context).forEach { sid ->
            val clean = sanitizeRtdbKey(sid)
            if (clean.isNotEmpty()) keys.add(clean)
        }
        return keys.toList()
    }

    fun setFcmToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_FCM_TOKEN, token.trim()).apply()
    }

    fun getFcmToken(context: Context): String =
        prefs(context).getString(KEY_FCM_TOKEN, "")?.trim() ?: ""

    fun isVoiceGuardEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_VOICE_GUARD_ENABLED, true)

    fun setVoiceGuardEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_VOICE_GUARD_ENABLED, enabled).apply()
    }

    @Synchronized
    fun markNotifSeenIfNew(context: Context, notifId: String): Boolean {
        val clean = notifId.trim()
        if (clean.isEmpty()) return false
        val p = prefs(context)
        val raw = p.getString(KEY_SEEN_IDS, "[]") ?: "[]"
        val list = mutableListOf<String>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val item = arr.optString(i)
                if (item.isNotEmpty()) list.add(item)
            }
        } catch (_: Exception) {}

        if (list.contains(clean)) return false

        list.add(clean)
        val trimmed = if (list.size > 200) list.takeLast(200) else list
        val nextArr = JSONArray()
        trimmed.forEach { nextArr.put(it) }
        p.edit().putString(KEY_SEEN_IDS, nextArr.toString()).apply()
        return true
    }
}
