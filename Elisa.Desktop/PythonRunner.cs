using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace Elisa.Desktop;

/// <summary>Python is arbitrary code execution, never a workspace sandbox.</summary>
internal static class PythonRunner
{
    public static async Task<string> RunAsync(IReadOnlyList<string> args, string directory, bool useVenv, CancellationToken cancellationToken)
    {
        if (args.Count is < 1 or > 80 || args.Any(a => a.Length > 12000 || a.Contains('\0'))) throw new ArgumentException("Недопустимые аргументы Python.");
        if (!Directory.Exists(directory)) throw new DirectoryNotFoundException("Рабочая папка Python недоступна.");
        if (useVenv)
        {
            string executable = Path.Combine(directory, ".venv", OperatingSystem.IsWindows() ? "Scripts" : "bin", OperatingSystem.IsWindows() ? "python.exe" : "python");
            if (!File.Exists(executable)) throw new FileNotFoundException("Окружение .venv не найдено; сначала создайте его командой Python -m venv .venv.");
            return await RunProcess(executable, [], args, directory, cancellationToken);
        }
        if (OperatingSystem.IsWindows())
        {
            try { return await RunProcess("py", ["-3"], args, directory, cancellationToken); }
            catch (Win32Exception ex) when (ex.NativeErrorCode is 2 or 3) { }
            try { return await RunProcess("python", [], args, directory, cancellationToken); }
            catch (Win32Exception ex) when (ex.NativeErrorCode is 2 or 3) { throw new InvalidOperationException("Python 3 не найден. Установите Python и перезапустите Elisa."); }
        }
        try { return await RunProcess("python3", [], args, directory, cancellationToken); }
        catch (Win32Exception ex) when (ex.NativeErrorCode is 2 or 3) { throw new InvalidOperationException("Python 3 не найден."); }
    }
    private static async Task<string> RunProcess(string executable, IReadOnlyList<string> prefix, IReadOnlyList<string> args, string directory, CancellationToken cancellationToken)
    {
        var start = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, WorkingDirectory = directory };
        foreach (string value in prefix.Concat(args)) start.ArgumentList.Add(value);
        start.Environment["PYTHONIOENCODING"] = "utf-8"; start.Environment["PIP_DISABLE_PIP_VERSION_CHECK"] = "1"; start.Environment["PIP_NO_INPUT"] = "1";
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Не удалось запустить Python.");
        process.StandardInput.Close();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(120));
        Task<string> stdout = ReadLimitedAsync(process.StandardOutput), stderr = ReadLimitedAsync(process.StandardError);
        try { await Task.WhenAll(process.WaitForExitAsync(timeout.Token), stdout, stderr).WaitAsync(timeout.Token); }
        catch (OperationCanceledException)
        {
            try { process.Kill(true); } catch (InvalidOperationException) { } catch (Win32Exception) { }
            await process.WaitForExitAsync();
            if (cancellationToken.IsCancellationRequested) throw;
            return "Код выхода: -1\nВремя ожидания Python истекло (120 секунд); уже выполнённые действия не отменены.";
        }
        return $"Код выхода: {process.ExitCode}\nstdout:\n{await stdout}\nstderr:\n{await stderr}";
    }
    private static async Task<string> ReadLimitedAsync(StreamReader reader)
    {
        var text = new StringBuilder(); var buffer = new char[4096]; int n; bool cut = false;
        while ((n = await reader.ReadAsync(buffer)) > 0) { int take = Math.Min(n, Math.Max(0, 24000 - text.Length)); text.Append(buffer, 0, take); cut |= take < n; }
        if (cut) text.Append("\n[Вывод обрезан]"); return text.ToString();
    }
}
