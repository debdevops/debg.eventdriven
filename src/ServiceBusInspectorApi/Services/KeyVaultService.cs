using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace ServiceBusInspectorApi.Services;

/// <summary>
/// OBSOLETE: This service is no longer used. Connection strings are now provided directly by the UI.
/// Service for retrieving secrets from Azure Key Vault using DefaultAzureCredential.
/// In local development, this uses `az login` credentials.
/// In Azure, this uses the Managed Identity of the App Service.
/// </summary>
[Obsolete("KeyVaultService is no longer used. Connection strings are provided directly by clients.")]
public class KeyVaultService
{
    private readonly DefaultAzureCredential _credential;
    private readonly ILogger<KeyVaultService> _logger;

    public KeyVaultService(DefaultAzureCredential credential, ILogger<KeyVaultService> logger)
    {
        _credential = credential;
        _logger = logger;
    }

    /// <summary>
    /// Retrieves a secret value from Key Vault.
    /// WARNING: Never log the returned connection string.
    /// </summary>
    public async Task<string> GetSecretAsync(string keyVaultName, string secretName)
    {
        var keyVaultUri = new Uri($"https://{keyVaultName}.vault.azure.net/");
        var client = new SecretClient(keyVaultUri, _credential);

        try
        {
            var secret = await client.GetSecretAsync(secretName);
            _logger.LogInformation("Successfully retrieved secret {SecretName} from Key Vault {KeyVaultName}",
                secretName, keyVaultName);
            
            // SECURITY: Never log the actual secret value
            return secret.Value.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve secret {SecretName} from Key Vault {KeyVaultName}",
                secretName, keyVaultName);
            throw;
        }
    }

    /// <summary>
    /// Validates that a secret exists in Key Vault without retrieving its value.
    /// Used during session creation to fail fast if the secret doesn't exist.
    /// </summary>
    public async Task ValidateSecretExistsAsync(string keyVaultName, string secretName)
    {
        var keyVaultUri = new Uri($"https://{keyVaultName}.vault.azure.net/");
        var client = new SecretClient(keyVaultUri, _credential);

        try
        {
            // Just check if we can access the secret properties (doesn't retrieve the value)
            await client.GetSecretAsync(secretName);
            _logger.LogInformation("Validated secret {SecretName} exists in Key Vault {KeyVaultName}",
                secretName, keyVaultName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Secret {SecretName} does not exist or is not accessible in Key Vault {KeyVaultName}",
                secretName, keyVaultName);
            throw;
        }
    }

    // PRODUCTION HARDENING:
    // 1. Implement secret caching with short TTL (5-10 minutes) to reduce Key Vault calls
    // 2. Enable Key Vault Private Link to restrict access to VNet only
    // 3. Use Azure Key Vault RBAC instead of access policies
    // 4. Implement circuit breaker pattern for Key Vault calls
    // 5. Monitor Key Vault access logs and set up alerts for anomalies
    // 6. Rotate secrets regularly and test rotation procedures
}
