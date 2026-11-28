package app.lifemaker.school

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

class ParentCallOverlayService : Service() {

    companion object {
        const val ACTION_SHOW_RINGING = "app.lifemaker.school.OVERLAY_SHOW_RINGING"
        const val ACTION_SHOW_OUTGOING = "app.lifemaker.school.OVERLAY_SHOW_OUTGOING"
        const val ACTION_SHOW_POST_CALL = "app.lifemaker.school.OVERLAY_SHOW_POST_CALL"
        const val ACTION_SHOW_NSTA_CALL = "app.lifemaker.school.OVERLAY_SHOW_NSTA_CALL"
        const val ACTION_HIDE_NSTA_CALL = "app.lifemaker.school.OVERLAY_HIDE_NSTA_CALL"
        const val ACTION_HIDE = "app.lifemaker.school.OVERLAY_HIDE"
        const val EXTRA_CALLER_JSON = "extra_caller_json"
        const val EXTRA_NSTA_CALL_JSON = "extra_nsta_call_json"
        const val EXTRA_NSTA_CALL_ID = "extra_nsta_call_id"
        const val ACTION_NSTA_CALL_NATIVE_ACTION = "app.lifemaker.school.NSTA_CALL_NATIVE_ACTION"
        const val EXTRA_NATIVE_ACTION = "extra_native_action"
        const val EXTRA_NATIVE_CALL_URL = "extra_native_call_url"

        fun showRinging(context: Context, match: CallerDirectoryMatch) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_RINGING
                putExtra(EXTRA_CALLER_JSON, match.toJson(postCall = false, direction = "INCOMING").toString())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun showOutgoing(context: Context, match: CallerDirectoryMatch) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_OUTGOING
                putExtra(EXTRA_CALLER_JSON, match.toJson(postCall = false, direction = "OUTGOING").toString())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun showPostCall(
            context: Context,
            match: CallerDirectoryMatch,
            direction: String = "INCOMING",
            durationSec: Int = 0,
            callType: String = ""
        ) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_POST_CALL
                putExtra(
                    EXTRA_CALLER_JSON,
                    match.toJson(
                        postCall = true,
                        direction = direction,
                        durationSec = durationSec,
                        callType = callType
                    ).toString()
                )
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun showNstaCall(context: Context, callJson: JSONObject) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_NSTA_CALL
                putExtra(EXTRA_NSTA_CALL_JSON, callJson.toString())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun hideNstaCall(context: Context, callId: String = "") {
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_HIDE_NSTA_CALL
                putExtra(EXTRA_NSTA_CALL_ID, callId.trim())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {
                hide(context)
            }
        }

        fun hide(context: Context) {
            try {
                context.stopService(Intent(context, ParentCallOverlayService::class.java))
            } catch (_: Exception) {}
        }

        fun canDrawOverlays(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Settings.canDrawOverlays(context)
                } catch (_: Exception) {
                    false
                }
            } else {
                true
            }
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var activeNstaCallId: String = ""
    private val mainHandler = Handler(Looper.getMainLooper())
    private val autoDismissRunnable = Runnable {
        removeOverlayView()
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_HIDE
        if (action == ACTION_HIDE) {
            activeNstaCallId = ""
            removeOverlayView()
            stopSelf()
            return START_NOT_STICKY
        }

        if (action == ACTION_HIDE_NSTA_CALL) {
            val targetId = intent?.getStringExtra(EXTRA_NSTA_CALL_ID).orEmpty().trim()
            if (targetId.isEmpty() || activeNstaCallId.isEmpty() || targetId == activeNstaCallId) {
                activeNstaCallId = ""
                removeOverlayView()
                stopSelf()
            }
            return START_NOT_STICKY
        }

        if (!canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (action == ACTION_SHOW_NSTA_CALL) {
            val rawNstaJson = intent?.getStringExtra(EXTRA_NSTA_CALL_JSON).orEmpty()
            if (rawNstaJson.isBlank()) {
                stopSelf()
                return START_NOT_STICKY
            }
            mainHandler.post {
                showOrUpdateNstaCallOverlay(rawNstaJson)
            }
            return START_NOT_STICKY
        }

        val rawJson = intent?.getStringExtra(EXTRA_CALLER_JSON).orEmpty()
        if (rawJson.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val isPostCall = action == ACTION_SHOW_POST_CALL
        val forceOutgoing = action == ACTION_SHOW_OUTGOING
        mainHandler.post {
            showOrUpdateOverlay(rawJson, isPostCall, forceOutgoing)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(autoDismissRunnable)
        removeOverlayView()
        super.onDestroy()
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun removeOverlayView() {
        val wm = windowManager
        val view = overlayView
        if (wm != null && view != null) {
            try {
                wm.removeViewImmediate(view)
            } catch (_: Exception) {}
        }
        overlayView = null
        layoutParams = null
        activeNstaCallId = ""
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showOrUpdateOverlay(rawJson: String, isPostCall: Boolean, forceOutgoing: Boolean = false) {
        val data = try {
            JSONObject(rawJson)
        } catch (_: Exception) {
            stopSelf()
            return
        }

        removeOverlayView()
        mainHandler.removeCallbacks(autoDismissRunnable)

        val wm = getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: run {
            stopSelf()
            return
        }
        windowManager = wm

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val widthPx = (resources.displayMetrics.widthPixels - dp(24)).coerceAtMost(dp(420))
        val params = WindowManager.LayoutParams(
            widthPx,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(42)
        }
        layoutParams = params

        val direction = if (forceOutgoing) {
            "OUTGOING"
        } else {
            data.optString("direction", "INCOMING").ifBlank { "INCOMING" }
        }
        val isOutgoing = direction.equals("OUTGOING", ignoreCase = true)
        val durationSec = data.optInt("durationSec", 0).coerceAtLeast(0)
        val durationSuffix = if (durationSec > 0) {
            val mins = durationSec / 60
            val secs = durationSec % 60
            if (mins > 0) " (${mins}m ${secs}s)" else " (${secs}s)"
        } else {
            ""
        }
        val kind = data.optString("kind", "PARENT").ifBlank { "PARENT" }
        val isParentCaller = kind.equals("PARENT", ignoreCase = true)
        val isEnquiry = kind.equals("ENQUIRY", ignoreCase = true)
        val isStaff = !isParentCaller && !isEnquiry
        val absentToday = data.optBoolean("absentToday", false)
        val phone = data.optString("phone", "").trim()
        val schoolName = data.optString("schoolName", "School").ifBlank { "School" }
        val name = data.optString("name", "Caller").trim()
        val role = data.optString("role", "School Staff").trim().ifBlank { "School Staff" }
        val studentSummary = data.optString("studentSummary", "").trim()
        val relationLabel = data.optString("relationLabel", "Parent").ifBlank { "Parent" }
        val fatherName = data.optString("fatherName", "").trim()
        val dueAmount = data.optLong("dueAmount", 0L)
        val promiseDate = data.optString("promiseDate", "").trim()
        val promisedAmount = data.optLong("promisedAmount", 0L)
        val nextCallDate = data.optString("nextCallDate", "").trim()
        val solvedToday = data.optBoolean("solvedToday", false)
        val settled = data.optBoolean("settled", false)
        val enquiryStage = data.optString("enquiryStage", "").trim()
        val enquiryFollowUp = data.optString("enquiryFollowUpDate", "").trim()
        val enquiryVisit = data.optString("enquiryVisitDate", "").trim()
        val enquiryNote = data.optString("enquiryNote", "").trim()
        val counsellorName = data.optString("counsellorName", "").trim()

        val cardBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(18).toFloat()
            setStroke(dp(1), Color.parseColor(
                when {
                    isStaff -> "#0EA5E9"
                    isPostCall -> "#4F46E5"
                    absentToday -> "#E11D48"
                    isEnquiry -> "#0284C7"
                    isOutgoing -> "#0D9488"
                    else -> "#10B981"
                }
            ))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg
            elevation = dp(12).toFloat()
        }

        // Top Drag Header Strip
        val headerBg = GradientDrawable().apply {
            setColor(Color.parseColor(
                when {
                    isStaff && isOutgoing -> "#0F3A4A"
                    isStaff -> "#0C4A6E"
                    isPostCall -> "#1E1B4B"
                    absentToday -> "#4C0519"
                    isEnquiry -> "#082F49"
                    isOutgoing -> "#134E4A"
                    else -> "#064E3B"
                }
            ))
            cornerRadii = floatArrayOf(
                dp(17).toFloat(), dp(17).toFloat(),
                dp(17).toFloat(), dp(17).toFloat(),
                0f, 0f, 0f, 0f
            )
        }

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = headerBg
            setPadding(dp(14), dp(10), dp(10), dp(10))
        }

        val tagText = TextView(this).apply {
            text = when {
                isStaff && isOutgoing -> "✓ VERIFIED SCHOOL CALL · OUTGOING"
                isStaff -> "✓ VERIFIED SCHOOL CALL · $schoolName"
                isPostCall && isOutgoing -> "OUTGOING CALL ENDED$durationSuffix · UPDATE"
                isPostCall -> "CALL ENDED$durationSuffix · UPDATE STATUS"
                isOutgoing && isEnquiry -> "OUTGOING ENQUIRY · $schoolName"
                isOutgoing && absentToday -> "OUTGOING ABSENT ALERT · $schoolName"
                isOutgoing -> "OUTGOING PARENT CALL · $schoolName"
                isEnquiry -> "ADMISSION ENQUIRY · $schoolName"
                absentToday -> "ABSENT TODAY ALERT · $schoolName"
                else -> "PARENT CALLER ID · $schoolName"
            }
            setTextColor(Color.parseColor(
                when {
                    isStaff -> "#7DD3FC"
                    isPostCall -> "#C7D2FE"
                    absentToday -> "#FDA4AF"
                    isEnquiry -> "#7DD3FC"
                    else -> "#6EE7B7"
                }
            ))
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#CBD5E1"))
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(10), dp(2), dp(10), dp(2))
            setOnClickListener {
                removeOverlayView()
                stopSelf()
            }
        }

        headerRow.addView(tagText)
        headerRow.addView(closeBtn)

        // Allow dragging overlay vertically/horizontally from header
        var initX = 0
        var initY = 0
        var touchX = 0f
        var touchY = 0f
        headerRow.setOnTouchListener { _, event ->
            val lp = layoutParams ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initX = lp.x
                    initY = lp.y
                    touchX = event.rawX
                    touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    lp.x = initX + (event.rawX - touchX).toInt()
                    lp.y = initY + (event.rawY - touchY).toInt()
                    try {
                        wm.updateViewLayout(root, lp)
                    } catch (_: Exception) {}
                    true
                }
                else -> false
            }
        }

        root.addView(headerRow)

        // Body Container
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }

