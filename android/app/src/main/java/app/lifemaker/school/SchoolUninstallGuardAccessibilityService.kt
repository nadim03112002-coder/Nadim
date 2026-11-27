package app.lifemaker.school

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

class SchoolUninstallGuardAccessibilityService : AccessibilityService() {

    private var connectedAtMs: Long = 0L
    private var lastPromptLaunchedAtMs: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())

    // Never touch notification shade, volume panel, lockscreen, or permission dialogs!
    private val ignoredPackages = listOf(
        "com.android.systemui",
        "systemui",
        "permissioncontroller",
        "com.google.android.permissioncontroller"
    )

    private val watchedPackageHints = listOf(
        "settings",
        "packageinstaller",
        "installer",
        "securitycenter",
        "safecenter",
        "vending",
        "launcher",
        "home",
        "miui",
        "coloros",
        "oplus",
        "oppo",
        "vivo",
        "iqoo",
        "oneplus",
        "samsung",
        "transsion",
        "itel",
        "tecno",
        "appmanager"
    )

    private val appTargetTokens = listOf(
        "school+",
        "school+ uninstall",
        "app.lifemaker.school",
        "schooldeviceadminreceiver"
    )

    // Passive screen viewing (e.g. App Info, Permissions, About App) is allowed.
    // These keywords trigger ONLY when explicitly clicked OR inside an active uninstall/deactivation confirmation dialog.
    private val clickedDangerButtonTokens = listOf(
        "uninstall",
        "delete app",
        "remove app",
        "deactivate",
        "remove active admin",
        "force stop",
        "clear storage",
        "clear data",
        "अनइंस्टॉल",
        "निष्क्रिय",
        "फ़ोर्स स्टॉप",
        "फोर्स स्टॉप"
    )

    // Explicit confirmation prompts (not passive App Info page labels)
    private val activeConfirmDialogTokens = listOf(
        "do you want to uninstall",
        "want to uninstall this app",
        "uninstall this app",
        "uninstall school+",
        "delete school+",
        "remove school+",
        "remove active admin",
        "deactivate this device admin",
        "deactivate & uninstall",
        "turn off school+ uninstall guard",
        "stop school+ uninstall guard",
        "use school+ uninstall guard",
        "clear all data",
        "delete app data",
        "force stop?",
        "misbehave",
        "अनइंस्टॉल करें"
    )

    private val permissionDialogSafetyTokens = listOf(
        "while using the app",
        "only this time",
        "don't allow",
        "allow school+ to"
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        connectedAtMs = System.currentTimeMillis()
        lastPromptLaunchedAtMs = 0L
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val now = System.currentTimeMillis()

        // Allow 4.5s grace window right after user enables Accessibility toggle in Settings
        if (now - connectedAtMs < 4500L) return

        // Keep Uninstall Guard active in BOTH modes:
        // - PIN Prompt ON  -> shows Admin PIN verification screen
        // - PIN Prompt OFF -> shows strict School Data Safety Block message (no PIN box, no unlock)
        // Guard pauses ONLY via explicit Accessibility Guard Lock OFF or 2-minute Admin temp unlock.
        if (!AppPrefs.isAccessibilityGuardLocked(applicationContext)) return
        if (now < AppPrefs.getGuardUnlockUntilMs(applicationContext)) return

        val pkg = event.packageName?.toString()?.lowercase(Locale.US) ?: return
        if (pkg == packageName.lowercase(Locale.US)) return
        if (ignoredPackages.any { pkg.contains(it) }) return
        if (watchedPackageHints.none { pkg.contains(it) }) return

        // Cooldown so we don't spam PIN screen in rapid loops
        if (now - lastPromptLaunchedAtMs < 1300L) return

        val isViewClick = event.eventType == AccessibilityEvent.TYPE_VIEW_CLICKED
        val isPackageInstaller = pkg.contains("packageinstaller") ||
            (pkg.contains("installer") && !pkg.contains("permission"))

        val root = try {
            rootInActiveWindow ?: event.source
        } catch (_: Exception) {
            null
        } ?: return

        val screenBuilder = StringBuilder(512)
        event.text?.forEach { cs ->
            if (!cs.isNullOrBlank()) {
                screenBuilder.append(cs.toString().lowercase(Locale.US)).append('\n')
            }
        }
        collectNodeText(root, screenBuilder, depth = 0, countHolder = intArrayOf(0))
        val screenSnapshot = screenBuilder.toString()
        if (screenSnapshot.isBlank()) return

        // Never block Android runtime permission popups
        if (permissionDialogSafetyTokens.any { screenSnapshot.contains(it) }) return

        val hasAppTarget = appTargetTokens.any { screenSnapshot.contains(it) }
        if (!hasAppTarget) return

        var detectedReason: String? = null

        if (isViewClick) {
            val clickedBuilder = StringBuilder(128)
            event.text?.forEach { cs ->
                if (!cs.isNullOrBlank()) {
                    clickedBuilder.append(cs.toString().lowercase(Locale.US)).append(' ')
                }
            }
            val src = try { event.source } catch (_: Exception) { null }
            if (src != null) {
                collectNodeText(src, clickedBuilder, depth = 0, countHolder = intArrayOf(0), maxDepth = 3, maxNodes = 16)
                try {
                    @Suppress("DEPRECATION")
                    src.recycle()
                } catch (_: Exception) {}
            }
            val clickedText = clickedBuilder.toString().trim()
            if (clickedText.isNotEmpty() && clickedDangerButtonTokens.any { clickedText.contains(it) }) {
                detectedReason = when {
                    clickedText.contains("deactivate") || clickedText.contains("admin") -> "Device Admin Removal"
                    clickedText.contains("force stop") || clickedText.contains("clear") -> "App Stop / Clear Data"
                    else -> "App Uninstall Attempt"
                }
            }
        }

        if (detectedReason == null) {
            if (isPackageInstaller && (screenSnapshot.contains("uninstall") || screenSnapshot.contains("अनइंस्टॉल"))) {
                detectedReason = "App Uninstall Confirmation"
            } else if (activeConfirmDialogTokens.any { screenSnapshot.contains(it) }) {
                detectedReason = when {
                    screenSnapshot.contains("admin") || screenSnapshot.contains("deactivate") -> "Device Admin Deactivation"
                    screenSnapshot.contains("accessibility") || screenSnapshot.contains("uninstall guard") -> "Uninstall Guard Disable"
                    screenSnapshot.contains("force stop") || screenSnapshot.contains("clear") -> "App Force Stop / Clear Data"
                    else -> "App Uninstall Confirmation"
                }
            }
        }

        if (detectedReason == null) return

        lastPromptLaunchedAtMs = now
        val reasonToShow = detectedReason

        // Close/dismiss the dangerous dialog first, then open native Admin PIN verification screen
        performGlobalAction(GLOBAL_ACTION_BACK)

        mainHandler.postDelayed({
            try {
                val pinIntent = Intent(this, UninstallPinPromptActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                    putExtra(UninstallPinPromptActivity.EXTRA_REASON, reasonToShow)
                }
                startActivity(pinIntent)
            } catch (_: Exception) {}
        }, 80L)
    }

    private fun collectNodeText(
        node: AccessibilityNodeInfo?,
        out: StringBuilder,
        depth: Int,
        countHolder: IntArray,
        maxDepth: Int = 12,
        maxNodes: Int = 140
    ) {
        if (node == null || depth > maxDepth || countHolder[0] >= maxNodes) return
        countHolder[0]++

        try {
            val txt = node.text?.toString()
            if (!txt.isNullOrBlank()) {
                out.append(txt.lowercase(Locale.US)).append('\n')
            }
            val desc = node.contentDescription?.toString()
            if (!desc.isNullOrBlank()) {
                out.append(desc.lowercase(Locale.US)).append('\n')
            }

            val childCount = node.childCount
            for (i in 0 until childCount) {
                if (countHolder[0] >= maxNodes) break
                val child = try {
                    node.getChild(i)
                } catch (_: Exception) {
                    null
                }
                if (child != null) {
                    collectNodeText(child, out, depth + 1, countHolder, maxDepth, maxNodes)
                    try {
                        @Suppress("DEPRECATION")
                        child.recycle()
                    } catch (_: Exception) {}
                }
            }
        } catch (_: Exception) {}
    }

    override fun onInterrupt() {
        // No-op
    }
}
