using Azure;
using Azure.Messaging.ServiceBus;

namespace ServiceBusInspectorApi.Services;

public static class ServiceBusErrorClassifier
{
    public const string ErrorEmpty = "EMPTY";
    public const string ErrorNotReady = "NOT_READY";
    public const string ErrorDisabled = "DISABLED";
    public const string ErrorFailed = "FAILED";

    public static bool IsTransient(Exception ex)
    {
        if (ex is ServiceBusException sbEx)
        {
            return sbEx.Reason is ServiceBusFailureReason.ServiceCommunicationProblem
                or ServiceBusFailureReason.ServiceTimeout
                or ServiceBusFailureReason.ServiceBusy;
        }

        if (ex is RequestFailedException rfe)
        {
            // Common transient patterns for ARM/management-plane style failures.
            return rfe.Status is 408 or 429 or 500 or 502 or 503 or 504;
        }

        // Timeouts and task cancellations can surface depending on underlying transport.
        if (ex is TimeoutException)
        {
            return true;
        }

        return false;
    }

    public static (int statusCode, string errorCode, string title, string detail) Classify(Exception ex, string operation)
    {
        // Default: safe, generic.
        var title = $"{operation} failed";
        var detail = "The operation could not be completed.";
        var status = 500;
        var errorCode = ErrorFailed;

        if (ex is ServiceBusException sbEx)
        {
            switch (sbEx.Reason)
            {
                case ServiceBusFailureReason.MessagingEntityDisabled:
                    errorCode = ErrorDisabled;
                    title = $"{operation} failed: entity disabled";
                    detail = "This entity is disabled in Service Bus.";
                    status = 409;
                    return (status, errorCode, title, detail);

                case ServiceBusFailureReason.MessagingEntityNotFound:
                    errorCode = ErrorNotReady;
                    title = $"{operation} failed: entity not found";
                    detail = "The entity was not found. If it was just created or recently changed, refresh and try again.";
                    status = 503;
                    return (status, errorCode, title, detail);

                case ServiceBusFailureReason.ServiceBusy:
                case ServiceBusFailureReason.ServiceTimeout:
                case ServiceBusFailureReason.ServiceCommunicationProblem:
                    errorCode = ErrorNotReady;
                    title = $"{operation} temporarily unavailable";
                    detail = "Service Bus is temporarily unavailable. Please retry.";
                    status = 503;
                    return (status, errorCode, title, detail);
            }

            // Other ServiceBusException
            errorCode = ErrorFailed;
            title = $"{operation} failed";
            detail = "Service Bus rejected the request.";
            status = 500;
            return (status, errorCode, title, detail);
        }

        if (ex is RequestFailedException rfe)
        {
            if (IsTransient(rfe))
            {
                errorCode = ErrorNotReady;
                title = $"{operation} temporarily unavailable";
                detail = "The Service Bus management API is temporarily unavailable. Please retry.";
                status = 503;
                return (status, errorCode, title, detail);
            }

            errorCode = ErrorFailed;
            title = $"{operation} failed";
            detail = "The Service Bus management API rejected the request.";
            status = 500;
            return (status, errorCode, title, detail);
        }

        // DNS / connection hints (best-effort; still safe)
        var message = ex.InnerException?.Message ?? ex.Message;
        if (message.Contains("No such host is known", StringComparison.OrdinalIgnoreCase)
            || message.Contains("Name or service not known", StringComparison.OrdinalIgnoreCase))
        {
            errorCode = ErrorFailed;
            title = $"{operation} failed";
            detail = "Unable to resolve the Service Bus namespace host. Please check the connection string.";
            status = 502;
            return (status, errorCode, title, detail);
        }

        if (message.Contains("Connection refused", StringComparison.OrdinalIgnoreCase)
            || message.Contains("actively refused", StringComparison.OrdinalIgnoreCase))
        {
            errorCode = ErrorNotReady;
            title = $"{operation} temporarily unavailable";
            detail = "Connection refused by Service Bus. Please check network connectivity and firewall settings.";
            status = 503;
            return (status, errorCode, title, detail);
        }

        return (status, errorCode, title, detail);
    }
}