        val callerTitle = TextView(this).apply {
            text = when {
                isStaff -> name
                isEnquiry -> if (studentSummary.isNotBlank()) "$name · $studentSummary" else name
                else -> if (studentSummary.isNotBlank()) "$studentSummary ke $relationLabel" else name
            }
            setTextColor(Color.WHITE)
            textSize = if (isStaff) 17f else 16f
            setTypeface(null, Typeface.BOLD)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        body.addView(callerTitle)

        val subLine = TextView(this).apply {
            text = if (isStaff) {
                buildString {
                    append(role)
                    if (phone.isNotBlank()) {
                        append(" • ")
                        append(phone)
                    }
                }
            } else {
                buildString {
                    if (!isEnquiry && fatherName.isNotBlank()) {
                        append(fatherName)
                        append(" • ")
                    }
                    append(phone)
                    if (absentToday && !isEnquiry) {
                        append(" • Aaj School me Absent Hain")
                    }
                }
            }
            setTextColor(Color.parseColor(
                when {
                    isStaff -> "#7DD3FC"
                    absentToday && !isEnquiry -> "#FDA4AF"
                    else -> "#94A3B8"
                }
            ))
            textSize = 12f
            setPadding(0, dp(2), 0, dp(10))
        }
        body.addView(subLine)

        // Fact Grid
        fun createFactCell(label: String, value: String, valueColor: String): LinearLayout {
            val cellBg = GradientDrawable().apply {
                setColor(Color.parseColor("#1E293B"))
                cornerRadius = dp(10).toFloat()
            }
            return LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = cellBg
                setPadding(dp(10), dp(8), dp(10), dp(8))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                addView(TextView(context).apply {
                    text = label
                    setTextColor(Color.parseColor("#94A3B8"))
                    textSize = 10f
                    isSingleLine = true
                })
                addView(TextView(context).apply {
                    text = value
                    setTextColor(Color.parseColor(valueColor))
                    textSize = 13f
                    setTypeface(null, Typeface.BOLD)
                    maxLines = 2
                    ellipsize = TextUtils.TruncateAt.END
                    setPadding(0, dp(2), 0, 0)
                })
            }
        }

