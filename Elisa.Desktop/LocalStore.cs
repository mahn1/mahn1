using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal sealed class ChatEntry
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Preview { get; set; } = "";
    public List<ChatItem> Messages { get; set; } = [];
}
internal sealed class ChatItem
{
    public string Role { get; set; } = "";
    public string Text { get; set; } = "";
    public string? Command { get; set; }
    public string? ToolId { get; set; }
    public string? ToolName { get; set; }
    public string? ToolComment { get; set; }
    public string? ToolStatus { get; set; }
    public string? Provider { get; set; }
    public string? Model { get; set; }
    public List<ChatImage> Images { get; set; } = [];
    public long DurationMs { get; set; }
    public List<string> Attachments { get; set; } = [];
}
internal sealed class MemoryItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Text { get; set; } = "";
}
internal sealed class ModelUsage
{
    public long PromptTokens { get; set; }
    public long CompletionTokens { get; set; }
    public long TotalTokens { get; set; }
    public long Requests { get; set; }
}
internal sealed class SavedState
{
    public string ApiKey { get; set; } = "";
    public string Model { get; set; } = "openrouter/free"; // legacy OpenRouter model
    public string NvidiaApiKey { get; set; } = "";
    public string NvidiaModel { get; set; } = "deepseek-ai/deepseek-v4.1-flash";
    public string SelectedProvider { get; set; } = "openrouter";
    public Dictionary<string, AgentRoute> AgentRoutes { get; set; } = [];
    public Dictionary<string, string> HistoryRoutes { get; set; } = [];
    public Dictionary<string, JsonArray> Histories { get; set; } = [];
    public List<ChatEntry> Chats { get; set; } = [];
    public Dictionary<string, ModelUsage> Usage { get; set; } = [];
    public List<MemoryItem> Memories { get; set; } = [];
    public Dictionary<string, ProviderCap> ProviderCaps { get; set; } = [];
    public Dictionary<string, DailyProviderUsage> DailyUsage { get; set; } = [];
}

/// <summary>DPAPI CurrentUser encrypts the complete state, including API key and model context.</summary>
internal sealed class LocalStore
{
    public object Sync { get; } = new();
    private readonly string path;
    private readonly bool persist;
    private bool blocked;
    public SavedState Data { get; private set; } = new();
    public string? LoadError { get; private set; }

