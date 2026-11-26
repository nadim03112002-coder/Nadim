package app.lifemaker.school

import android.annotation.SuppressLint
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
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
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject

class UpiProofOverlayService : Service() {

    companion object {
        const val ACTION_SHOW_QUEUE = "app.lifemaker.school.UPI_OVERLAY_SHOW_QUEUE"
        const val ACTION_REMOVE_PROOF = "app.lifemaker.school.UPI_OVERLAY_REMOVE"
        const val EXTRA_PROOF_ID = "extra_upi_proof_id"

        fun enqueueAndShow(context: Context, proof: JSONObject) {
            AppPrefs.upsertPendingUpiProof(context, proof)
            if (!ParentCallOverlayService.canDrawOverlays(context)) return
            val intent = Intent(context, UpiProofOverlayService::class.java).apply {
                action = ACTION_SHOW_QUEUE
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun syncFromWeb(context: Context, jsonStr: String) {
            AppPrefs.savePendingUpiProofsJson(context, jsonStr)
            val list = AppPrefs.getPendingUpiProofsList(context)
            if (list.isEmpty()) {
                try {
                    context.stopService(Intent(context, UpiProofOverlayService::class.java))
                } catch (_: Exception) {}
                return
            }
            if (!ParentCallOverlayService.canDrawOverlays(context)) return
            val intent = Intent(context, UpiProofOverlayService::class.java).apply {
                action = ACTION_SHOW_QUEUE
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {}
        }

        fun removeProof(context: Context, proofId: String) {
            val cleanId = proofId.trim()
            if (cleanId.isNotEmpty()) {
                NotificationHelper.cancelUpiProofNotification(context, cleanId)
            }
            val remaining = AppPrefs.removePendingUpiProof(context, cleanId)
            if (remaining <= 0) {
                try {
                    context.stopService(Intent(context, UpiProofOverlayService::class.java))
                } catch (_: Exception) {}
            } else if (ParentCallOverlayService.canDrawOverlays(context)) {
                val intent = Intent(context, UpiProofOverlayService::class.java).apply {
                    action = ACTION_SHOW_QUEUE
                }
                try {
                    context.startService(intent)
                } catch (_: Exception) {}
            }
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var isMinimized: Boolean = false
    private var activeIndex: Int = 0
    private var lastX: Int = 0
    private var lastY: Int = -1

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_SHOW_QUEUE
        if (action == ACTION_REMOVE_PROOF) {
            val proofId = intent?.getStringExtra(EXTRA_PROOF_ID).orEmpty()
            removeProof(applicationContext, proofId)
            return START_NOT_STICKY
        }

        if (!ParentCallOverlayService.canDrawOverlays(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        mainHandler.post {
            renderFromStorage()
        }
        return START_STICKY
    }

    override fun onDestroy() {
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
    private fun renderFromStorage() {
        val proofs = AppPrefs.getPendingUpiProofsList(applicationContext)
        if (proofs.isEmpty()) {
            removeOverlayView()
            stopSelf()
            return
        }
        if (activeIndex >= proofs.size || activeIndex < 0) {
            activeIndex = 0
        }

        removeOverlayView()

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

        if (isMinimized) {
            renderMinimizedPill(wm, overlayType, proofs)
        } else {
            renderExpandedCard(wm, overlayType, proofs)
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun renderMinimizedPill(
        wm: WindowManager,
        overlayType: Int,
        proofs: List<JSONObject>
    ) {
        val current = proofs[activeIndex]
        val amt = current.optString("amount", "0").toLongOrNull() ?: 0L
        val formattedAmt = AppPrefs.formatIndianRupees(amt)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = dp(12)
            y = if (lastY >= 0) lastY else dp(84)
        }
        layoutParams = params

        val pillBg = GradientDrawable().apply {
            setColor(Color.parseColor("#F59E0B"))
            cornerRadius = dp(24).toFloat()
            setStroke(dp(2), Color.parseColor("#0F172A"))
        }

        val pill = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = pillBg
            elevation = dp(12).toFloat()
            setPadding(dp(12), dp(8), dp(12), dp(8))
        }

        val label = TextView(this).apply {
            text = "🔔 ${proofs.size} UPI ₹$formattedAmt · Verify"
            setTextColor(Color.parseColor("#0F172A"))
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            isSingleLine = true
        }
        pill.addView(label)

        var initX = 0
        var initY = 0
        var touchX = 0f
        var touchY = 0f
        var moved = false
        pill.setOnTouchListener { _, event ->
            val lp = layoutParams ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initX = lp.x
                    initY = lp.y
                    touchX = event.rawX
                    touchY = event.rawY
                    moved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - touchX).toInt()
                    val dy = (event.rawY - touchY).toInt()
                    if (kotlin.math.abs(dx) > dp(4) || kotlin.math.abs(dy) > dp(4)) {
                        moved = true
                    }
                    lp.x = initX - dx
                    lp.y = initY + dy
                    lastY = lp.y
                    try {
                        wm.updateViewLayout(pill, lp)
                    } catch (_: Exception) {}
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) {
                        isMinimized = false
                        renderFromStorage()
                    }
                    true
                }
                else -> false
            }
        }

        try {
            wm.addView(pill, params)
            overlayView = pill
        } catch (_: Exception) {
            stopSelf()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun renderExpandedCard(
        wm: WindowManager,
        overlayType: Int,
        proofs: List<JSONObject>
    ) {
        val current = proofs[activeIndex]
        val proofId = current.optString("proofId", "").trim()
        val studentName = current.optString("studentName", "Student").ifBlank { "Student" }
        val monthLabel = current.optString("monthLabel", "").trim()
        val familySummary = current.optString("familySummary", "").trim()
        val amtLong = current.optString("amount", "0").toLongOrNull() ?: 0L
        val formattedAmt = AppPrefs.formatIndianRupees(amtLong)
        val utr = current.optString("utrNumber", "").trim()
        val paidTime = current.optString("paidTime", "").trim()

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
            x = lastX
            y = if (lastY >= 0) lastY else dp(44)
        }
        layoutParams = params

        val cardBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(18).toFloat()
            setStroke(dp(2), Color.parseColor("#F59E0B"))
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg
            elevation = dp(14).toFloat()
        }

        val headerBg = GradientDrawable().apply {
            setColor(Color.parseColor("#F59E0B"))
            cornerRadii = floatArrayOf(
                dp(16).toFloat(), dp(16).toFloat(),
                dp(16).toFloat(), dp(16).toFloat(),
                0f, 0f, 0f, 0f
            )
        }

        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = headerBg
            setPadding(dp(12), dp(10), dp(10), dp(10))
        }

        val titleCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        titleCol.addView(TextView(this).apply {
            text = "BharatPe / UPI Check (${activeIndex + 1}/${proofs.size})"
            setTextColor(Color.parseColor("#0F172A"))
            textSize = 13f
            setTypeface(null, Typeface.BOLD)
            isSingleLine = true
        })
        titleCol.addView(TextView(this).apply {
            text = "Bina Confirm kiye nahi hatega · Minimize karein"
            setTextColor(Color.parseColor("#451A03"))
            textSize = 10f
            setTypeface(null, Typeface.BOLD)
            isSingleLine = true
            ellipsize = TextUtils.TruncateAt.END
        })
        headerRow.addView(titleCol)

        if (proofs.size > 1) {
            val prevBtn = TextView(this).apply {
                text = "◀"
                setTextColor(Color.parseColor("#0F172A"))
                textSize = 13f
                setTypeface(null, Typeface.BOLD)
                setPadding(dp(8), dp(4), dp(8), dp(4))
                setOnClickListener {
                    activeIndex = (activeIndex - 1 + proofs.size) % proofs.size
                    renderFromStorage()
                }
            }
            val nextBtn = TextView(this).apply {
                text = "▶"
                setTextColor(Color.parseColor("#0F172A"))
                textSize = 13f
                setTypeface(null, Typeface.BOLD)
                setPadding(dp(8), dp(4), dp(8), dp(4))
                setOnClickListener {
                    activeIndex = (activeIndex + 1) % proofs.size
                    renderFromStorage()
                }
            }
            headerRow.addView(prevBtn)
            headerRow.addView(nextBtn)
        }

        val minBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(8).toFloat()
        }
        val minBtn = TextView(this).apply {
            text = "— Minimize"
            setTextColor(Color.WHITE)
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            background = minBg
            setPadding(dp(10), dp(6), dp(10), dp(6))
            setOnClickListener {
                isMinimized = true
                renderFromStorage()
            }
        }
        headerRow.addView(minBtn)

        // Drag handler on header (no close button — strictly non-dismissible until resolved)
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
                    lastX = lp.x
                    lastY = lp.y
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

        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val leftInfo = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        leftInfo.addView(TextView(this).apply {
            text = studentName
            setTextColor(Color.WHITE)
            textSize = 16f
            setTypeface(null, Typeface.BOLD)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        })
        leftInfo.addView(TextView(this).apply {
            text = buildString {
                if (monthLabel.isNotBlank()) append(monthLabel)
                if (familySummary.isNotBlank()) {
                    if (isNotEmpty()) append(" · ")
                    append(familySummary)
                }
            }.ifBlank { "Monthly School Fee" }
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 12f
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        })

        val rightAmt = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.END
        }
        rightAmt.addView(TextView(this).apply {
            text = "₹$formattedAmt"
            setTextColor(Color.parseColor("#34D399"))
            textSize = 19f
            setTypeface(null, Typeface.BOLD)
        })
        if (paidTime.isNotBlank()) {
            rightAmt.addView(TextView(this).apply {
                text = "🕒 $paidTime"
                setTextColor(Color.parseColor("#A5B4FC"))
                textSize = 11f
                setTypeface(null, Typeface.BOLD)
            })
        }

        topRow.addView(leftInfo)
        topRow.addView(rightAmt)
        body.addView(topRow)

        // UTR Box with Copy UTR (only when UTR was provided)
        if (utr.isNotBlank()) {
            val utrBoxBg = GradientDrawable().apply {
                setColor(Color.parseColor("#1E293B"))
                cornerRadius = dp(10).toFloat()
                setStroke(dp(1), Color.parseColor("#334155"))
            }
            val utrBox = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                background = utrBoxBg
                setPadding(dp(10), dp(8), dp(8), dp(8))
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = dp(10)
                layoutParams = lp
            }

            val utrCol = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            utrCol.addView(TextView(this).apply {
                text = "UTR / TRANSACTION REF NO."
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 9.5f
                setTypeface(null, Typeface.BOLD)
            })
            utrCol.addView(TextView(this).apply {
                text = utr
                setTextColor(Color.WHITE)
                textSize = 14f
                typeface = Typeface.MONOSPACE
                setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
            })

            val copyBtnBg = GradientDrawable().apply {
                setColor(Color.parseColor("#4F46E5"))
                cornerRadius = dp(8).toFloat()
            }
            val copyBtn = TextView(this).apply {
                text = "📋 Copy UTR"
                setTextColor(Color.WHITE)
                textSize = 11.5f
                setTypeface(null, Typeface.BOLD)
                background = copyBtnBg
                setPadding(dp(10), dp(7), dp(10), dp(7))
                setOnClickListener {
                    try {
                        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                        cm?.setPrimaryClip(ClipData.newPlainText("UPI UTR", utr))
                        Toast.makeText(
                            this@UpiProofOverlayService,
                            "UTR Copied ($utr)! BharatPe me paste karein.",
                            Toast.LENGTH_SHORT
                        ).show()
                    } catch (_: Exception) {}
                }
            }
            utrBox.addView(utrCol)
            utrBox.addView(copyBtn)
            body.addView(utrBox)
        }