        val row1 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }
        val row2 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(6), 0, 0)
        }

        val gapView1 = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(6), 1)
        }
        val gapView2 = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(6), 1)
        }

        if (isStaff) {
            row1.addView(createFactCell("School Directory", schoolName, "#F8FAFC"))
            row1.addView(gapView1)
            row1.addView(createFactCell("Verified Role", role, "#34D399"))
            body.addView(row1)
        } else if (isEnquiry) {
            val stageLabel = when (enquiryStage.lowercase()) {
                "visit_scheduled" -> "Visit Scheduled"
                "contacted" -> "Contacted"
                "applied" -> "Applied"
                "new" -> "New Enquiry"
                else -> enquiryStage.ifBlank { "Open Enquiry" }
            }
            val dateVal = when {
                enquiryVisit.isNotBlank() -> "Visit: ${AppPrefs.formatShortDateLabel(enquiryVisit)}"
                enquiryFollowUp.isNotBlank() -> "Follow: ${AppPrefs.formatShortDateLabel(enquiryFollowUp)}"
                else -> "Set nahi"
            }
            row1.addView(createFactCell("Target Class / Baccha", studentSummary.ifBlank { "Admission" }, "#F8FAFC"))
            row1.addView(gapView1)
            row1.addView(createFactCell("Enquiry Stage", stageLabel, "#38BDF8"))
            row2.addView(createFactCell("Visit / Follow-up", dateVal, "#FBBF24"))
            row2.addView(gapView2)
            row2.addView(
                createFactCell(
                    "Counsellor / Note",
                    counsellorName.ifBlank { enquiryNote.ifBlank { "New Call" } },
                    "#E2E8F0"
                )
            )
            body.addView(row1)
            body.addView(row2)
        } else {
            val dueStr = if (dueAmount > 0L) "₹${AppPrefs.formatIndianRupees(dueAmount)}" else "₹0 · Clear"
            val dueColor = if (dueAmount > 0L) "#FB7185" else "#34D399"

            val promiseStr = if (promiseDate.isNotBlank()) {
                val d = AppPrefs.formatShortDateLabel(promiseDate)
                if (promisedAmount > 0L) "$d (₹${AppPrefs.formatIndianRupees(promisedAmount)})" else d
            } else {
                "Set nahi"
            }
            val nextCallStr = if (nextCallDate.isNotBlank()) {
                AppPrefs.formatShortDateLabel(nextCallDate)
            } else {
                "Set nahi"
            }
            val solveStr = when {
                solvedToday -> "Haan, Solve ✅"
                settled && dueAmount <= 0L -> "Settled ✅"
                else -> "Abhi Pending"
            }
            val solveColor = if (solvedToday || (settled && dueAmount <= 0L)) "#34D399" else "#FBBF24"

            row1.addView(createFactCell("1. Fee Baki", dueStr, dueColor))
            row1.addView(gapView1)
            row1.addView(createFactCell("2. Promise Date", promiseStr, "#E2E8F0"))
            row2.addView(createFactCell("3. Next Call", nextCallStr, "#38BDF8"))
            row2.addView(gapView2)
            row2.addView(createFactCell("4. Aaj Solve?", solveStr, solveColor))
            body.addView(row1)
            body.addView(row2)
        }

        // Action Row
        val actionRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }

        val openBtnBg = GradientDrawable().apply {
            setColor(Color.parseColor(
                when {
                    isStaff -> "#0284C7"
                    isPostCall -> "#4F46E5"
                    else -> "#059669"
                }
            ))
            cornerRadius = dp(10).toFloat()
        }
        val openBtn = TextView(this).apply {
            text = when {
                isStaff -> "Open School App"
                isPostCall -> "Promise / Solve Update Karein"
                else -> "Open Full Card / Collect"
            }
            setTextColor(Color.WHITE)
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = openBtnBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                val launch = if (isStaff) {
                    Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                } else {
                    val postParam = if (isPostCall) "&postCall=1" else ""
                    val url = NotificationHelper.sanitizeAppUrl(
                        "/?incomingParentPhone=${Uri.encode(phone)}&incomingParentCall=1$postParam"
                    )
                    Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra(NotificationHelper.EXTRA_TARGET_URL, url)
                    }
                }
                try {
                    startActivity(launch)
                } catch (_: Exception) {}
                removeOverlayView()
                stopSelf()
            }
        }

        val gapAction = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(8), 1)
        }

        val dismissBtnBg = GradientDrawable().apply {
            setColor(Color.parseColor("#334155"))
            cornerRadius = dp(10).toFloat()
        }
        val dismissBtn = TextView(this).apply {
            text = "Close"
            setTextColor(Color.parseColor("#E2E8F0"))
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = dismissBtnBg
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setOnClickListener {
                removeOverlayView()
                stopSelf()
            }
        }

        actionRow.addView(openBtn)
        actionRow.addView(gapAction)
        actionRow.addView(dismissBtn)
        body.addView(actionRow)

        root.addView(body)

        try {
            wm.addView(root, params)
            overlayView = root
            val timeoutMs = when {
                isStaff -> 45_000L
                isPostCall -> 25_000L
                else -> 65_000L
            }
            mainHandler.postDelayed(autoDismissRunnable, timeoutMs)
        } catch (_: Exception) {
            stopSelf()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showOrUpdateNstaCallOverlay(rawJson: String) {
        val data = try {
            JSONObject(rawJson)
        } catch (_: Exception) {
            stopSelf()
            return
        }

        val callId = data.optString("callId", "").trim()
        val callerName = data.optString("callerName", "NSTA Caller").trim().ifBlank { "NSTA Caller" }
        val callerRole = data.optString("callerRole", "").trim()
        val schoolName = data.optString("schoolName", "School").trim().ifBlank { "School" }
        val callType = data.optString("callType", "voice").trim().lowercase()
        val phase = data.optString("phase", "ringing_incoming").trim().lowercase()
        val statusText = data.optString("statusText", "").trim()
        val deepLinkUrl = NotificationHelper.sanitizeAppUrl(
            data.optString("url", "/?schoolPortal=1&schoolTab=messenger").ifBlank { "/?schoolPortal=1&schoolTab=messenger" }
        )
        val isVideo = callType == "video"
        val isIncoming = phase == "ringing_incoming"
        val isOutgoing = phase == "ringing_outgoing"
        val isConnected = phase == "connected" || phase == "connecting"
        val isTerminal = phase == "ended" || phase == "missed" || phase == "cancelled" || phase == "rejected"

        removeOverlayView()
        mainHandler.removeCallbacks(autoDismissRunnable)
        activeNstaCallId = callId

        val wm = getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: run {
            stopSelf()
            return
        }
        windowManager = wm

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val widthPx = (resources.displayMetrics.widthPixels - dp(24)).coerceAtMost(dp(420))
        val params = WindowManager.LayoutParams(
            widthPx,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dp(42)
        }
        layoutParams = params

        val borderColor = when {
            isTerminal -> if (phase == "missed" || phase == "rejected") "#E11D48" else "#6366F1"
            isConnected -> "#10B981"
            isOutgoing -> "#0EA5E9"
            isVideo -> "#8B5CF6"
            else -> "#10B981"
        }

        val cardBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(18).toFloat()
            setStroke(dp(1), Color.parseColor(borderColor))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg
            elevation = dp(14).toFloat()
        }

        val headerBgColor = when {
            phase == "missed" || phase == "rejected" -> "#4C0519"
            isTerminal -> "#1E1B4B"
            isConnected -> "#064E3B"
            isOutgoing -> "#0C4A6E"
            isVideo -> "#3B0764"
            else -> "#065F46"
        }

        val headerBg = GradientDrawable().apply {
            setColor(Color.parseColor(headerBgColor))
            cornerRadii = floatArrayOf(
                dp(17).toFloat(), dp(17).toFloat(),
                dp(17).toFloat(), dp(17).toFloat(),
                0f, 0f, 0f, 0f
            )
        }

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = headerBg
            setPadding(dp(14), dp(10), dp(10), dp(10))
        }

        val callKindTag = if (isVideo) "NSTA VIDEO CALL" else "NSTA VOICE CALL"
        val phaseTag = when {
            phase == "missed" -> "MISSED CALL"
            phase == "rejected" -> "DECLINED"
            phase == "cancelled" -> "CANCELLED"
            phase == "ended" -> "CALL ENDED"
            isConnected -> "LIVE CALL"
            isOutgoing -> "CALLING..."
            else -> "INCOMING"
        }

        val tagText = TextView(this).apply {
            text = "${if (isVideo) "📹" else "📞"} $callKindTag · $phaseTag"
            setTextColor(Color.parseColor(if (phase == "missed" || phase == "rejected") "#FDA4AF" else "#6EE7B7"))
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#CBD5E1"))
            textSize = 15f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(dp(10), dp(2), dp(10), dp(2))
            setOnClickListener {
                removeOverlayView()
                stopSelf()
            }
        }

        headerRow.addView(tagText)
        headerRow.addView(closeBtn)

        var initX = 0
        var initY = 0
        var touchX = 0f
        var touchY = 0f
        headerRow.setOnTouchListener { _, event ->
            val lp = layoutParams ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initX = lp.x
                    initY = lp.y
                    touchX = event.rawX
                    touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    lp.x = initX + (event.rawX - touchX).toInt()
                    lp.y = initY + (event.rawY - touchY).toInt()
                    try {
                        wm.updateViewLayout(root, lp)
                    } catch (_: Exception) {}
                    true
                }
                else -> false
            }
        }

        root.addView(headerRow)

        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }

        val titleView = TextView(this).apply {
            text = callerName
            setTextColor(Color.WHITE)
            textSize = 17f
            setTypeface(null, Typeface.BOLD)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        body.addView(titleView)

        val defaultStatus = when {
            phase == "missed" -> "NSTA Messenger Call missed ho gayi"
            phase == "rejected" -> "Call decline ki gayi"
            phase == "cancelled" -> "Caller ne call cancel kar di"
            phase == "ended" -> "NSTA Call samapt hui"
            isConnected -> "Baat chal rahi hai"
            isOutgoing -> "Ring ja rahi hai..."
            isVideo -> "NSTA Messenger par video call aa rahi hai"
            else -> "NSTA Messenger par voice call aa rahi hai"
        }

        val subLine = TextView(this).apply {
            text = buildString {
                append(schoolName)
                if (callerRole.isNotBlank()) {
                    append(" • ")
                    append(callerRole)
                }
                append("\n")
                append(statusText.ifBlank { defaultStatus })
            }
            setTextColor(Color.parseColor("#CBD5E1"))
            textSize = 12f
            setPadding(0, dp(3), 0, dp(10))
        }
        body.addView(subLine)

        val actionRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        fun sendNativeCallBroadcast(actionName: String) {
            try {
                sendBroadcast(Intent(ACTION_NSTA_CALL_NATIVE_ACTION).apply {
                    setPackage(packageName)
                    putExtra(EXTRA_NSTA_CALL_ID, callId)
                    putExtra(EXTRA_NATIVE_ACTION, actionName)
                    putExtra(EXTRA_NATIVE_CALL_URL, deepLinkUrl)
                })
            } catch (_: Exception) {}
        }

        if (isIncoming) {
            val declineBg = GradientDrawable().apply {
                setColor(Color.parseColor("#E11D48"))
                cornerRadius = dp(10).toFloat()
            }
            val declineBtn = TextView(this).apply {
                text = "Decline"
                setTextColor(Color.WHITE)
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = declineBg
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    VoiceAnnouncer.stopSpeaking()
                    NotificationHelper.cancelNstaCallNotification(applicationContext, callId)
                    sendNativeCallBroadcast("decline")
                    removeOverlayView()
                    stopSelf()
                }
            }

            val gap = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(8), 1)
            }

            val acceptBg = GradientDrawable().apply {
                setColor(Color.parseColor("#059669"))
                cornerRadius = dp(10).toFloat()
            }
            val acceptBtn = TextView(this).apply {
                text = if (isVideo) "Accept Video" else "Accept Call"
                setTextColor(Color.WHITE)
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = acceptBg
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.3f)
                setOnClickListener {
                    VoiceAnnouncer.stopSpeaking()
                    NotificationHelper.cancelNstaCallNotification(applicationContext, callId)
                    val acceptUrl = try {
                        Uri.parse(deepLinkUrl).buildUpon().appendQueryParameter("callAction", "accept").build().toString()
                    } catch (_: Exception) {
                        deepLinkUrl
                    }
                    try {
                        startActivity(Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            putExtra(NotificationHelper.EXTRA_TARGET_URL, acceptUrl)
                        })
                    } catch (_: Exception) {}
                    sendNativeCallBroadcast("accept")
                    removeOverlayView()
                    stopSelf()
                }
            }

            actionRow.addView(declineBtn)
            actionRow.addView(gap)
            actionRow.addView(acceptBtn)
            body.addView(actionRow)
        } else if (isOutgoing || isConnected) {
            val openBg = GradientDrawable().apply {
                setColor(Color.parseColor("#0284C7"))
                cornerRadius = dp(10).toFloat()
            }
            val openBtn = TextView(this).apply {
                text = "Open Call"
                setTextColor(Color.WHITE)
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = openBg
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f)
                setOnClickListener {
                    try {
                        startActivity(Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            putExtra(NotificationHelper.EXTRA_TARGET_URL, deepLinkUrl)
                        })
                    } catch (_: Exception) {}
                    removeOverlayView()
                    stopSelf()
                }
            }

            val gap = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(8), 1)
            }

            val endBg = GradientDrawable().apply {
                setColor(Color.parseColor("#E11D48"))
                cornerRadius = dp(10).toFloat()
            }
            val endBtn = TextView(this).apply {
                text = "End Call"
                setTextColor(Color.WHITE)
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = endBg
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    VoiceAnnouncer.stopSpeaking()
                    NotificationHelper.cancelNstaCallNotification(applicationContext, callId)
                    sendNativeCallBroadcast("hangup")
                    removeOverlayView()
                    stopSelf()
                }
            }

            actionRow.addView(openBtn)
            actionRow.addView(gap)
            actionRow.addView(endBtn)
            body.addView(actionRow)
        } else {
            val openMsgBg = GradientDrawable().apply {
                setColor(Color.parseColor("#334155"))
                cornerRadius = dp(10).toFloat()
            }
            val openMsgBtn = TextView(this).apply {
                text = "Open NSTA Messenger"
                setTextColor(Color.WHITE)
                textSize = 12f
                setTypeface(null, Typeface.BOLD)
                gravity = Gravity.CENTER
                background = openMsgBg
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    try {
                        startActivity(Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            putExtra(NotificationHelper.EXTRA_TARGET_URL, deepLinkUrl)
                        })
                    } catch (_: Exception) {}
                    removeOverlayView()
                    stopSelf()
                }
            }
            actionRow.addView(openMsgBtn)
            body.addView(actionRow)
        }

        root.addView(body)

        try {
            wm.addView(root, params)
            overlayView = root
            val timeoutMs = when {
                isTerminal -> 5_500L
                isConnected -> 180_000L
                else -> 46_000L
            }
            mainHandler.postDelayed(autoDismissRunnable, timeoutMs)
        } catch (_: Exception) {
            stopSelf()
        }
    }
}
