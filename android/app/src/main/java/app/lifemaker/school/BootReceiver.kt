package app.lifemaker.school

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            if (AppPrefs.isVoiceGuardEnabled(context) && AppPrefs.getInboxKeys(context).isNotEmpty()) {
                VoiceGuardService.startOrUpdate(context)
            }
            // Safely resume Bus GPS service only if active & OS permits background location FGS
            try {
                if (AppPrefs.isBusGpsActive(context) && BusGpsForegroundService.hasLocationPermission(context)) {
                    BusGpsForegroundService.startOrUpdate(context)
                }
            } catch (_: Exception) {}
        }
    }
}
