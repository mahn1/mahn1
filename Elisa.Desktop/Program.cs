using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Elisa.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new ElisaWindow());
    }
}

internal sealed class ElisaWindow : Form
{
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    private readonly Agent agent;
    private readonly Workspaces workspaces = new();
    private readonly LocalStore store = new();
    private readonly LocalLibrary library = new();

    public ElisaWindow()
    {
        Text = "Elisa Viora 1.0";
        MinimumSize = new Size(800, 600);
        Size = new Size(1400, 900);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(32, 32, 32);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(browser);
        agent = new Agent(SendAgentEvent, workspaces, store: store);
        FormClosed += (_, _) => agent.Dispose();
        Shown += async (_, _) => await InitializeBrowserAsync();
    }

    private static bool IsLocal(string source) => Uri.TryCreate(source, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps && uri.Host == "elisa.local" && uri.IsDefaultPort;

    private async Task InitializeBrowserAsync()
    {
        try
        {
            string content = Path.Combine(AppContext.BaseDirectory, "wwwroot");
            if (!File.Exists(Path.Combine(content, "index.html")))
                throw new FileNotFoundException("Не найдены файлы интерфейса. Запустите приложение из папки, созданной build.bat.");
            string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Elisa", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: data);
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            browser.CoreWebView2.NavigationStarting += (_, e) => { if (!IsLocal(e.Uri)) e.Cancel = true; };
            browser.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
            browser.CoreWebView2.WebMessageReceived += OnWebMessage;
            browser.CoreWebView2.SetVirtualHostNameToFolderMapping("elisa.local", content, CoreWebView2HostResourceAccessKind.DenyCors);
            browser.CoreWebView2.Navigate("https://elisa.local/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show("Не удалось запустить Elisa. Проверьте, что установлен Microsoft Edge WebView2 Runtime.\n\n" + ex.Message,
                "Elisa", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    private void Send(object message)
    {
        if (!IsDisposed && browser.CoreWebView2 is not null)
            browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
    }

    private async void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!IsLocal(e.Source)) return;
        string conversationId = "";
        try
        {
            using var document = JsonDocument.Parse(e.WebMessageAsJson);
            var root = document.RootElement;
            string type = root.GetProperty("type").GetString() ?? "";
            if (type == "get_settings") { SendSettings(); SendState(); try { library.Ensure(); Send(new { type = "storage_ready", path = library.Root }); } catch (Exception) { Send(new { type = "persistence_warning", text = "Не удалось создать локальное хранилище." }); } }
            else if (type == "rename_chat")
            {
                agent.EnsureIdle(); string id = root.GetProperty("id").GetString() ?? "";
                store.RenameChat(id, root.GetProperty("title").GetString() ?? "");
                Send(new { type = "chat_renamed", id, title = store.Data.Chats.Find(c => c.Id == id)!.Title });
            }
            else if (type == "delete_chat")
            {
                agent.EnsureIdle(); string id = root.GetProperty("id").GetString() ?? "";
                store.DeleteChat(id); Send(new { type = "chat_deleted", id });
            }
            else if (type == "open_storage")
            {
                library.Ensure(); Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = true, ArgumentList = { library.Root } });
            }
            else if (type == "add_storage_workspace")
            {
                agent.EnsureIdle(); library.Ensure(); workspaces.Add(library.Root); SendSettings();
                Send(new { type = "storage_added" });
            }
            else if (type == "open_file")
            {
                string file = FileAccess.Resolve(root.GetProperty("path").GetString() ?? "", workspaces, Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
                if (FileAccess.CanOpenDirectly(file)) Process.Start(new ProcessStartInfo(file) { UseShellExecute = true });
                else
                {
                    Process.Start(new ProcessStartInfo("explorer.exe") { UseShellExecute = true, ArgumentList = { "/select," + file } });
                    Send(new { type = "file_revealed" });
                }
            }
            else if (type == "add_workspace")
            {
                agent.EnsureIdle();
                using var picker = new FolderBrowserDialog { Description = "Выберите рабочую область Elisa", UseDescriptionForTitle = true };
                if (picker.ShowDialog(this) == DialogResult.OK) { workspaces.Add(picker.SelectedPath); SendSettings(); }
            }
            else if (type == "remove_workspace") { agent.EnsureIdle(); workspaces.Remove(root.GetProperty("path").GetString() ?? ""); SendSettings(); }
            else if (type == "set_unrestricted") { agent.EnsureIdle(); workspaces.SetUnrestricted(root.GetProperty("enabled").GetBoolean()); SendSettings(); }
            else if (type == "add_to_path") { agent.EnsureIdle(); AddToPath(); }
            else if (type == "configure")
                agent.Configure(root.GetProperty("key").GetString() ?? "", root.GetProperty("model").GetString() ?? "");
            else if (type == "cancel") agent.Cancel();
            else if (type == "copy_text")
            {
                string value = root.GetProperty("text").GetString() ?? "";
                if (value.Length > 1000000) throw new ArgumentException("Текст слишком большой для копирования.");
                if (!string.IsNullOrEmpty(value)) Clipboard.SetText(value);
                Send(new { type = "copied" });
            }
            else if (type == "open_link")
            {
                string url = root.GetProperty("url").GetString() ?? "";
                if (url.Length > 4096 || !Uri.TryCreate(url, UriKind.Absolute, out var target) ||
                    (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps))
                    throw new ArgumentException("Разрешены только ссылки HTTP и HTTPS.");
                Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
            }
            else if (type == "send")
            {
                conversationId = root.GetProperty("conversationId").GetString() ?? "";
                agent.EnsureIdle();
                if (string.IsNullOrEmpty(store.Data.ApiKey)) throw new InvalidOperationException("Сначала настройте OpenRouter.");
                string text = root.GetProperty("text").GetString() ?? "";
                var files = Attachments.Parse(root);
                if (conversationId.Length > 100 || string.IsNullOrWhiteSpace(conversationId) || text.Length > 50000 || (string.IsNullOrWhiteSpace(text) && files.Count == 0))
                    throw new ArgumentException("Недопустимое сообщение.");
                var chat = store.FindOrCreate(conversationId, text, files);
                chat.Messages.Add(new ChatItem { Role = "user", Text = text, Attachments = files.Select(f => f.Name).ToList() });
                store.Save();
                await agent.RunAsync(conversationId, text, files);
            }
        }
        catch (OperationCanceledException) { SendAgentEvent(new { type = "error", conversationId, text = "Запрос остановлен. Выполненные изменения не отменяются." }); }
        catch (Exception ex) { SendAgentEvent(new { type = "error", conversationId, text = ex.Message }); }
    }

    private void SendState()
    {
        Send(new { type = "state_loaded", configured = !string.IsNullOrEmpty(store.Data.ApiKey), model = store.Data.Model,
            usage = store.Data.Usage,
            chats = store.Data.Chats.Select(c => new { id = c.Id, title = c.Title, preview = c.Preview,
                messages = c.Messages.Select(m => new { role = m.Role, text = m.Text, command = m.Command, attachments = m.Attachments, toolId = m.ToolId, toolName = m.ToolName, toolComment = m.ToolComment, toolStatus = m.ToolStatus, durationMs = m.DurationMs }) }) });
        if (store.LoadError is not null) Send(new { type = "persistence_warning", text = store.LoadError });
    }

    private void SendAgentEvent(object message)
    {
        using var data = JsonDocument.Parse(JsonSerializer.Serialize(message));
        var root = data.RootElement;
        string type = root.GetProperty("type").GetString() ?? "";
        if (type is "answer" or "step" or "tool_result" or "error" or "tool_start" or "tool_finish" or "thinking_start" or "thinking_finish")
        {
            string id = root.TryGetProperty("conversationId", out var idNode) ? idNode.GetString() ?? "" : "";
            var chat = store.Data.Chats.Find(c => c.Id == id);
            if (chat is not null)
            {
                if (type == "thinking_finish")
                {
                    string toolId = root.GetProperty("toolId").GetString() ?? "";
                    var item = chat.Messages.LastOrDefault(m => m.Role == "thinking_start" && m.ToolId == toolId);
                    if (item is not null) { item.DurationMs = root.GetProperty("durationMs").GetInt64(); item.ToolStatus = root.GetProperty("toolStatus").GetString(); }
                }
                else if (type == "thinking_start")
                    chat.Messages.Add(new ChatItem { Role = type, ToolId = root.GetProperty("toolId").GetString(), ToolStatus = "running" });
                else if (type == "tool_finish")
                {
                    string toolId = root.GetProperty("toolId").GetString() ?? "";
                    var item = chat.Messages.LastOrDefault(m => m.Role == "tool_start" && m.ToolId == toolId);
                    if (item is not null) { item.Text = root.GetProperty("text").GetString() ?? ""; item.ToolStatus = root.GetProperty("toolStatus").GetString(); }
                }
                else if (type == "tool_start")
                    chat.Messages.Add(new ChatItem { Role = type, ToolId = root.GetProperty("toolId").GetString(),
                        ToolName = root.GetProperty("toolName").GetString(), ToolComment = root.GetProperty("toolComment").GetString(), Command = root.GetProperty("command").GetString(), ToolStatus = "running" });
                else
                    chat.Messages.Add(new ChatItem { Role = type, Text = root.GetProperty("text").GetString() ?? "",
                        Command = root.TryGetProperty("command", out var command) ? command.GetString() : null });
                try { store.Save(); }
                catch (Exception) { Send(new { type = "persistence_warning", text = "Не удалось сохранить историю. Проверьте доступ к папке Elisa." }); }
            }
        }
        Send(message);
    }

    private void SendSettings() => Send(new { type = "workspace_settings", paths = workspaces.Settings.Paths, unrestricted = workspaces.Settings.UnrestrictedPowerShell });

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, string lParam, uint flags, uint timeout, out IntPtr result);

