package app.lifemaker.school

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.app.admin.DevicePolicyManager
import android.app.role.RoleManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.CallLog
import android.provider.MediaStore
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.view.animation.LinearInterpolator
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var splashOverlay: LinearLayout
    private lateinit var offlineOverlay: LinearLayout
    private lateinit var networkBanner: TextView
    private var splashLetterViews: List<TextView> = emptyList()
    private lateinit var webAppBridge: WebAppBridge

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraPhotoUri: Uri? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var lastBackPressedAt: Long = 0L
    private var splashStartedAt: Long = 0L
    private var isHidingSplash: Boolean = false
    private var hasMainFrameError: Boolean = false
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var wasOfflineBannerShown: Boolean = false
    private var activeOfflineCallTrackingId: String? = null
    private var activeOfflineCallPhone: String? = null
    private var activeOfflineCallStartedAt: Long = 0L
    private var pendingCallPermissionPhone: String? = null
    private var pendingCallPermissionTrackingId: String? = null
    private var pendingDeviceAdminSyncOnResume: Boolean = false
    private var pendingCallerIdStatusSyncOnResume: Boolean = false

    private val trustedInternalHosts = setOf(
        "lmps27.vercel.app",
        "accounts.google.com",
        "nst2512-6a2e4.firebaseapp.com",
        "apis.google.com",
        "checkout.razorpay.com",
        "api.razorpay.com"
    )

    private var lastBatteryLevel: Int = -1
    private var lastBatteryCharging: Boolean = false
    private var isBatteryReceiverRegistered: Boolean = false

    private val fcmTokenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra(LifeMakerMessagingService.EXTRA_FCM_TOKEN) ?: return
            pushFcmTokenToWebView(token)
        }
    }

    private val batteryChangedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != Intent.ACTION_BATTERY_CHANGED) return
            handleBatteryIntent(intent, forcePush = false)
        }
    }

    private val incomingParentCallReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ParentCallerAlertHelper.ACTION_INCOMING_PARENT_CALL) return
            val payload = intent.getStringExtra(ParentCallerAlertHelper.EXTRA_PARENT_PAYLOAD).orEmpty()
            if (payload.isNotBlank()) {
                pushIncomingParentCallToWebView(payload)
            }
        }
    }

    private val missedSchoolCallReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ParentCallerAlertHelper.ACTION_MISSED_SCHOOL_CALL) return
            val payload = intent.getStringExtra(ParentCallerAlertHelper.EXTRA_MISSED_CALL_PAYLOAD).orEmpty()
            pushMissedSchoolCallToWebView(payload, openModal = false)
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileUploadCallback
        fileUploadCallback = null
        if (callback == null) return@registerForActivityResult

        var uris: Array<Uri>? = null
        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val clipData = data?.clipData
            if (clipData != null && clipData.itemCount > 0) {
                uris = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
            } else if (data?.data != null) {
                uris = arrayOf(data.data!!)
            } else if (pendingCameraPhotoUri != null) {
                uris = arrayOf(pendingCameraPhotoUri!!)
            }
        }
        pendingCameraPhotoUri = null
        callback.onReceiveValue(uris)
    }

    private val runtimePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val webReq = pendingWebPermissionRequest
        pendingWebPermissionRequest = null
        if (webReq != null) {
            val grantedResources = mutableListOf<String>()
            for (res in webReq.resources) {
                when (res) {
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                        if (results[Manifest.permission.CAMERA] == true ||
                            hasPermission(Manifest.permission.CAMERA)
                        ) {
                            grantedResources.add(res)
                        }
                    }
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                        if (results[Manifest.permission.RECORD_AUDIO] == true ||
                            hasPermission(Manifest.permission.RECORD_AUDIO)
                        ) {
                            grantedResources.add(res)
                        }
                    }
                }
            }
            if (grantedResources.isNotEmpty()) {
                webReq.grant(grantedResources.toTypedArray())
            } else {
                webReq.deny()
            }
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted && AppPrefs.isVoiceGuardEnabled(applicationContext)) {
            VoiceGuardService.startOrUpdate(applicationContext)
        }
    }

    private val callPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val phone = pendingCallPermissionPhone
        val trackingId = pendingCallPermissionTrackingId
        pendingCallPermissionPhone = null
        pendingCallPermissionTrackingId = null
        if (!phone.isNullOrBlank() && !trackingId.isNullOrBlank()) {
            dispatchOfflinePhoneIntent(phone, trackingId, useDirectCall = granted)
        }
    }

    private val callLogPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results[Manifest.permission.READ_CALL_LOG] == true || hasAutoCallLogPermission()
        if (::webView.isInitialized && webAppBridge.isTrustedHostActive) {
            webView.post {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('android-call-log-permission', { detail: { granted: $granted } }));",
                    null
                )
            }
        }
        pushCallerIdStatusToWebView()
    }

    private val callScreeningRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (!hasCallerIdPhonePerms()) {
            try {
                callLogPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.READ_PHONE_STATE,
                        Manifest.permission.READ_CALL_LOG
                    )
                )
                return@registerForActivityResult
            } catch (_: Exception) {}
        }
        pushCallerIdStatusToWebView()
    }

    private val deviceAdminLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (isDeviceAdminActive()) {
            AppPrefs.setDeviceAdminEnabledAt(applicationContext, System.currentTimeMillis())
        }
        pushDeviceAdminStatusToWebView()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        NotificationHelper.ensureChannels(applicationContext)

        val rootContainer = findViewById<View>(R.id.rootContainer)
        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { v, insets ->
            val sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(sysBars.left, sysBars.top, sysBars.right, sysBars.bottom)
            insets
        }

        swipeRefresh = findViewById(R.id.swipeRefreshLayout)
        webView = findViewById(R.id.webView)
        splashOverlay = findViewById(R.id.splashOverlay)
        offlineOverlay = findViewById(R.id.offlineOverlay)
        networkBanner = findViewById(R.id.networkBanner)
        splashLetterViews = listOf(
            findViewById(R.id.splashLetterS),
            findViewById(R.id.splashLetterC),
            findViewById(R.id.splashLetterH),
            findViewById(R.id.splashLetterO1),
            findViewById(R.id.splashLetterO2),
            findViewById(R.id.splashLetterL),
            findViewById(R.id.splashLetterPlus)
        )
        val retryButton = findViewById<Button>(R.id.retryButton)

        startSplashAnimations()

        webAppBridge = WebAppBridge(this)

        configureWebView()

        swipeRefresh.isEnabled = false

        retryButton.setOnClickListener {
            performNativeHaptic("light")
            hasMainFrameError = false
            offlineOverlay.visibility = View.GONE
            splashOverlay.alpha = 1f
            splashOverlay.scaleX = 1f
            splashOverlay.scaleY = 1f
            splashOverlay.visibility = View.VISIBLE
            startSplashAnimations()
            webView.reload()
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    val now = System.currentTimeMillis()
                    if (now - lastBackPressedAt < 2000L) {
                        finish()
                    } else {
                        lastBackPressedAt = now
                        Toast.makeText(
                            this@MainActivity,
                            "बाहर निकलने के लिए फिर से Back दबाएं",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }
        })

        val initialUrl = resolveLaunchUrl(intent)
        webView.loadUrl(initialUrl)

        requestNotificationPermissionIfNeeded()
        fetchAndRegisterFcmTokenIfConfigured()

        if (AppPrefs.isVoiceGuardEnabled(applicationContext) && AppPrefs.getInboxKeys(applicationContext).isNotEmpty()) {
            VoiceGuardService.startOrUpdate(applicationContext)
        }
    }

    private fun startSplashAnimations() {
        splashStartedAt = System.currentTimeMillis()
        isHidingSplash = false
        splashLetterViews.forEachIndexed { index, letterView ->
            letterView.animate().cancel()
            letterView.alpha = 0f
            letterView.translationY = 40f
            letterView.scaleX = if (index == splashLetterViews.lastIndex) 0.35f else 0.8f
            letterView.scaleY = if (index == splashLetterViews.lastIndex) 0.35f else 0.8f
            letterView.animate()
                .alpha(1f)
                .translationY(0f)
                .scaleX(1f)
                .scaleY(1f)
                .setStartDelay(index * 65L)
                .setDuration(if (index == splashLetterViews.lastIndex) 420L else 320L)
                .setInterpolator(android.view.animation.OvershootInterpolator(1.35f))
                .start()
        }
    }

    private fun hideSplashSmoothly() {
        if (splashOverlay.visibility != View.VISIBLE || isHidingSplash) return
        isHidingSplash = true
        val elapsed = System.currentTimeMillis() - splashStartedAt
        val waitMs = (950L - elapsed).coerceAtLeast(0L)
        splashOverlay.postDelayed({
            if (isFinishing || isDestroyed || splashOverlay.visibility != View.VISIBLE) return@postDelayed
            splashOverlay.animate()
                .alpha(0f)
                .scaleX(1.03f)
                .scaleY(1.03f)
                .setDuration(260L)
                .withEndAction {
                    splashOverlay.visibility = View.GONE
                    splashOverlay.alpha = 1f
                    splashOverlay.scaleX = 1f
                    splashOverlay.scaleY = 1f
                    isHidingSplash = false
                }
                .start()
        }, waitMs)
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(LifeMakerMessagingService.ACTION_NEW_FCM_TOKEN)
        val parentCallFilter = IntentFilter(ParentCallerAlertHelper.ACTION_INCOMING_PARENT_CALL)
        val missedCallFilter = IntentFilter(ParentCallerAlertHelper.ACTION_MISSED_SCHOOL_CALL)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fcmTokenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            registerReceiver(incomingParentCallReceiver, parentCallFilter, Context.RECEIVER_NOT_EXPORTED)
            registerReceiver(missedSchoolCallReceiver, missedCallFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(fcmTokenReceiver, filter)
            registerReceiver(incomingParentCallReceiver, parentCallFilter)
            registerReceiver(missedSchoolCallReceiver, missedCallFilter)
        }
        registerBatteryReceiver()
        registerNetworkObserver()
    }

    override fun onStop() {
        try {
            unregisterReceiver(fcmTokenReceiver)
        } catch (_: Exception) {}
        try {
            unregisterReceiver(incomingParentCallReceiver)
        } catch (_: Exception) {}
        try {
            unregisterReceiver(missedSchoolCallReceiver)
        } catch (_: Exception) {}
        unregisterBatteryReceiver()
        unregisterNetworkObserver()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        if (pendingDeviceAdminSyncOnResume) {
            pendingDeviceAdminSyncOnResume = false
            pushDeviceAdminStatusToWebView()
        }
        if (pendingCallerIdStatusSyncOnResume) {
            pendingCallerIdStatusSyncOnResume = false
            pushCallerIdStatusToWebView()
        }
        val trackingId = activeOfflineCallTrackingId
        val phone = activeOfflineCallPhone
        val startedAt = activeOfflineCallStartedAt
        if (!trackingId.isNullOrBlank() && startedAt > 0L) {
            activeOfflineCallTrackingId = null
            activeOfflineCallPhone = null
            activeOfflineCallStartedAt = 0L
            val elapsedSec = ((System.currentTimeMillis() - startedAt) / 1000L).toInt().coerceAtLeast(0)
            val endedAtIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
            if (::webView.isInitialized && webAppBridge.isTrustedHostActive) {
                val safeTracking = JSONObject.quote(trackingId)
                val safePhone = JSONObject.quote(phone.orEmpty())
                val safeEndedAt = JSONObject.quote(endedAtIso)
                webView.postDelayed({
                    val logInfo = queryLatestCallLogInfo(phone.orEmpty(), startedAt)
                    val autoVerified = logInfo.optBoolean("found", false)
                    val verifiedDurationSec = if (autoVerified) {
                        logInfo.optInt("durationSec", elapsedSec)
                    } else {
                        elapsedSec
                    }
                    val callPicked = if (autoVerified) {
                        logInfo.optBoolean("callPicked", verifiedDurationSec > 0)
                    } else {
                        elapsedSec >= 12
                    }
                    val callType = JSONObject.quote(logInfo.optString("callType", "UNKNOWN"))
                    webView.evaluateJavascript(
                        """
                        (function() {
                          try {
                            window.dispatchEvent(new CustomEvent('android-offline-call-returned', {
                              detail: {
                                trackingId: $safeTracking,
                                phone: $safePhone,
                                elapsedSeconds: $elapsedSec,
                                durationSec: $verifiedDurationSec,
                                callPicked: $callPicked,
                                autoLogVerified: $autoVerified,
                                callType: $callType,
                                endedAt: $safeEndedAt
                              }
                            }));
                          } catch (e) {}
                        })();
                        """.trimIndent(),
                        null
                    )
                }, 520L)
            }
        }
    }

    private fun registerNetworkObserver() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (wasOfflineBannerShown) {
                        wasOfflineBannerShown = false
                        networkBanner.setBackgroundColor(Color.parseColor("#059669"))
                        networkBanner.text = "इंटरनेट वापस जुड़ गया है!"
                        networkBanner.postDelayed({
                            networkBanner.visibility = View.GONE
                        }, 1800L)
                        if (hasMainFrameError) {
                            hasMainFrameError = false
                            offlineOverlay.visibility = View.GONE
                            webView.reload()
                        }
                    }
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    if (!isNetworkConnected()) {
                        wasOfflineBannerShown = true
                        networkBanner.setBackgroundColor(Color.parseColor("#B91C1C"))
                        networkBanner.text = "इंटरनेट कनेक्शन नहीं है — पुनः जुड़ रहा है..."
                        networkBanner.visibility = View.VISIBLE
                    }
                }
            }
        }
        networkCallback = callback
        try {
            val req = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            cm.registerNetworkCallback(req, callback)
        } catch (_: Exception) {}
    }

    private fun unregisterNetworkObserver() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val cb = networkCallback ?: return
        try {
            cm.unregisterNetworkCallback(cb)
        } catch (_: Exception) {}
        networkCallback = null
    }

    private fun isNetworkConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = resolveLaunchUrl(intent)
        if (url != BuildConfig.APP_BASE_URL) {
            val parsed = try { Uri.parse(url) } catch (_: Exception) { null }
            val callId = parsed?.getQueryParameter("callId")?.trim().orEmpty()
            val callAction = parsed?.getQueryParameter("callAction")?.trim().orEmpty()
            val incomingParentPhone = parsed?.getQueryParameter("incomingParentPhone")?.trim().orEmpty()
            val incomingParentCall = parsed?.getQueryParameter("incomingParentCall")?.trim().orEmpty()
            val isPostCall = parsed?.getQueryParameter("postCall")?.trim() == "1"
            val openWalkie = parsed?.getQueryParameter("openWalkie")?.trim() == "1"
            val isMissedSchoolCall = parsed?.getQueryParameter("missedSchoolCall")?.trim() == "1"
            val basePrefix = BuildConfig.APP_BASE_URL.trimEnd('/')
            val isWebLoaded =
                ::webView.isInitialized &&
                webAppBridge.isTrustedHostActive &&
                webView.progress == 100 &&
                webView.url?.startsWith(basePrefix) == true

            if (openWalkie && isWebLoaded) {
                webView.post {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('android-open-walkie'));",
                        null
                    )
                }
            } else if (isMissedSchoolCall && isWebLoaded) {
                pushMissedSchoolCallToWebView("", openModal = true)
            } else if (incomingParentPhone.isNotEmpty() && incomingParentCall == "1" && isWebLoaded) {
                val matchJson = AppPrefs.findCallerEntry(applicationContext, incomingParentPhone)
                    ?.toJson(postCall = isPostCall)
                    ?.toString()
                    ?: JSONObject().apply {
                        put("phone", incomingParentPhone)
                        put("postCall", isPostCall)
                    }.toString()
                pushIncomingParentCallToWebView(matchJson)
            } else if (callId.isNotEmpty() && isWebLoaded) {
                val payloadJson = JSONObject().apply {
                    put("callId", callId)
                    put("callAction", callAction)
                    put("url", url)
                }.toString()
                webView.post {
                    webView.evaluateJavascript(
                        """
                        (function() {
                          try {
                            window.dispatchEvent(new CustomEvent('android-incoming-call-action', { detail: $payloadJson }));
                          } catch (e) {}
                        })();
                        """.trimIndent(),
                        null
                    )
                }
            } else {
                webView.loadUrl(url)
            }
        }
    }

    private fun resolveLaunchUrl(launchIntent: Intent?): String {
        val extraUrl = launchIntent?.getStringExtra(NotificationHelper.EXTRA_TARGET_URL)
        if (!extraUrl.isNullOrBlank()) {
            return NotificationHelper.sanitizeAppUrl(extraUrl)
        }
        val dataUri = launchIntent?.data?.toString()
        if (!dataUri.isNullOrBlank()) {
            return NotificationHelper.sanitizeAppUrl(dataUri)
        }
        return BuildConfig.APP_BASE_URL
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(webAppBridge, "LifeMakerAndroid")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase(Locale.US) ?: return false
                val host = uri.host?.lowercase(Locale.US) ?: ""

                val path = uri.path ?: ""
                val wantsChrome =
                    path.startsWith("/api/print-document") ||
                    uri.getQueryParameter("openInChrome") == "1"

                if ((scheme == "https" || scheme == "http") && !wantsChrome && trustedInternalHosts.any { host == it || host.endsWith(".$it") }) {
                    webAppBridge.isTrustedHostActive = host == "lmps27.vercel.app"
                    return false
                }

                if (wantsChrome) {
                    openUrlInChromeBrowser(uri.toString())
                    return true
                }

                // External URLs (tel:, mailto:, WhatsApp, external websites) open safely via OS Intent
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Exception) {
                    true
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                val parsedHost = try { Uri.parse(url).host?.lowercase(Locale.US) } catch (_: Exception) { null }
                webAppBridge.isTrustedHostActive = parsedHost == "lmps27.vercel.app"
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                if (!hasMainFrameError) {
                    offlineOverlay.visibility = View.GONE
                    hideSplashSmoothly()
                }
                if (webAppBridge.isTrustedHostActive) {
                    view?.evaluateJavascript(
                        """
                        (function() {
                          if (!window.__lmNativeBridgePatched && window.LifeMakerAndroid) {
                            window.__lmNativeBridgePatched = true;
                            if (typeof window.LifeMakerAndroid.printCurrentPageWithOptions === 'function') {
                              window.print = function() {
                                window.LifeMakerAndroid.printCurrentPageWithOptions(
                                  window.__lmNextPrintOrientation || 'portrait',
                                  window.__lmNextPrintTitle || document.title || ''
                                );
                              };
                            } else if (typeof window.LifeMakerAndroid.printCurrentPage === 'function') {
                              window.print = function() { window.LifeMakerAndroid.printCurrentPage(); };
                            }
                            if (!navigator.share && typeof window.LifeMakerAndroid.shareText === 'function') {
                              navigator.share = function(data) {
                                window.LifeMakerAndroid.shareText((data && data.title) || 'SCHOOL+', (data && data.text) || '', (data && data.url) || window.location.href);
                                return Promise.resolve();
                              };
                            }
                          }
                        })();
                        """.trimIndent(),
                        null
                    )
                    val token = AppPrefs.getFcmToken(applicationContext)
                    if (token.isNotEmpty()) {
                        pushFcmTokenToWebView(token)
                    }
                    syncCurrentBatteryToWebView()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    hasMainFrameError = true
                    swipeRefresh.isRefreshing = false
                    splashLetterViews.forEach { it.animate().cancel() }
                    splashOverlay.visibility = View.GONE
                    offlineOverlay.visibility = View.VISIBLE
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val originHost = request.origin?.host?.lowercase(Locale.US) ?: ""
                if (originHost != "lmps27.vercel.app") {
                    request.deny()
                    return
                }

                val neededPermissions = mutableListOf<String>()
                val alreadyGrantedResources = mutableListOf<String>()

                for (res in request.resources) {
                    when (res) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                            if (hasPermission(Manifest.permission.CAMERA)) {
                                alreadyGrantedResources.add(res)
                            } else {
                                neededPermissions.add(Manifest.permission.CAMERA)
                            }
                        }
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                            if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
                                alreadyGrantedResources.add(res)
                            } else {
                                neededPermissions.add(Manifest.permission.RECORD_AUDIO)
                            }
                        }
                    }
                }

                if (neededPermissions.isEmpty()) {
                    if (alreadyGrantedResources.isNotEmpty()) {
                        request.grant(alreadyGrantedResources.toTypedArray())
                    } else {
                        request.deny()
                    }
                } else {
                    pendingWebPermissionRequest = request
                    runtimePermissionLauncher.launch(neededPermissions.toTypedArray())
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                val host = try { Uri.parse(origin).host?.lowercase(Locale.US) } catch (_: Exception) { null }
                callback?.invoke(origin, host == "lmps27.vercel.app", false)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val acceptTypes = fileChooserParams?.acceptTypes?.joinToString(",").orEmpty()
                val wantsImages = acceptTypes.isBlank() || acceptTypes.contains("image")

                var cameraIntent: Intent? = null
                if (wantsImages && hasPermission(Manifest.permission.CAMERA)) {
                    try {
                        val photoFile = createTempImageFile()
                        val photoUri = FileProvider.getUriForFile(
                            this@MainActivity,
                            "$packageName.fileprovider",
                            photoFile
                        )
                        pendingCameraPhotoUri = photoUri
                        cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                            putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                        }
                    } catch (_: Exception) {
                        pendingCameraPhotoUri = null
                    }
                }

                val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (wantsImages) "image/*" else "*/*"
                    if (fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }
                }

                val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentIntent)
                    putExtra(Intent.EXTRA_TITLE, "फ़ाइल या फोटो चुनें")
                    if (cameraIntent != null) {
                        putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                    }
                }

                return try {
                    fileChooserLauncher.launch(chooser)
                    true
                } catch (_: Exception) {
                    fileUploadCallback = null
                    false
                }
            }
        }

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                val guessName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val safeNameJson = JSONObject.quote(guessName)
                val safeUrlJson = JSONObject.quote(url)
                val safeMimeJson = JSONObject.quote(mimeType ?: "application/octet-stream")
                val script = """
                    (function() {
                      fetch($safeUrlJson).then(function(r) { return r.blob(); }).then(function(b) {
                        var fr = new FileReader();
                        fr.onloadend = function() {
                          if (window.LifeMakerAndroid && fr.result) {
                            window.LifeMakerAndroid.saveBase64Download(fr.result, $safeNameJson, b.type || $safeMimeJson);
                          }
                        };
                        fr.readAsDataURL(b);
                      }).catch(function(){});
                    })();
                """.trimIndent()
                webView.evaluateJavascript(script, null)
                return@setDownloadListener
            }

            try {
                val parsed = Uri.parse(url)
                if (parsed.scheme != "https" && parsed.scheme != "http") return@setDownloadListener
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val req = DownloadManager.Request(parsed).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    val cookies = CookieManager.getInstance().getCookie(url)
                    if (!cookies.isNullOrEmpty()) addRequestHeader("Cookie", cookies)
                    setTitle(fileName)
                    setDescription("SCHOOL+ Download")
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                }
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(req)
                Toast.makeText(this, "Downloading: $fileName", Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(this, "Download unavailable", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun performNativeHaptic(kind: String) {
        try {
            val code = when (kind.lowercase(Locale.US)) {
                "error", "long" -> HapticFeedbackConstants.LONG_PRESS
                "success" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    HapticFeedbackConstants.CONFIRM
                } else {
                    HapticFeedbackConstants.VIRTUAL_KEY
                }
                else -> HapticFeedbackConstants.VIRTUAL_KEY
            }
            webView.performHapticFeedback(code)
        } catch (_: Exception) {}
    }

    fun shareNativeContent(title: String, text: String, url: String) {
        try {
            val body = listOf(text.trim(), url.trim()).filter { it.isNotEmpty() }.joinToString("\n")
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                if (title.isNotBlank()) putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, body.ifEmpty { BuildConfig.APP_BASE_URL })
            }
            startActivity(Intent.createChooser(shareIntent, "Share via"))
        } catch (_: Exception) {}
    }

    fun isIgnoringBatteryOptimizations(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        return try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(packageName) == true
        } catch (_: Exception) {
            false
        }
    }

    @SuppressLint("BatteryLife")
    fun requestBatteryOptimizationExemption() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm?.isIgnoringBatteryOptimizations(packageName) == false) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
                return
            }
        } catch (_: Exception) {}
        try {
            val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(fallback)
        } catch (_: Exception) {}
    }

    fun launchBiometricPrompt(title: String, safeCallbackName: String) {
        val manager = BiometricManager.from(this)
        val canAuth = manager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            deliverBiometricResult(safeCallbackName, false)
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val prompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                performNativeHaptic("success")
                deliverBiometricResult(safeCallbackName, true)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                deliverBiometricResult(safeCallbackName, false)
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                performNativeHaptic("error")
            }
        })

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle("Verify Fingerprint / Face / Screen Lock")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        prompt.authenticate(promptInfo)
    }

    private fun deliverBiometricResult(safeCallbackName: String, success: Boolean) {
        webView.post {
            webView.evaluateJavascript(
                "if (typeof window.$safeCallbackName === 'function') { window.$safeCallbackName($success); }",
                null
            )
        }
    }

    fun openUrlInChromeBrowser(rawUrl: String) {
        val trimmed = rawUrl.trim()
        if (trimmed.isEmpty()) return
        val resolved = if (trimmed.startsWith("/")) {
            "${BuildConfig.APP_BASE_URL.trimEnd('/')}$trimmed"
        } else {
            trimmed
        }
        val uri = try { Uri.parse(resolved) } catch (_: Exception) { return }
        val scheme = uri.scheme?.lowercase(Locale.US) ?: ""
        if (scheme != "https" && scheme != "http") return
        try {
            val chromeIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.android.chrome")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(chromeIntent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
            } catch (_: Exception) {
                Toast.makeText(this, "Chrome / Browser unavailable", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun printWebView(orientation: String? = null, customJobName: String? = null) {
        try {
            val printManager = getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
            val jobName = customJobName?.trim()?.takeIf { it.isNotEmpty() }
                ?: "${getString(R.string.app_name)} Document"
            val adapter = webView.createPrintDocumentAdapter(jobName)
            val isLandscape = orientation?.equals("landscape", ignoreCase = true) == true
            val mediaSize = if (isLandscape) {
                PrintAttributes.MediaSize.ISO_A4.asLandscape()
            } else {
                PrintAttributes.MediaSize.ISO_A4.asPortrait()
            }
            val attrs = PrintAttributes.Builder()
                .setMediaSize(mediaSize)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build()
            printManager.print(jobName, adapter, attrs)
        } catch (_: Exception) {}
    }

    private fun pushFcmTokenToWebView(token: String) {
        if (token.isBlank()) return
        val quoted = JSONObject.quote(token)
        webView.post {
            webView.evaluateJavascript(
                "if (typeof window.__onLifeMakerNativeFcmToken === 'function') { window.__onLifeMakerNativeFcmToken($quoted); }",
                null
            )
        }
    }

    private fun fetchAndRegisterFcmTokenIfConfigured() {
        if (!BuildConfig.HAS_GOOGLE_SERVICES) return
        try {
            if (FirebaseApp.getApps(this).isEmpty()) return
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) {
                    AppPrefs.setFcmToken(applicationContext, token)
                    pushFcmTokenToWebView(token)
                }
            }
        } catch (_: Exception) {}
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    fun hasOfflineCallPermission(): Boolean =
        hasPermission(Manifest.permission.CALL_PHONE)

    fun hasAutoCallLogPermission(): Boolean =
        hasPermission(Manifest.permission.READ_CALL_LOG)

    fun requestAutoCallLogPermission() {
        if (hasAutoCallLogPermission()) {
            if (::webView.isInitialized && webAppBridge.isTrustedHostActive) {
                webView.post {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('android-call-log-permission', { detail: { granted: true } }));",
                        null
                    )
                }
            }
            return
        }
        try {
            callLogPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.READ_CALL_LOG,
                    Manifest.permission.READ_PHONE_STATE
                )
            )
        } catch (_: Exception) {}
    }

    fun queryLatestCallLogInfo(rawPhone: String, sinceMs: Long): JSONObject {
        val result = JSONObject().apply { put("found", false) }
        if (!hasAutoCallLogPermission()) return result
        val targetDigits = rawPhone.filter { it.isDigit() }
        if (targetDigits.length < 5) return result
        val targetLast10 = if (targetDigits.length > 10) targetDigits.takeLast(10) else targetDigits
        val minDateMs = (sinceMs - 15_000L).coerceAtLeast(0L)

        try {
            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.DURATION,
                CallLog.Calls.DATE,
                CallLog.Calls.TYPE
            )
            val selection = "${CallLog.Calls.DATE} >= ?"
            val selectionArgs = arrayOf(minDateMs.toString())
            val sortOrder = "${CallLog.Calls.DATE} DESC"

            contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                val idxNumber = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val idxDuration = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val idxDate = cursor.getColumnIndex(CallLog.Calls.DATE)
                val idxType = cursor.getColumnIndex(CallLog.Calls.TYPE)

                var checked = 0
                while (cursor.moveToNext() && checked < 25) {
                    checked++
                    val numStr = if (idxNumber >= 0) cursor.getString(idxNumber).orEmpty() else ""
                    val numDigits = numStr.filter { it.isDigit() }
                    val numLast10 = if (numDigits.length > 10) numDigits.takeLast(10) else numDigits
                    if (numLast10.isNotEmpty() && (numLast10 == targetLast10 || numDigits.endsWith(targetLast10) || targetLast10.endsWith(numLast10))) {
                        val dur = if (idxDuration >= 0) cursor.getInt(idxDuration).coerceAtLeast(0) else 0
                        val dt = if (idxDate >= 0) cursor.getLong(idxDate) else 0L
                        val cType = if (idxType >= 0) cursor.getInt(idxType) else CallLog.Calls.OUTGOING_TYPE
                        val typeLabel = when (cType) {
                            CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                            CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                            CallLog.Calls.MISSED_TYPE -> "MISSED"
                            CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                            else -> "OTHER"
                        }
                        result.put("found", true)
                        result.put("durationSec", dur)
                        result.put("callPicked", dur > 0)
                        result.put("callDateMs", dt)
                        result.put("callType", typeLabel)
                        return result
                    }
                }
            }
        } catch (_: Exception) {}
        return result
    }

    fun queryMatchedSchoolCallLogs(sinceMs: Long, limitCount: Int = 80): JSONArray {
        val merged = JSONArray()
        val seenKeys = mutableListOf<Pair<String, Long>>()

        fun isDuplicate(phone: String, dateMs: Long): Boolean =
            seenKeys.any { (p, t) -> p == phone && kotlin.math.abs(t - dateMs) < 12_000L }

        if (hasAutoCallLogPermission()) {
            try {
                val projection = arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.DATE,
                    CallLog.Calls.TYPE
                )
                val effectiveSince = if (sinceMs > 0L) sinceMs else (System.currentTimeMillis() - 7L * 24L * 60L * 60L * 1000L)
                contentResolver.query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    "${CallLog.Calls.DATE} >= ?",
                    arrayOf(effectiveSince.toString()),
                    "${CallLog.Calls.DATE} DESC"
                )?.use { cursor ->
                    val idxNum = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                    val idxDur = cursor.getColumnIndex(CallLog.Calls.DURATION)
                    val idxDate = cursor.getColumnIndex(CallLog.Calls.DATE)
                    val idxType = cursor.getColumnIndex(CallLog.Calls.TYPE)

                    var scanned = 0
                    while (cursor.moveToNext() && scanned < 250 && merged.length() < limitCount) {
                        scanned++
                        val rawNum = if (idxNum >= 0) cursor.getString(idxNum).orEmpty() else ""
                        val match = AppPrefs.findCallerEntry(applicationContext, rawNum) ?: continue
                        if (!match.kind.equals("PARENT", true) && !match.kind.equals("ENQUIRY", true)) continue

                        val dur = if (idxDur >= 0) cursor.getInt(idxDur).coerceAtLeast(0) else 0
                        val dt = if (idxDate >= 0) cursor.getLong(idxDate) else 0L
                        if (dt <= 0L || isDuplicate(match.last10, dt)) continue

                        val cType = if (idxType >= 0) cursor.getInt(idxType) else CallLog.Calls.INCOMING_TYPE
                        val typeLabel = when (cType) {
                            CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                            CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                            CallLog.Calls.MISSED_TYPE -> "MISSED"
                            CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                            else -> "INCOMING"
                        }
                        val dir = if (cType == CallLog.Calls.OUTGOING_TYPE) "OUTGOING" else "INCOMING"

                        seenKeys.add(match.last10 to dt)
                        merged.put(JSONObject().apply {
                            put("phone", match.last10)
                            put("direction", dir)
                            put("callType", typeLabel)
                            put("durationSec", dur)
                            put("callDateMs", dt)
                            put("kind", match.kind)
                            put("name", match.name)
                            put("studentSummary", match.studentSummary)
                            put("relationLabel", match.relationLabel)
                            put("fatherName", match.fatherName)
                            put("primaryStudentId", match.primaryStudentId)
                            put("dueAmount", match.dueAmount)
                            put("absentToday", match.absentToday)
                            put("enquiryId", match.enquiryId)
                            put("schoolName", match.schoolName)
                        })
                    }
                }
            } catch (_: Exception) {}
        }

        // Also include locally tracked matched calls (works even when CallLog permission isn't granted)
        try {
            val localArr = AppPrefs.getRecentMatchedSimCalls(applicationContext, sinceMs)
            for (i in 0 until localArr.length()) {
                if (merged.length() >= limitCount) break
                val item = localArr.optJSONObject(i) ?: continue
                val p = item.optString("phone", "")
                val dt = item.optLong("callDateMs", 0L)
                if (p.isNotEmpty() && dt > 0L && !isDuplicate(p, dt)) {
                    seenKeys.add(p to dt)
                    merged.put(item)
                }
            }
        } catch (_: Exception) {}

        return merged
    }

    fun launchOfflinePhoneCall(rawPhone: String, trackingId: String) {
        val cleaned = rawPhone.replace(Regex("[^+0-9]"), "")
        val digitCount = cleaned.count { it.isDigit() }
        if (digitCount < 5) {
            Toast.makeText(this, "Sahi mobile number uplabdh nahi hai", Toast.LENGTH_SHORT).show()
            return
        }
        if (hasPermission(Manifest.permission.CALL_PHONE)) {
            dispatchOfflinePhoneIntent(cleaned, trackingId, useDirectCall = true)
        } else {
            pendingCallPermissionPhone = cleaned
            pendingCallPermissionTrackingId = trackingId
            try {
                callPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
            } catch (_: Exception) {
                pendingCallPermissionPhone = null
                pendingCallPermissionTrackingId = null
                dispatchOfflinePhoneIntent(cleaned, trackingId, useDirectCall = false)
            }
        }
    }

    private fun dispatchOfflinePhoneIntent(cleanPhone: String, trackingId: String, useDirectCall: Boolean) {
        val telUri = Uri.parse("tel:$cleanPhone")
        activeOfflineCallTrackingId = trackingId
        activeOfflineCallPhone = cleanPhone
        activeOfflineCallStartedAt = System.currentTimeMillis()
        try {
            val action = if (useDirectCall && hasPermission(Manifest.permission.CALL_PHONE)) {
                Intent.ACTION_CALL
            } else {
                Intent.ACTION_DIAL
            }
            startActivity(Intent(action, telUri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (_: Exception) {
            try {
                startActivity(Intent(Intent.ACTION_DIAL, telUri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
            } catch (_: Exception) {
                activeOfflineCallTrackingId = null
                activeOfflineCallPhone = null
                activeOfflineCallStartedAt = 0L
                Toast.makeText(this, "Phone dialer available nahi hai", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun getDevicePolicyManager(): DevicePolicyManager? =
        getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager

    private fun getDeviceAdminComponent(): ComponentName =
        ComponentName(this, SchoolDeviceAdminReceiver::class.java)

    fun isDeviceAdminActive(): Boolean {
        return try {
            getDevicePolicyManager()?.isAdminActive(getDeviceAdminComponent()) == true
        } catch (_: Exception) {
            false
        }
    }

    fun isDeviceOwnerApp(): Boolean {
        return try {
            getDevicePolicyManager()?.isDeviceOwnerApp(packageName) == true
        } catch (_: Exception) {
            false
        }
    }

    fun isUninstallBlocked(): Boolean {
        if (!isDeviceOwnerApp()) return false
        return try {
            getDevicePolicyManager()?.isUninstallBlocked(getDeviceAdminComponent(), packageName) == true
        } catch (_: Exception) {
            false
        }
    }

    fun isAccessibilityGuardEnabled(): Boolean {
        val target = ComponentName(this, SchoolUninstallGuardAccessibilityService::class.java)
        try {
            val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
            val enabledList = am?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            if (enabledList?.any {
                    val si = it.resolveInfo?.serviceInfo
                    si != null && si.packageName == packageName && si.name == target.className
                } == true) {
                return true
            }
        } catch (_: Exception) {}
        return try {
            val settingValue = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ).orEmpty()
            settingValue.contains(target.flattenToString(), ignoreCase = true) ||
                settingValue.contains(target.flattenToShortString(), ignoreCase = true)
        } catch (_: Exception) {
            false
        }
    }

    fun getDeviceAdminStatusJson(): JSONObject {
        val adminComponent = getDeviceAdminComponent()
        val now = System.currentTimeMillis()
        val unlockUntilMs = AppPrefs.getGuardUnlockUntilMs(applicationContext)
        val tempUnlockRemainingSec = if (unlockUntilMs > now) ((unlockUntilMs - now) / 1000L).toInt() else 0
        return JSONObject().apply {
            put("supported", true)
            put("isAdminActive", isDeviceAdminActive())
            put("isDeviceOwner", isDeviceOwnerApp())
            put("isUninstallBlocked", isUninstallBlocked())
            put("isAccessibilityGuardEnabled", isAccessibilityGuardEnabled())
            put("isAccessibilityGuardLocked", AppPrefs.isAccessibilityGuardLocked(applicationContext))
            put("hasNativeAdminPin", AppPrefs.hasAdminPinHash(applicationContext))
            put("tempUnlockRemainingSec", tempUnlockRemainingSec)
            put("enabledAt", AppPrefs.getDeviceAdminEnabledAt(applicationContext))
            put("packageName", packageName)
            put("receiverComponent", adminComponent.flattenToString())
            put("shortReceiverComponent", adminComponent.flattenToShortString())
        }
    }

    fun pushDeviceAdminStatusToWebView() {
        if (!::webView.isInitialized || !webAppBridge.isTrustedHostActive) return
        val statusJson = getDeviceAdminStatusJson().toString()
        webView.post {
            webView.evaluateJavascript(
                """
                (function() {
                  try {
                    window.dispatchEvent(new CustomEvent('android-device-admin-changed', { detail: $statusJson }));
                  } catch (e) {}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    fun requestDeviceAdminActivation(): Boolean {
        if (isDeviceAdminActive()) {
            pushDeviceAdminStatusToWebView()
            return true
        }
        return try {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, getDeviceAdminComponent())
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "SCHOOL+ ko Device Admin banayein taaki koi bhi is app ko galti se ya bina anumati Uninstall na kar sake."
                )
            }
            deviceAdminLauncher.launch(intent)
            true
        } catch (_: Exception) {
            openDeviceAdminSettings()
            false
        }
    }

    fun openDeviceAdminSettings() {
        pendingDeviceAdminSyncOnResume = true
        try {
            val intent = Intent().apply {
                component = ComponentName("com.android.settings", "com.android.settings.DeviceAdminSettings")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            return
        } catch (_: Exception) {}
        try {
            startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            return
        } catch (_: Exception) {}
        try {
            startActivity(Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (_: Exception) {
            pendingDeviceAdminSyncOnResume = false
        }
    }

    fun setUninstallBlockedByOwner(blocked: Boolean): Boolean {
        if (!isDeviceOwnerApp()) return false
        return try {
            getDevicePolicyManager()?.setUninstallBlocked(getDeviceAdminComponent(), packageName, blocked)
            pushDeviceAdminStatusToWebView()
            isUninstallBlocked() == blocked
        } catch (_: Exception) {
            false
        }
    }

    fun deactivateDeviceAdmin(): Boolean {
        return try {
            val dpm = getDevicePolicyManager() ?: return false
            val admin = getDeviceAdminComponent()
            if (isDeviceOwnerApp()) {
                try {
                    dpm.setUninstallBlocked(admin, packageName, false)
                } catch (_: Exception) {}
            }
            if (dpm.isAdminActive(admin)) {
                dpm.removeActiveAdmin(admin)
            }
            AppPrefs.setDeviceAdminEnabledAt(applicationContext, 0L)
            pushDeviceAdminStatusToWebView()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun lockDeviceScreenNow(): Boolean {
        if (!isDeviceAdminActive()) return false
        return try {
            getDevicePolicyManager()?.lockNow()
            true
        } catch (_: Exception) {
            false
        }
    }

    fun openAccessibilityGuardSettings() {
        pendingDeviceAdminSyncOnResume = true
        try {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            return
        } catch (_: Exception) {}
        try {
            startActivity(Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (_: Exception) {
            pendingDeviceAdminSyncOnResume = false
        }
    }

    fun setAccessibilityGuardLocked(locked: Boolean): Boolean {
        AppPrefs.setAccessibilityGuardLocked(applicationContext, locked)
        if (locked) {
            AppPrefs.setGuardUnlockUntilMs(applicationContext, 0L)
        }
        pushDeviceAdminStatusToWebView()
        return true
    }

    fun unlockUninstallProtectionTemporarily(seconds: Int): Boolean {
        val safeSec = seconds.coerceIn(0, 1800)
        val untilMs = if (safeSec > 0) System.currentTimeMillis() + safeSec * 1000L else 0L
        AppPrefs.setGuardUnlockUntilMs(applicationContext, untilMs)
        pushDeviceAdminStatusToWebView()
        return true
    }

    fun isCallScreeningRoleHeld(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        return try {
            val rm = getSystemService(RoleManager::class.java)
            rm != null && rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
        } catch (_: Exception) {
            false
        }
    }

    fun hasCallerIdPhonePerms(): Boolean {
        val hasPhone = hasPermission(Manifest.permission.READ_PHONE_STATE)
        val hasLog = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            hasPermission(Manifest.permission.READ_CALL_LOG)
        } else {
            true
        }
        return hasPhone && hasLog
    }

    fun getCallerIdStatusJson(): JSONObject {
        val roleHeld = isCallScreeningRoleHeld()
        val phonePerms = hasCallerIdPhonePerms()
        val hasPhoneState = hasPermission(Manifest.permission.READ_PHONE_STATE)
        val isReady = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            (roleHeld && hasPhoneState) || phonePerms
        } else {
            phonePerms
        }
        return JSONObject().apply {
            put("supported", true)
            put("isRoleHeld", roleHeld)
            put("hasPhonePerms", phonePerms)
            put("hasPhoneStatePerm", hasPhoneState)
            put("hasCallLogPerm", hasAutoCallLogPermission())
            put("isReady", isReady)
            put("cachedCount", AppPrefs.getCallerDirectoryCount(applicationContext))
            put("schoolName", AppPrefs.getCallerDirectorySchoolName(applicationContext))
            put("voiceEnabled", AppPrefs.isCallerVoiceAnnounceEnabled(applicationContext))
            put("batteryUnrestricted", isIgnoringBatteryOptimizations())
            put("parentCallerEnabled", AppPrefs.isParentCallerIdEnabled(applicationContext))
            put("parentDueVoiceEnabled", AppPrefs.isParentDueVoiceEnabled(applicationContext))
            put("parentScheduleVoiceEnabled", AppPrefs.isParentScheduleVoiceEnabled(applicationContext))
            put("parentCardPopupEnabled", AppPrefs.isParentCardPopupEnabled(applicationContext))
            put("parentOverlayEnabled", AppPrefs.isParentOverlayEnabled(applicationContext))
            put("outgoingCallEnabled", AppPrefs.isOutgoingCallIdEnabled(applicationContext))
            put("autoCallLogSyncEnabled", AppPrefs.isAutoCallLogSyncEnabled(applicationContext))
            put("canDrawOverlays", ParentCallOverlayService.canDrawOverlays(applicationContext))
        }
    }

    fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || ParentCallOverlayService.canDrawOverlays(applicationContext)) {
            pushCallerIdStatusToWebView()
            return
        }
        pendingCallerIdStatusSyncOnResume = true
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
            } catch (_: Exception) {
                pendingCallerIdStatusSyncOnResume = false
            }
        }
    }

    fun pushIncomingParentCallToWebView(payloadJson: String) {
        if (!::webView.isInitialized || !webAppBridge.isTrustedHostActive) return
        webView.post {
            webView.evaluateJavascript(
                """
                (function() {
                  try {
                    window.dispatchEvent(new CustomEvent('android-incoming-parent-call', { detail: $payloadJson }));
                  } catch (e) {}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    fun pushMissedSchoolCallToWebView(payloadJson: String, openModal: Boolean = false) {
        if (!::webView.isInitialized || !webAppBridge.isTrustedHostActive) return
        val callObj = payloadJson.takeIf { it.isNotBlank() } ?: "null"
        webView.post {
            webView.evaluateJavascript(
                """
                (function() {
                  try {
                    window.dispatchEvent(new CustomEvent('android-missed-school-call', { detail: { openModal: $openModal, call: $callObj } }));
                  } catch (e) {}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    fun pushCallerIdStatusToWebView() {
        if (!::webView.isInitialized || !webAppBridge.isTrustedHostActive) return
        val statusJson = getCallerIdStatusJson().toString()
        webView.post {
            webView.evaluateJavascript(
                """
                (function() {
                  try {
                    window.dispatchEvent(new CustomEvent('android-caller-id-status', { detail: $statusJson }));
                  } catch (e) {}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    fun requestOfflineCallerIdPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val rm = getSystemService(RoleManager::class.java)
                if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) && !rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                    val intent = rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                    callScreeningRoleLauncher.launch(intent)
                    return
                }
            } catch (_: Exception) {}
        }
        if (!hasCallerIdPhonePerms()) {
            try {
                callLogPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.READ_PHONE_STATE,
                        Manifest.permission.READ_CALL_LOG
                    )
                )
                return
            } catch (_: Exception) {}
        }
        pushCallerIdStatusToWebView()
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun createTempImageFile(): File {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File.createTempFile("LMPS_$stamp", ".jpg", cacheDir)
    }

    private fun registerBatteryReceiver() {
        if (isBatteryReceiverRegistered) return
        try {
            val batteryFilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val stickyIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(batteryChangedReceiver, batteryFilter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(batteryChangedReceiver, batteryFilter)
            }
            isBatteryReceiverRegistered = true
            handleBatteryIntent(stickyIntent, forcePush = true)
        } catch (_: Exception) {}
    }

    private fun unregisterBatteryReceiver() {
        if (!isBatteryReceiverRegistered) return
        try {
            unregisterReceiver(batteryChangedReceiver)
        } catch (_: Exception) {}
        isBatteryReceiverRegistered = false
    }

    private fun syncCurrentBatteryToWebView() {
        try {
            val sticky = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            if (sticky != null) {
                handleBatteryIntent(sticky, forcePush = true)
                return
            }
        } catch (_: Exception) {}
        if (lastBatteryLevel >= 0) {
            pushBatteryStatusToWebView(lastBatteryLevel, lastBatteryCharging)
        }
    }

    private fun handleBatteryIntent(intent: Intent?, forcePush: Boolean) {
        val rawLevel = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val pct = if (rawLevel >= 0 && scale > 0) {
            ((rawLevel * 100f) / scale.toFloat()).toInt().coerceIn(0, 100)
        } else {
            val bm = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.coerceIn(0, 100) ?: -1
        }
        if (pct < 0) return

        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = intent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL ||
            plugged != 0

        if (!forcePush && pct == lastBatteryLevel && isCharging == lastBatteryCharging) {
            return
        }
        lastBatteryLevel = pct
        lastBatteryCharging = isCharging
        pushBatteryStatusToWebView(pct, isCharging)
    }

    private fun pushBatteryStatusToWebView(level: Int, isCharging: Boolean) {
        if (level < 0 || !webAppBridge.isTrustedHostActive) return
        webView.post {
            webView.evaluateJavascript(
                """
                (function() {
                  window.__androidBatteryState = { level: $level, charging: $isCharging, supported: true };
                  if (typeof window.__onAndroidBatteryUpdate === 'function') {
                    window.__onAndroidBatteryUpdate($level, $isCharging);
                  }
                  try {
                    window.dispatchEvent(new CustomEvent('android-battery-update', { detail: { level: $level, charging: $isCharging } }));
                  } catch (e) {}
                })();
                """.trimIndent(),
                null
            )
        }
    }

    override fun onDestroy() {
        splashLetterViews.forEach { it.animate().cancel() }
        unregisterBatteryReceiver()
        unregisterNetworkObserver()
        webView.destroy()
        super.onDestroy()
    }
}
