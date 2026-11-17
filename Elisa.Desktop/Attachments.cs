using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal sealed record Attachment(string Name, string Mime, byte[] Bytes);

internal static class Attachments
{
    public const int MaxFileBytes = 8 * 1024 * 1024;
    public const int MaxTotalBytes = 12 * 1024 * 1024;
    public const int MaxFiles = 8;
    public static List<Attachment> Parse(JsonElement root)
    {
        var result = new List<Attachment>();
        if (!root.TryGetProperty("attachments", out var list)) return result;
        if (list.ValueKind != JsonValueKind.Array || list.GetArrayLength() > MaxFiles) throw new ArgumentException("Не более 8 файлов в одном сообщении.");
        long total = 0;
        foreach (var item in list.EnumerateArray())
        {
            string name = Path.GetFileName(item.GetProperty("name").GetString() ?? "файл");
            if (string.IsNullOrWhiteSpace(name) || name.Length > 255) throw new ArgumentException("Недопустимое имя файла.");
            string mime = item.GetProperty("type").GetString() ?? "";
            if (mime.Length > 100 || mime.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '/' or '.' or '-' or '+'))) mime = "application/octet-stream";
            if (string.IsNullOrWhiteSpace(mime) || mime == "application/octet-stream")
                mime = Path.GetExtension(name).ToLowerInvariant() switch { ".pdf" => "application/pdf", ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp", ".gif" => "image/gif", _ => "application/octet-stream" };
            string encoded = item.GetProperty("data").GetString() ?? "";
            if (encoded.Length > ((MaxFileBytes + 2L) / 3L) * 4L) throw new ArgumentException("Файл больше 8 МБ.");
            byte[] bytes = Convert.FromBase64String(encoded);
            total += bytes.Length;
            if (bytes.Length > MaxFileBytes || total > MaxTotalBytes) throw new ArgumentException("Максимум 8 МБ на файл и 12 МБ на сообщение.");
            result.Add(new Attachment(name, mime, bytes));
        }
        return result;
    }

    public static JsonNode BuildContent(string text, IReadOnlyList<Attachment> attachments)
    {
        if (attachments.Count == 0) return JsonValue.Create(text)!;
        var parts = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = string.IsNullOrWhiteSpace(text) ? "Пожалуйста, изучи прикреплённые файлы." : text });
        foreach (var file in attachments)
        {
            string data = Convert.ToBase64String(file.Bytes);
            string mime = string.IsNullOrWhiteSpace(file.Mime) ? "application/octet-stream" : file.Mime.ToLowerInvariant();
            if (mime is "image/png" or "image/jpeg" or "image/webp" or "image/gif")
                parts.Add(new JsonObject { ["type"] = "image_url", ["image_url"] = new JsonObject { ["url"] = $"data:{mime};base64,{data}" } });
            else if (TryText(file.Bytes, mime, out string decoded))
                parts.Add(new JsonObject { ["type"] = "text", ["text"] = $"Файл: {file.Name}\n--- начало файла ---\n{decoded}\n--- конец файла ---" });
            else
                parts.Add(new JsonObject { ["type"] = "file", ["file"] = new JsonObject { ["filename"] = file.Name, ["file_data"] = $"data:{mime};base64,{data}" } });
        }
        return parts;
    }

    private static bool TryText(byte[] bytes, string mime, out string text)
    {
        text = "";
        if (mime.StartsWith("image/") || mime == "application/pdf") return false;
        if (bytes.Contains((byte)0)) return false;
        try { text = new UTF8Encoding(false, true).GetString(bytes); return true; }
        catch (DecoderFallbackException) { return false; }
    }
}
