package app.lifemaker.school

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object NotificationHelper {
    const val CHANNEL_ALERTS = "high_importance_channel"
    const val CHANNEL_VOICE_GUARD = "voice_guard_channel"
    const val EXTRA_TARGET_URL = "extra_target_url"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val alertChannel = NotificationChannel(
            CHANNEL_ALERTS,
            context.getString(R.string.voice_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = context.getString(R.string.voice_channel_desc)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 350, 150, 350)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(true)
        }
        nm.createNotificationChannel(alertChannel)

        val guardChannel = NotificationChannel(
            CHANNEL_VOICE_GUARD,
            context.getString(R.string.guard_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.guard_channel_desc)
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_SECRET
        }
        nm.createNotificationChannel(guardChannel)
    }

    fun sanitizeAppUrl(rawUrl: String?): String {
        val base = BuildConfig.APP_BASE_URL.trimEnd('/')
        val clean = rawUrl?.trim().orEmpty()
        if (clean.isEmpty()) return base
        if (clean.startsWith("/")) return "$base$clean"
        return try {
            val parsed = Uri.parse(clean)
            if (parsed.scheme == "https" && parsed.host.equals("lmps27.vercel.app", ignoreCase = true)) {
                clean
            } else {
                base
            }
        } catch (_: Exception) {
            base
        }
    }

    fun buildVoiceGuardForegroundNotification(context: Context): Notification {
        ensureChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            1001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(context, CHANNEL_VOICE_GUARD)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setContentTitle(context.getString(R.string.guard_notif_title))
            .setContentText(context.getString(R.string.guard_notif_body))
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pi)
            .build()
    }

    fun showVoiceNotification(
        context: Context,
        notifKey: String,
        title: String,
        body: String,
        deepLinkUrl: String?
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val safeUrl = sanitizeAppUrl(deepLinkUrl)
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, safeUrl)
        }
        val reqCode = (notifKey.hashCode() and 0x7FFFFFFF)
        val pendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle(title.ifBlank { context.getString(R.string.app_name) })
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setVibrate(longArrayOf(0, 350, 150, 350))
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }
}
