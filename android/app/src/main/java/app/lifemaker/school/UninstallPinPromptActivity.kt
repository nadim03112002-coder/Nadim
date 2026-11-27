package app.lifemaker.school

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.text.method.PasswordTransformationMethod
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class UninstallPinPromptActivity : Activity() {

    companion object {
        const val EXTRA_REASON = "extra_guard_reason"
    }

    private fun dp(value: Int): Int = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value.toFloat(),
        resources.displayMetrics
    ).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val isPinModeEnabled = AppPrefs.isUninstallPinRequired(applicationContext)
        val hasPinConfigured = AppPrefs.hasAdminPinHash(applicationContext)

        window.setSoftInputMode(
            if (isPinModeEnabled && hasPinConfigured) {
                WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
            } else {
                WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
            }
        )

        val reason = intent?.getStringExtra(EXTRA_REASON)?.takeIf { it.isNotBlank() }
            ?: "App Uninstall / Security Change"

        val rootScroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#0B1120"))
            isFillViewport = true
        }

        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(20), dp(32), dp(20), dp(32))
        }

        val cardBg = GradientDrawable().apply {
            setColor(Color.parseColor("#111827"))
            cornerRadius = dp(20).toFloat()
            setStroke(
                dp(1),
                Color.parseColor(if (isPinModeEnabled) "#334155" else "#7F1D1D")
            )
        }

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg
            setPadding(dp(22), dp(24), dp(22), dp(22))
        }

        val badgeBg = GradientDrawable().apply {
            setColor(Color.parseColor(if (isPinModeEnabled) "#1E1B4B" else "#450A0A"))
            cornerRadius = dp(10).toFloat()
            setStroke(dp(1), Color.parseColor(if (isPinModeEnabled) "#4F46E5" else "#EF4444"))
        }

        val badgeText = TextView(this).apply {
            text = if (isPinModeEnabled) {
                "SCHOOL+ UNINSTALL GUARD"
            } else {
                "SCHOOL+ DATA SECURITY GUARD"
            }
            setTextColor(Color.parseColor(if (isPinModeEnabled) "#A5B4FC" else "#FCA5A5"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            typeface = Typeface.DEFAULT_BOLD
            background = badgeBg
            setPadding(dp(10), dp(5), dp(10), dp(5))
            gravity = Gravity.CENTER
        }

        val titleView = TextView(this).apply {
            text = when {
                !isPinModeEnabled -> "App Uninstall Restricted Hai"
                hasPinConfigured -> "School Admin PIN Darj Karein"
                else -> "School Security PIN Sync Nahi Hua"
            }
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(14), 0, dp(8))
        }

        val subtitleView = TextView(this).apply {
            text = when {
                !isPinModeEnabled ->
                    "School ke zaroori data, attendance records aur suraksha (data safety) ki wajah se aap is device se SCHOOL+ app ko uninstall, force-stop ya band nahi kar sakte.\n\nYeh device School Security Policy ke tahat surakshit hai. Kisi bhi badlav ya sahayta ke liye apne School Admin se sampark karein."
                hasPinConfigured ->
                    "$reason ko aage badhane ke liye School Admin Security PIN daalein. Sahi PIN par 2 minute ke liye unlock milega."
                else ->
                    "$reason surakshit hai. Kripya SCHOOL+ App kholkar apna School account refresh karein — School Admin ka PIN sync hote hi yahan PIN daalne ka box dikhega."
            }
            setTextColor(Color.parseColor("#CBD5E1"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
            setLineSpacing(dp(4).toFloat(), 1.0f)
            setPadding(0, 0, 0, dp(16))
        }

        val policyBoxBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), Color.parseColor("#334155"))
        }

        val policyNoticeView = TextView(this).apply {
            text = "Protected Action: $reason • Status: Blocked by School Policy"
            setTextColor(Color.parseColor("#FDE68A"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
            background = policyBoxBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }

        val errorView = TextView(this).apply {
            text = ""
            setTextColor(Color.parseColor("#FCA5A5"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, dp(10))
            visibility = TextView.GONE
        }

        val inputBg = GradientDrawable().apply {
            setColor(Color.parseColor("#0F172A"))
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), Color.parseColor("#475569"))
        }

        val pinInput = EditText(this).apply {
            hint = "Admin PIN daalein"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = inputBg
            setPadding(dp(14), dp(12), dp(14), dp(12))
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            transformationMethod = PasswordTransformationMethod.getInstance()
            filters = arrayOf(InputFilter.LengthFilter(16))
        }

        val unlockBtnBg = GradientDrawable().apply {
            setColor(Color.parseColor("#10B981"))
            cornerRadius = dp(12).toFloat()
        }

        val unlockBtn = Button(this).apply {
            text = if (hasPinConfigured) "Verify PIN & Unlock (2 Min)" else "SCHOOL+ App Kholein"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14.5f)
            typeface = Typeface.DEFAULT_BOLD
            isAllCaps = false
            background = unlockBtnBg
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }

        val cancelBtnBg = GradientDrawable().apply {
            setColor(Color.parseColor(if (isPinModeEnabled) "#1E293B" else "#DC2626"))
            cornerRadius = dp(12).toFloat()
            setStroke(dp(1), Color.parseColor(if (isPinModeEnabled) "#334155" else "#F87171"))
        }

        val cancelBtn = Button(this).apply {
            text = if (isPinModeEnabled) "Cancel & Keep Protected" else "Surakshit Wapas Jayein"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14.5f)
            typeface = Typeface.DEFAULT_BOLD
            isAllCaps = false
            background = cancelBtnBg
            setPadding(dp(16), dp(13), dp(16), dp(13))
        }

        card.addView(badgeText, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
        card.addView(titleView)
        card.addView(subtitleView)
        if (!isPinModeEnabled) {
            card.addView(policyNoticeView, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) })
        } else {
            if (hasPinConfigured) {
                card.addView(pinInput, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dp(10) })
            }
            card.addView(errorView)
            card.addView(unlockBtn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(10) })
        }
        card.addView(cancelBtn, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        outer.addView(card, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))
        rootScroll.addView(outer)
        setContentView(rootScroll)

        if (isPinModeEnabled && hasPinConfigured) {
            pinInput.requestFocus()
        }

        unlockBtn.setOnClickListener {
            if (!isPinModeEnabled) {
                goHomeSafe()
                return@setOnClickListener
            }
            if (!hasPinConfigured) {
                openMainApp()
                return@setOnClickListener
            }
            val entered = pinInput.text?.toString()?.trim().orEmpty()
            if (entered.length < 4) {
                errorView.text = "Kam se kam 4 digit ka Admin PIN daalein."
                errorView.visibility = TextView.VISIBLE
                return@setOnClickListener
            }
            if (AppPrefs.verifyAdminPin(applicationContext, entered)) {
                val untilMs = System.currentTimeMillis() + 120_000L
                AppPrefs.setGuardUnlockUntilMs(applicationContext, untilMs)
                Toast.makeText(
                    applicationContext,
                    "2 minute ke liye Uninstall Lock unlock ho gaya!",
                    Toast.LENGTH_SHORT
                ).show()
                finish()
            } else {
                errorView.text = "Galat Admin PIN! Dobara koshish karein."
                errorView.visibility = TextView.VISIBLE
                pinInput.setText("")
            }
        }

        cancelBtn.setOnClickListener {
            goHomeSafe()
        }
    }

    private fun openMainApp() {
        try {
            startActivity(Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            })
        } catch (_: Exception) {}
        finish()
    }

    private fun goHomeSafe() {
        try {
            startActivity(Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        } catch (_: Exception) {}
        finish()
    }
}
