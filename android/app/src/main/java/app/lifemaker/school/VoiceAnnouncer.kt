package app.lifemaker.school

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

object VoiceAnnouncer {
    private data class QueuedSpeech(val text: String, val utteranceId: String)

    private val mainHandler = Handler(Looper.getMainLooper())
    private val recentCache = ConcurrentHashMap<String, Long>()
    private val pendingQueue = ConcurrentLinkedQueue<QueuedSpeech>()

    @Volatile
    private var tts: TextToSpeech? = null

    @Volatile
    private var isInitialized = false

    @Volatile
    private var isInitializing = false

    private var wakeLock: PowerManager.WakeLock? = null
    private var audioFocusRequest: AudioFocusRequest? = null
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
        if (isDuplicate(dKey)) return

        val ctx = context.applicationContext
        appContext = ctx
        val uid = "lm_tts_${UUID.randomUUID().toString().take(8)}"

        mainHandler.post {
            acquireTemporaryWakeLock(ctx)
            requestSpeechAudioFocus(ctx)
            if (tts == null || (!isInitialized && !isInitializing)) {
                pendingQueue.offer(QueuedSpeech(clean, uid))
                initTts(ctx)
            } else if (!isInitialized) {
                pendingQueue.offer(QueuedSpeech(clean, uid))
            } else {
                speakNow(clean, uid)
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

    private fun configureEngine(ctx: Context) {
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
            speakNow(item.text, item.utteranceId)
            item = pendingQueue.poll()
        }
    }

    private fun speakNow(text: String, utteranceId: String) {
        val engine = tts ?: return
        try {
            engine.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId)
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

    private fun requestSpeechAudioFocus(ctx: Context) {
        try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest == null) {
                    val attrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(attrs)
                        .setAcceptsDelayedFocusGain(false)
                        .build()
                }
                audioFocusRequest?.let { am.requestAudioFocus(it) }
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(
                    null,
                    AudioManager.STREAM_NOTIFICATION,
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
                    audioFocusRequest?.let { am?.abandonAudioFocusRequest(it) }
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

    private fun isDuplicate(key: String): Boolean {
        val now = System.currentTimeMillis()
        val prev = recentCache[key]
        if (prev != null && now - prev < 15_000L) {
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
