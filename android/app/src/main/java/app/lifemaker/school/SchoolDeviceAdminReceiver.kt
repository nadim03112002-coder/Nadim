package app.lifemaker.school

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class SchoolDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        AppPrefs.setDeviceAdminEnabledAt(context, System.currentTimeMillis())
        Toast.makeText(
            context,
            "SCHOOL+ Uninstall Protection (Device Admin) चालू हो गया!",
            Toast.LENGTH_LONG
        ).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "चेतावनी: SCHOOL+ Device Admin बंद करने पर कोई भी इस ऐप को अनइंस्टॉल (Uninstall) कर सकेगा। स्कूल एडमिन की अनुमति के बिना इसे बंद न करें।"
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        AppPrefs.setDeviceAdminEnabledAt(context, 0L)
        Toast.makeText(
            context,
            "SCHOOL+ Device Admin बंद कर दिया गया है",
            Toast.LENGTH_SHORT
        ).show()
    }
}
