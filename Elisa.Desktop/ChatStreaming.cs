using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

/// <summary>OpenAI-compatible SSE, including incremental tool calls and reasoning replay data.</summary>
internal static class ChatStreaming
{
    public static async Task<JsonNode> ReadAsync(HttpResponseMessage response, Action<string> onText, CancellationToken ct)
    {
        if (!string.Equals(response.Content.Headers.ContentType?.MediaType, "text/event-stream", StringComparison.OrdinalIgnoreCase))
            return JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) ?? throw new InvalidOperationException("Пустой ответ провайдера.");
        await using var input = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(input, Encoding.UTF8);
        var text = new StringBuilder(); var reasoning = new StringBuilder(); var reasoningContent = new StringBuilder();
        var calls = new SortedDictionary<int, JsonObject>(); var details = new JsonArray(); JsonNode? usage = null; string? model = null, finish = null;
        var data = new StringBuilder(); bool done = false; long received = 0;
        void Handle(string payload)
        {
            if (payload == "[DONE]") { done = true; return; }
            var chunk = JsonNode.Parse(payload) ?? throw new InvalidOperationException("Пустое событие потока.");
            if (chunk["error"] is not null) throw new InvalidOperationException("Провайдер сообщил об ошибке во время потока.");
            model = chunk["model"]?.GetValue<string>() ?? model;
            if (chunk["usage"] is not null) usage = chunk["usage"]!.DeepClone();
            if (chunk["choices"] is not JsonArray choices || choices.Count == 0) return;
            var choice = choices[0]; if (choice?["error"] is not null) throw new InvalidOperationException("Провайдер сообщил об ошибке во время потока.");
            if (choice?["finish_reason"] is JsonValue end && end.TryGetValue<string>(out var endString)) finish = endString;
            if (choice?["delta"] is not JsonObject delta) return;
            if (delta["content"] is JsonValue content && content.TryGetValue<string>(out var fragment) && !string.IsNullOrEmpty(fragment))
            { text.Append(fragment); if (text.Length > 2_000_000) throw new InvalidOperationException("Слишком длинный ответ модели."); onText(fragment); }
            if (delta["reasoning"] is JsonValue r && r.TryGetValue<string>(out var rv)) reasoning.Append(rv);
            if (delta["reasoning_content"] is JsonValue rc && rc.TryGetValue<string>(out var rcv)) reasoningContent.Append(rcv);
            if (delta["reasoning_details"] is JsonArray blocks)
                foreach (var block in blocks) if (block is JsonObject obj) AppendReasoning(details, obj);
            if (delta["tool_calls"] is JsonArray tools)
                foreach (var part in tools)
                {
                    if (part is not JsonObject tool) continue;
                    int index = tool["index"]?.GetValue<int>() ?? 0;
                    if (index is < 0 or > 64) throw new InvalidOperationException("Недопустимый номер инструмента в потоке.");
                    if (!calls.TryGetValue(index, out var target)) calls[index] = target = new JsonObject { ["type"] = "function", ["function"] = new JsonObject { ["name"] = "", ["arguments"] = "" } };
                    if (tool["id"] is JsonValue id && id.TryGetValue<string>(out var toolId) && !string.IsNullOrEmpty(toolId)) target["id"] = toolId;
                    if (tool["type"] is JsonValue type && type.TryGetValue<string>(out var toolType) && !string.IsNullOrEmpty(toolType)) target["type"] = toolType;
                    if (tool["function"] is JsonObject fn)
                        foreach (var key in new[] { "name", "arguments" })
                            if (fn[key] is JsonValue partValue && partValue.TryGetValue<string>(out var partText)) target["function"]![key] = (target["function"]![key]?.GetValue<string>() ?? "") + partText;
                    foreach (var property in tool) if (property.Key is not ("index" or "id" or "type" or "function") && property.Value is not null) target[property.Key] = property.Value.DeepClone();
                }
        }
        while (!done)
        {
            string? line = await reader.ReadLineAsync(ct);
            if (line is null) { if (data.Length > 0) Handle(data.ToString()); break; }
            received += line.Length; if (received > 16_000_000) throw new InvalidOperationException("Поток ответа слишком большой.");
            if (line.Length == 0) { if (data.Length > 0) { Handle(data.ToString()); data.Clear(); } continue; }
            if (line.StartsWith("data:", StringComparison.Ordinal)) { if (data.Length > 0) data.Append('\n'); data.Append(line.AsSpan(5).TrimStart()); }
        }
        if (finish is null) throw new IOException("Поток оборвался до завершения ответа.");
        if (finish == "length") throw new InvalidOperationException("Ответ модели обрезан из-за лимита токенов; инструменты не запускались.");
        if (finish == "error") throw new InvalidOperationException("Провайдер завершил поток с ошибкой.");
        var message = new JsonObject { ["role"] = "assistant", ["content"] = text.Length == 0 ? null : text.ToString() };
        if (calls.Count > 0) message["tool_calls"] = new JsonArray(calls.Values.Cast<JsonNode?>().ToArray());
        if (details.Count > 0) message["reasoning_details"] = details;
        if (reasoning.Length > 0) message["reasoning"] = reasoning.ToString();
        if (reasoningContent.Length > 0) message["reasoning_content"] = reasoningContent.ToString();
        return new JsonObject { ["model"] = model, ["usage"] = usage, ["choices"] = new JsonArray(new JsonObject { ["message"] = message, ["finish_reason"] = finish }) };
    }
    internal static void AppendReasoning(JsonArray target, JsonObject incoming)
    {
        string? kind = incoming["type"]?.GetValue<string>(); var previous = target.Count > 0 ? target[^1] as JsonObject : null;
        bool mergeable = kind is "reasoning.text" or "reasoning.summary";
        bool same = mergeable && previous?["type"]?.GetValue<string>() == kind && previous["signature"] is null;
        if (same && previous!["index"] is JsonValue pi && incoming["index"] is JsonValue ni && pi.ToJsonString() != ni.ToJsonString()) same = false;
        if (same && previous!["id"] is JsonValue pid && incoming["id"] is JsonValue nid && pid.ToJsonString() != nid.ToJsonString()) same = false;
        if (!same) { target.Add(incoming.DeepClone()); return; }
        foreach (var item in incoming)
        {
            if (item.Value is null) continue;
            if (item.Key is "text" or "summary" && item.Value is JsonValue v && v.TryGetValue<string>(out var part)) previous![item.Key] = (previous[item.Key]?.GetValue<string>() ?? "") + part;
            else previous![item.Key] = item.Value.DeepClone();
        }
    }
}
