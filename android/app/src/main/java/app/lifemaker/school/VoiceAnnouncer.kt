package app.lifemaker.school

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import java.io.File
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

object VoiceAnnouncer {
    private data class QueuedSpeech(
        val text: String,
        val utteranceId: String,
        val isIncomingCall: Boolean = false
    )

    private val mainHandler = Handler(Looper.getMainLooper())
    private val recentCache = ConcurrentHashMap<String, Long>()
    private val pendingQueue = ConcurrentLinkedQueue<QueuedSpeech>()

    @Volatile
    private var tts: TextToSpeech? = null

    @Volatile
    private var isInitialized = false

    @Volatile
    private var isInitializing = false

    @Volatile
    private var lastIncomingCallSpokenAt: Long = 0L

    private var wakeLock: PowerManager.WakeLock? = null
    private var notifAudioFocusRequest: AudioFocusRequest? = null
    private var callAudioFocusRequest: AudioFocusRequest? = null
    private var appContext: Context? = null

    private val emojiAndSymbolRegex = Regex("[\\uD83C-\\uDBFF\\uDC00-\\uDFFF]+|[*_#~`\\[\\]()]")
    private val rupeesRegex = Regex("₹\\s*([0-9,]+)")
    private val rsRegex = Regex("\\bRs\\.?\\s*([0-9,]+)", RegexOption.IGNORE_CASE)
    private val spaceRegex = Regex("\\s+")

    fun speak(context: Context, title: String, body: String?, dedupeKey: String? = null) {
        val raw = if (!body.isNullOrBlank()) "$title. $body" else title
        speakDirect(context, raw, dedupeKey)
    }

    fun speakDirect(context: Context, rawText: String, dedupeKey: String? = null) {
        val clean = cleanTextForSpeech(rawText)
        if (clean.isEmpty()) return

        val dKey = (dedupeKey?.takeIf { it.isNotBlank() } ?: clean.lowercase().take(160))
        if (isDuplicate(dKey, 15_000L)) return

        enqueueSpeech(context, clean, dKey, isIncomingCall = false)
    }

    fun speakIncomingCall(
        context: Context,
        rawText: String,
        dedupeKey: String? = null,
        bypassGlobalCooldown: Boolean = false
    ) {
        val clean = cleanTextForSpeech(rawText)
        if (clean.isEmpty()) return

        val dKey = (dedupeKey?.takeIf { it.isNotBlank() } ?: "call_${clean.lowercase().take(120)}")
        if (isDuplicate(dKey, 4_500L)) return

        val now = System.currentTimeMillis()
        if (!bypassGlobalCooldown && now - lastIncomingCallSpokenAt < 5_000L) {
            return
        }
        lastIncomingCallSpokenAt = now

        enqueueSpeech(context, clean, dKey, isIncomingCall = true)
    }

    fun stopSpeaking() {
        pendingQueue.clear()
        mainHandler.post {
            try {
                tts?.stop()
            } catch (_: Exception) {}
            releaseAudioAndWakeLock()
        }
    }