    private void AddToPath()
    {
        string folder = Path.TrimEndingDirectorySeparator(AppContext.BaseDirectory);
        if (folder.Contains(';')) throw new InvalidOperationException("Папка Elisa содержит точку с запятой и не может быть добавлена в PATH.");
        string userPath = Environment.GetEnvironmentVariable("PATH", EnvironmentVariableTarget.User) ?? "";
        bool exists = userPath.Split(';', StringSplitOptions.RemoveEmptyEntries).Any(p =>
            string.Equals(Path.TrimEndingDirectorySeparator(Environment.ExpandEnvironmentVariables(p.Trim().Trim('"'))), folder, StringComparison.OrdinalIgnoreCase));
        if (!exists)
        {
            string updated = string.IsNullOrWhiteSpace(userPath) ? folder : userPath.TrimEnd(';') + ";" + folder;
            if (updated.Length > 32767) throw new InvalidOperationException("PATH слишком длинный.");
            Environment.SetEnvironmentVariable("PATH", updated, EnvironmentVariableTarget.User);
            string processPath = Environment.GetEnvironmentVariable("PATH") ?? "";
            Environment.SetEnvironmentVariable("PATH", processPath.TrimEnd(';') + ";" + folder);
            SendMessageTimeout(new IntPtr(0xffff), 0x001A, IntPtr.Zero, "Environment", 0x0002, 5000, out _);
        }
        Send(new { type = "path_added", path = folder });
    }
}
