using System.Net.Http.Headers;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal sealed class DailyProviderUsage { public string Date { get; set; } = ""; public long Requests { get; set; } public long Tokens { get; set; } }
internal sealed class ProviderCap { public long Requests { get; set; } public long Tokens { get; set; } }

internal static class ProviderBudget
{
    private static DailyProviderUsage Current(SavedState data, string provider)
    {
        string today=DateTime.UtcNow.ToString("yyyy-MM-dd");
        if (!data.DailyUsage.TryGetValue(provider, out var entry) || entry.Date != today) data.DailyUsage[provider]=entry=new DailyProviderUsage { Date=today };
        return entry;
    }
    public static void Begin(LocalStore store, string provider)
    {
        lock (store.Sync)
        {
            var entry=Current(store.Data,provider); store.Data.ProviderCaps.TryGetValue(provider,out var cap);
            if (cap is not null && ((cap.Requests>0 && entry.Requests>=cap.Requests) || (cap.Tokens>0 && entry.Tokens>=cap.Tokens))) throw new InvalidOperationException($"Достигнут локальный суточный лимит {provider}; проверьте настройки лимитов.");
            entry.Requests++;
            try { store.Save(); } catch { entry.Requests--; throw; }
        }
    }
    public static void AddUsage(LocalStore store, string provider, JsonNode root)
    {
        if (root["usage"] is not JsonObject usage) return;
        static long? Read(JsonNode? node) { try { long? n=node?.GetValue<long>(); return n is >=0 and <=1_000_000_000 ? n : null; } catch (Exception ex) when (ex is InvalidOperationException or FormatException or OverflowException) { return null; } }
        long? total=Read(usage["total_tokens"]), input=Read(usage["prompt_tokens"]), output=Read(usage["completion_tokens"]);
        if (total is null && (input is null || output is null)) return;
        lock(store.Sync) { Current(store.Data,provider).Tokens += total ?? input!.Value + output!.Value; }
    }
    public static void SetCaps(LocalStore store, string provider, long requests, long tokens)
    {
        if (!ProviderSettings.ValidProvider(provider) || requests<0 || tokens<0 || requests>1_000_000 || tokens>1_000_000_000) throw new ArgumentException("Недопустимый суточный лимит.");
        lock(store.Sync) { store.Data.ProviderCaps.TryGetValue(provider, out var previous); store.Data.ProviderCaps[provider]=new ProviderCap { Requests=requests, Tokens=tokens }; try { store.Save(); } catch { if(previous is null) store.Data.ProviderCaps.Remove(provider); else store.Data.ProviderCaps[provider]=previous; throw; } }
    }
    public static async Task<object> OpenRouterQuotaAsync(HttpClient http, string key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Ключ OpenRouter не настроен.");
        using var request=new HttpRequestMessage(HttpMethod.Get,"https://openrouter.ai/api/v1/key"); request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",key);
        using var response=await http.SendAsync(request,ct); if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"OpenRouter вернул HTTP {(int)response.StatusCode}.");
        var root=JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)); var data=root?["data"] ?? throw new InvalidOperationException("OpenRouter не вернул данные ключа.");
        return new { usageDaily=data["usage_daily"]?.DeepClone(), usageMonthly=data["usage_monthly"]?.DeepClone(), freeRequests=data["free_model_daily_requests"]?.DeepClone() };
    }
}
