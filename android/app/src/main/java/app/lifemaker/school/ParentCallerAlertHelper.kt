package app.lifemaker.school

import android.content.Context
import android.content.Intent

object ParentCallerAlertHelper {
    const val ACTION_INCOMING_PARENT_CALL = "app.lifemaker.school.ACTION_INCOMING_PARENT_CALL"
    const val EXTRA_PARENT_PAYLOAD = "extra_parent_payload"

    fun handleIncomingNumber(context: Context, rawPhone: String?) {
        val cleanNumber = rawPhone?.trim().orEmpty()
        if (cleanNumber.isBlank()) return

        val match = AppPrefs.findCallerEntry(context, cleanNumber) ?: return
        val dedupeBucket = System.currentTimeMillis() / 12_000L
        val dedupeKey = "sim_call_${match.last10}_$dedupeBucket"
        val isParentCaller = match.kind.equals("PARENT", ignoreCase = true)
        val isEnquiryCaller = match.kind.equals("ENQUIRY", ignoreCase = true)

        if (isParentCaller || isEnquiryCaller) {
            if (!AppPrefs.isParentCallerIdEnabled(context)) return

            AppPrefs.setActiveRingingCaller(context, match)

            if (AppPrefs.isCallerVoiceAnnounceEnabled(context)) {
                val spoken = if (isEnquiryCaller) {
                    buildEnquirySpokenText(match)
                } else {
                    buildParentSpokenText(context, match)
                }
                VoiceAnnouncer.speakIncomingCall(
                    context = context,
                    rawText = spoken,
                    dedupeKey = dedupeKey
                )
            }

            if (AppPrefs.isParentCardPopupEnabled(context)) {
                AppPrefs.saveLastIncomingParentCall(context, match, postCall = false)
                val broadcastIntent = Intent(ACTION_INCOMING_PARENT_CALL).apply {
                    setPackage(context.packageName)
                    putExtra(EXTRA_PARENT_PAYLOAD, match.toJson(postCall = false).toString())
                }
                try {
                    context.sendBroadcast(broadcastIntent)
                } catch (_: Exception) {}
            }

            if (AppPrefs.isParentOverlayEnabled(context) && ParentCallOverlayService.canDrawOverlays(context)) {
                ParentCallOverlayService.showRinging(context, match)
            }

            NotificationHelper.showIncomingParentCallBanner(
                context = context,
                notifKey = dedupeKey,
                match = match
            )
            return
        }

        // Staff / Principal / Teacher / Accountant caller
        if (!AppPrefs.isCallerVoiceAnnounceEnabled(context)) return
        val roleSuffix = if (match.role.isNotBlank()) " (${match.role})" else ""
        val spoken = "Dhyan dein, ${match.schoolName} se ${match.name}$roleSuffix aapko call kar rahe hain."
        val title = "📞 ${match.schoolName} • ${match.name}"
        val body = "${match.name}$roleSuffix aapko call kar rahe hain (${match.schoolName} Offline Caller ID)"

        VoiceAnnouncer.speakIncomingCall(
            context = context,
            rawText = spoken,
            dedupeKey = dedupeKey
        )

        NotificationHelper.showIncomingCallerBanner(
            context = context,
            notifKey = dedupeKey,
            title = title,
            body = body
        )
    }

    fun handleCallEnded(context: Context) {
        val match = AppPrefs.getActiveRingingCaller(context) ?: return
        AppPrefs.clearActiveRingingCaller(context)
        if (!AppPrefs.isParentCallerIdEnabled(context) || !AppPrefs.isParentCardPopupEnabled(context)) {
            return
        }

        AppPrefs.saveLastIncomingParentCall(context, match, postCall = true)
        val broadcastIntent = Intent(ACTION_INCOMING_PARENT_CALL).apply {
            setPackage(context.packageName)
            putExtra(EXTRA_PARENT_PAYLOAD, match.toJson(postCall = true).toString())
        }
        try {
            context.sendBroadcast(broadcastIntent)
        } catch (_: Exception) {}

        if (AppPrefs.isParentOverlayEnabled(context) && ParentCallOverlayService.canDrawOverlays(context)) {
            ParentCallOverlayService.showPostCall(context, match)
        }
    }

    private fun buildEnquirySpokenText(match: CallerDirectoryMatch): String {
        val targetInfo = if (match.studentSummary.isNotBlank()) {
            "${match.studentSummary} ke liye "
        } else {
            ""
        }
        return "New admission enquiry, ${targetInfo}${match.name} call kar rahe hain."
    }

    private fun buildParentSpokenText(context: Context, match: CallerDirectoryMatch): String {
        val rel = match.relationLabel.ifBlank { "Parent" }
        val absentPrefix = if (match.absentToday && match.studentSummary.isNotBlank()) {
            "Dhyan dein, aaj ${match.studentSummary} school me absent hain. "
        } else {
            ""
        }
        val callerPhrase = if (match.studentSummary.isNotBlank()) {
            "${match.studentSummary} ke $rel call kar rahe hain"
        } else {
            "${match.name} call kar rahe hain"
        }

        val dueClause = if (AppPrefs.isParentDueVoiceEnabled(context)) {
            if (match.dueAmount > 0L) {
                ", ₹${AppPrefs.formatIndianRupees(match.dueAmount)} fee baki hai"
            } else {
                ", sab fee clear hai"
            }
        } else {
            ""
        }

        val extraParts = mutableListOf<String>()
        if (AppPrefs.isParentScheduleVoiceEnabled(context)) {
            if (match.promiseDate.isNotBlank()) {
                extraParts.add("promise date ${AppPrefs.formatShortDateLabel(match.promiseDate)}")
            }
            if (match.nextCallDate.isNotBlank()) {
                extraParts.add("next call ${AppPrefs.formatShortDateLabel(match.nextCallDate)}")
            }
            if (match.solvedToday) {
                extraParts.add("aaj ka case solve hai")
            }
        }

        val extraClause = if (extraParts.isNotEmpty()) ". ${extraParts.joinToString(", ")}" else ""
        return "$absentPrefix$callerPhrase$dueClause$extraClause."
    }
}
