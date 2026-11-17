using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Elisa.Desktop;

static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
const string toolReply = """{"choices":[{"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call-1","type":"function","function":{"name":"run_powershell","arguments":"{\"command\":\"Get-Location\"}"}}]}}]}""";
const string answerReply = """{"choices":[{"message":{"role":"assistant","content":"Готово"}}]}""";

async Task CheckToolAsync(bool allow)
{
    int executed = 0, approvals = 0;
    var handler = new FakeHandler(toolReply, answerReply);
    var events = new List<string>();
    using var agent = new Agent(x => events.Add(JsonSerializer.Serialize(x)), command => { approvals++; Assert(command == "Get-Location", "unexpected command"); return allow; },
        new HttpClient(handler), (command, token) => { executed++; return Task.FromResult("успех"); });
    agent.Configure("secret", "test/model");
    await agent.RunAsync("chat-1", "Проверь папку");
    Assert(approvals == 1 && executed == (allow ? 1 : 0), "approval was not enforced");
    Assert(events.Any(e => e.Contains("tool_result")) && events.Any(e => e.Contains("answer")), "missing events");
    Assert(handler.Requests.Count == 2, "wrong number of requests");
    Assert(!handler.Requests.Any(r => r.Contains("secret")), "key leaked into request body");
    var second = JsonNode.Parse(handler.Requests[1])!;
    var result = second["messages"]!.AsArray().Last()!;
    Assert(result["role"]!.GetValue<string>() == "tool" && result["tool_call_id"]!.GetValue<string>() == "call-1", "missing tool result");
    Assert(result["content"]!.GetValue<string>().Contains(allow ? "успех" : "отклонил"), "wrong tool result");
}
await CheckToolAsync(false);
await CheckToolAsync(true);
using (var agent = new Agent(_ => {}, _ => throw new Exception("must not ask"), new HttpClient(new FakeHandler(answerReply))))
{
    try { await agent.RunAsync("c", "test"); throw new Exception("missing key accepted"); } catch (InvalidOperationException) { }
    agent.Configure("secret", "test/model");
    await agent.RunAsync("c", "hello");
}
Console.WriteLine("Agent tests passed");

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
