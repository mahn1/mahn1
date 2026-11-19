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
    using (var response = new HttpResponseMessage(HttpStatusCode.OK))
    {
        string sse = "data: {\"choices\":[{\"delta\":{\"content\":\"Hi \"}}]}\n\n" +
            "data: {\"choices\":[{\"delta\":{\"content\":\"there\",\"tool_calls\":[{\"index\":0,\"id\":\"c1\",\"type\":\"function\",\"function\":{\"name\":\"read_\",\"arguments\":\"{\\\"a\\\":\"}}]}}]}\n\n" +
            "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"name\":\"file\",\"arguments\":\"1}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n" +
            "data: [DONE]\n\n";
        response.Content = new StringContent(sse, Encoding.UTF8, "text/event-stream");
        string partial = ""; var streamed = await ChatStreaming.ReadAsync(response, part => partial += part, CancellationToken.None);
        var msg = streamed["choices"]![0]!["message"]!;
        Assert(partial == "Hi there" && msg["content"]!.GetValue<string>() == partial, "stream text assembly");
        Assert(msg["tool_calls"]![0]!["function"]!["name"]!.GetValue<string>() == "read_file" && msg["tool_calls"]![0]!["function"]!["arguments"]!.GetValue<string>() == "{\"a\":1}", "stream tool assembly");
    }
    var reasoningBlocks = new JsonArray();
    ChatStreaming.AppendReasoning(reasoningBlocks, JsonNode.Parse("{\"type\":\"reasoning.text\",\"index\":0,\"text\":\"A\"}")!.AsObject());
    ChatStreaming.AppendReasoning(reasoningBlocks, JsonNode.Parse("{\"type\":\"reasoning.text\",\"index\":0,\"signature\":\"sig\"}")!.AsObject());
    ChatStreaming.AppendReasoning(reasoningBlocks, JsonNode.Parse("{\"type\":\"reasoning.text\",\"index\":0,\"text\":\"B\"}")!.AsObject());
    Assert(reasoningBlocks.Count == 2 && reasoningBlocks[0]!["signature"]!.GetValue<string>() == "sig", "signed reasoning blocks combined");
    using (var response = new HttpResponseMessage(HttpStatusCode.OK))
    {
        response.Content = new StringContent("data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n", Encoding.UTF8, "text/event-stream");
        bool rejected = false; try { await ChatStreaming.ReadAsync(response, _ => { }, CancellationToken.None); } catch (IOException) { rejected = true; }
        Assert(rejected, "truncated stream accepted");
    }
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
    // Real orchestration protocol: isolated child context, visible nested tool, result returned to parent.
    static string ReplyWithTool(string name, string id, object args) => JsonSerializer.Serialize(new { choices = new[] { new { message = new { role = "assistant", content = (string?)null, tool_calls = new[] { new { id, type = "function", function = new { name, arguments = JsonSerializer.Serialize(args) } } } } } } });
    var orchestratorHandler = new FakeHandler(
        ReplyWithTool("delegate_agent", "delegate-1", new { role = "research", task = "Изучи список PR" }),
        ReplyWithTool("github_cli", "github-1", new { args = new[] { "pr", "list", "--repo", "owner/repo" }, workspace = 0 }),
        """{"choices":[{"message":{"role":"assistant","content":"Найдены два PR"}}]}""",
        """{"choices":[{"message":{"role":"assistant","content":"Итог"}}]}""");
    var orchestrationEvents = new List<string>(); var ghCalls = 0;
    using (var orchestra = new Agent(e=>orchestrationEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(orchestratorHandler), store: restored,
        runGithub: (arguments, folder, ct) => { ghCalls++; Assert(arguments.SequenceEqual(new[] { "pr", "list", "--repo", "owner/repo" }), "wrong gh args"); return Task.FromResult("Код выхода: 0\nstdout:\nдва PR\nstderr:\n"); }))
        await orchestra.RunAsync("orchestra", "Проверь PR");
    Assert(ghCalls == 1 && orchestratorHandler.Requests.Count == 4, "orchestration did not execute child");
    var childRequest = JsonNode.Parse(orchestratorHandler.Requests[1])!;
    Assert(childRequest["messages"]!.AsArray().Count == 2 && childRequest["messages"]![1]!["content"]!.GetValue<string>() == "Изучи список PR", "child context not isolated");
    Assert(!childRequest["tools"]!.AsArray().Any(t => t?["function"]?["name"]?.GetValue<string>() == "delegate_agent"), "nested delegation exposed");
    var parentContinuation = JsonNode.Parse(orchestratorHandler.Requests[3])!;
    Assert(parentContinuation["messages"]!.AsArray().Last()!["content"]!.GetValue<string>() == "Найдены два PR", "child output not returned");
    Assert(orchestrationEvents.Any(e => e.Contains("delegate_agent") && e.Contains("tool_start")) && orchestrationEvents.Any(e => e.Contains("github_cli") && e.Contains("tool_start")), "subagent actions not visible");
    try { await GitHubCli.RunAsync(new[] { "auth", "token" }, root, CancellationToken.None); throw new Exception("token command accepted"); } catch (UnauthorizedAccessException) { }

    byte[] png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    File.WriteAllBytes(Path.Combine(root, "preview.png"), png);
    Assert(ChatImages.FromBytes("cat.png", png)?.DataUrl.StartsWith("data:image/png;base64,") == true, "png preview missing");
    Assert(ChatImages.FromBytes("bad.svg", Encoding.UTF8.GetBytes("<svg/>")) is null, "unsafe svg accepted");
    spaces.SetUnrestricted(false);
    var imageHandler = new FakeHandler(ReplyWithTool("attach_image", "image-1", new { path = "preview.png" }), answerReply);
    var imageEvents = new List<string>();
    using (var imageAgent = new Agent(e=>imageEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(imageHandler), store: restored)) await imageAgent.RunAsync("image-chat", "Покажи");
    Assert(imageEvents.Any(e => e.Contains("assistant_image") && e.Contains("data:image/png;base64,")), "image tool did not emit preview");
    Reject(() => ChatImages.FromFile(Path.Combine(outside, "outside.txt"), spaces), "image outside workspace allowed");
    restored.Data.Chats[0].Messages.Add(new ChatItem { Role = "assistant_image", Images = [ChatImages.FromBytes("cat.png", png)!] }); restored.Save();
    Assert(new LocalStore(storePath).Data.Chats[0].Messages[^1].Images[0].DataUrl.StartsWith("data:image/png"), "image preview not persisted");
    // Provider settings migrate the legacy OpenRouter key, isolate secrets and route each agent.
    var dualStore = new LocalStore(Path.Combine(temp, "dual-state.dat"));
    var dualHandler = new FakeHandler(
        ReplyWithTool("delegate_agent", "d-route", new { role = "research", task = "Исследуй" }),
        """{"model":"deepseek-ai/deepseek-v4.1-flash","usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6},"choices":[{"message":{"role":"assistant","content":"Отчёт"}}]}""",
        """{"choices":[{"message":{"role":"assistant","content":"Итог"}}]}""");
    using (var dual = new Agent(_=>{}, spaces, new HttpClient(dualHandler), store: dualStore))
    {
        dual.Configure("or-secret", "or-model");
        dual.ConfigureProviders("openrouter", "", "or-model", "nv-secret", "deepseek-ai/deepseek-v4.1-flash", new() { ["research"] = new AgentRoute { Provider = "nvidia", Model = "" } });
        await dual.RunAsync("dual", "Исследуй");
    }
    Assert(dualHandler.Uris[0].Host == "openrouter.ai" && dualHandler.Uris[1].Host == "integrate.api.nvidia.com" && dualHandler.Uris[2].Host == "openrouter.ai", "wrong provider routing");
    Assert(dualHandler.Auth[0] == "or-secret" && dualHandler.Auth[1] == "nv-secret" && dualHandler.Auth[2] == "or-secret", "provider key crossed endpoints");
    Assert(JsonNode.Parse(dualHandler.Requests[1])!["model"]!.GetValue<string>() == "deepseek-ai/deepseek-v4.1-flash", "wrong child model");
    Assert(dualStore.Data.Usage["NVIDIA · deepseek-ai/deepseek-v4.1-flash"].TotalTokens == 6, "nvidia usage not attributed");
    var dualReloaded = new LocalStore(Path.Combine(temp, "dual-state.dat"));
    Assert(dualReloaded.Data.ApiKey == "or-secret" && dualReloaded.Data.NvidiaApiKey == "nv-secret" && dualReloaded.Data.AgentRoutes["research"].Provider == "nvidia", "provider config not persisted");
    Assert(!Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(temp, "dual-state.dat"))).Contains("nv-secret"), "nvidia key not encrypted");
    var portable = ProviderSettings.PortableHistory(JsonNode.Parse("""[{"role":"assistant","content":"ok","reasoning_details":[{"secret":"provider"}]}]""")!.AsArray());
    Assert(portable[0]!["content"]!.GetValue<string>() == "ok" && portable[0]!["reasoning_details"] is null, "provider-specific metadata not removed");
    var nvHandler = new FakeHandler(answerReply);
    using (var nv = new Agent(_=>{}, spaces, new HttpClient(nvHandler), store: dualReloaded))
    {
        nv.ConfigureProviders("nvidia", "", "or-model", "", "deepseek-ai/deepseek-v4.1-flash", new());
        await nv.RunAsync("dual", "продолжи");
        Assert(nvHandler.Uris[0].Host == "integrate.api.nvidia.com" && !JsonNode.Parse(nvHandler.Requests[0])!.AsObject().ContainsKey("plugins"), "NVIDIA request incorrectly uses OpenRouter options");
        try { await nv.RunAsync("nvidia-pdf", "file", attachments); throw new Exception("unsupported NVIDIA attachment accepted"); } catch (InvalidOperationException ex) { Assert(ex.Message.Contains("PDF"), "wrong NVIDIA file error"); }
    }
    Assert(nvHandler.Requests.Count == 1, "unsupported file was sent to NVIDIA");
    // Arena settings work for both the main agent and role overrides; keys never cross endpoints.
    var arenaStore = new LocalStore(Path.Combine(temp, "arena-state.dat"));
    var arenaHandler = new FakeHandler(ReplyWithTool("delegate_agent", "arena-delegate", new { role = "research", task = "Исследуй" }),
        """{"choices":[{"message":{"role":"assistant","content":"child"}}]}""",
        """{"model":"coding-router-preview","usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8},"choices":[{"message":{"role":"assistant","content":"done"}}]}""");
    using (var arenaAgent = new Agent(_ => { }, spaces, new HttpClient(arenaHandler), store: arenaStore))
    {
        arenaAgent.ConfigureProviders("arena", "or-key", "or-model", "nv-key", "nv-model", new() { ["research"] = new AgentRoute { Provider = "openrouter", Model = "or-child" } }, "arena-key", "coding-router-preview");
        await arenaAgent.RunAsync("arena-chat", "Исследуй");
    }
    Assert(arenaHandler.Uris.Select(u => u.Host).SequenceEqual(new[] { "api.arena.ai", "openrouter.ai", "api.arena.ai" }), "Arena endpoint/role routing");
    Assert(arenaHandler.Uris[0].AbsolutePath == "/v1/chat/completions" && arenaHandler.Auth.SequenceEqual(new[] { "arena-key", "or-key", "arena-key" }), "Arena key crossed endpoints");
    var arenaRequest = JsonNode.Parse(arenaHandler.Requests[0])!;
    Assert(arenaRequest["model"]!.GetValue<string>() == "coding-router-preview" && arenaRequest["stream"]!.GetValue<bool>() && arenaRequest["plugins"] is null && arenaRequest["stream_options"] is null, "Arena request incorrect");
    Assert(arenaStore.Data.Usage["Arena · coding-router-preview"].TotalTokens == 8 && arenaStore.Data.DailyUsage["arena"].Requests == 2, "Arena usage not isolated");
    var arenaReloaded = new LocalStore(Path.Combine(temp, "arena-state.dat"));
    Assert(arenaReloaded.Data.ArenaApiKey == "arena-key" && arenaReloaded.Data.ArenaModel == "coding-router-preview" && arenaReloaded.Data.ApiKey == "or-key" && arenaReloaded.Data.NvidiaApiKey == "nv-key", "Arena state migration/persistence");
    Assert(!Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(temp, "arena-state.dat"))).Contains("arena-key"), "Arena key not protected");
    var childArena = new FakeHandler(ReplyWithTool("delegate_agent", "d-arena", new { role = "research", task = "test" }), answerReply, answerReply);
    using (var a = new Agent(_ => { }, spaces, new HttpClient(childArena), store: arenaReloaded))
    {
        a.ConfigureProviders("openrouter", "", "or-model", "", "nv-model", new() { ["research"] = new AgentRoute { Provider = "arena", Model = "custom-arena" } });
        await a.RunAsync("child-arena", "test");
        Assert(childArena.Uris[1].Host == "api.arena.ai" && childArena.Auth[1] == "arena-key" && JsonNode.Parse(childArena.Requests[1])!["model"]!.GetValue<string>() == "custom-arena", "Arena agent role routing");
        a.ConfigureProviders("arena", "", "or-model", "", "nv-model", new());
        try { await a.RunAsync("arena-pdf", "file", attachments); throw new Exception("unsupported Arena attachment accepted"); } catch (InvalidOperationException ex) { Assert(ex.Message.Contains("PDF"), "wrong Arena attachment error"); }
    }
    Assert(childArena.Uris.Count == 3, "unsupported Arena file sent");
    var oldData = JsonSerializer.Deserialize<SavedState>("""{"ApiKey":"old","Model":"or-old"}""")!;
    Assert(oldData.ArenaApiKey == "" && oldData.ArenaModel == "coding-router-preview" && ProviderSettings.Resolve(oldData).Key == "old", "old state migration");
    var arenaStreamEvents = new List<string>();
    using (var a = new Agent(e => arenaStreamEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(new ArenaStreamHandler()), store: arenaReloaded)) await a.RunAsync("arena-stream", "hello");
    Assert(arenaStreamEvents.Any(e => e.Contains("stream_delta")) && arenaStreamEvents.Any(e => e.Contains("answer")), "Arena stream not displayed");
    var arenaLimits = new LocalStore(persist: false); ProviderBudget.SetCaps(arenaLimits, "arena", 1, 0); ProviderBudget.Begin(arenaLimits, "arena");
    try { ProviderBudget.Begin(arenaLimits, "arena"); throw new Exception("Arena request limit ignored"); } catch (InvalidOperationException) { }
    var pyCheck = await PythonRunner.RunAsync(new[] { "-c", "print('elisa-python-ok')" }, root, false, CancellationToken.None);
    Assert(pyCheck.Contains("Код выхода: 0") && pyCheck.Contains("elisa-python-ok"), "Python execution failed");
    var pyVenv = await PythonRunner.RunAsync(new[] { "-m", "venv", ".venv" }, root, false, CancellationToken.None);
    Assert(pyVenv.Contains("Код выхода: 0"), "Python venv creation failed: " + pyVenv);
    var pyVenvCheck = await PythonRunner.RunAsync(new[] { "-c", "import sys; print(sys.prefix)" }, root, true, CancellationToken.None);
    Assert(pyVenvCheck.Contains("Код выхода: 0") && pyVenvCheck.Contains(".venv"), "venv not used");
    var pyEvents = new List<string>(); var pyCalls = 0;
    var pyHandler = new FakeHandler(ReplyWithTool("python_run", "py-1", new { args = new[] { "-c", "print(1)" }, workspace = 1, useVenv = false }), answerReply);
    spaces.SetUnrestricted(true);
    using (var pyAgent = new Agent(e=>pyEvents.Add(JsonSerializer.Serialize(e)), spaces, new HttpClient(pyHandler), store: restored,
        runPython: (arguments, folder, venv, ct) => { pyCalls++; Assert(folder == root && !venv, "wrong Python working directory"); return Task.FromResult("Код выхода: 0\nstdout:\n1\nstderr:\n"); })) await pyAgent.RunAsync("py-chat", "run");
    Assert(pyCalls == 1 && pyEvents.Any(e=>e.Contains("python_run") && e.Contains("tool_finish") == false), "python tool did not run");
    spaces.SetUnrestricted(false);
    var pyBlockedHandler = new FakeHandler(ReplyWithTool("python_run", "py-2", new { args = new[] { "-c", "print(1)" }, workspace = 1, useVenv = false }), answerReply);
    using (var pyBlocked = new Agent(_=>{}, spaces, new HttpClient(pyBlockedHandler), store: restored, runPython: (arguments, folder, venv, ct) => { throw new Exception("restricted Python ran"); })) await pyBlocked.RunAsync("blocked-py", "run");
    Assert(JsonNode.Parse(pyBlockedHandler.Requests[1])!["messages"]!.AsArray().Last()!["content"]!.GetValue<string>().Contains("Полный доступ выключен"), "restricted Python not rejected");
    // Memory persists and context compaction never mutates the original or splits tool exchanges.
    var memoryStore = new LocalStore(Path.Combine(temp, "mem-state.dat")); memoryStore.AddMemory("Предпочитаю русский язык");
    Assert(new LocalStore(Path.Combine(temp, "mem-state.dat")).Data.Memories.Single().Text == "Предпочитаю русский язык", "memory not persisted");
    var longHistory = new JsonArray(new JsonObject { ["role"] = "system", ["content"] = "system" });
    for (int n=0;n<6;n++) { longHistory.Add(new JsonObject { ["role"]="user", ["content"]="Вопрос "+n+" "+new string('x',500) }); longHistory.Add(new JsonObject { ["role"]="assistant", ["content"]="Ответ "+n }); }
    string originalHistory=longHistory.ToJsonString(); var shortHistory=ChatContext.Prepare(longHistory,memoryStore.Data.Memories,out bool compacted,1000);
    Assert(compacted && longHistory.ToJsonString()==originalHistory && shortHistory.Count==7, "context compaction damaged history");
    Assert(shortHistory[0]!["content"]!.GetValue<string>().Contains("Предпочитаю русский") && shortHistory[0]!["content"]!.GetValue<string>().Contains("Вопрос 0"), "context summary or memory missing");
    memoryStore.RemoveMemory(memoryStore.Data.Memories[0].Id); Assert(new LocalStore(Path.Combine(temp, "mem-state.dat")).Data.Memories.Count==0,"memory deletion not persisted");

    Directory.CreateDirectory(Path.Combine(root,"src")); File.WriteAllText(Path.Combine(root,"src","search.py"),"def unique_feline_search():\n    return 42\n");
    File.WriteAllText(Path.Combine(root,"credentials.json"),"unique_feline_search secret");
    Directory.CreateDirectory(Path.Combine(root,"node_modules")); File.WriteAllText(Path.Combine(root,"node_modules","skip.py"),"unique_feline_search");
    string indexed=ProjectIndex.Search(spaces,1,"unique_feline_search",CancellationToken.None);
    Assert(indexed.Contains("search.py") && !indexed.Contains("credentials.json") && !indexed.Contains("skip.py"),"project index included excluded files or missed code");
    Assert(ProjectIndex.Overview(spaces,1,CancellationToken.None).Contains("search.py"),"project overview missing file");
    var budgetStore=new LocalStore(persist:false); ProviderBudget.SetCaps(budgetStore,"openrouter",1,0); ProviderBudget.Begin(budgetStore,"openrouter");
    try { ProviderBudget.Begin(budgetStore,"openrouter"); throw new Exception("request budget ignored"); } catch(InvalidOperationException) { }
    ProviderBudget.SetCaps(budgetStore,"openrouter",0,10); ProviderBudget.AddUsage(budgetStore,"openrouter",JsonNode.Parse("""{"usage":{"total_tokens":11}}""")!);
    try { ProviderBudget.Begin(budgetStore,"openrouter"); throw new Exception("token budget ignored"); } catch(InvalidOperationException) { }
    var quotaHandler = new QuotaHandler(); var quota = JsonSerializer.Serialize(await ProviderBudget.OpenRouterQuotaAsync(new HttpClient(quotaHandler),"quota-secret",CancellationToken.None));
    Assert(quotaHandler.Host=="openrouter.ai" && quotaHandler.Key=="quota-secret" && quota.Contains("remaining") && !quota.Contains("quota-secret"), "quota response or key handling failed");

    var parallelHandler=new ParallelHandler(ReplyWithTool("delegate_parallel", "parallel-1", new { tasks=new[] { new { role="research", task="Изучи A" }, new { role="review", task="Изучи B" } } }));
    var parallelEvents=new System.Collections.Concurrent.ConcurrentQueue<string>();
    using(var parallelAgent=new Agent(e=>parallelEvents.Enqueue(JsonSerializer.Serialize(e)), spaces, new HttpClient(parallelHandler), store:restored)) await parallelAgent.RunAsync("parallel", "Проверь проект");
    Assert(parallelHandler.ChildRequests==2 && parallelHandler.MaxConcurrent==2, "agents were not actually concurrent");
    Assert(parallelHandler.ChildBodies.All(body=>!JsonNode.Parse(body)!["tools"]!.AsArray().Any(t => new[] { "run_powershell", "write_file", "github_cli" }.Contains(t?["function"]?["name"]?.GetValue<string>()))), "parallel agent has write tools");
    Assert(parallelEvents.Any(e=>e.Contains("delegate_parallel") && e.Contains("tool_start")), "parallel action not visible");

    var maliciousReply=ReplyWithTool("write_file", "bad-write", new { workspace=1, path="parallel-should-not-exist.txt", content="bad" });
    var maliciousHandler=new ParallelHandler(ReplyWithTool("delegate_parallel", "parallel-2", new { tasks=new[] { new { role="research", task="A" }, new { role="review", task="B" } } }), maliciousReply);
    using(var readOnlyAgent=new Agent(_=>{}, spaces, new HttpClient(maliciousHandler), store:restored)) await readOnlyAgent.RunAsync("parallel-restrictions", "Проверь");
    Assert(!File.Exists(Path.Combine(root,"parallel-should-not-exist.txt")), "parallel agent bypassed read-only enforcement");

    string checkDir=Path.Combine(temp,"checks"); Directory.CreateDirectory(checkDir);
    File.WriteAllText(Path.Combine(checkDir,"package.json"), """{"scripts":{"test":"node -e \"console.log('verified')\""}}""");
    string verification=await ProjectChecks.VerifyAsync(checkDir,CancellationToken.None);
    Assert(verification.Contains("verified") && verification.Contains("Код выхода: 0"), "project test command failed: "+verification);
    File.WriteAllText(Path.Combine(root,"package.json"), """{"scripts":{"test":"node -e \"console.log('auto-check-ok')\""}}""");
    var autoHandler=new FakeHandler(ReplyWithTool("write_file", "write-auto", new { workspace=1, path="autocheck.py", content="print(42)" }), answerReply, answerReply);
    var autoEvents=new List<string>(); spaces.SetUnrestricted(true);
    using(var autoAgent=new Agent(e=>autoEvents.Add(JsonSerializer.Serialize(e)),spaces,new HttpClient(autoHandler),store:restored)) await autoAgent.RunAsync("auto-check", "Измени код");
    Assert(autoHandler.Requests.Count==3 && autoEvents.Any(e=>e.Contains("verify_project") && e.Contains("tool_start")) && autoEvents.Any(e=>e.Contains("auto-check-ok")),"automatic check not run after code write");
    Assert(JsonNode.Parse(autoHandler.Requests[2])!["messages"]!.AsArray().Last()!["content"]!.GetValue<string>().Contains("auto-check-ok"),"check result not provided to model");
    spaces.SetUnrestricted(false);
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
    public List<Uri> Uris { get; } = [];
    public List<string?> Auth { get; } = [];
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Uris.Add(request.RequestUri!); Auth.Add(request.Headers.Authorization?.Parameter);
        Requests.Add(await request.Content!.ReadAsStringAsync(cancellationToken));
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(responses[index++], Encoding.UTF8, "application/json") };
    }
}

