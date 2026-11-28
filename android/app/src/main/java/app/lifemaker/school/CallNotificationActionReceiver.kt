package app.lifemaker.school

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat

class CallNotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_DECLINE_CALL) return

        VoiceAnnouncer.stopSpeaking()

        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, 0)
        val callId = intent.getStringExtra(EXTRA_CALL_ID).orEmpty().trim()
        if (notifId != 0) {
            try {
                NotificationManagerCompat.from(context).cancel(notifId)
            } catch (_: Exception) {}
        }
        if (callId.isNotEmpty()) {
            NotificationHelper.cancelNstaCallNotification(context, callId)
        }
        ParentCallOverlayService.hideNstaCall(context, callId)
        if (callId.isNotEmpty()) {
            try {
                context.sendBroadcast(Intent(ParentCallOverlayService.ACTION_NSTA_CALL_NATIVE_ACTION).apply {
                    setPackage(context.packageName)
                    putExtra(ParentCallOverlayService.EXTRA_NSTA_CALL_ID, callId)
                    putExtra(ParentCallOverlayService.EXTRA_NATIVE_ACTION, "decline")
                })
            } catch (_: Exception) {}
        }
    }

    companion object {
        const val ACTION_DECLINE_CALL = "app.lifemaker.school.ACTION_DECLINE_INCOMING_CALL"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
        const val EXTRA_CALL_ID = "extra_call_id"
    }
}
