package app.lifemaker.school

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast
import java.util.Locale

class SchoolUninstallGuardAccessibilityService : AccessibilityService() {

    private var connectedAtMs: Long = 0L
    private var lastBlockedAtMs: Long = 0L
    private var consecutiveBlocks: Int = 0
    private val mainHandler = Handler(Looper.getMainLooper())

    private val watchedPackageHints = listOf(
        "settings",
        "packageinstaller",
        "installer",
        "securitycenter",
        "safecenter",
        "permission",
        "vending",
        "lool",
        "launcher",
        "home",
        "systemui",
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

    private val dangerActionTokens = listOf(
        "uninstall",
        "deactivate",
        "remove active admin",
        "device admin",
        "device administrator",
        "force stop",
        "clear storage",
        "clear data",
        "use school+",
        "uninstall guard",
        "delete app",
        "remove app",
        "अनइंस्टॉल",
        "हटाएं",
        "बंद करें",
        "निष्क्रिय",
        "फ़ोर्स स्टॉप",
        "फोर्स स्टॉप"
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        connectedAtMs = System.currentTimeMillis()
        lastBlockedAtMs = 0L
        consecutiveBlocks = 0
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val now = System.currentTimeMillis()

        // Allow 4.5s grace window right after user enables Accessibility toggle in Settings
        if (now - connectedAtMs < 4500L) return

        // Respect Admin PIN-verified lock off or temporary 2-minute unlock window
        if (!AppPrefs.isAccessibilityGuardLocked(applicationContext)) return
        if (now < AppPrefs.getGuardUnlockUntilMs(applicationContext)) return

        val pkg = event.packageName?.toString()?.lowercase(Locale.US) ?: return
        if (pkg == packageName.lowercase(Locale.US)) return
        if (watchedPackageHints.none { pkg.contains(it) }) return

        // Throttle bursts
        if (now - lastBlockedAtMs < 450L) return

        val root = try {
            rootInActiveWindow ?: event.source
        } catch (_: Exception) {
            null
        } ?: return

        val collectedText = StringBuilder(512)
        // Also seed with event text if present (e.g., dialog titles)
        event.text?.forEach { cs ->
            if (!cs.isNullOrBlank()) {
                collectedText.append(cs.toString().lowercase(Locale.US)).append('\n')
            }
        }
        collectNodeText(root, collectedText, depth = 0, countHolder = intArrayOf(0))

        val snapshot = collectedText.toString()
        if (snapshot.isBlank()) return

        val hasAppTarget = appTargetTokens.any { snapshot.contains(it) }
        if (!hasAppTarget) return

        val isPackageInstaller = pkg.contains("installer")
        val hasDangerKeyword = isPackageInstaller || dangerActionTokens.any { snapshot.contains(it) }
        if (!hasDangerKeyword) return

        val sinceLast = now - lastBlockedAtMs
        lastBlockedAtMs = now
        consecutiveBlocks = if (sinceLast < 3500L) consecutiveBlocks + 1 else 1

        // Immediately bounce out of Uninstall / Device Admin / Accessibility disable screen
        performGlobalAction(GLOBAL_ACTION_BACK)

        if (consecutiveBlocks >= 2) {
            mainHandler.postDelayed({
                try {
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    val bringFront = Intent(this, MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    startActivity(bringFront)
                } catch (_: Exception) {}
            }, 90L)
        }

        mainHandler.post {
            Toast.makeText(
                applicationContext,
                "🔒 SCHOOL+ Uninstall Lock Active! Hatane ke liye app me Admin PIN daalein.",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun collectNodeText(
        node: AccessibilityNodeInfo?,
        out: StringBuilder,
        depth: Int,
        countHolder: IntArray
    ) {
        if (node == null || depth > 12 || countHolder[0] >= 140) return
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
                if (countHolder[0] >= 140) break
                val child = try {
                    node.getChild(i)
                } catch (_: Exception) {
                    null
                }
                if (child != null) {
                    collectNodeText(child, out, depth + 1, countHolder)
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
