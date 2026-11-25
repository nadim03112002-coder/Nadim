package app.lifemaker.school

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class SchoolCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        // Never block, reject, or silence any call
        respondToCall(callDetails, CallResponse.Builder().build())

        val rawNumber = callDetails.handle?.schemeSpecificPart
            ?: callDetails.gatewayInfo?.originalAddress?.schemeSpecificPart
            ?: ""

        if (rawNumber.isBlank()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            when (callDetails.callDirection) {
                Call.Details.DIRECTION_INCOMING -> {
                    ParentCallerAlertHelper.handleIncomingNumber(applicationContext, rawNumber)
                }
                Call.Details.DIRECTION_OUTGOING -> {
                    ParentCallerAlertHelper.handleOutgoingNumber(applicationContext, rawNumber)
                }
                else -> Unit
            }
        } else {
            ParentCallerAlertHelper.handleIncomingNumber(applicationContext, rawNumber)
        }
    }
}
