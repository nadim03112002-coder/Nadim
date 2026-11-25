package app.lifemaker.school

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class SchoolCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        // Never block, reject, or silence any incoming call
        respondToCall(callDetails, CallResponse.Builder().build())

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
                return
            }
        }

        val rawNumber = callDetails.handle?.schemeSpecificPart
            ?: callDetails.gatewayInfo?.originalAddress?.schemeSpecificPart
            ?: ""

        if (rawNumber.isBlank()) return

        ParentCallerAlertHelper.handleIncomingNumber(applicationContext, rawNumber)
    }
}
