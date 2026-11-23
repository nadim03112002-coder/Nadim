package app.lifemaker.school

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class VoiceGuardService : Service() {

    private val running = AtomicBoolean(false)
    private val streamThreads = ConcurrentHashMap<String, Thread>()
    private val activeConnections = ConcurrentHashMap<String, HttpURLConnection>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopAllStreams()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (!AppPrefs.isVoiceGuardEnabled(applicationContext)) {
            stopAllStreams()
            stopSelf()
            return START_NOT_STICKY
        }

        val notif = NotificationHelper.buildVoiceGuardForegroundNotification(applicationContext)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                FOREGROUND_NOTIFICATION_ID,
                notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(FOREGROUND_NOTIFICATION_ID, notif)
        }

        running.set(true)
        syncStreams()
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        stopAllStreams()
        super.onDestroy()
    }

    @Synchronized
    private fun syncStreams() {
        val desiredKeys = AppPrefs.getInboxKeys(applicationContext).toSet()
        if (desiredKeys.isEmpty()) {
            stopAllStreams()
            return
        }

        // Stop streams no longer needed
        for (existingKey in streamThreads.keys.toList()) {
            if (!desiredKeys.contains(existingKey)) {
                stopStream(existingKey)
            }
        }

        // Start streams for newly synced student/user keys
        for (key in desiredKeys) {
            val currentThread = streamThreads[key]
            if (currentThread == null || !currentThread.isAlive) {
                startStreamForKey(key)
            }
        }
    }

    private fun startStreamForKey(inboxKey: String) {
        val worker = Thread({
            var backoffMs = 3_000L
            while (running.get() && AppPrefs.isVoiceGuardEnabled(applicationContext)) {
                var conn: HttpURLConnection? = null
                try {
                    val encodedOwner = URLEncoder.encode(inboxKey, "UTF-8")
                    val streamUrl = URL("${BuildConfig.RTDB_BASE_URL.trimEnd('/')}/user_notifications/$encodedOwner.json")
                    conn = (streamUrl.openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        setRequestProperty("Accept", "text/event-stream")
                        connectTimeout = 15_000
                        readTimeout = 70_000
                    }
                    activeConnections[inboxKey] = conn

                    val code = conn.responseCode
                    if (code in 200..299) {
                        backoffMs = 3_000L
                        BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { reader ->
                            var eventName = ""
                            val dataBuf = StringBuilder()

                            while (running.get() && !Thread.currentThread().isInterrupted) {
                                val line = reader.readLine() ?: break
                                when {
                                    line.startsWith("event:") -> {
                                        eventName = line.substringAfter("event:").trim()
                                    }
                                    line.startsWith("data:") -> {
                                        dataBuf.append(line.substringAfter("data:").trim())
                                    }
                                    line.isEmpty() -> {
                                        if (dataBuf.isNotEmpty()) {
                                            handleSseEvent(inboxKey, eventName, dataBuf.toString())
                                            dataBuf.setLength(0)
                                        }
                                        eventName = ""
                                    }
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                    // Transient reconnect handled by backoff below
                } finally {
                    activeConnections.remove(inboxKey)
                    try { conn?.disconnect() } catch (_: Exception) {}
                }

                if (!running.get() || Thread.currentThread().isInterrupted) break
                try {
                    Thread.sleep(backoffMs)
                } catch (_: InterruptedException) {
                    break
                }
                backoffMs = (backoffMs * 2).coerceAtMost(30_000L)
            }
        }, "VoiceGuardSSE-$inboxKey")
        streamThreads[inboxKey] = worker
        worker.start()
    }

    private fun handleSseEvent(inboxKey: String, eventName: String, rawJson: String) {
        if (eventName != "put" && eventName != "patch") return
        if (rawJson == "null") return

        try {
            val envelope = JSONObject(rawJson)
            val path = envelope.optString("path", "/")
            val dataObj = envelope.opt("data") ?: return
            if (dataObj == JSONObject.NULL) return

            if (path == "/" && dataObj is JSONObject) {
                // Either initial map of notifications OR a single notification pushed at root
                if (dataObj.has("title") && dataObj.has("id")) {
                    processNotificationObject(inboxKey, dataObj.optString("id"), dataObj)
                } else {
                    val keys = dataObj.keys()
                    while (keys.hasNext()) {
                        val childKey = keys.next()
                        val item = dataObj.optJSONObject(childKey) ?: continue
                        processNotificationObject(inboxKey, childKey, item)
                    }
                }
            } else if (dataObj is JSONObject) {
                val childKey = path.trim('/').substringBefore('/')
                processNotificationObject(inboxKey, childKey, dataObj)
            }
        } catch (_: Exception) {}
    }

    private fun processNotificationObject(inboxKey: String, notifKey: String, item: JSONObject) {
        val notifId = item.optString("id").takeIf { it.isNotBlank() } ?: notifKey
        if (notifId.isBlank()) return

        val senderDeviceId = item.optString("senderDeviceId").trim()
        if (senderDeviceId.isNotEmpty() && senderDeviceId == AppPrefs.getOrCreateDeviceId(applicationContext)) {
            deleteProcessedNotification(inboxKey, notifKey)
            return
        }

        val timestamp = item.optLong("timestamp", 0L)
        val ageMs = System.currentTimeMillis() - timestamp
        if (timestamp > 0L && ageMs > 30L * 60L * 1000L) {
            deleteProcessedNotification(inboxKey, notifKey)
            return
        }

        if (!AppPrefs.markNotifSeenIfNew(applicationContext, notifId)) {
            return
        }

        val title = item.optString("title").ifBlank { getString(R.string.app_name) }
        val body = item.optString("body")
        val targetUrl = item.optString("url")

        VoiceAnnouncer.speak(
            context = applicationContext,
            title = title,
            body = body,
            dedupeKey = notifId
        )

        NotificationHelper.showVoiceNotification(
            context = applicationContext,
            notifKey = notifId,
            title = title,
            body = body,
            deepLinkUrl = targetUrl
        )

        deleteProcessedNotification(inboxKey, notifKey)
    }

    private fun deleteProcessedNotification(inboxKey: String, notifKey: String) {
        if (notifKey.isBlank()) return
        try {
            val encodedOwner = URLEncoder.encode(inboxKey, "UTF-8")
            val encodedKey = URLEncoder.encode(notifKey, "UTF-8")
            val url = URL("${BuildConfig.RTDB_BASE_URL.trimEnd('/')}/user_notifications/$encodedOwner/$encodedKey.json")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "DELETE"
                connectTimeout = 5000
                readTimeout = 5000
            }
            conn.responseCode
            conn.disconnect()
        } catch (_: Exception) {}
    }

    private fun stopStream(key: String) {
        try { activeConnections.remove(key)?.disconnect() } catch (_: Exception) {}
        try { streamThreads.remove(key)?.interrupt() } catch (_: Exception) {}
    }

    private fun stopAllStreams() {
        for (key in activeConnections.keys.toList()) {
            try { activeConnections.remove(key)?.disconnect() } catch (_: Exception) {}
        }
        for (key in streamThreads.keys.toList()) {
            try { streamThreads.remove(key)?.interrupt() } catch (_: Exception) {}
        }
    }

    companion object {
        private const val FOREGROUND_NOTIFICATION_ID = 4102
        const val ACTION_START_OR_SYNC = "app.lifemaker.school.VOICE_GUARD_SYNC"
        const val ACTION_STOP = "app.lifemaker.school.VOICE_GUARD_STOP"

        fun startOrUpdate(context: Context) {
            if (!AppPrefs.isVoiceGuardEnabled(context)) return
            if (AppPrefs.getInboxKeys(context).isEmpty()) return
            val intent = Intent(context, VoiceGuardService::class.java).apply {
                action = ACTION_START_OR_SYNC
            }
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (_: Exception) {}
        }

        fun stop(context: Context) {
            val intent = Intent(context, VoiceGuardService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }
    }
}
