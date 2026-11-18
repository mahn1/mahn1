using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Elisa.Desktop;

static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
static void Reject(Action action, string message) { try { action(); } catch (Exception ex) when (ex is ArgumentException or UnauthorizedAccessException or IOException) { return; } throw new Exception(message); }
const string toolReply = """{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call-1","type":"function","function":{"name":"run_powershell","arguments":"{\"command\":\"Get-Location\"}"}}]}}]}""";
const string answerReply = """{"choices":[{"message":{"role":"assistant","content":"Готово"}}]}""";

string temp = Path.Combine(Path.GetTempPath(), "elisa-test-" + Guid.NewGuid());
string root = Path.Combine(temp, "work"), outside = Path.Combine(temp, "work-other");
Directory.CreateDirectory(root); Directory.CreateDirectory(outside);
try
{
    var spaces = new Workspaces(Path.Combine(temp, "settings.json"));
    spaces.Add(root);
    spaces.Add(root);
    Assert(spaces.Settings.Paths.Count == 1, "duplicate workspace");
    JsonObject Args(string path) => new() { ["workspace"] = 1, ["path"] = path };
    spaces.Execute("write_file", new JsonObject { ["workspace"] = 1, ["path"] = "sample.txt", ["content"] = "Привет" });
    Assert(spaces.Execute("read_file", Args("sample.txt")) == "Привет", "file round trip");
    Assert(spaces.Execute("list_files", Args("")).Contains("sample.txt"), "directory listing");
    spaces.Execute("create_directory", Args("nested/dir"));
    Assert(Directory.Exists(Path.Combine(root, "nested", "dir")), "directory creation");
    Reject(() => spaces.Execute("read_file", Args("../work-other/secret.txt")), "traversal accepted");
    Reject(() => spaces.Execute("write_file", new JsonObject { ["workspace"] = 1, ["path"] = Path.Combine(outside, "x.txt"), ["content"] = "x" }), "absolute path accepted");
    Reject(() => spaces.Execute("read_file", Args("sample.txt:stream")), "ADS accepted");
    Reject(() => spaces.Execute("read_file", Args("NUL.txt")), "device name accepted");
    Reject(() => spaces.Execute("read_file", new JsonObject { ["workspace"] = 2, ["path"] = "" }), "unknown workspace accepted");
    // Windows may disallow symlink creation for an unprivileged runner.
    try { Directory.CreateSymbolicLink(Path.Combine(root, "link"), outside); }
    catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or PlatformNotSupportedException) { }
    if (Directory.Exists(Path.Combine(root, "link"))) Reject(() => spaces.Execute("list_files", Args("link")), "symlink accepted");
    Assert(new Workspaces(Path.Combine(temp, "settings.json")).Settings.Paths.Count == 1, "settings not persisted");
    Assert(ChatFileAccess.Resolve("sample.txt", spaces, outside) == Path.Combine(root, "sample.txt"), "workspace file not resolved");
    Assert(ChatFileAccess.Resolve(new Uri(Path.Combine(root, "sample.txt")).AbsoluteUri, spaces, outside) == Path.Combine(root, "sample.txt"), "file URI not resolved");
    File.WriteAllText(Path.Combine(outside, "outside.txt"), "outside");
    Reject(() => ChatFileAccess.Resolve(Path.Combine(outside, "outside.txt"), spaces, outside), "outside file opened in workspace mode");
    Assert(ChatFileAccess.CanOpenDirectly("cat.svg") && !ChatFileAccess.CanOpenDirectly("script.bat"), "unsafe file policy failed");
    spaces.SetUnrestricted(true);
    Reject(() => ChatFileAccess.Resolve("sample.txt:stream", spaces, outside), "file ADS accepted");
    Assert(ChatFileAccess.Resolve("outside.txt", spaces, outside) == Path.Combine(outside, "outside.txt"), "desktop file not resolved");
    var library = new LocalLibrary(Path.Combine(temp, "library")); library.Ensure();
    Assert(Directory.Exists(Path.Combine(library.Root, "Projects")) && Directory.Exists(Path.Combine(library.Root, "Notes")) && Directory.Exists(Path.Combine(library.Root, "Exports")), "library folders missing");
    spaces.SetUnrestricted(false);

    async Task CheckPowerShellAsync(bool enabled)
    {
        spaces.SetUnrestricted(enabled);
        int executed = 0;
        var handler = new FakeHandler(toolReply, answerReply);
        var events = new List<string>();
        using var agent = new Agent(x => events.Add(JsonSerializer.Serialize(x)), spaces, new HttpClient(handler),
            (command, token) => { Assert(events.Any(e => e.Contains("tool_start") && e.Contains("Get-Location")), "command not shown before execution"); executed++; return Task.FromResult("успех"); });
        agent.Configure("secret", "test/model");
        await agent.RunAsync("chat-1", "Проверь папку");
        Assert(executed == (enabled ? 1 : 0), "PowerShell mode not enforced");
        Assert(events.Any(e => e.Contains("tool_start") && e.Contains("Get-Location")) && events.Any(e => e.Contains("tool_finish")) && events.Any(e => e.Contains("answer")), "missing live events");
        var begin = events.FindIndex(e => e.Contains("tool_start"));
        var end = events.FindIndex(e => e.Contains("tool_finish"));
        Assert(JsonNode.Parse(events[begin])!["toolComment"]!.GetValue<string>() == "Просматриваю расположение и содержимое", "fallback comment missing");
        Assert(begin >= 0 && end > begin && events[end].Contains(enabled ? "done" : "error"), "wrong event order or status");
        Assert(handler.Requests.Count == 2 && !handler.Requests.Any(r => r.Contains("secret")), "requests or key");
        var first = JsonNode.Parse(handler.Requests[0])!;
        Assert(first["tools"]!.AsArray().Any(t => t?["function"]?["name"]?.GetValue<string>() == "run_powershell") == enabled, "wrong tool exposure");
        Assert(first["tools"]![0]!["function"]!["parameters"]!["properties"]!["comment"] is not null, "comment missing from tool schema");
        var result = JsonNode.Parse(handler.Requests[1])!["messages"]!.AsArray().Last()!;
        Assert(result["role"]!.GetValue<string>() == "tool" && result["tool_call_id"]!.GetValue<string>() == "call-1", "missing tool result");
        Assert(result["content"]!.GetValue<string>().Contains(enabled ? "успех" : "выключен"), "wrong result");
    }
    await CheckPowerShellAsync(false);
    await CheckPowerShellAsync(true);
    const string commentedReply = """{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call-2","type":"function","function":{"name":"run_powershell","arguments":"{\"command\":\"Get-Location\",\"comment\":\"Checking workspace\"}"}}]}}]}""";
    var commentEvents = new List<string>();
    using (var commenting = new Agent(e => commentEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(new FakeHandler(commentedReply, answerReply)), (command, token) => Task.FromResult("ok")))
    {
        commenting.Configure("secret", "test/model");
        await commenting.RunAsync("comment", "test");
        var startEvent = commentEvents.Select(e => JsonNode.Parse(e)).First(n => n?["type"]?.GetValue<string>() == "tool_start");
        Assert(startEvent!["toolComment"]!.GetValue<string>() == "Checking workspace", "custom comment not forwarded");
    }
    var failureEvents = new List<string>();
    using (var failing = new Agent(e => failureEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(new FakeHandler(toolReply, answerReply)),
        (command, token) => Task.FromResult("Код выхода: 1\nstdout:\n\nstderr:\nfail")))
    {
        failing.Configure("secret", "test/model");
        await failing.RunAsync("failed", "test");
        Assert(failureEvents.Any(e => e.Contains("tool_finish") && e.Contains("error")), "nonzero exit not reported as error");
    }
    var cancelledEvents = new List<string>();
    using (var cancelled = new Agent(e => cancelledEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(new FakeHandler(toolReply)),
        (command, token) => throw new OperationCanceledException()))
    {
        cancelled.Configure("secret", "test/model");
        try { await cancelled.RunAsync("cancelled", "test"); throw new Exception("cancellation was ignored"); } catch (OperationCanceledException) { }
        Assert(cancelledEvents.Any(e => e.Contains("tool_finish") && e.Contains("interrupted")), "interrupted tool was not reported");
    }
    using (var agent = new Agent(_ => {}, spaces, new HttpClient(new FakeHandler(answerReply))))
    {
        try { await agent.RunAsync("c", "test"); throw new Exception("missing key accepted"); } catch (InvalidOperationException) { }
        agent.Configure("secret", "test/model");
        agent.Configure("", "another/model");
        await agent.RunAsync("c", "hello");
    }
    // Persistence and model history survive a fresh agent instance under the same Windows user.
    string storePath = Path.Combine(temp, "encrypted-state.dat");
    var store = new LocalStore(storePath);
    var firstHandler = new FakeHandler(answerReply);
    using (var first = new Agent(_ => {}, spaces, new HttpClient(firstHandler), store: store))
    {
        first.Configure("sk-secret-test", "saved/model");
        store.FindOrCreate("persisted", "Привет", []).Messages.Add(new ChatItem { Role = "user", Text = "Привет" });
        store.Save();
        await first.RunAsync("persisted", "Привет");
    }
    Assert(!Encoding.UTF8.GetString(File.ReadAllBytes(storePath)).Contains("sk-secret-test"), "plaintext secret stored");
    var restored = new LocalStore(storePath);
    Assert(restored.Data.ApiKey == "sk-secret-test" && restored.Data.Model == "saved/model", "credentials not restored");
    Assert(restored.Data.Chats.Count == 1 && restored.Data.Chats[0].Messages[0].Text == "Привет", "chat not restored");
    restored.Data.Chats[0].Messages.Add(new ChatItem { Role = "tool_start", ToolId = "abc", ToolName = "run_powershell", ToolComment = "Просматриваю папку", Command = "Get-Location", ToolStatus = "running" });
    restored.Save();
    var afterRestart = new LocalStore(storePath);
    Assert(afterRestart.Data.Chats[0].Messages[^1].ToolStatus == "interrupted" && afterRestart.Data.Chats[0].Messages[^1].Command == "Get-Location" && afterRestart.Data.Chats[0].Messages[^1].ToolComment == "Просматриваю папку", "unfinished activity not restored");
    Assert(restored.RecordUsage(JsonNode.Parse("""{"model":"vendor/a","usage":{"prompt_tokens":100,"completion_tokens":20,"total_tokens":120}}""")!, "fallback"), "usage not recorded");
    Assert(restored.RecordUsage(JsonNode.Parse("""{"model":"vendor/a","usage":{"prompt_tokens":10,"completion_tokens":5}}""")!, "fallback"), "usage without total not recorded");
    Assert(!restored.RecordUsage(JsonNode.Parse("""{"model":"vendor/b"}""")!, "fallback"), "missing usage counted");
    restored.Save();
    var usageReloaded = new LocalStore(storePath);
    Assert(usageReloaded.Data.Usage["vendor/a"].TotalTokens == 135 && usageReloaded.Data.Usage["vendor/a"].Requests == 2, "usage not persisted correctly");
    restored.RenameChat("persisted", "Новый заголовок");
    Assert(new LocalStore(storePath).Data.Chats[0].Title == "Новый заголовок", "rename did not persist");
    var tempChat = restored.FindOrCreate("to-delete", "delete", []); restored.Data.Histories[tempChat.Id] = new JsonArray(); restored.Save();
    restored.DeleteChat("to-delete");
    var deletedReload = new LocalStore(storePath);
    Assert(deletedReload.Data.Chats.All(c=>c.Id!="to-delete") && !deletedReload.Data.Histories.ContainsKey("to-delete"), "delete did not remove chat and model history");
    var nextHandler = new FakeHandler(answerReply);
    using (var next = new Agent(_ => {}, spaces, new HttpClient(nextHandler), store: restored)) await next.RunAsync("persisted", "Продолжим");
    var history = JsonNode.Parse(nextHandler.Requests[0])!["messages"]!.AsArray();
    Assert(history.Count == 4 && history[1]!["content"]!.GetValue<string>() == "Привет", "context not restored");
    Assert(history[0]!["content"]!.GetValue<string>().Contains("оркестратор"), "orchestrator instructions missing from saved chat");
    File.WriteAllText(Path.Combine(temp, "broken.dat"), "broken state");
    var broken = new LocalStore(Path.Combine(temp, "broken.dat"));
    Assert(broken.LoadError is not null, "corrupt state not reported");
    Reject(() => broken.Save(), "corrupt state overwritten");

    var attachments = new List<Attachment> {
        new("paste.txt", "text/plain", Encoding.UTF8.GetBytes("большой текст")),
        new("image.png", "image/png", new byte[] { 1, 2, 3 }),
        new("data.bin", "application/octet-stream", new byte[] { 0, 1, 2 }),
        new("document.pdf", "application/pdf", new byte[] { 37, 80, 68, 70 })
    };
    var parts = Attachments.BuildContent("Проверь", attachments).AsArray();
    Assert(parts[1]!["text"]!.GetValue<string>().Contains("большой текст"), "text attachment missing");
    Assert(parts[2]!["image_url"]!["url"]!.GetValue<string>().StartsWith("data:image/png;base64,"), "image not attached");
    Assert(parts[3]!["file"]!["filename"]!.GetValue<string>() == "data.bin", "binary not attached");
    Assert(parts[4]!["file"]!["file_data"]!.GetValue<string>().StartsWith("data:application/pdf;base64,"), "pdf not attached");
    const string usageReply = """{"model":"vendor/real-model","usage":{"prompt_tokens":33,"completion_tokens":7,"total_tokens":40},"choices":[{"message":{"role":"assistant","content":"OK"}}]}""";
    var usageEvents = new List<string>();
    using (var usageAgent = new Agent(e => usageEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(new FakeHandler(usageReply)), store: restored)) await usageAgent.RunAsync("usage-chat", "Hello");
    Assert(restored.Data.Usage["vendor/real-model"].TotalTokens == 40 && usageEvents.Any(e=>e.Contains("usage_updated")), "response usage not captured");
    Assert(usageEvents.Any(e=>e.Contains("thinking_start")) && usageEvents.Any(e=>e.Contains("thinking_finish")), "thinking timer events missing");
    var attachHandler = new FakeHandler(answerReply);
    using (var attaching = new Agent(_ => {}, spaces, new HttpClient(attachHandler), store: restored)) await attaching.RunAsync("file-chat", "", attachments);
    var payload = JsonNode.Parse(attachHandler.Requests[0])!;
    Assert(payload["messages"]!.AsArray().Last()!["content"]!.AsArray().Count == 5, "attachments not sent");
    Assert(payload["plugins"]![0]!["pdf"]!["engine"]!.GetValue<string>() == "cloudflare-ai", "pdf parser not configured");
    Console.WriteLine("Agent, workspace, attachment and persistence tests passed");
}
finally { Directory.Delete(temp, recursive: true); }

sealed class FakeHandler(params string[] responses) : HttpMessageHandler
{
    private int index;
    public List<string> Requests { get; } = [];
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(await request.Content!.ReadAsStringAsync(cancellationToken));
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(responses[index++], Encoding.UTF8, "application/json") };
    }
}
