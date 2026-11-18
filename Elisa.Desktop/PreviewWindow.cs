using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Elisa.Desktop;

// A separate WebView and profile; untrusted page never runs in the privileged UI origin.
internal sealed class PreviewWindow : Form
{
    private readonly WebView2 view = new() { Dock = DockStyle.Fill };
    private readonly string file;
    private readonly string host = "preview-" + Guid.NewGuid().ToString("N") + ".local";
    public PreviewWindow(string file)
    {
        this.file = Path.GetFullPath(file);
        Text = "Elisa — предпросмотр: " + Path.GetFileName(file);
        Size = new Size(1100, 800); Controls.Add(view);
        Shown += async (_, _) => await InitializeAsync();
    }
    private async Task InitializeAsync()
    {
        try
        {
            var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Elisa", "PreviewWebView2");
            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: folder);
            await view.EnsureCoreWebView2Async(env);
            var core = view.CoreWebView2;
            core.Settings.IsWebMessageEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.AreDefaultScriptDialogsEnabled = false;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.DownloadStarting += (_, e) => e.Cancel = true;
            core.NavigationStarting += (_, e) => { if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var u) || u.Scheme != "https" || !string.Equals(u.Host, host, StringComparison.OrdinalIgnoreCase) || !u.IsDefaultPort) e.Cancel = true; };
            core.SetVirtualHostNameToFolderMapping(host, Path.GetDirectoryName(file)!, CoreWebView2HostResourceAccessKind.DenyCors);
            core.Navigate("https://" + host + "/" + Uri.EscapeDataString(Path.GetFileName(file)));
        }
        catch (Exception ex) { MessageBox.Show("Не удалось открыть предпросмотр: " + ex.Message, "Elisa"); Close(); }
    }
}
