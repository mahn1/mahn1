using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal static class ProjectChecks
{
    public static async Task<string> VerifyAsync(string folder, CancellationToken ct)
    {
        var commands = new List<(string Exe,string[] Args)>();
        string package = Path.Combine(folder,"package.json");
        if (File.Exists(package))
        {
            try { var json=JsonNode.Parse(File.ReadAllText(package)); if (json?["scripts"]?["test"] is not null) commands.Add(OperatingSystem.IsWindows() ? ("cmd.exe", ["/d","/c","npm.cmd","test"]) : ("npm", ["test"])); }
            catch (Exception ex) when (ex is IOException or System.Text.Json.JsonException) { }
        }
        if (File.Exists(Path.Combine(folder,"pyproject.toml")) || File.Exists(Path.Combine(folder,"pytest.ini")) || Directory.Exists(Path.Combine(folder,"tests")) && File.Exists(Path.Combine(folder,"requirements.txt")))
            commands.Add(("<python>", ["-m", "pytest", "-q"]));
        var sln = Directory.EnumerateFiles(folder, "*.sln").FirstOrDefault();
        if (sln is not null) commands.Add(("dotnet", ["test", sln, "--no-restore"]));
        if (commands.Count == 0) return "Тестовая команда не обнаружена; укажите команду вручную. Ничего не запускалось.";
        var report = new StringBuilder();
        foreach (var (exe,args) in commands.Take(3))
        {
            ct.ThrowIfCancellationRequested(); report.AppendLine("Команда: " + exe + " " + string.Join(" ",args));
            try { report.AppendLine(exe == "<python>" ? await PythonRunner.RunAsync(args, folder, File.Exists(Path.Combine(folder,".venv",OperatingSystem.IsWindows()?"Scripts":"bin",OperatingSystem.IsWindows()?"python.exe":"python")), ct) : await RunAsync(exe,args,folder,ct)); }
            catch (Exception ex) when (ex is not OperationCanceledException) { report.AppendLine("Ошибка запуска: " + ex.Message); }
        }
        return report.ToString();
    }
    public static async Task<string> GitSummaryAsync(string folder, CancellationToken ct)
    {
        try { return "Git status:\n" + await RunAsync("git", ["status", "--short", "--branch"], folder, ct, 10) + "\nПоследние коммиты:\n" + await RunAsync("git", ["log", "-5", "--format=%h %s"], folder, ct, 10); }
        catch (Exception ex) when (ex is not OperationCanceledException) { return "Git недоступен: " + ex.Message; }
    }
    private static async Task<string> RunAsync(string exe, string[] args, string directory, CancellationToken ct, int seconds = 120)
    {
        var start=new ProcessStartInfo(exe) { UseShellExecute=false, CreateNoWindow=true, RedirectStandardOutput=true, RedirectStandardError=true, RedirectStandardInput=true, StandardOutputEncoding=Encoding.UTF8, StandardErrorEncoding=Encoding.UTF8, WorkingDirectory=directory };
        foreach(string arg in args) start.ArgumentList.Add(arg);
        start.Environment["GIT_TERMINAL_PROMPT"]="0"; start.Environment["CI"]="true";
        using var process=Process.Start(start) ?? throw new InvalidOperationException("Не удалось запустить команду."); process.StandardInput.Close();
        using var timeout=CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(seconds));
        async Task<string> Read(StreamReader r) { var sb=new StringBuilder(); var buffer=new char[4096]; int n; bool cut=false; while((n=await r.ReadAsync(buffer))>0){int take=Math.Min(n,Math.Max(0,12000-sb.Length)); sb.Append(buffer,0,take); cut |= n>take;} return sb+(cut?"\n[Вывод обрезан]":""); }
        var output=Read(process.StandardOutput); var error=Read(process.StandardError);
        try { await Task.WhenAll(process.WaitForExitAsync(timeout.Token),output,error).WaitAsync(timeout.Token); }
        catch (OperationCanceledException) { try { process.Kill(true); } catch (InvalidOperationException) { } catch (Win32Exception) { } await process.WaitForExitAsync(); if(ct.IsCancellationRequested) throw; return "Код выхода: -1 (тайм-аут)"; }
        return $"Код выхода: {process.ExitCode}\nstdout:\n{await output}\nstderr:\n{await error}";
    }
}
