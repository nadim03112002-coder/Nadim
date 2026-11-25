package app.lifemaker.school

import android.content.Context
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.UUID

data class CallerDirectoryMatch(
    val schoolName: String,
    val name: String,
    val role: String,
    val last10: String,
    val kind: String = "STAFF",
    val studentSummary: String = "",
    val relationLabel: String = "",
    val fatherName: String = "",
    val primaryStudentId: String = "",
    val dueAmount: Long = 0L,
    val unpaidMonthsCount: Int = 0,
    val promiseDate: String = "",
    val promisedAmount: Long = 0L,
    val nextCallDate: String = "",
    val solvedToday: Boolean = false,
    val settled: Boolean = false,
    val lastNote: String = "",
    val absentToday: Boolean = false,
    val enquiryId: String = "",
    val enquiryStage: String = "",
    val enquiryFollowUpDate: String = "",
    val enquiryVisitDate: String = "",
    val enquiryNote: String = "",
    val counsellorName: String = ""
) {
    fun toJson(
        receivedAtMs: Long = System.currentTimeMillis(),
        postCall: Boolean = false
    ): JSONObject = JSONObject().apply {
        put("phone", last10)
        put("name", name)
        put("role", role)
        put("schoolName", schoolName)
        put("kind", kind)
        put("studentSummary", studentSummary)
        put("relationLabel", relationLabel)
        put("fatherName", fatherName)
        put("primaryStudentId", primaryStudentId)
        put("dueAmount", dueAmount)
        put("unpaidMonthsCount", unpaidMonthsCount)
        put("promiseDate", promiseDate)
        put("promisedAmount", promisedAmount)
        put("nextCallDate", nextCallDate)
        put("solvedToday", solvedToday)
        put("settled", settled)
        put("lastNote", lastNote)
        put("absentToday", absentToday)
        put("enquiryId", enquiryId)
        put("enquiryStage", enquiryStage)
        put("enquiryFollowUpDate", enquiryFollowUpDate)
        put("enquiryVisitDate", enquiryVisitDate)
        put("enquiryNote", enquiryNote)
        put("counsellorName", counsellorName)
        put("postCall", postCall)
        put("receivedAtMs", receivedAtMs)
    }
}

object AppPrefs {
    private const val PREF_NAME = "life_maker_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_SCHOOL_ID = "school_id"
    private const val KEY_STUDENT_IDS = "student_ids_json"
    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_VOICE_GUARD_ENABLED = "voice_guard_enabled"
    private const val KEY_CALLER_VOICE_ANNOUNCE_ENABLED = "caller_voice_announce_enabled"
    private const val KEY_PARENT_CALLER_ID_ENABLED = "parent_caller_id_enabled"
    private const val KEY_PARENT_DUE_VOICE_ENABLED = "parent_due_voice_enabled"
    private const val KEY_PARENT_SCHEDULE_VOICE_ENABLED = "parent_schedule_voice_enabled"
    private const val KEY_PARENT_CARD_POPUP_ENABLED = "parent_card_popup_enabled"
    private const val KEY_PARENT_OVERLAY_ENABLED = "parent_overlay_enabled_v1"
    private const val KEY_LAST_INCOMING_PARENT_CALL = "last_incoming_parent_call_v1"
    private const val KEY_ACTIVE_RINGING_CALLER_JSON = "active_ringing_caller_v1"
    private const val KEY_ACTIVE_RINGING_CALLER_AT_MS = "active_ringing_caller_at_ms"
    private const val KEY_CALLER_DIR_JSON = "school_caller_directory_v1"
    private const val KEY_CALLER_DIR_SCHOOL = "school_caller_directory_school"
    private const val KEY_SEEN_IDS = "seen_notif_ids_json"
    private const val KEY_DEVICE_ADMIN_ENABLED_AT = "device_admin_enabled_at"
    private const val KEY_ACCESSIBILITY_GUARD_LOCKED = "accessibility_guard_locked"
    private const val KEY_GUARD_UNLOCK_UNTIL_MS = "guard_unlock_until_ms"
    private const val KEY_ADMIN_PIN_HASH = "admin_pin_hash_v1"
    private const val KEY_WALKIE_ENABLED = "walkie_enabled_v1"
    private const val KEY_WALKIE_AUTO_PLAY = "walkie_auto_play_v1"
    private const val KEY_WALKIE_START_TIME = "walkie_start_time_v1"
    private const val KEY_WALKIE_END_TIME = "walkie_end_time_v1"
    private const val KEY_WALKIE_DAYS_JSON = "walkie_days_json_v1"

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