    fun playWalkieMessage(
        context: Context,
        audioBase64: String?,
        mimeType: String?,
        fallbackText: String?,
        dedupeKey: String? = null
    ) {
        val cleanKey = dedupeKey?.takeIf { it.isNotBlank() } ?: "walkie_${System.currentTimeMillis()}"
        if (isDuplicate(cleanKey, 4_000L)) return

        val ctx = context.applicationContext
        val cleanAudio = audioBase64?.trim().orEmpty()
        val cleanText = cleanTextForSpeech(fallbackText.orEmpty())

        Thread({
            try {
                ToneGenerator(AudioManager.STREAM_MUSIC, 90).apply {
                    startTone(ToneGenerator.TONE_PROP_BEEP2, 160)
                    Thread.sleep(190)
                    release()
                }
            } catch (_: Exception) {}

            if (cleanAudio.isNotBlank()) {
                var tempFile: File? = null
                var walkieFocusReq: AudioFocusRequest? = null
                val audioManager = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                try {
                    val b64Payload = if (cleanAudio.contains(",")) cleanAudio.substringAfter(",") else cleanAudio
                    val bytes = Base64.decode(b64Payload, Base64.DEFAULT)
                    val ext = when {
                        mimeType?.contains("mp4", true) == true -> "m4a"
                        mimeType?.contains("ogg", true) == true -> "ogg"
                        mimeType?.contains("wav", true) == true -> "wav"
                        else -> "webm"
                    }
                    tempFile = File.createTempFile("walkie_", ".$ext", ctx.cacheDir).apply {
                        writeBytes(bytes)
                    }
                    val mediaAttrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        walkieFocusReq = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(mediaAttrs)
                            .setAcceptsDelayedFocusGain(false)
                            .build()
                        walkieFocusReq.let { audioManager?.requestAudioFocus(it) }
                    } else {
                        @Suppress("DEPRECATION")
                        audioManager?.requestAudioFocus(
                            null,
                            AudioManager.STREAM_MUSIC,
                            AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                        )
                    }

                    val player = MediaPlayer()
                    player.setAudioAttributes(mediaAttrs)
                    player.setDataSource(tempFile.absolutePath)
                    player.setVolume(1.0f, 1.0f)
                    val cleanup = {
                        try { player.release() } catch (_: Exception) {}
                        try { tempFile.delete() } catch (_: Exception) {}
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                walkieFocusReq?.let { audioManager?.abandonAudioFocusRequest(it) }
                            } else {
                                @Suppress("DEPRECATION")
                                audioManager?.abandonAudioFocus(null)
                            }
                        } catch (_: Exception) {}
                    }
                    player.setOnCompletionListener { cleanup() }
                    player.setOnErrorListener { _, _, _ ->
                        cleanup()
                        if (cleanText.isNotBlank()) {
                            speakIncomingCall(ctx, cleanText, "${cleanKey}_fb", bypassGlobalCooldown = true)
                        }
                        true
                    }
                    player.prepare()
                    player.start()
                    return@Thread
                } catch (_: Exception) {
                    try { tempFile?.delete() } catch (_: Exception) {}
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            walkieFocusReq?.let { audioManager?.abandonAudioFocusRequest(it) }
                        } else {
                            @Suppress("DEPRECATION")
                            audioManager?.abandonAudioFocus(null)
                        }
                    } catch (_: Exception) {}
                }
            }

            if (cleanText.isNotBlank()) {
                speakIncomingCall(ctx, cleanText, cleanKey, bypassGlobalCooldown = true)
            }
        }, "WalkiePlayerThread").start()
    }

    private fun enqueueSpeech(
        context: Context,
        clean: String,
        @Suppress("UNUSED_PARAMETER") dKey: String,
        isIncomingCall: Boolean
    ) {
        val ctx = context.applicationContext
        appContext = ctx
        val uid = "lm_tts_${UUID.randomUUID().toString().take(8)}"

        mainHandler.post {
            acquireTemporaryWakeLock(ctx)
            requestSpeechAudioFocus(ctx, isIncomingCall)
            if (tts == null || (!isInitialized && !isInitializing)) {
                pendingQueue.offer(QueuedSpeech(clean, uid, isIncomingCall))
                initTts(ctx)
            } else if (!isInitialized) {
                pendingQueue.offer(QueuedSpeech(clean, uid, isIncomingCall))
            } else {
                speakNow(clean, uid, isIncomingCall)
            }
        }
    }

    private fun initTts(ctx: Context) {
        isInitializing = true
        try {
            tts = TextToSpeech(ctx) { status ->
                mainHandler.post {
                    isInitializing = false
                    if (status == TextToSpeech.SUCCESS) {
                        configureEngine(ctx)
                        isInitialized = true
                        drainQueue()
                    } else {
                        isInitialized = false
                        pendingQueue.clear()
                        releaseAudioAndWakeLock()
                    }
                }
            }
        } catch (_: Exception) {
            isInitializing = false
            isInitialized = false
            releaseAudioAndWakeLock()
        }
    }

    private fun configureEngine(@Suppress("UNUSED_PARAMETER") ctx: Context) {
        val engine = tts ?: return
        val hindiLocale = Locale("hi", "IN")
        val indianEnglish = Locale("en", "IN")

        val hiRes = engine.isLanguageAvailable(hindiLocale)
        if (hiRes >= TextToSpeech.LANG_AVAILABLE) {
            engine.language = hindiLocale
        } else if (engine.isLanguageAvailable(indianEnglish) >= TextToSpeech.LANG_AVAILABLE) {
            engine.language = indianEnglish
        }

        engine.setSpeechRate(0.95f)
        engine.setPitch(1.0f)

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        engine.setAudioAttributes(attrs)

        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}

            override fun onDone(utteranceId: String?) {
                mainHandler.post {
                    if (pendingQueue.isEmpty()) {
                        releaseAudioAndWakeLock()
                    }
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                mainHandler.post { releaseAudioAndWakeLock() }
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                mainHandler.post { releaseAudioAndWakeLock() }
            }
        })
    }

    private fun drainQueue() {
        var item = pendingQueue.poll()
        while (item != null) {
            speakNow(item.text, item.utteranceId, item.isIncomingCall)
            item = pendingQueue.poll()
        }
    }

    private fun speakNow(text: String, utteranceId: String, isIncomingCall: Boolean) {
        val engine = tts ?: return
        try {
            val usage = if (isIncomingCall) {
                AudioAttributes.USAGE_NOTIFICATION_RINGTONE
            } else {
                AudioAttributes.USAGE_NOTIFICATION_EVENT
            }
            val attrs = AudioAttributes.Builder()
                .setUsage(usage)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            engine.setAudioAttributes(attrs)
            val queueMode = if (isIncomingCall) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            engine.speak(text, queueMode, null, utteranceId)
        } catch (_: Exception) {
            releaseAudioAndWakeLock()
        }
    }

    private fun acquireTemporaryWakeLock(ctx: Context) {
        try {
            val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            if (wakeLock == null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "LifeMaker:VoiceAnnouncerWakeLock"
                ).apply { setReferenceCounted(false) }
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(20_000L)
            }
        } catch (_: Exception) {}
    }

    private fun requestSpeechAudioFocus(ctx: Context, isIncomingCall: Boolean) {
        try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (isIncomingCall) {
                    if (callAudioFocusRequest == null) {
                        val attrs = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                        callAudioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attrs)
                            .setAcceptsDelayedFocusGain(false)
                            .build()
                    }
                    callAudioFocusRequest?.let { am.requestAudioFocus(it) }
                } else {
                    if (notifAudioFocusRequest == null) {
                        val attrs = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                        notifAudioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attrs)
                            .setAcceptsDelayedFocusGain(false)
                            .build()
                    }
                    notifAudioFocusRequest?.let { am.requestAudioFocus(it) }
                }
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(
                    null,
                    if (isIncomingCall) AudioManager.STREAM_RING else AudioManager.STREAM_NOTIFICATION,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }
        } catch (_: Exception) {}
    }

    private fun releaseAudioAndWakeLock() {
        try {
            val ctx = appContext
            if (ctx != null) {
                val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    notifAudioFocusRequest?.let { am?.abandonAudioFocusRequest(it) }
                    callAudioFocusRequest?.let { am?.abandonAudioFocusRequest(it) }
                } else {
                    @Suppress("DEPRECATION")
                    am?.abandonAudioFocus(null)
                }
            }
        } catch (_: Exception) {}

        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {}
    }

    private fun isDuplicate(key: String, windowMs: Long): Boolean {
        val now = System.currentTimeMillis()
        val prev = recentCache[key]
        if (prev != null && now - prev < windowMs) {
            return true
        }
        recentCache[key] = now
        if (recentCache.size > 100) {
            recentCache.entries.removeIf { now - it.value > 60_000L }
        }
        return false
    }

    fun cleanTextForSpeech(text: String): String {
        var clean = text
        clean = rupeesRegex.replace(clean, "$1 रुपये")
        clean = rsRegex.replace(clean, "$1 रुपये")
        clean = emojiAndSymbolRegex.replace(clean, " ")
        clean = spaceRegex.replace(clean, " ").trim()
        return clean
    }
}
