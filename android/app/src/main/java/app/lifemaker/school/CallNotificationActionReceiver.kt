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
        if (notifId != 0) {
            try {
                NotificationManagerCompat.from(context).cancel(notifId)
            } catch (_: Exception) {}
        }
    }

    companion object {
        const val ACTION_DECLINE_CALL = "app.lifemaker.school.ACTION_DECLINE_INCOMING_CALL"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
    }
}