    fun getDeviceAdminEnabledAt(context: Context): Long =
        prefs(context).getLong(KEY_DEVICE_ADMIN_ENABLED_AT, 0L)

    fun setDeviceAdminEnabledAt(context: Context, timestampMs: Long) {
        prefs(context).edit().putLong(KEY_DEVICE_ADMIN_ENABLED_AT, timestampMs).apply()
    }

    fun isAccessibilityGuardLocked(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ACCESSIBILITY_GUARD_LOCKED, true)

    fun setAccessibilityGuardLocked(context: Context, locked: Boolean) {
        prefs(context).edit().putBoolean(KEY_ACCESSIBILITY_GUARD_LOCKED, locked).apply()
    }

    fun getGuardUnlockUntilMs(context: Context): Long =
        prefs(context).getLong(KEY_GUARD_UNLOCK_UNTIL_MS, 0L)

    fun setGuardUnlockUntilMs(context: Context, untilMs: Long) {
        prefs(context).edit().putLong(KEY_GUARD_UNLOCK_UNTIL_MS, untilMs).apply()
    }

    fun getAdminPinHash(context: Context): String =
        prefs(context).getString(KEY_ADMIN_PIN_HASH, "")?.trim() ?: ""

    fun hasAdminPinHash(context: Context): Boolean =
        getAdminPinHash(context).isNotEmpty()

    fun setAdminPinHash(context: Context, hash: String?) {
        val clean = hash?.trim().orEmpty()
        prefs(context).edit().putString(KEY_ADMIN_PIN_HASH, clean).apply()
    }

