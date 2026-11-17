using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Elisa.Desktop;

internal sealed class WorkspaceSettings
{
    public List<string> Paths { get; set; } = [];
    public bool UnrestrictedPowerShell { get; set; }
}

/// <summary>Path-level restrictions, not an OS sandbox: do not run untrusted local code concurrently.</summary>
internal sealed class Workspaces
{
    private const int MaxBytes = 1024 * 1024;
    private readonly string? settingsFile;
    public WorkspaceSettings Settings { get; private set; } = new();

    public Workspaces(string? settingsFile = null, bool persist = true)
    {
        this.settingsFile = persist ? settingsFile ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Elisa", "workspaces.json") : null;
        if (this.settingsFile is not null && File.Exists(this.settingsFile))
        {
            try { Settings = JsonSerializer.Deserialize<WorkspaceSettings>(File.ReadAllText(this.settingsFile)) ?? new(); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { Settings = new(); }
        }
        Settings.Paths ??= [];
    }

    private void Save()
    {
        if (settingsFile is null) return;
        Directory.CreateDirectory(Path.GetDirectoryName(settingsFile)!);
        File.WriteAllText(settingsFile, JsonSerializer.Serialize(Settings, new JsonSerializerOptions { WriteIndented = true }));
    }

    public void Add(string path)
    {
        string full = Path.GetFullPath(path);
        if (!Directory.Exists(full)) throw new ArgumentException("Папка не существует.");
        EnsureNoReparse(full);
        Update(() => { if (!Settings.Paths.Contains(full, StringComparer.OrdinalIgnoreCase)) Settings.Paths.Add(full); });
    }
    private void Update(Action change)
    {
        var previous = new WorkspaceSettings { Paths = [.. Settings.Paths], UnrestrictedPowerShell = Settings.UnrestrictedPowerShell };
        try { change(); Save(); }
        catch { Settings = previous; throw; }
    }
    public void Remove(string path) => Update(() => Settings.Paths.RemoveAll(p => string.Equals(p, path, StringComparison.OrdinalIgnoreCase)));
    public void SetUnrestricted(bool enabled) => Update(() => Settings.UnrestrictedPowerShell = enabled);

    private static void EnsureNoReparse(string path)
    {
        string full = Path.GetFullPath(path);
        var root = Path.GetPathRoot(full) ?? throw new ArgumentException("Недопустимый путь.");
        string current = root;
        Check(current);
        foreach (string part in full[root.Length..].Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, part);
            Check(current);
        }
        static void Check(string candidate)
        {
            try
            {
                if ((File.GetAttributes(candidate) & FileAttributes.ReparsePoint) != 0)
                    throw new UnauthorizedAccessException("Символические ссылки и точки повторной обработки запрещены в рабочих областях.");
            }
            catch (FileNotFoundException) { }
            catch (DirectoryNotFoundException) { }
        }
    }

    private string Resolve(int index, string relative)
    {
        if (index < 1 || index > Settings.Paths.Count) throw new ArgumentException("Неизвестная рабочая область.");
        if (Path.IsPathRooted(relative) || relative.Contains(':')) throw new UnauthorizedAccessException("Используйте относительный путь внутри рабочей области.");
        var parts = relative.Split(['/', '\\'], StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var baseName = part.Split('.')[0];
            if (part is "." or ".." || part.EndsWith(' ') || part.EndsWith('.') ||
                baseName.Equals("CON", StringComparison.OrdinalIgnoreCase) || baseName.Equals("PRN", StringComparison.OrdinalIgnoreCase) ||
                baseName.Equals("AUX", StringComparison.OrdinalIgnoreCase) || baseName.Equals("NUL", StringComparison.OrdinalIgnoreCase) ||
                (baseName.Length == 4 && (baseName.StartsWith("COM", StringComparison.OrdinalIgnoreCase) || baseName.StartsWith("LPT", StringComparison.OrdinalIgnoreCase)) && baseName[3] is >= '1' and <= '9'))
                throw new UnauthorizedAccessException("Недопустимый компонент пути.");
        }
        string root = Path.GetFullPath(Settings.Paths[index - 1]);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException("Рабочая область недоступна.");
        string full = Path.GetFullPath(Path.Combine(root, relative));
        string prefix = Path.EndsInDirectorySeparator(root) ? root : root + Path.DirectorySeparatorChar;
        if (!full.Equals(root, StringComparison.OrdinalIgnoreCase) && !full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Путь находится вне рабочей области.");
        EnsureNoReparse(full);
        return full;
    }

    public string Execute(string name, JsonNode? args)
    {
        if (name == "list_workspaces")
            return JsonSerializer.Serialize(Settings.Paths.Select((path, i) => new { workspace = i + 1, path }));
        int index = args?["workspace"]?.GetValue<int>() ?? throw new ArgumentException("Укажите номер рабочей области.");
        string relative = args?["path"]?.GetValue<string>() ?? "";
        string path = Resolve(index, relative);
        switch (name)
        {
            case "list_files":
                if (!Directory.Exists(path)) throw new DirectoryNotFoundException("Папка не найдена.");
                var items = Directory.EnumerateFileSystemEntries(path).Take(501).Select(p => {
                    var attr = File.GetAttributes(p);
                    return new { name = Path.GetFileName(p), type = (attr & FileAttributes.ReparsePoint) != 0 ? "link (недоступно)" : (attr & FileAttributes.Directory) != 0 ? "directory" : "file" };
                }).ToList();
                return JsonSerializer.Serialize(items.Take(500)) + (items.Count > 500 ? "\n[Показаны первые 500 элементов]" : "");
            case "read_file":
                var info = new FileInfo(path);
                if (!info.Exists) throw new FileNotFoundException("Файл не найден.");
                if (info.Length > MaxBytes) throw new IOException("Файл больше 1 МБ.");
                return File.ReadAllText(path, Encoding.UTF8);
            case "write_file":
                string text = args?["content"]?.GetValue<string>() ?? throw new ArgumentException("Укажите содержимое файла.");
                if (Encoding.UTF8.GetByteCount(text) > MaxBytes) throw new IOException("Содержимое больше 1 МБ.");
                if (path.Equals(Path.GetFullPath(Settings.Paths[index - 1]), StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Укажите путь к файлу.");
                File.WriteAllText(path, text, new UTF8Encoding(false));
                return "Файл записан: " + relative;
            case "create_directory":
                Directory.CreateDirectory(path);
                return "Папка создана: " + relative;
            default: throw new ArgumentException("Неизвестный инструмент.");
        }
    }
}