sealed class QuotaHandler : HttpMessageHandler
{
    public string? Host; public string? Key;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Host=request.RequestUri!.Host; Key=request.Headers.Authorization?.Parameter;
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content=new StringContent("""{"data":{"usage_daily":0.12,"free_model_daily_requests":{"remaining":5,"limit":50}}}""") });
    }
}
sealed class ParallelHandler(string first, string? malicious = null) : HttpMessageHandler
{
    private int count, active, maxConcurrent; private readonly TaskCompletionSource gate = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public int MaxConcurrent => maxConcurrent;
    public int ChildRequests; public System.Collections.Concurrent.ConcurrentBag<string> ChildBodies = new();
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        int n=Interlocked.Increment(ref count); string body=await request.Content!.ReadAsStringAsync(ct);
        if (n==1) return Reply(first);
        if (n is 2 or 3) {
            ChildBodies.Add(body); Interlocked.Increment(ref ChildRequests); int now=Interlocked.Increment(ref active); if(now==2) { maxConcurrent=2; gate.TrySetResult(); }
            await gate.Task.WaitAsync(TimeSpan.FromSeconds(10),ct); Interlocked.Decrement(ref active);
            return Reply(n == 2 && malicious is not null ? malicious : """{"choices":[{"message":{"role":"assistant","content":"Отчёт"}}]}""");
        }
        return Reply("""{"choices":[{"message":{"role":"assistant","content":"Итог"}}]}""");
    }
    private static HttpResponseMessage Reply(string text) => new(HttpStatusCode.OK) { Content=new StringContent(text,Encoding.UTF8,"application/json") };
}

sealed class ArenaStreamHandler : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        AssertRequest(request);
        string sse = "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n" + "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" + "data: [DONE]\n\n";
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(sse, Encoding.UTF8, "text/event-stream") });
    }
    private static void AssertRequest(HttpRequestMessage request)
    {
        if (request.RequestUri?.Host != "api.arena.ai" || request.Headers.Authorization?.Parameter != "arena-key") throw new Exception("stream sent to wrong endpoint/key");
    }
}