    fun computePinHash(rawPin: String): String {
        val clean = rawPin.trim()
        if (clean.isEmpty()) return ""
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
                .digest("lm_admin_guard_v1:$clean".toByteArray(Charsets.UTF_8))
            digest.joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            ""
        }
    }

    fun verifyAdminPin(context: Context, rawPin: String): Boolean {
        val stored = getAdminPinHash(context)
        if (stored.isEmpty()) return false
        val candidate = computePinHash(rawPin)
        return candidate.isNotEmpty() && candidate.equals(stored, ignoreCase = true)
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

    fun isCallerVoiceAnnounceEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_CALLER_VOICE_ANNOUNCE_ENABLED, true)

    fun setCallerVoiceAnnounceEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_CALLER_VOICE_ANNOUNCE_ENABLED, enabled).apply()
    }

    fun isParentCallerIdEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PARENT_CALLER_ID_ENABLED, true)

    fun isParentDueVoiceEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PARENT_DUE_VOICE_ENABLED, true)

    fun isParentScheduleVoiceEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PARENT_SCHEDULE_VOICE_ENABLED, false)

    fun isParentCardPopupEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PARENT_CARD_POPUP_ENABLED, true)

    fun isParentOverlayEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PARENT_OVERLAY_ENABLED, true)

    fun saveParentCallerIdOptions(context: Context, jsonStr: String) {
        try {
            val obj = JSONObject(jsonStr)
            val editor = prefs(context).edit()
            if (obj.has("parentCallerEnabled")) {
                editor.putBoolean(KEY_PARENT_CALLER_ID_ENABLED, obj.optBoolean("parentCallerEnabled", true))
            }
            if (obj.has("dueVoiceEnabled")) {
                editor.putBoolean(KEY_PARENT_DUE_VOICE_ENABLED, obj.optBoolean("dueVoiceEnabled", true))
            }
            if (obj.has("scheduleVoiceEnabled")) {
                editor.putBoolean(KEY_PARENT_SCHEDULE_VOICE_ENABLED, obj.optBoolean("scheduleVoiceEnabled", false))
            }
            if (obj.has("cardPopupEnabled")) {
                editor.putBoolean(KEY_PARENT_CARD_POPUP_ENABLED, obj.optBoolean("cardPopupEnabled", true))
            }
            if (obj.has("overlayEnabled")) {
                editor.putBoolean(KEY_PARENT_OVERLAY_ENABLED, obj.optBoolean("overlayEnabled", true))
            }
            editor.apply()
        } catch (_: Exception) {}
    }

    fun isWalkieEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_WALKIE_ENABLED, true)

    fun isWalkieAutoPlayEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_WALKIE_AUTO_PLAY, true)

    fun getWalkieStartTime(context: Context): String =
        prefs(context).getString(KEY_WALKIE_START_TIME, "07:30")?.takeIf { it.isNotBlank() } ?: "07:30"

    fun getWalkieEndTime(context: Context): String =
        prefs(context).getString(KEY_WALKIE_END_TIME, "15:30")?.takeIf { it.isNotBlank() } ?: "15:30"

    fun getWalkieDaysJson(context: Context): String =
        prefs(context).getString(KEY_WALKIE_DAYS_JSON, "[1,2,3,4,5,6]")?.takeIf { it.isNotBlank() } ?: "[1,2,3,4,5,6]"

    fun saveWalkieOptions(context: Context, jsonStr: String) {
        try {
            val obj = JSONObject(jsonStr)
            val editor = prefs(context).edit()
            if (obj.has("enabled")) {
                editor.putBoolean(KEY_WALKIE_ENABLED, obj.optBoolean("enabled", true))
            }
            if (obj.has("autoPlay")) {
                editor.putBoolean(KEY_WALKIE_AUTO_PLAY, obj.optBoolean("autoPlay", true))
            }
            val startTime = obj.optString("startTime", "").trim()
            if (Regex("^\\d{2}:\\d{2}$").matches(startTime)) {
                editor.putString(KEY_WALKIE_START_TIME, startTime)
            }
            val endTime = obj.optString("endTime", "").trim()
            if (Regex("^\\d{2}:\\d{2}$").matches(endTime)) {
                editor.putString(KEY_WALKIE_END_TIME, endTime)
            }
            val daysArr = obj.optJSONArray("activeDays")
            if (daysArr != null) {
                editor.putString(KEY_WALKIE_DAYS_JSON, daysArr.toString())
            }
            editor.apply()
        } catch (_: Exception) {}
    }

    fun isWithinWalkieSchoolHoursNow(context: Context): Boolean {
        if (!isWalkieEnabled(context)) return false
        return try {
            val cal = java.util.Calendar.getInstance()
            val jsDay = cal.get(java.util.Calendar.DAY_OF_WEEK) - 1 // Sunday=0..Saturday=6
            val daysArr = JSONArray(getWalkieDaysJson(context))
            var dayAllowed = false
            for (i in 0 until daysArr.length()) {
                if (daysArr.optInt(i, -1) == jsDay) {
                    dayAllowed = true
                    break
                }
            }
            if (!dayAllowed) return false

            val startParts = getWalkieStartTime(context).split(":")
            val endParts = getWalkieEndTime(context).split(":")
            if (startParts.size != 2 || endParts.size != 2) return true
            val startMin = startParts[0].toInt() * 60 + startParts[1].toInt()
            val endMin = endParts[0].toInt() * 60 + endParts[1].toInt()
            val nowMin = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)
            if (endMin >= startMin) {
                nowMin in startMin..endMin
            } else {
                nowMin >= startMin || nowMin <= endMin
            }
        } catch (_: Exception) {
            true
        }
    }

    fun saveLastIncomingParentCall(context: Context, match: CallerDirectoryMatch, postCall: Boolean = false) {
        try {
            prefs(context).edit()
                .putString(KEY_LAST_INCOMING_PARENT_CALL, match.toJson(postCall = postCall).toString())
                .apply()
        } catch (_: Exception) {}
    }

    fun getLastIncomingParentCall(context: Context): String =
        prefs(context).getString(KEY_LAST_INCOMING_PARENT_CALL, "")?.trim().orEmpty()

    fun clearLastIncomingParentCall(context: Context) {
        prefs(context).edit().remove(KEY_LAST_INCOMING_PARENT_CALL).apply()
    }

    fun setActiveRingingCaller(context: Context, match: CallerDirectoryMatch) {
        try {
            prefs(context).edit()
                .putString(KEY_ACTIVE_RINGING_CALLER_JSON, match.toJson().toString())
                .putLong(KEY_ACTIVE_RINGING_CALLER_AT_MS, System.currentTimeMillis())
                .apply()
        } catch (_: Exception) {}
    }

    fun getActiveRingingCaller(context: Context, maxAgeMs: Long = 20 * 60 * 1000L): CallerDirectoryMatch? {
        return try {
            val p = prefs(context)
            val atMs = p.getLong(KEY_ACTIVE_RINGING_CALLER_AT_MS, 0L)
            if (atMs <= 0L || System.currentTimeMillis() - atMs > maxAgeMs) {
                return null
            }
            val raw = p.getString(KEY_ACTIVE_RINGING_CALLER_JSON, "")?.trim().orEmpty()
            if (raw.isEmpty()) return null
            val obj = JSONObject(raw)
            val last10 = obj.optString("phone", "").trim()
            val name = obj.optString("name", "").trim()
            if (last10.isEmpty() || name.isEmpty()) return null
            CallerDirectoryMatch(
                schoolName = obj.optString("schoolName", "School").ifBlank { "School" },
                name = name,
                role = obj.optString("role", ""),
                last10 = last10,
                kind = obj.optString("kind", "PARENT").ifBlank { "PARENT" },
                studentSummary = obj.optString("studentSummary", ""),
                relationLabel = obj.optString("relationLabel", ""),
                fatherName = obj.optString("fatherName", ""),
                primaryStudentId = obj.optString("primaryStudentId", ""),
                dueAmount = obj.optLong("dueAmount", 0L),
                unpaidMonthsCount = obj.optInt("unpaidMonthsCount", 0),
                promiseDate = obj.optString("promiseDate", ""),
                promisedAmount = obj.optLong("promisedAmount", 0L),
                nextCallDate = obj.optString("nextCallDate", ""),
                solvedToday = obj.optBoolean("solvedToday", false),
                settled = obj.optBoolean("settled", false),
                lastNote = obj.optString("lastNote", ""),
                absentToday = obj.optBoolean("absentToday", false),
                enquiryId = obj.optString("enquiryId", ""),
                enquiryStage = obj.optString("enquiryStage", ""),
                enquiryFollowUpDate = obj.optString("enquiryFollowUpDate", ""),
                enquiryVisitDate = obj.optString("enquiryVisitDate", ""),
                enquiryNote = obj.optString("enquiryNote", ""),
                counsellorName = obj.optString("counsellorName", "")
            )
        } catch (_: Exception) {
            null
        }
    }

    fun clearActiveRingingCaller(context: Context) {
        prefs(context).edit()
            .remove(KEY_ACTIVE_RINGING_CALLER_JSON)
            .remove(KEY_ACTIVE_RINGING_CALLER_AT_MS)
            .apply()
    }

    fun formatIndianRupees(amount: Long): String {
        val clean = amount.coerceAtLeast(0L).toString()
        if (clean.length <= 3) return clean
        val last3 = clean.takeLast(3)
        val rest = clean.dropLast(3)
        val sb = StringBuilder()
        var i = rest.length
        while (i > 0) {
            val start = (i - 2).coerceAtLeast(0)
            if (sb.isNotEmpty()) sb.insert(0, ",")
            sb.insert(0, rest.substring(start, i))
            i = start
        }
        return "$sb,$last3"
    }

    fun formatShortDateLabel(rawYmd: String): String {
        val clean = rawYmd.trim()
        if (clean.isEmpty()) return ""
        return try {
            val inFmt = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            val todayStr = inFmt.format(java.util.Date())
            if (clean == todayStr) return "Aaj"
            val parsed = inFmt.parse(clean) ?: return clean
            java.text.SimpleDateFormat("d MMM", java.util.Locale.ENGLISH).format(parsed)
        } catch (_: Exception) {
            clean
        }
    }

    fun normalizePhoneMatchKey(raw: String?): String {
        val digits = raw?.filter { it.isDigit() }.orEmpty()
        if (digits.length >= 10) return digits.takeLast(10)
        if (digits.length >= 6) return digits
        return ""
    }

    @Synchronized
    fun saveCallerDirectoryJson(context: Context, jsonStr: String): Int {
        return try {
            val root = JSONObject(jsonStr)
            val defaultSchool = root.optString("schoolName", "").trim()
            val arr = root.optJSONArray("entries") ?: JSONArray()
            val mapObj = JSONObject()
            for (i in 0 until arr.length()) {
                val entry = arr.optJSONObject(i) ?: continue
                val key = normalizePhoneMatchKey(entry.optString("phone", ""))
                val name = entry.optString("name", "").trim()
                if (key.isEmpty() || name.isEmpty()) continue
                val role = entry.optString("role", "").trim()
                val kind = entry.optString("kind", "STAFF").trim().ifBlank { "STAFF" }
                val sch = entry.optString("schoolName", "").trim().ifBlank { defaultSchool }
                val packed = JSONObject().apply {
                    put("name", name)
                    put("role", role)
                    put("kind", kind)
                    put("schoolName", sch)
                    if (kind.equals("PARENT", ignoreCase = true) || kind.equals("ENQUIRY", ignoreCase = true)) {
                        put("studentSummary", entry.optString("studentSummary", "").trim())
                        put("relationLabel", entry.optString("relationLabel", "").trim())
                        put("fatherName", entry.optString("fatherName", "").trim())
                        put("primaryStudentId", entry.optString("primaryStudentId", "").trim())
                        put("dueAmount", entry.optLong("dueAmount", 0L))
                        put("unpaidMonthsCount", entry.optInt("unpaidMonthsCount", 0))
                        put("promiseDate", entry.optString("promiseDate", "").trim())
                        put("promisedAmount", entry.optLong("promisedAmount", 0L))
                        put("nextCallDate", entry.optString("nextCallDate", "").trim())
                        put("solvedToday", entry.optBoolean("solvedToday", false))
                        put("settled", entry.optBoolean("settled", false))
                        put("lastNote", entry.optString("lastNote", "").trim())
                        put("absentToday", entry.optBoolean("absentToday", false))
                        put("enquiryId", entry.optString("enquiryId", "").trim())
                        put("enquiryStage", entry.optString("enquiryStage", "").trim())
                        put("enquiryFollowUpDate", entry.optString("enquiryFollowUpDate", "").trim())
                        put("enquiryVisitDate", entry.optString("enquiryVisitDate", "").trim())
                        put("enquiryNote", entry.optString("enquiryNote", "").trim())
                        put("counsellorName", entry.optString("counsellorName", "").trim())
                    }
                }
                mapObj.put(key, packed)
            }
            prefs(context).edit()
                .putString(KEY_CALLER_DIR_JSON, mapObj.toString())
                .putString(KEY_CALLER_DIR_SCHOOL, defaultSchool)
                .apply()
            mapObj.length()
        } catch (_: Exception) {
            getCallerDirectoryCount(context)
        }
    }

    fun getCallerDirectoryCount(context: Context): Int {
        val raw = prefs(context).getString(KEY_CALLER_DIR_JSON, "{}") ?: "{}"
        return try {
            JSONObject(raw).length()
        } catch (_: Exception) {
            0
        }
    }

    fun getCallerDirectorySchoolName(context: Context): String =
        prefs(context).getString(KEY_CALLER_DIR_SCHOOL, "")?.trim().orEmpty()

    fun findCallerEntry(context: Context, rawPhone: String?): CallerDirectoryMatch? {
        val cleanKey = normalizePhoneMatchKey(rawPhone)
        if (cleanKey.isEmpty()) return null
        val p = prefs(context)
        val rawMap = p.getString(KEY_CALLER_DIR_JSON, "{}") ?: "{}"
        val defaultSchool = p.getString(KEY_CALLER_DIR_SCHOOL, "")?.trim().orEmpty()
        return try {
            val mapObj = JSONObject(rawMap)
            var matched = mapObj.optJSONObject(cleanKey)
            var matchedKey = cleanKey
            if (matched == null && cleanKey.length >= 7) {
                val keys = mapObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    if (k.length >= 7 && (cleanKey.endsWith(k) || k.endsWith(cleanKey))) {
                        matched = mapObj.optJSONObject(k)
                        matchedKey = k
                        break
                    }
                }
            }
            if (matched == null) return null
            val name = matched.optString("name", "").trim()
            if (name.isEmpty()) return null
            val role = matched.optString("role", "").trim()
            val kind = matched.optString("kind", "STAFF").trim().ifBlank { "STAFF" }
            val schoolName = matched.optString("schoolName", "").trim()
                .ifBlank { defaultSchool }
                .ifBlank { "School" }
            CallerDirectoryMatch(
                schoolName = schoolName,
                name = name,
                role = role,
                last10 = matchedKey,
                kind = kind,
                studentSummary = matched.optString("studentSummary", "").trim(),
                relationLabel = matched.optString("relationLabel", "").trim(),
                fatherName = matched.optString("fatherName", "").trim(),
                primaryStudentId = matched.optString("primaryStudentId", "").trim(),
                dueAmount = matched.optLong("dueAmount", 0L),
                unpaidMonthsCount = matched.optInt("unpaidMonthsCount", 0),
                promiseDate = matched.optString("promiseDate", "").trim(),
                promisedAmount = matched.optLong("promisedAmount", 0L),
                nextCallDate = matched.optString("nextCallDate", "").trim(),
                solvedToday = matched.optBoolean("solvedToday", false),
                settled = matched.optBoolean("settled", false),
                lastNote = matched.optString("lastNote", "").trim(),
                absentToday = matched.optBoolean("absentToday", false),
                enquiryId = matched.optString("enquiryId", "").trim(),
                enquiryStage = matched.optString("enquiryStage", "").trim(),
                enquiryFollowUpDate = matched.optString("enquiryFollowUpDate", "").trim(),
                enquiryVisitDate = matched.optString("enquiryVisitDate", "").trim(),
                enquiryNote = matched.optString("enquiryNote", "").trim(),
                counsellorName = matched.optString("counsellorName", "").trim()
            )
        } catch (_: Exception) {
            null
        }
    }
}
