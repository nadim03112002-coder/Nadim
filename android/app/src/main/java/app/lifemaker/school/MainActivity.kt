package app.lifemaker.school

import android.Manifest
import android.animation.ObjectAnimator
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
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
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.View
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
    private var hasMainFrameError: Boolean = false
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var wasOfflineBannerShown: Boolean = false

    private val trustedInternalHosts = setOf(
        "lmps27.vercel.app",
        "accounts.google.com",
        "nst2512-6a2e4.firebaseapp.com",
        "apis.google.com",
        "checkout.razorpay.com",
        "api.razorpay.com"
    )

    private val fcmTokenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val token = intent?.getStringExtra(LifeMakerMessagingService.EXTRA_FCM_TOKEN) ?: return
            pushFcmTokenToWebView(token)
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

        swipeRefresh.setColorSchemeResources(R.color.brand_accent, R.color.brand_primary)
        swipeRefresh.setOnChildScrollUpCallback { _, _ -> webView.scrollY > 0 }
        swipeRefresh.setOnRefreshListener {
            hasMainFrameError = false
            webView.reload()
        }

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
        if (splashOverlay.visibility != View.VISIBLE) return
        splashLetterViews.forEach { it.animate().cancel() }
        splashOverlay.animate()
            .alpha(0f)
            .scaleX(1.04f)
            .scaleY(1.04f)
            .setDuration(280L)
            .withEndAction {
                splashOverlay.visibility = View.GONE
                splashOverlay.alpha = 1f
                splashOverlay.scaleX = 1f
                splashOverlay.scaleY = 1f
            }
            .start()
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(LifeMakerMessagingService.ACTION_NEW_FCM_TOKEN)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fcmTokenReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(fcmTokenReceiver, filter)
        }
        registerNetworkObserver()
    }

    override fun onStop() {
        try {
            unregisterReceiver(fcmTokenReceiver)
        } catch (_: Exception) {}
        unregisterNetworkObserver()
        super.onStop()
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
            webView.loadUrl(url)
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

                if ((scheme == "https" || scheme == "http") && trustedInternalHosts.any { host == it || host.endsWith(".$it") }) {
                    webAppBridge.isTrustedHostActive = host == "lmps27.vercel.app"
                    return false
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
                            if (typeof window.LifeMakerAndroid.printCurrentPage === 'function') {
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
                    splashRingAnimator?.cancel()
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

    fun printWebView() {
        try {
            val printManager = getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
            val jobName = "${getString(R.string.app_name)} Document"
            val adapter = webView.createPrintDocumentAdapter(jobName)
            printManager.print(jobName, adapter, PrintAttributes.Builder().build())
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

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun createTempImageFile(): File {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        return File.createTempFile("LMPS_$stamp", ".jpg", cacheDir)
    }

    override fun onDestroy() {
        splashRingAnimator?.cancel()
        unregisterNetworkObserver()
        webView.destroy()
        super.onDestroy()
    }
}
