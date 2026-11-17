using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

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

    public ElisaWindow()
    {
        Text = "Elisa";
        MinimumSize = new Size(800, 600);
        Size = new Size(1400, 900);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(16, 21, 18);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(browser);
        agent = new Agent(Send, ApproveCommand);
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
            if (type == "configure")
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

    private bool ApproveCommand(string command)
    {
        using var dialog = new Form { Text = "Elisa — подтверждение команды", Width = 760, Height = 470,
            MinimumSize = new Size(650, 400), StartPosition = FormStartPosition.CenterParent,
            BackColor = Color.FromArgb(20, 27, 22), ForeColor = Color.White, ShowInTaskbar = false };
        var label = new Label { Dock = DockStyle.Top, Height = 94, Padding = new Padding(16),
            Text = "Агент просит доступ к Windows. Команда будет выполнена БЕЗ песочницы с вашими правами.\nОна может читать, изменять или удалять файлы и отправлять данные в сеть. Проверьте всю команду перед запуском." };
        var code = new TextBox { Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Both,
            WordWrap = false, Text = command, Font = new Font("Consolas", 10), BackColor = Color.FromArgb(9, 14, 10), ForeColor = Color.FromArgb(198, 237, 183) };
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 62, FlowDirection = FlowDirection.RightToLeft, Padding = new Padding(10) };
        var reject = new Button { Text = "Отклонить", Width = 130, Height = 36, DialogResult = DialogResult.Cancel, ForeColor = Color.Black };
        var allow = new Button { Text = "Выполнить", Width = 130, Height = 36, DialogResult = DialogResult.OK, ForeColor = Color.Black };
        buttons.Controls.Add(reject); buttons.Controls.Add(allow);
        dialog.Controls.Add(code); dialog.Controls.Add(label); dialog.Controls.Add(buttons);
        dialog.AcceptButton = reject; dialog.CancelButton = reject;
        return dialog.ShowDialog(this) == DialogResult.OK;
    }
}
