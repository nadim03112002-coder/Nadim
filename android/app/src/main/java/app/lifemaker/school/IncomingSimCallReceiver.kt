package app.lifemaker.school

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

class IncomingSimCallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val callState = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        if (callState == TelephonyManager.EXTRA_STATE_OFFHOOK) {
            VoiceAnnouncer.stopSpeaking()
            return
        }

        if (callState == TelephonyManager.EXTRA_STATE_IDLE) {
            VoiceAnnouncer.stopSpeaking()
            ParentCallerAlertHelper.handleCallEnded(context)
            return
        }

        if (callState != TelephonyManager.EXTRA_STATE_RINGING) return

        @Suppress("DEPRECATION")
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
        if (incomingNumber.isBlank()) return

        ParentCallerAlertHelper.handleIncomingNumber(context, incomingNumber)
    }
}
