using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;
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

    public ElisaWindow()
    {
        Text = "Elisa";
        MinimumSize = new Size(800, 600);
        Size = new Size(1400, 900);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(32, 32, 32);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(browser);
        agent = new Agent(Send, workspaces);
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
            if (type == "get_settings") SendSettings();
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
            else if (type == "send")
            {
                conversationId = root.GetProperty("conversationId").GetString() ?? "";
                await agent.RunAsync(conversationId, root.GetProperty("text").GetString() ?? "");
            }
        }
        catch (OperationCanceledException) { Send(new { type = "error", conversationId, text = "Запрос остановлен. Выполненные изменения не отменяются." }); }
        catch (Exception ex) { Send(new { type = "error", conversationId, text = ex.Message }); }
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
