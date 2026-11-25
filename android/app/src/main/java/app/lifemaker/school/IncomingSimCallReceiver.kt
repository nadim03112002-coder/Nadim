package app.lifemaker.school

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

class IncomingSimCallReceiver : BroadcastReceiver() {

    companion object {
        private val ioExecutor = Executors.newSingleThreadExecutor()
        private val mainHandler = Handler(Looper.getMainLooper())
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return

        @Suppress("DEPRECATION")
        if (action == Intent.ACTION_NEW_OUTGOING_CALL) {
            @Suppress("DEPRECATION")
            val outgoingNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER).orEmpty()
            if (outgoingNumber.isNotBlank()) {
                ParentCallerAlertHelper.handleOutgoingNumber(context.applicationContext, outgoingNumber)
            }
            return
        }

        if (action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val callState = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val appCtx = context.applicationContext

        if (callState == TelephonyManager.EXTRA_STATE_OFFHOOK) {
            VoiceAnnouncer.stopSpeaking()
            if (AppPrefs.getActiveRingingCaller(appCtx) != null &&
                AppPrefs.getActiveRingingCallDirection(appCtx).equals("INCOMING", ignoreCase = true)
            ) {
                AppPrefs.setActiveCallWasAnswered(appCtx, true)
            }
            // Fallback for Android 10+ devices without CallScreening role: detect outgoing matched school/parent call via recent CallLog
            if (AppPrefs.getActiveRingingCaller(appCtx) == null && hasReadCallLogPerm(appCtx)) {
                val pending = goAsync()
                mainHandler.postDelayed({
                    ioExecutor.execute {
                        try {
                            val recent = findLatestMatchedCallInLog(
                                appCtx,
                                System.currentTimeMillis() - 18_000L,
                                outgoingOnly = true,
                                includeStaff = true
                            )
                            if (recent != null) {
                                ParentCallerAlertHelper.handleOutgoingNumber(appCtx, recent.phone)
                            }
                        } catch (_: Exception) {
                        } finally {
                            try { pending.finish() } catch (_: Exception) {}
                        }
                    }
                }, 750L)
            }
            return
        }

        if (callState == TelephonyManager.EXTRA_STATE_IDLE) {
            VoiceAnnouncer.stopSpeaking()
            val activeNow = AppPrefs.getActiveRingingCaller(appCtx)
            if (activeNow != null &&
                !activeNow.kind.equals("PARENT", true) &&
                !activeNow.kind.equals("ENQUIRY", true)
            ) {
                val callTypeGuess = if (AppPrefs.wasActiveCallAnswered(appCtx)) "INCOMING" else "MISSED"
                ParentCallerAlertHelper.handleCallEnded(appCtx, resolvedCallType = callTypeGuess)
                return
            }

            val pending = goAsync()
            mainHandler.postDelayed({
                ioExecutor.execute {
                    try {
                        val active = AppPrefs.getActiveRingingCaller(appCtx)
                        val startedAt = AppPrefs.getActiveRingingCallStartedAtMs(appCtx)
                        val lookupSince = if (startedAt > 0L) startedAt - 15_000L else System.currentTimeMillis() - 45_000L

                        if (active != null) {
                            val info = if (hasReadCallLogPerm(appCtx)) {
                                findCallDetailsForNumber(appCtx, active.last10, lookupSince)
                            } else {
                                null
                            }
                            ParentCallerAlertHelper.handleCallEnded(
                                context = appCtx,
                                durationSec = info?.durationSec ?: 0,
                                resolvedCallType = info?.callType ?: "",
                                resolvedCallDateMs = info?.callDateMs ?: 0L
                            )
                        } else if (hasReadCallLogPerm(appCtx)) {
                            // Last-resort fallback: if a matched parent/enquiry call just ended without active cache
                            val recent = findLatestMatchedCallInLog(
                                appCtx,
                                System.currentTimeMillis() - 25_000L,
                                outgoingOnly = false,
                                includeStaff = false
                            )
                            if (recent != null) {
                                val match = AppPrefs.findCallerEntry(appCtx, recent.phone)
                                if (match != null && (match.kind.equals("PARENT", true) || match.kind.equals("ENQUIRY", true))) {
                                    AppPrefs.setActiveRingingCaller(appCtx, match, direction = recent.direction)
                                    ParentCallerAlertHelper.handleCallEnded(
                                        context = appCtx,
                                        durationSec = recent.durationSec,
                                        resolvedCallType = recent.callType,
                                        resolvedCallDateMs = recent.callDateMs
                                    )
                                }
                            }
                        }
                    } catch (_: Exception) {
                        ParentCallerAlertHelper.handleCallEnded(appCtx)
                    } finally {
                        try { pending.finish() } catch (_: Exception) {}
                    }
                }
            }, 650L)
            return
        }

        if (callState != TelephonyManager.EXTRA_STATE_RINGING) return

        @Suppress("DEPRECATION")
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
        if (incomingNumber.isBlank()) return

        ParentCallerAlertHelper.handleIncomingNumber(appCtx, incomingNumber)
    }