        // Action Row: Open BharatPe + Open SCHOOL+ & Confirm
        val actionRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(10), 0, 0)
        }

        val bharatPeBg = GradientDrawable().apply {
            setColor(Color.parseColor("#1E40AF"))
            cornerRadius = dp(10).toFloat()
        }
        val bharatPeBtn = TextView(this).apply {
            text = "BharatPe"
            setTextColor(Color.WHITE)
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = bharatPeBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
            setOnClickListener {
                val launchIntent =
                    packageManager.getLaunchIntentForPackage("com.bharatpe.merchant")
                        ?: packageManager.getLaunchIntentForPackage("com.bharatpe.app")
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    try {
                        startActivity(launchIntent)
                        isMinimized = true
                        renderFromStorage()
                    } catch (_: Exception) {
                        Toast.makeText(
                            this@UpiProofOverlayService,
                            "BharatPe app kholne me samasya aayi",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                } else {
                    Toast.makeText(
                        this@UpiProofOverlayService,
                        "BharatPe Merchant app is phone par install nahi hai",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }

        val gap = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(8), 1)
        }

        val openAppBg = GradientDrawable().apply {
            setColor(Color.parseColor("#059669"))
            cornerRadius = dp(10).toFloat()
        }
        val openAppBtn = TextView(this).apply {
            text = "✅ Open SCHOOL+ & Confirm"
            setTextColor(Color.WHITE)
            textSize = 12f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
            background = openAppBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                val targetUrl = NotificationHelper.sanitizeAppUrl(
                    "/?schoolPortal=1&openUpiProof=${Uri.encode(proofId)}"
                )
                val launch = Intent(this@UpiProofOverlayService, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    putExtra(NotificationHelper.EXTRA_TARGET_URL, targetUrl)
                }
                try {
                    startActivity(launch)
                    isMinimized = true
                    renderFromStorage()
                } catch (_: Exception) {}
            }
        }

        actionRow.addView(bharatPeBtn)
        actionRow.addView(gap)
        actionRow.addView(openAppBtn)
        body.addView(actionRow)

        root.addView(body)

        try {
            wm.addView(root, params)
            overlayView = root
        } catch (_: Exception) {
            stopSelf()
        }
    }
}
