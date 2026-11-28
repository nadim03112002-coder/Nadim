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
    const val CHANNEL_INCOMING_CALLS = "incoming_call_channel"
    const val CHANNEL_VOICE_GUARD = "voice_guard_channel"
    const val CHANNEL_BUS_GPS = "bus_gps_channel"
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

        val callChannel = NotificationChannel(
            CHANNEL_INCOMING_CALLS,
            "Incoming School Calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Lock-screen incoming NSTA voice/video call alerts with Accept & Decline actions"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 250, 500)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(true)
        }
        nm.createNotificationChannel(callChannel)

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

        val busGpsChannel = NotificationChannel(
            CHANNEL_BUS_GPS,
            context.getString(R.string.bus_gps_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = context.getString(R.string.bus_gps_channel_desc)
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        nm.createNotificationChannel(busGpsChannel)
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

    fun buildBusGpsForegroundNotification(
        context: Context,
        busNumber: String,
        statusText: String
    ): Notification {
        ensureChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            2002,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cleanBus = busNumber.ifBlank { "School Bus" }
        val cleanStatus = statusText.ifBlank { "Live GPS chalu hai — screen lock hone par bhi location share hogi." }
        return NotificationCompat.Builder(context, CHANNEL_BUS_GPS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle("🚌 $cleanBus • Live GPS ON")
            .setContentText(cleanStatus)
            .setStyle(NotificationCompat.BigTextStyle().bigText(cleanStatus))
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
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

    fun showIncomingCallerBanner(
        context: Context,
        notifKey: String,
        title: String,
        body: String
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val reqCode = (("caller_$notifKey").hashCode() and 0x7FFFFFFF)
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
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setTimeoutAfter(45_000L)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }

    fun showMissedSchoolCallBanner(
        context: Context,
        match: CallerDirectoryMatch,
        callDateMs: Long = System.currentTimeMillis()
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val targetUrl = sanitizeAppUrl("/?missedSchoolCall=1")
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, targetUrl)
        }
        val reqCode = (("missed_school_${match.last10}_${callDateMs / 15000L}").hashCode() and 0x7FFFFFFF)
        val pendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val roleText = match.role.ifBlank { "School Staff" }
        val title = "📵 Missed School Call • ${match.name}"
        val body = "${match.schoolName} ($roleText) se call aaya tha — NSTA Messenger par message karne ke liye tap karein."

        val notification = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }

    fun showIncomingParentCallBanner(
        context: Context,
        notifKey: String,
        match: CallerDirectoryMatch
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val targetUrl = sanitizeAppUrl("/?incomingParentPhone=${Uri.encode(match.last10)}&incomingParentCall=1")
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, targetUrl)
        }
        val reqCode = (("parent_caller_${match.last10}").hashCode() and 0x7FFFFFFF)
        val pendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val isEnquiry = match.kind.equals("ENQUIRY", ignoreCase = true)
        val rel = match.relationLabel.ifBlank { "Parent" }
        val whoLabel = if (isEnquiry) {
            if (match.studentSummary.isNotBlank()) {
                "Enquiry: ${match.name} (${match.studentSummary})"
            } else {
                "Enquiry: ${match.name}"
            }
        } else if (match.studentSummary.isNotBlank()) {
            "${match.studentSummary} ke $rel"
        } else {
            match.name
        }
        val title = when {
            isEnquiry -> "📋 $whoLabel"
            match.absentToday -> "⚠️ ABSENT TODAY · $whoLabel"
            else -> "📞 $whoLabel"
        }

        val compactLine: String
        val bigBody: String

        if (isEnquiry) {
            val stageLabel = when (match.enquiryStage.lowercase()) {
                "visit_scheduled" -> "Visit Scheduled"
                "contacted" -> "Contacted"
                "applied" -> "Applied"
                "new" -> "New Enquiry"
                else -> match.enquiryStage.ifBlank { "Open Enquiry" }
            }
            val dateLine = when {
                match.enquiryVisitDate.isNotBlank() -> "🏫 Campus Visit: ${AppPrefs.formatShortDateLabel(match.enquiryVisitDate)}"
                match.enquiryFollowUpDate.isNotBlank() -> "📅 Follow-up: ${AppPrefs.formatShortDateLabel(match.enquiryFollowUpDate)}"
                else -> "📅 Follow-up: Set nahi"
            }
            val noteLine = if (match.enquiryNote.isNotBlank()) "📝 Note: ${match.enquiryNote}" else "📝 Counsellor: ${match.counsellorName.ifBlank { "Admissions" }}"
            compactLine = "$stageLabel • ${match.studentSummary.ifBlank { "Admission" }}"
            bigBody = listOf("📋 Stage: $stageLabel", dateLine, noteLine).joinToString("\n")
        } else {
            val dueLine = if (match.dueAmount > 0L) {
                val formatted = AppPrefs.formatIndianRupees(match.dueAmount)
                val mTag = if (match.unpaidMonthsCount > 0) " (${match.unpaidMonthsCount} mahine)" else ""
                "💰 Baki Fee: ₹$formatted$mTag"
            } else {
                "✅ Fee Clear: ₹0 baki"
            }

            val promiseLine = if (match.promiseDate.isNotBlank()) {
                val dLabel = AppPrefs.formatShortDateLabel(match.promiseDate)
                val amtTag = if (match.promisedAmount > 0L) " (₹${AppPrefs.formatIndianRupees(match.promisedAmount)})" else ""
                "🤝 Promise Date: $dLabel$amtTag"
            } else {
                "🤝 Promise Date: Set nahi"
            }

            val nextCallLine = if (match.nextCallDate.isNotBlank()) {
                "📅 Next Call Schedule: ${AppPrefs.formatShortDateLabel(match.nextCallDate)}"
            } else {
                "📅 Next Call Schedule: Set nahi"
            }

            val solvedLine = when {
                match.solvedToday -> "🎯 Aaj Solve Status: Haan, Aaj Solve Ho Gaya ✅"
                match.settled && match.dueAmount <= 0L -> "🎯 Aaj Solve Status: Settled ✅"
                else -> "🎯 Aaj Solve Status: Abhi Pending Hai ⏳"
            }

            val lines = mutableListOf<String>()
            if (match.absentToday) {
                lines.add("⚠️ Alert: Baccha aaj school me ABSENT hai")
            }
            lines.add(dueLine)
            lines.add(promiseLine)
            lines.add(nextCallLine)
            lines.add(solvedLine)
            bigBody = lines.joinToString("\n")

            compactLine = buildString {
                if (match.absentToday) append("ABSENT • ")
                append(if (match.dueAmount > 0L) "₹${AppPrefs.formatIndianRupees(match.dueAmount)} baki" else "Fee clear")
                if (match.promiseDate.isNotBlank()) {
                    append(" • Promise: ${AppPrefs.formatShortDateLabel(match.promiseDate)}")
                }
                if (match.nextCallDate.isNotBlank()) {
                    append(" • Next: ${AppPrefs.formatShortDateLabel(match.nextCallDate)}")
                }
                append(if (match.solvedToday) " • Solved ✅" else " • Pending")
            }
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING_CALLS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle(title)
            .setContentText(compactLine)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bigBody))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setTimeoutAfter(90_000L)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, false)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }

    private fun appendQueryParam(rawUrl: String, key: String, value: String): String {
        return try {
            Uri.parse(rawUrl).buildUpon()
                .appendQueryParameter(key, value)
                .build()
                .toString()
        } catch (_: Exception) {
            val sep = if (rawUrl.contains("?")) "&" else "?"
            "$rawUrl$sep$key=$value"
        }
    }

    private fun extractCallId(rawUrl: String?, fallbackKey: String): String {
        val urlStr = rawUrl.orEmpty()
        try {
            val fromQuery = Uri.parse(urlStr).getQueryParameter("callId").orEmpty().trim()
            if (fromQuery.isNotEmpty()) return fromQuery
        } catch (_: Exception) {}
        return fallbackKey.trim()
    }

    fun showIncomingNstaCallNotification(
        context: Context,
        notifKey: String,
        title: String,
        body: String,
        deepLinkUrl: String?,
        explicitCallId: String = ""
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
        val acceptUrl = appendQueryParam(safeUrl, "callAction", "accept")
        val resolvedCallId = explicitCallId.trim().ifBlank { extractCallId(safeUrl, notifKey) }
        val reqCode = (("nsta_call_$resolvedCallId").hashCode() and 0x7FFFFFFF)

        val contentIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, safeUrl)
        }
        val contentPi = PendingIntent.getActivity(
            context,
            reqCode,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val acceptIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, acceptUrl)
        }
        val acceptPi = PendingIntent.getActivity(
            context,
            reqCode + 1,
            acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val declineIntent = Intent(context, CallNotificationActionReceiver::class.java).apply {
            action = CallNotificationActionReceiver.ACTION_DECLINE_CALL
            putExtra(CallNotificationActionReceiver.EXTRA_NOTIF_ID, reqCode)
            putExtra(CallNotificationActionReceiver.EXTRA_CALL_ID, resolvedCallId)
        }
        val declinePi = PendingIntent.getBroadcast(
            context,
            reqCode + 2,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING_CALLS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle(title.ifBlank { context.getString(R.string.app_name) })
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setTimeoutAfter(45_000L)
            .setVibrate(longArrayOf(0, 500, 250, 500))
            .setContentIntent(contentPi)
            .setFullScreenIntent(contentPi, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePi)
            .addAction(android.R.drawable.ic_menu_call, "Accept", acceptPi)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }

    fun cancelNstaCallNotification(context: Context, callIdOrKey: String) {
        val clean = callIdOrKey.trim()
        if (clean.isEmpty()) return
        val reqCode = (("nsta_call_$clean").hashCode() and 0x7FFFFFFF)
        try {
            NotificationManagerCompat.from(context).cancel(reqCode)
        } catch (_: Exception) {}
    }

    fun showUpiProofOngoingNotification(
        context: Context,
        proof: org.json.JSONObject,
        pendingCount: Int
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val proofId = proof.optString("proofId", "").trim()
        if (proofId.isEmpty()) return
        val studentName = proof.optString("studentName", "Student").ifBlank { "Student" }
        val amtLong = proof.optString("amount", "0").toLongOrNull() ?: 0L
        val formattedAmt = AppPrefs.formatIndianRupees(amtLong)
        val utr = proof.optString("utrNumber", "").trim()
        val paidTime = proof.optString("paidTime", "").trim()
        val monthLabel = proof.optString("monthLabel", "").trim()

        val safeUrl = sanitizeAppUrl("/?schoolPortal=1&openUpiProof=${Uri.encode(proofId)}")
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_TARGET_URL, safeUrl)
        }
        val reqCode = (("upi_proof_$proofId").hashCode() and 0x7FFFFFFF)
        val pendingIntent = PendingIntent.getActivity(
            context,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val title = "₹$formattedAmt UPI Check · $studentName ($pendingCount pending)"
        val body = buildString {
            if (monthLabel.isNotBlank()) append("$monthLabel · ")
            if (utr.isNotBlank()) append("UTR: $utr") else append("Payment Screenshot")
            if (paidTime.isNotBlank()) append(" · 🕒 $paidTime")
            append("\nBharatPe me match karke Confirm karein.")
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_notification)
            .setColor(ContextCompat.getColor(context, R.color.brand_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setVibrate(longArrayOf(0, 350, 150, 350))
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "Verify & Confirm", pendingIntent)
            .build()

        NotificationManagerCompat.from(context).notify(reqCode, notification)
    }

    fun cancelUpiProofNotification(context: Context, proofId: String) {
        val cleanId = proofId.trim()
        if (cleanId.isEmpty()) return
        val reqCode = (("upi_proof_$cleanId").hashCode() and 0x7FFFFFFF)
        try {
            NotificationManagerCompat.from(context).cancel(reqCode)
        } catch (_: Exception) {}
    }
}
