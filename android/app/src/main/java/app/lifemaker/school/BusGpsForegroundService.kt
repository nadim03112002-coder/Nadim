package app.lifemaker.school

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt

class BusGpsForegroundService : Service(), LocationListener {

    private var locationManager: LocationManager? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val isTracking = AtomicBoolean(false)
    private val ioExecutor = Executors.newSingleThreadExecutor()

    private var lastSentAtMs: Long = 0L
    private var lastLocation: Location? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        if (action == ACTION_STOP) {
            AppPrefs.setBusGpsActive(applicationContext, false)
            val finalLoc = lastLocation
            if (finalLoc != null) {
                val payload = buildPayloadJson(finalLoc, tripStatusOverride = "ended")
                if (payload != null) {
                    ioExecutor.execute {
                        pushLocationToRtdb(payload)
                    }
                }
            }
            cleanupLocationAndWakeLock()
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (_: Exception) {}
            stopSelf()
            return START_NOT_STICKY
        }

        if (!AppPrefs.isBusGpsActive(applicationContext) || !hasLocationPermission(applicationContext)) {
            AppPrefs.setBusGpsActive(applicationContext, false)
            cleanupLocationAndWakeLock()
            stopSelf()
            return START_NOT_STICKY
        }

        val cfg = readConfig()
        val busNumber = cfg?.optString("busNumber", "School Bus")?.ifBlank { "School Bus" } ?: "School Bus"
        val notif = NotificationHelper.buildBusGpsForegroundNotification(
            context = applicationContext,
            busNumber = busNumber,
            statusText = "GPS active — screen lock ya call par bhi location share hogi."
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    FOREGROUND_NOTIFICATION_ID,
                    notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                )
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notif)
            }
        } catch (_: SecurityException) {
            AppPrefs.setBusGpsActive(applicationContext, false)
            stopSelf()
            return START_NOT_STICKY
        } catch (_: Exception) {
            AppPrefs.setBusGpsActive(applicationContext, false)
            stopSelf()
            return START_NOT_STICKY
        }

        acquirePartialWakeLock()
        startLocationUpdates()
        return START_STICKY
    }

    override fun onDestroy() {
        cleanupLocationAndWakeLock()
        try {
            ioExecutor.shutdown()
        } catch (_: Exception) {}
        super.onDestroy()
    }

    private fun readConfig(): JSONObject? {
        val raw = AppPrefs.getBusGpsConfigJson(applicationContext)
        if (raw.isEmpty()) return null
        return try {
            JSONObject(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun acquirePartialWakeLock() {
        if (wakeLock?.isHeld == true) return
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SCHOOLPlus::BusGpsWakeLock").apply {
                setReferenceCounted(false)
                acquire(6L * 60L * 60L * 1000L) // Max 6h safety cap per trip
            }
        } catch (_: Exception) {}
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        if (!hasLocationPermission(applicationContext)) return
        if (isTracking.getAndSet(true)) return

        try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            locationManager = lm
            if (lm == null) {
                isTracking.set(false)
                return
            }

            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    4_000L,
                    5f,
                    this,
                    Looper.getMainLooper()
                )
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    8_000L,
                    15f,
                    this,
                    Looper.getMainLooper()
                )
            }

            val seedLocation = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
                .mapNotNull { provider ->
                    try {
                        lm.getLastKnownLocation(provider)
                    } catch (_: Exception) {
                        null
                    }
                }
                .maxByOrNull { it.time }

            if (seedLocation != null) {
                handleNewLocation(seedLocation, forceSync = true)
            }
        } catch (_: SecurityException) {
            isTracking.set(false)
            AppPrefs.setBusGpsActive(applicationContext, false)
            stopSelf()
        } catch (_: Exception) {
            isTracking.set(false)
        }
    }

    private fun cleanupLocationAndWakeLock() {
        isTracking.set(false)
        try {
            locationManager?.removeUpdates(this)
        } catch (_: Exception) {}
        locationManager = null
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {}
        wakeLock = null
    }

    override fun onLocationChanged(location: Location) {
        if (!AppPrefs.isBusGpsActive(applicationContext)) return
        handleNewLocation(location, forceSync = false)
    }

    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun handleNewLocation(location: Location, forceSync: Boolean) {
        val nowMs = System.currentTimeMillis()
        val prev = lastLocation
        if (!forceSync && prev != null) {
            val elapsedMs = nowMs - lastSentAtMs
            val movedMeters = prev.distanceTo(location)
            if (elapsedMs < 3_500L && movedMeters < 10f) {
                return
            }
        }

        lastSentAtMs = nowMs
        val payload = buildPayloadJson(location, tripStatusOverride = null) ?: return
        lastLocation = location

        // Update foreground notification live text
        val cfg = readConfig()
        val busNum = cfg?.optString("busNumber", "School Bus")?.ifBlank { "School Bus" } ?: "School Bus"
        val speedKmh = payload.optInt("speed", 0)
        val stopLabel = payload.optString("currentStop", "").ifBlank { "On Route" }
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.notify(
                FOREGROUND_NOTIFICATION_ID,
                NotificationHelper.buildBusGpsForegroundNotification(
                    context = applicationContext,
                    busNumber = busNum,
                    statusText = "Speed: $speedKmh km/h • $stopLabel"
                )
            )
        } catch (_: Exception) {}

        // Notify in-app WebView if open
        try {
            val broadcastIntent = Intent(ACTION_BUS_LOCATION_UPDATE).apply {
                setPackage(packageName)
                putExtra(EXTRA_BUS_PAYLOAD, payload.toString())
            }
            sendBroadcast(broadcastIntent)
        } catch (_: Exception) {}

        // Sync directly to Firebase RTDB in background thread even if screen is locked
        ioExecutor.execute {
            pushLocationToRtdb(payload)
        }
    }

    private fun buildPayloadJson(location: Location, tripStatusOverride: String?): JSONObject? {
        val cfg = readConfig() ?: return null
        val schoolId = cfg.optString("schoolId", "").trim()
        val busId = cfg.optString("busId", "").trim()
        if (schoolId.isEmpty() || busId.isEmpty()) return null

        var kmh = if (location.hasSpeed() && location.speed >= 0f) {
            (location.speed * 3.6f).roundToInt()
        } else {
            0
        }
        val prev = lastLocation
        if (kmh == 0 && prev != null) {
            val dtSec = ((location.time - prev.time) / 1000.0)
            if (dtSec > 0.5 && dtSec < 120.0) {
                val distKm = prev.distanceTo(location) / 1000.0
                if (distKm > 0.005) {
                    kmh = (distKm / (dtSec / 3600.0)).roundToInt()
                }
            }
        }
        if (kmh > 120 || kmh < 0) kmh = 0

        val isoFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val completedArr = cfg.optJSONArray("completedStops") ?: JSONArray()
        val currentStop = cfg.optString("currentStop", "").ifBlank {
            if (completedArr.length() > 0) completedArr.optString(completedArr.length() - 1, "On Route") else "Starting Depot"
        }

        val lat = (location.latitude * 1_000_000.0).roundToInt() / 1_000_000.0
        val lng = (location.longitude * 1_000_000.0).roundToInt() / 1_000_000.0

        return JSONObject().apply {
            put("schoolId", schoolId)
            put("busId", busId)
            put("busNumber", cfg.optString("busNumber", "School Bus"))
            put("route", cfg.optString("route", "School Bus Route"))
            put("driverName", cfg.optString("driverName", "Driver"))
            put("driverPhone", cfg.optString("driverPhone", ""))
            put("latitude", lat)
            put("longitude", lng)
            put("lat", lat)
            put("lng", lng)
            put("speed", if (tripStatusOverride == "ended") 0 else kmh)
            put("heading", if (location.hasBearing()) location.bearing.toDouble() else 0.0)
            put("accuracy", if (location.hasAccuracy()) location.accuracy.roundToInt() else 12)
            put("tripStatus", tripStatusOverride ?: "started")
            put("tripType", cfg.optString("tripType", "morning_pickup"))
            put("lastUpdated", isoFmt.format(Date()))
            put("currentStop", currentStop)
            put("totalStops", cfg.optInt("totalStops", 3))
            put("completedStops", completedArr)
            put("nativeBackground", true)
        }
    }

    private fun pushLocationToRtdb(payload: JSONObject) {
        val schoolId = payload.optString("schoolId", "").trim()
        val busId = payload.optString("busId", "").trim()
        if (schoolId.isEmpty() || busId.isEmpty()) return

        val cleanSchool = AppPrefs.sanitizeRtdbKey(schoolId)
        val cleanBus = AppPrefs.sanitizeRtdbKey(busId)
        val encodedSchool = URLEncoder.encode(cleanSchool, "UTF-8")
        val encodedBus = URLEncoder.encode(cleanBus, "UTF-8")
        val token = AppPrefs.getBusGpsAuthToken(applicationContext)
        val authQuery = if (token.isNotEmpty()) "?auth=${URLEncoder.encode(token, "UTF-8")}" else ""
        val base = BuildConfig.RTDB_BASE_URL.trimEnd('/')
        val bodyStr = payload.toString()

        val endpoints = listOf(
            "$base/school_bus_locations/$encodedSchool/$encodedBus.json$authQuery",
            "$base/schools/$encodedSchool/bus_live_locations/$encodedBus.json$authQuery"
        )

        for (endpoint in endpoints) {
            var conn: HttpURLConnection? = null
            try {
                val url = URL(endpoint)
                conn = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "PUT"
                    setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                    connectTimeout = 8_000
                    readTimeout = 8_000
                    doOutput = true
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                    writer.write(bodyStr)
                    writer.flush()
                }
                conn.responseCode
            } catch (_: Exception) {
            } finally {
                try {
                    conn?.disconnect()
                } catch (_: Exception) {}
            }
        }
    }

    companion object {
        const val FOREGROUND_NOTIFICATION_ID = 2002
        const val ACTION_START = "app.lifemaker.school.ACTION_START_BUS_GPS"
        const val ACTION_STOP = "app.lifemaker.school.ACTION_STOP_BUS_GPS"
        const val ACTION_BUS_LOCATION_UPDATE = "app.lifemaker.school.BUS_LOCATION_UPDATE"
        const val EXTRA_BUS_PAYLOAD = "bus_payload"

        fun hasLocationPermission(context: Context): Boolean {
            val fine = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            val coarse = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
            return fine || coarse
        }

        fun startOrUpdate(context: Context): Boolean {
            if (!AppPrefs.isBusGpsActive(context)) return false
            if (AppPrefs.getBusGpsConfigJson(context).isEmpty()) return false
            if (!hasLocationPermission(context)) return false
            val intent = Intent(context, BusGpsForegroundService::class.java).apply {
                action = ACTION_START
            }
            return try {
                ContextCompat.startForegroundService(context, intent)
                true
            } catch (_: Exception) {
                false
            }
        }

        fun stop(context: Context) {
            AppPrefs.setBusGpsActive(context, false)
            val intent = Intent(context, BusGpsForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {
                try {
                    context.stopService(Intent(context, BusGpsForegroundService::class.java))
                } catch (_: Exception) {}
            }
        }
    }
}
