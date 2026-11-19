using System.Diagnostics;
using System.Text;

namespace Elisa.Desktop;

/// <summary>Runs the user's own authenticated gh without a shell or token in arguments.</summary>
internal static class GitHubCli
{
    public static Task<string> StatusAsync(CancellationToken cancellationToken) => RunCoreAsync(new[] { "auth", "status", "--hostname", "github.com" }, Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), cancellationToken);
    public static Task<string> RunAsync(IReadOnlyList<string> args, string directory, CancellationToken cancellationToken)
    {
        if (args.Count > 0 && args[0].Equals("auth", StringComparison.OrdinalIgnoreCase)) throw new UnauthorizedAccessException("Авторизация доступна только пользователю в настройках Elisa, а не агенту.");
        return RunCoreAsync(args, directory, cancellationToken);
    }
    private static async Task<string> RunCoreAsync(IReadOnlyList<string> args, string directory, CancellationToken cancellationToken)
    {
        if (args.Count == 0 || args.Count > 80 || args.Any(a => a.Length > 4000 || a.Contains('\0'))) throw new ArgumentException("Недопустимые аргументы gh.");
        var start = new ProcessStartInfo("gh") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, WorkingDirectory = directory };
        foreach (string arg in args) start.ArgumentList.Add(arg);
        start.Environment["GH_PROMPT_DISABLED"] = "1"; start.Environment["GH_PAGER"] = "cat"; start.Environment["GIT_TERMINAL_PROMPT"] = "0";
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Не удалось запустить GitHub CLI.");
        process.StandardInput.Close();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(90));
        Task<string> stdout = ReadLimitedAsync(process.StandardOutput), stderr = ReadLimitedAsync(process.StandardError);
        try { await Task.WhenAll(process.WaitForExitAsync(timeout.Token), stdout, stderr).WaitAsync(timeout.Token); }
        catch (OperationCanceledException) {
            try { process.Kill(true); } catch (InvalidOperationException) { } catch (System.ComponentModel.Win32Exception) { }
            await process.WaitForExitAsync();
            if (cancellationToken.IsCancellationRequested) throw;
            return "Код выхода: -1\nВремя ожидания GitHub CLI истекло; уже выполнённые изменения не отменены.";
        }
        return $"Код выхода: {process.ExitCode}\nstdout:\n{await stdout}\nstderr:\n{await stderr}";
    }
    private static async Task<string> ReadLimitedAsync(StreamReader reader)
    {
        var text = new StringBuilder(); var buffer = new char[4096]; int n; bool cut = false;
        while ((n = await reader.ReadAsync(buffer)) > 0) { int take = Math.Min(n, Math.Max(0, 24000-text.Length)); text.Append(buffer, 0, take); cut |= take < n; }
        if (cut) text.Append("\n[Вывод обрезан]"); return text.ToString();
    }
}
