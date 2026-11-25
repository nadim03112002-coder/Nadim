package app.lifemaker.school

import android.content.Context
import android.content.Intent

object ParentCallerAlertHelper {
    const val ACTION_INCOMING_PARENT_CALL = "app.lifemaker.school.ACTION_INCOMING_PARENT_CALL"
    const val EXTRA_PARENT_PAYLOAD = "extra_parent_payload"
    const val ACTION_MISSED_SCHOOL_CALL = "app.lifemaker.school.ACTION_MISSED_SCHOOL_CALL"
    const val EXTRA_MISSED_CALL_PAYLOAD = "extra_missed_call_payload"

    @Volatile
    private var lastOutgoingKey: String = ""

    @Volatile
    private var lastOutgoingAtMs: Long = 0L

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

            AppPrefs.setActiveRingingCaller(context, match, direction = "INCOMING")

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
                AppPrefs.saveLastIncomingParentCall(context, match, postCall = false, direction = "INCOMING")
                val broadcastIntent = Intent(ACTION_INCOMING_PARENT_CALL).apply {
                    setPackage(context.packageName)
                    putExtra(EXTRA_PARENT_PAYLOAD, match.toJson(postCall = false, direction = "INCOMING").toString())
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

        // Staff / Principal / Teacher / Accountant caller (Verified School Call)
        AppPrefs.setActiveRingingCaller(context, match, direction = "INCOMING")

        val roleSuffix = if (match.role.isNotBlank()) " (${match.role})" else ""
        val spoken = "Dhyan dein, ${match.schoolName} se ${match.name}$roleSuffix aapko call kar rahe hain."
        val title = "✓ ${match.schoolName} • ${match.name}"
        val body = "${match.name}$roleSuffix aapko call kar rahe hain (Verified School Call)"

        if (AppPrefs.isCallerVoiceAnnounceEnabled(context)) {
            VoiceAnnouncer.speakIncomingCall(
                context = context,
                rawText = spoken,
                dedupeKey = dedupeKey
            )
        }

        if (AppPrefs.isParentOverlayEnabled(context) && ParentCallOverlayService.canDrawOverlays(context)) {
            ParentCallOverlayService.showRinging(context, match)
        }

        NotificationHelper.showIncomingCallerBanner(
            context = context,
            notifKey = dedupeKey,
            title = title,
            body = body
        )
    }

    fun showTestVerifiedSchoolOverlay(
        context: Context,
        schoolName: String,
        staffName: String,
        staffRole: String,
        phone: String
    ): Boolean {
        if (!ParentCallOverlayService.canDrawOverlays(context)) return false
        val match = CallerDirectoryMatch(
            schoolName = schoolName.ifBlank { "School" },
            name = staffName.ifBlank { "Rajesh Sir" },
            role = staffRole.ifBlank { "Class Teacher" },
            last10 = phone.ifBlank { "9876543210" },
            kind = "STAFF"
        )
        ParentCallOverlayService.showRinging(context, match)
        return true
    }

    fun handleOutgoingNumber(context: Context, rawPhone: String?) {
        val cleanNumber = rawPhone?.trim().orEmpty()
        if (cleanNumber.isBlank()) return
        if (!AppPrefs.isOutgoingCallIdEnabled(context)) return

        val match = AppPrefs.findCallerEntry(context, cleanNumber) ?: return
        val isParentCaller = match.kind.equals("PARENT", ignoreCase = true)
        val isEnquiryCaller = match.kind.equals("ENQUIRY", ignoreCase = true)
        val isParentOrEnquiry = isParentCaller || isEnquiryCaller

        if (isParentOrEnquiry && !AppPrefs.isParentCallerIdEnabled(context)) return

        val now = System.currentTimeMillis()
        if (lastOutgoingKey == match.last10 && now - lastOutgoingAtMs < 6_000L) {
            return
        }
        lastOutgoingKey = match.last10
        lastOutgoingAtMs = now

        AppPrefs.setActiveRingingCaller(context, match, direction = "OUTGOING")

        if (isParentOrEnquiry && AppPrefs.isParentCardPopupEnabled(context)) {
            AppPrefs.saveLastIncomingParentCall(context, match, postCall = false, direction = "OUTGOING")
            val broadcastIntent = Intent(ACTION_INCOMING_PARENT_CALL).apply {
                setPackage(context.packageName)
                putExtra(EXTRA_PARENT_PAYLOAD, match.toJson(postCall = false, direction = "OUTGOING").toString())
            }
            try {
                context.sendBroadcast(broadcastIntent)
            } catch (_: Exception) {}
        }

        if (AppPrefs.isParentOverlayEnabled(context) && ParentCallOverlayService.canDrawOverlays(context)) {
            ParentCallOverlayService.showOutgoing(context, match)
        }
    }

