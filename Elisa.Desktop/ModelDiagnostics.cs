using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal static class ModelDiagnostics
{
    // A tiny generated 1x1 PNG; no user data is transmitted by the probes.
    private const string Pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN8AAAAASUVORK5CYII=";
    public static async Task<List<string>> RunAsync(HttpClient http, LocalStore store, ProviderRoute route, Action notify, CancellationToken ct)
    {
        var results = new List<string>();
        foreach (string kind in new[] { "Подключение", "Инструменты", "Изображения" })
        {
            try
            {
                var message = new JsonObject { ["role"] = "user", ["content"] = kind == "Изображения" ? new JsonArray(new JsonObject { ["type"] = "text", ["text"] = "Describe this image briefly." }, new JsonObject { ["type"] = "image_url", ["image_url"] = new JsonObject { ["url"] = "data:image/png;base64," + Pixel } }) : JsonValue.Create(kind == "Инструменты" ? "Call the test_probe function now." : "Reply OK.") };
                var body = new JsonObject { ["model"] = route.Model, ["messages"] = new JsonArray(message), ["max_tokens"] = 128 };
                if (kind == "Инструменты")
                {
                    body["tools"] = new JsonArray(new JsonObject { ["type"] = "function", ["function"] = new JsonObject { ["name"] = "test_probe", ["description"] = "A test function", ["parameters"] = new JsonObject { ["type"] = "object", ["properties"] = new JsonObject() } } });
                    body["tool_choice"] = "required";
                }
                using var request = new HttpRequestMessage(HttpMethod.Post, route.Endpoint);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", route.Key);
                request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
                ProviderBudget.Begin(store, route.Provider); notify();
                using var response = await http.SendAsync(request, ct);
                if (!response.IsSuccessStatusCode) { string hint = route.Provider == "arena" && (int)response.StatusCode == 403 ? "Проверьте разрешение сторонних API-клиентов в workspace Arena, права ключа и доступ модели." : "Проверьте ключ, модель, квоту, доступ и совместимость запроса."; results.Add(kind + ": не подтверждено — HTTP " + (int)response.StatusCode + ". " + hint); continue; }
                var root = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
                if (root is null || root["error"] is not null) { results.Add(kind + ": не подтверждено — провайдер вернул ошибку."); continue; }
                lock (store.Sync) { ProviderBudget.AddUsage(store, route.Provider, root); store.RecordUsage(root, route.Model, route.Provider); store.Save(); } notify();
                var answer = root["choices"]?[0]?["message"];
                bool ok = kind == "Инструменты" ? answer?["tool_calls"] is JsonArray calls && calls.Any(c => c?["function"]?["name"]?.GetValue<string>() == "test_probe") : answer?["content"] is JsonValue v && v.TryGetValue<string>(out var text) && !string.IsNullOrWhiteSpace(text);
                results.Add(kind + (ok ? (kind == "Изображения" ? ": запрос с изображением принят; понимание изображения не гарантировано." : ": проверка пройдена.") : ": не подтверждено — ответ не содержит ожидаемого результата."));
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex) { results.Add(kind + ": не подтверждено — " + (ex is HttpRequestException ? "ошибка сети или TLS." : ex is OperationCanceledException ? "превышено время ожидания." : ex is InvalidOperationException ? "лимит или некорректный ответ провайдера." : "не удалось выполнить проверку.")); }
        }
        return results;
    }
}