    private data class CallLogHit(
        val phone: String,
        val direction: String,
        val callType: String,
        val durationSec: Int,
        val callDateMs: Long
    )

    private fun hasReadCallLogPerm(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

    private fun findCallDetailsForNumber(context: Context, last10: String, sinceMs: Long): CallLogHit? {
        if (last10.length < 6) return null
        return try {
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.DURATION,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE
            )
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(sinceMs.coerceAtLeast(0L).toString()),
                "${CallLog.Calls.DATE} DESC"
            )?.use { cursor ->
                val idxNum = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val idxDur = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val idxDate = cursor.getColumnIndex(CallLog.Calls.DATE)
                val idxType = cursor.getColumnIndex(CallLog.Calls.TYPE)
                var checked = 0
                while (cursor.moveToNext() && checked < 20) {
                    checked++
                    val numStr = if (idxNum >= 0) cursor.getString(idxNum).orEmpty() else ""
                    val key = AppPrefs.normalizePhoneMatchKey(numStr)
                    if (key.isNotEmpty() && (key == last10 || key.endsWith(last10) || last10.endsWith(key))) {
                        val dur = if (idxDur >= 0) cursor.getInt(idxDur).coerceAtLeast(0) else 0
                        val dt = if (idxDate >= 0) cursor.getLong(idxDate) else 0L
                        val cType = if (idxType >= 0) cursor.getInt(idxType) else CallLog.Calls.INCOMING_TYPE
                        val typeLabel = mapCallTypeLabel(cType)
                        val dir = if (cType == CallLog.Calls.OUTGOING_TYPE) "OUTGOING" else "INCOMING"
                        return CallLogHit(key, dir, typeLabel, dur, dt)
                    }
                }
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun findLatestMatchedCallInLog(
        context: Context,
        sinceMs: Long,
        outgoingOnly: Boolean,
        includeStaff: Boolean = false
    ): CallLogHit? {
        return try {
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.DURATION,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE
            )
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(sinceMs.coerceAtLeast(0L).toString()),
                "${CallLog.Calls.DATE} DESC"
            )?.use { cursor ->
                val idxNum = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val idxDur = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val idxDate = cursor.getColumnIndex(CallLog.Calls.DATE)
                val idxType = cursor.getColumnIndex(CallLog.Calls.TYPE)
                var checked = 0
                while (cursor.moveToNext() && checked < 10) {
                    checked++
                    val cType = if (idxType >= 0) cursor.getInt(idxType) else CallLog.Calls.INCOMING_TYPE
                    if (outgoingOnly && cType != CallLog.Calls.OUTGOING_TYPE) continue
                    val numStr = if (idxNum >= 0) cursor.getString(idxNum).orEmpty() else ""
                    val match = AppPrefs.findCallerEntry(context, numStr) ?: continue
                    val isParentOrEnquiry = match.kind.equals("PARENT", true) || match.kind.equals("ENQUIRY", true)
                    if (!includeStaff && !isParentOrEnquiry) continue
                    val dur = if (idxDur >= 0) cursor.getInt(idxDur).coerceAtLeast(0) else 0
                    val dt = if (idxDate >= 0) cursor.getLong(idxDate) else System.currentTimeMillis()
                    val typeLabel = mapCallTypeLabel(cType)
                    val dir = if (cType == CallLog.Calls.OUTGOING_TYPE) "OUTGOING" else "INCOMING"
                    return CallLogHit(match.last10, dir, typeLabel, dur, dt)
                }
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun mapCallTypeLabel(cType: Int): String = when (cType) {
        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
        CallLog.Calls.MISSED_TYPE -> "MISSED"
        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
        else -> "INCOMING"
    }
}
