using Microsoft.AspNetCore.Http;

namespace ServiceBusInspectorApi.Services;

public static class ProblemResults
{
    public static IResult FromException(Exception ex, string operation, string? entityPath = null)
    {
        var (status, errorCode, title, detail) = ServiceBusErrorClassifier.Classify(ex, operation);

        var extensions = new Dictionary<string, object?>
        {
            ["errorCode"] = errorCode,
            ["operation"] = operation,
        };

        if (!string.IsNullOrWhiteSpace(entityPath))
        {
            extensions["entityPath"] = entityPath;
        }

        return Results.Problem(
            title: title,
            detail: detail,
            statusCode: status,
            extensions: extensions);
    }
}
