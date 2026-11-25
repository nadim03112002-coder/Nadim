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
        const val ACTION_SHOW_POST_CALL = "app.lifemaker.school.OVERLAY_SHOW_POST_CALL"
        const val ACTION_HIDE = "app.lifemaker.school.OVERLAY_HIDE"
        const val EXTRA_CALLER_JSON = "extra_caller_json"

        fun showRinging(context: Context, match: CallerDirectoryMatch) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_RINGING
                putExtra(EXTRA_CALLER_JSON, match.toJson(postCall = false).toString())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun showPostCall(context: Context, match: CallerDirectoryMatch) {
            if (!canDrawOverlays(context)) return
            val intent = Intent(context, ParentCallOverlayService::class.java).apply {
                action = ACTION_SHOW_POST_CALL
                putExtra(EXTRA_CALLER_JSON, match.toJson(postCall = true).toString())
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
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
    private val mainHandler = Handler(Looper.getMainLooper())
    private val autoDismissRunnable = Runnable {
        removeOverlayView()
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_HIDE
        if (action == ACTION_HIDE) {
            removeOverlayView()
            stopSelf()
            return START_NOT_STICKY
        }

        if (!canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        val rawJson = intent?.getStringExtra(EXTRA_CALLER_JSON).orEmpty()
        if (rawJson.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val isPostCall = action == ACTION_SHOW_POST_CALL
        mainHandler.post {
            showOrUpdateOverlay(rawJson, isPostCall)
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
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showOrUpdateOverlay(rawJson: String, isPostCall: Boolean) {
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

        val kind = data.optString("kind", "PARENT").ifBlank { "PARENT" }
        val isEnquiry = kind.equals("ENQUIRY", ignoreCase = true)
        val absentToday = data.optBoolean("absentToday", false)
        val phone = data.optString("phone", "").trim()
        val schoolName = data.optString("schoolName", "School").ifBlank { "School" }
        val name = data.optString("name", "Caller").trim()
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
                    isPostCall -> "#4F46E5"
                    absentToday -> "#E11D48"
                    isEnquiry -> "#0284C7"
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
                    isPostCall -> "#1E1B4B"
                    absentToday -> "#4C0519"
                    isEnquiry -> "#082F49"
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
                isPostCall -> "CALL ENDED · UPDATE STATUS"
                isEnquiry -> "ADMISSION ENQUIRY · $schoolName"
                absentToday -> "ABSENT TODAY ALERT · $schoolName"
                else -> "PARENT CALLER ID · $schoolName"
            }
            setTextColor(Color.parseColor(
                when {
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
            text = if (isEnquiry) {
                if (studentSummary.isNotBlank()) "$name · $studentSummary" else name
            } else {
                if (studentSummary.isNotBlank()) "$studentSummary ke $relationLabel" else name
            }
            setTextColor(Color.WHITE)
            textSize = 16f
            setTypeface(null, Typeface.BOLD)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
        }
        body.addView(callerTitle)

        val subLine = TextView(this).apply {
            text = buildString {
                if (!isEnquiry && fatherName.isNotBlank()) {
                    append(fatherName)
                    append(" • ")
                }
                append(phone)
                if (absentToday && !isEnquiry) {
                    append(" • Aaj School me Absent Hain")
                }
            }
            setTextColor(Color.parseColor(if (absentToday && !isEnquiry) "#FDA4AF" else "#94A3B8"))
            textSize = 12f
            setPadding(0, dp(2), 0, dp(10))
        }
        body.addView(subLine)

        // 2x2 Fact Grid
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

        if (isEnquiry) {
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
        }

        body.addView(row1)
        body.addView(row2)

        // Action Row
        val actionRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }

        val openBtnBg = GradientDrawable().apply {
            setColor(Color.parseColor(if (isPostCall) "#4F46E5" else "#059669"))
            cornerRadius = dp(10).toFloat()
        }
        val openBtn = TextView(this).apply {
            text = if (isPostCall) "Promise / Solve Update Karein" else "Open Full Card / Collect"
            setTextColor(Color.WHITE)
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = openBtnBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                val postParam = if (isPostCall) "&postCall=1" else ""
                val url = NotificationHelper.sanitizeAppUrl(
                    "/?incomingParentPhone=${Uri.encode(phone)}&incomingParentCall=1$postParam"
                )
                val launch = Intent(this@ParentCallOverlayService, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra(NotificationHelper.EXTRA_TARGET_URL, url)
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
            val timeoutMs = if (isPostCall) 25_000L else 65_000L
            mainHandler.postDelayed(autoDismissRunnable, timeoutMs)
        } catch (_: Exception) {
            stopSelf()
        }
    }
}