    fun handleCallEnded(
        context: Context,
        durationSec: Int = 0,
        resolvedCallType: String = "",
        resolvedCallDateMs: Long = 0L
    ) {
        val match = AppPrefs.getActiveRingingCaller(context) ?: return
        val direction = AppPrefs.getActiveRingingCallDirection(context)
        val startedAtMs = AppPrefs.getActiveRingingCallStartedAtMs(context)
        val wasAnswered = AppPrefs.wasActiveCallAnswered(context)
        AppPrefs.clearActiveRingingCaller(context)

        val isParentCaller = match.kind.equals("PARENT", ignoreCase = true)
        val isEnquiryCaller = match.kind.equals("ENQUIRY", ignoreCase = true)
        if (!isParentCaller && !isEnquiryCaller) {
            // Staff / Verified School Call: immediately auto-close floating overlay on call end
            ParentCallOverlayService.hide(context)
            val isIncomingStaff = direction.equals("INCOMING", ignoreCase = true)
            val isMissedStaff = isIncomingStaff && (
                !wasAnswered ||
                resolvedCallType.equals("MISSED", ignoreCase = true) ||
                resolvedCallType.equals("REJECTED", ignoreCase = true)
            )
            if (isMissedStaff) {
                val missTs = if (resolvedCallDateMs > 0L) resolvedCallDateMs else (if (startedAtMs > 0L) startedAtMs else System.currentTimeMillis())
                AppPrefs.appendMissedSchoolCall(context, match, missTs)
                NotificationHelper.showMissedSchoolCallBanner(context, match, missTs)
                val missedPayload = org.json.JSONObject().apply {
                    put("phone", match.last10)
                    put("name", match.name)
                    put("role", match.role)
                    put("schoolName", match.schoolName)
                    put("callDateMs", missTs)
                }.toString()
                try {
                    context.sendBroadcast(Intent(ACTION_MISSED_SCHOOL_CALL).apply {
                        setPackage(context.packageName)
                        putExtra(EXTRA_MISSED_CALL_PAYLOAD, missedPayload)
                    })
                } catch (_: Exception) {}
            }
            return
        }

        val finalCallType = resolvedCallType.trim().ifBlank {
            if (direction.equals("OUTGOING", ignoreCase = true)) "OUTGOING" else "INCOMING"
        }
        val finalDateMs = if (resolvedCallDateMs > 0L) resolvedCallDateMs else (if (startedAtMs > 0L) startedAtMs else System.currentTimeMillis())

        AppPrefs.appendRecentMatchedSimCall(
            context = context,
            match = match,
            direction = direction,
            callType = finalCallType,
            durationSec = durationSec,
            callDateMs = finalDateMs
        )

        if (!AppPrefs.isParentCallerIdEnabled(context) || !AppPrefs.isParentCardPopupEnabled(context)) {
            return
        }

        AppPrefs.saveLastIncomingParentCall(
            context = context,
            match = match,
            postCall = true,
            direction = direction,
            durationSec = durationSec,
            callType = finalCallType
        )
        val broadcastIntent = Intent(ACTION_INCOMING_PARENT_CALL).apply {
            setPackage(context.packageName)
            putExtra(
                EXTRA_PARENT_PAYLOAD,
                match.toJson(
                    postCall = true,
                    direction = direction,
                    durationSec = durationSec,
                    callType = finalCallType
                ).toString()
            )
        }
        try {
            context.sendBroadcast(broadcastIntent)
        } catch (_: Exception) {}

        if (AppPrefs.isParentOverlayEnabled(context) && ParentCallOverlayService.canDrawOverlays(context)) {
            ParentCallOverlayService.showPostCall(
                context = context,
                match = match,
                direction = direction,
                durationSec = durationSec,
                callType = finalCallType
            )
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