    public LocalStore(string? path = null, bool persist = true)
    {
        this.path = path ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Elisa", "viora-state.dat");
        this.persist = persist;
        if (!persist || !File.Exists(this.path)) return;
        try
        {
            byte[] encrypted = File.ReadAllBytes(this.path);
            byte[] plaintext = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
            Data = JsonSerializer.Deserialize<SavedState>(plaintext) ?? throw new JsonException("Пустые данные.");
            Data.AgentRoutes ??= []; Data.HistoryRoutes ??= []; Data.Memories ??= []; Data.ProviderCaps ??= []; Data.DailyUsage ??= [];
            foreach (var item in Data.Chats.SelectMany(c => c.Messages).Where(m => m.ToolStatus == "running"))
            {
                item.ToolStatus = "interrupted";
                item.Text = item.Role == "thinking_start" ? "Ожидание ответа прервано." : "Приложение было закрыто во время выполнения. Проверьте результат вручную.";
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or CryptographicException or JsonException)
        {
            blocked = true;
            LoadError = "Не удалось открыть сохранённые данные Elisa Viora. Исходный файл сохранён; новые изменения в этой сессии не записываются.";
            Data = new();
        }
    }
    public void Save()
    {
        if (!persist) return;
        if (blocked) throw new IOException(LoadError);
        string? directory = Path.GetDirectoryName(path);
        if (directory is null) throw new IOException("Не удалось определить папку сохранения.");
        Directory.CreateDirectory(directory);
        byte[] plaintext = JsonSerializer.SerializeToUtf8Bytes(Data);
        byte[] encrypted = ProtectedData.Protect(plaintext, null, DataProtectionScope.CurrentUser);
        string tmp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try { File.WriteAllBytes(tmp, encrypted); File.Move(tmp, path, true); }
        finally { if (File.Exists(tmp)) File.Delete(tmp); }
    }
    public bool RecordUsage(JsonNode root, string fallbackModel, string provider = "openrouter")
    {
        if (root["usage"] is not JsonObject usage) return false;
        static long? Read(JsonNode? node)
        {
            try { long? n = node?.GetValue<long>(); return n is >= 0 and <= 1_000_000_000 ? n : null; }
            catch (Exception ex) when (ex is InvalidOperationException or FormatException or OverflowException) { return null; }
        }
        long? prompt = Read(usage["prompt_tokens"]), completion = Read(usage["completion_tokens"]), total = Read(usage["total_tokens"]);
        if (prompt is null && completion is null && total is null) return false;
        if (total is null && (prompt is null || completion is null)) return false;
        long totalValue = total ?? prompt!.Value + completion!.Value;
        string model = root["model"] is JsonValue value && value.TryGetValue<string>(out var actual) && !string.IsNullOrWhiteSpace(actual) ? actual : fallbackModel;
        if (model.Length > 200) model = model[..200];
        if (provider == "nvidia") model = "NVIDIA · " + model;
        if (!Data.Usage.TryGetValue(model, out var record)) Data.Usage[model] = record = new();
        record.PromptTokens += prompt ?? 0; record.CompletionTokens += completion ?? 0;
        record.TotalTokens += totalValue; record.Requests++;
        return true;
    }

    public void AddMemory(string text)
    {
        text = text.Trim();
        if (text.Length is < 1 or > 500 || text.Any(char.IsControl)) throw new ArgumentException("Запись памяти должна содержать 1–500 символов без переносов строк.");
        if (Data.Memories.Count >= 40) throw new ArgumentException("В памяти уже 40 записей; удалите ненужную.");
        if (Data.Memories.Any(x => string.Equals(x.Text, text, StringComparison.OrdinalIgnoreCase))) return;
        var item = new MemoryItem { Text = text }; Data.Memories.Add(item);
        try { Save(); } catch { Data.Memories.Remove(item); throw; }
    }
    public void RemoveMemory(string id)
    {
        int index = Data.Memories.FindIndex(x => x.Id == id); if (index < 0) throw new ArgumentException("Запись не найдена.");
        var item = Data.Memories[index]; Data.Memories.RemoveAt(index);
        try { Save(); } catch { Data.Memories.Insert(index, item); throw; }
    }

    public void RenameChat(string id, string title)
    {
        var chat = Data.Chats.Find(c => c.Id == id) ?? throw new ArgumentException("Чат не найден.");
        title = title.Trim();
        if (title.Length is < 1 or > 120 || title.Any(char.IsControl)) throw new ArgumentException("Название должно содержать от 1 до 120 символов.");
        string old = chat.Title; chat.Title = title;
        try { Save(); } catch { chat.Title = old; throw; }
    }
    public void DeleteChat(string id)
    {
        int index = Data.Chats.FindIndex(c => c.Id == id);
        if (index < 0) throw new ArgumentException("Чат не найден.");
        var chat = Data.Chats[index];
        Data.Histories.TryGetValue(id, out var history);
        Data.HistoryRoutes.TryGetValue(id, out var historyRoute);
        Data.Chats.RemoveAt(index); Data.Histories.Remove(id); Data.HistoryRoutes.Remove(id);
        try { Save(); }
        catch { Data.Chats.Insert(index, chat); if (history is not null) Data.Histories[id] = history; if (historyRoute is not null) Data.HistoryRoutes[id] = historyRoute; throw; }
    }
    public ChatEntry FindOrCreate(string id, string text, IReadOnlyList<Attachment> attachments)
    {
        var existing = Data.Chats.Find(c => c.Id == id);
        if (existing is not null) return existing;
        string preview = string.IsNullOrWhiteSpace(text) ? string.Join(", ", attachments.Select(a => a.Name)) : text.Trim();
        var chat = new ChatEntry { Id = id, Title = preview.Length > 36 ? preview[..36] + "…" : preview, Preview = preview };
        Data.Chats.Insert(0, chat);
        return chat;
    }
}
