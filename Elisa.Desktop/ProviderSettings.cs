using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal sealed class AgentRoute
{
    // inherit means use the selected main provider; blank model means its default model.
    public string Provider { get; set; } = "inherit";
    public string Model { get; set; } = "";
}
internal sealed record ProviderRoute(string Provider, string Model, string Key)
{
    public Uri Endpoint => Provider switch
    {
        "nvidia" => new("https://integrate.api.nvidia.com/v1/chat/completions"),
        "arena" => new("https://api.arena.ai/v1/chat/completions"),
        "openrouter" => new("https://openrouter.ai/api/v1/chat/completions"),
        _ => throw new ArgumentException("Неизвестный провайдер.")
    };
    public string Label => Provider switch { "nvidia" => "NVIDIA Build", "arena" => "Arena API", "openrouter" => "OpenRouter", _ => throw new ArgumentException("Неизвестный провайдер.") };
}
internal static class ProviderSettings
{
    public static readonly string[] Roles = ["research", "implement", "review", "general"];
    public static bool ValidProvider(string value) => value is "openrouter" or "nvidia" or "arena";
    public static bool ValidModel(string value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 200 && !value.Any(char.IsWhiteSpace) && !value.Any(char.IsControl);
    public static string KeyFor(SavedState state, string provider) => provider switch { "openrouter" => state.ApiKey, "nvidia" => state.NvidiaApiKey, "arena" => state.ArenaApiKey, _ => throw new ArgumentException("Неизвестный провайдер.") };
    public static string ModelFor(SavedState state, string provider) => provider switch { "openrouter" => state.Model, "nvidia" => state.NvidiaModel, "arena" => state.ArenaModel, _ => throw new ArgumentException("Неизвестный провайдер.") };
    public static ProviderRoute Resolve(SavedState state, string? role = null)
    {
        string provider = state.SelectedProvider;
        string overrideModel = "";
        if (role is not null && state.AgentRoutes.TryGetValue(role, out var route))
        {
            if (route.Provider != "inherit") provider = route.Provider;
            overrideModel = route.Model;
        }
        if (!ValidProvider(provider)) throw new ArgumentException("Неизвестный провайдер.");
        string model = string.IsNullOrWhiteSpace(overrideModel) ? ModelFor(state, provider) : overrideModel;
        string key = KeyFor(state, provider);
        if (!ValidModel(model)) throw new ArgumentException("Укажите корректный ID модели для " + provider + ".");
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Не задан API-ключ для " + provider + ".");
        return new ProviderRoute(provider, model, key);
    }
    // Different providers/models may not accept one another's private reasoning metadata.
    // Retain visible messages and the standard tool protocol, not vendor-specific metadata.
    public static JsonArray PortableHistory(JsonArray input)
    {
        var output = new JsonArray();
        foreach (var node in input)
        {
            if (node is not JsonObject item) throw new InvalidOperationException("Неизвестный формат истории.");
            var cleaned = new JsonObject();
            foreach (var name in new[] { "role", "content", "name", "tool_call_id" })
                if (item.TryGetPropertyValue(name, out var value)) cleaned[name] = value?.DeepClone();
            if (item["tool_calls"] is JsonArray calls)
            {
                var normalized = new JsonArray();
                foreach (var call in calls)
                    normalized.Add(new JsonObject { ["id"] = call?["id"]?.DeepClone(), ["type"] = call?["type"]?.DeepClone(), ["function"] = call?["function"]?.DeepClone() });
                cleaned["tool_calls"] = normalized;
            }
            output.Add(cleaned);
        }
        return output;
    }
    public static bool HasFileParts(JsonArray history) => history.Any(m => m?["content"] is JsonArray parts && parts.Any(p => p?["type"]?.GetValue<string>() == "file"));
}
