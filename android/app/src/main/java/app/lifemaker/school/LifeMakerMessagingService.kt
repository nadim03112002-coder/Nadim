package app.lifemaker.school

import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors

class LifeMakerMessagingService : FirebaseMessagingService() {

    private val executor = Executors.newSingleThreadExecutor()

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        AppPrefs.setFcmToken(applicationContext, token)
        syncTokenToRtdbIfLoggedIn(token)

        val broadcast = Intent(ACTION_NEW_FCM_TOKEN).apply {
            setPackage(packageName)
            putExtra(EXTRA_FCM_TOKEN, token)
        }
        sendBroadcast(broadcast)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val senderDeviceId = data["senderDeviceId"].orEmpty().trim()
        val myDeviceId = AppPrefs.getOrCreateDeviceId(applicationContext)
        if (senderDeviceId.isNotEmpty() && senderDeviceId == myDeviceId) {
            return
        }

        val title = data["title"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.title?.takeIf { it.isNotBlank() }
            ?: getString(R.string.app_name)

        val body = data["body"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.notification?.body.orEmpty()

        if (title.isBlank() && body.isBlank()) return

        val msgId = data["id"]?.takeIf { it.isNotBlank() }
            ?: remoteMessage.messageId
            ?: "fcm_${System.currentTimeMillis()}"

        val targetUrl = data["url"]

        if (!AppPrefs.markNotifSeenIfNew(applicationContext, msgId)) {
            return
        }

        val voiceSpeakRaw = data["voiceSpeak"]?.trim()?.lowercase().orEmpty()
        val threadType = data["threadType"]?.trim()?.uppercase().orEmpty()
        val notifType = data["type"]?.trim()?.uppercase().orEmpty()
        val isIncomingCall = notifType == "CALL_INCOMING"
        val isWalkieMsg = notifType == "WALKIE_VOICE" || notifType == "WALKIE_TTS"
        val isUpiProofAlert = notifType == "UPI_PAYMENT_PROOF"
        val isUpiProofResolved = notifType == "UPI_PROOF_RESOLVED"
        val voiceExplicitlyOff = voiceSpeakRaw == "false" || voiceSpeakRaw == "0"

        if (isUpiProofResolved) {
            val resolvedId = data["proofId"].orEmpty().trim()
            if (resolvedId.isNotEmpty()) {
                UpiProofOverlayService.removeProof(applicationContext, resolvedId)
            }
            return
        }

        if (isUpiProofAlert) {
            val proofObj = JSONObject().apply {
                put("proofId", data["proofId"].orEmpty().ifBlank { msgId })
                put("schoolId", data["schoolId"].orEmpty())
                put("studentName", data["studentName"].orEmpty().ifBlank { "Student" })
                put("monthLabel", data["monthLabel"].orEmpty())
                put("amount", data["amount"].orEmpty().ifBlank { "0" })
                put("billedAmount", data["billedAmount"].orEmpty().ifBlank { data["amount"].orEmpty().ifBlank { "0" } })
                put("utrNumber", data["utrNumber"].orEmpty())
                put("paidTime", data["paidTime"].orEmpty())
                put("familySummary", data["familySummary"].orEmpty())
                put("screenshotUrl", data["screenshotUrl"].orEmpty())
            }
            UpiProofOverlayService.enqueueAndShow(applicationContext, proofObj)
            val totalPending = AppPrefs.getPendingUpiProofsList(applicationContext).size.coerceAtLeast(1)
            if (!voiceExplicitlyOff) {
                VoiceAnnouncer.speak(
                    context = applicationContext,
                    title = title,
                    body = body,
                    dedupeKey = msgId
                )
            }
            NotificationHelper.showUpiProofOngoingNotification(
                context = applicationContext,
                proof = proofObj,
                pendingCount = totalPending
            )
            return
        }

        if (isWalkieMsg) {
            if (AppPrefs.isWithinWalkieSchoolHoursNow(applicationContext)) {
                val audioB64 = data["walkieAudioBase64"].orEmpty()
                val mimeType = data["walkieMimeType"].orEmpty().ifBlank { "audio/webm" }
                val spokenText = data["walkieSpeechText"]?.takeIf { it.isNotBlank() } ?: "$title. $body"
                if (AppPrefs.isWalkieAutoPlayEnabled(applicationContext)) {
                    VoiceAnnouncer.playWalkieMessage(
                        context = applicationContext,
                        audioBase64 = audioB64,
                        mimeType = mimeType,
                        fallbackText = spokenText,
                        dedupeKey = msgId
                    )
                }
                NotificationHelper.showVoiceNotification(
                    context = applicationContext,
                    notifKey = msgId,
                    title = title,
                    body = body,
                    deepLinkUrl = targetUrl?.takeIf { it.isNotBlank() } ?: "/?openWalkie=1"
                )
            }
        } else if (isIncomingCall) {
            if (!voiceExplicitlyOff && AppPrefs.isCallerVoiceAnnounceEnabled(applicationContext)) {
                VoiceAnnouncer.speakIncomingCall(
                    context = applicationContext,
                    rawText = "$title. $body",
                    dedupeKey = msgId
                )
            }
            if (targetUrl.orEmpty().contains("callId=")) {
                NotificationHelper.showIncomingNstaCallNotification(
                    context = applicationContext,
                    notifKey = msgId,
                    title = title,
                    body = body,
                    deepLinkUrl = targetUrl
                )
            } else {
                NotificationHelper.showIncomingCallerBanner(
                    context = applicationContext,
                    notifKey = msgId,
                    title = title,
                    body = body
                )
            }
        } else {
            val suppressVoice =
                voiceExplicitlyOff ||
                threadType == "TEACHER_CHAT" ||
                threadType == "STUDENT_CHAT" ||
                targetUrl.orEmpty().contains("subTab=teacher") ||
                targetUrl.orEmpty().contains("subTab=friend")

            if (!suppressVoice) {
                VoiceAnnouncer.speak(
                    context = applicationContext,
                    title = title,
                    body = body,
                    dedupeKey = msgId
                )
            }

            NotificationHelper.showVoiceNotification(
                context = applicationContext,
                notifKey = msgId,
                title = title,
                body = body,
                deepLinkUrl = targetUrl
            )
        }
    }

    private fun syncTokenToRtdbIfLoggedIn(token: String) {
        val userId = AppPrefs.getUserId(applicationContext)
        val studentIds = AppPrefs.getStudentIds(applicationContext)
        val schoolId = AppPrefs.getSchoolId(applicationContext)
        val deviceId = AppPrefs.getOrCreateDeviceId(applicationContext)

        if (userId.isEmpty() && studentIds.isEmpty()) return

        val keys = linkedSetOf<String>()
        if (userId.isNotEmpty()) keys.add(AppPrefs.sanitizeRtdbKey(userId))
        studentIds.forEach { keys.add(AppPrefs.sanitizeRtdbKey(it)) }

        val isoNow = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        executor.execute {
            val base = BuildConfig.RTDB_BASE_URL.trimEnd('/')
            for (k in keys) {
                try {
                    val encodedKey = URLEncoder.encode("${k}__android", "UTF-8")
                    val url = URL("$base/fcm_tokens/$encodedKey.json")
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "PUT"
                        connectTimeout = 8000
                        readTimeout = 8000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                    }
                    val payload = JSONObject().apply {
                        put("token", token)
                        put("platform", "android_native")
                        put("updatedAt", isoNow)
                        put("deviceId", deviceId)
                        if (userId.isNotEmpty()) put("userId", userId)
                        if (schoolId.isNotEmpty()) put("schoolId", schoolId)
                        if (studentIds.isNotEmpty()) {
                            put("studentId", if (studentIds.contains(k)) k else studentIds.first())
                        }
                    }
                    OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                        writer.write(payload.toString())
                    }
                    conn.responseCode
                    conn.disconnect()
                } catch (_: Exception) {}
            }
        }
    }

    companion object {
        const val ACTION_NEW_FCM_TOKEN = "app.lifemaker.school.NEW_FCM_TOKEN"
        const val EXTRA_FCM_TOKEN = "extra_fcm_token"
    }
}
