using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

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

    public ElisaWindow()
    {
        Text = "Elisa";
        MinimumSize = new Size(800, 600);
        Size = new Size(1400, 900);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(16, 21, 18);
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Controls.Add(browser);
        Shown += async (_, _) => await InitializeBrowserAsync();
    }

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
}
