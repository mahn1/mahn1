namespace Elisa.Desktop;

internal sealed class LocalLibrary
{
    public string Root { get; }
    public LocalLibrary(string? root = null) => Root = root ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Elisa", "Storage");
    public void Ensure()
    {
        Directory.CreateDirectory(Root);
        foreach (string name in new[] { "Projects", "Notes", "Exports" }) Directory.CreateDirectory(Path.Combine(Root, name));
    }
}

internal static class FileAccess
{
    private static readonly HashSet<string> DirectExtensions = new(StringComparer.OrdinalIgnoreCase) {
        ".txt", ".md", ".csv", ".json", ".xml", ".log", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".mp3", ".wav", ".flac", ".ogg", ".mp4", ".webm", ".docx", ".xlsx", ".pptx"
    };
    public static bool CanOpenDirectly(string path) => DirectExtensions.Contains(Path.GetExtension(path));
    public static string Resolve(string reference, Workspaces workspaces, string desktop)
    {
        reference = reference.Trim();
        if (reference.Length is < 1 or > 2048 || reference.Contains('\0')) throw new ArgumentException("Недопустимый путь.");
        if (reference.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
        {
            if (!Uri.TryCreate(reference, UriKind.Absolute, out var uri) || !uri.IsFile || uri.IsUnc) throw new ArgumentException("Разрешены только локальные файлы.");
            reference = uri.LocalPath;
        }
        if (reference.StartsWith("\\\\") || reference.StartsWith("//")) throw new ArgumentException("Сетевые пути не поддерживаются.");
        if ((reference.Length > 2 && reference[1] == ':' && reference[2..].Contains(':')) ||
            (reference.Length > 0 && reference[0] == ':')) throw new ArgumentException("Альтернативные потоки не поддерживаются.");
        var matches = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        bool absolute = Path.IsPathFullyQualified(reference);
        if (!absolute && Path.IsPathRooted(reference)) throw new ArgumentException("Укажите полный путь или путь относительно рабочей области.");
        if (absolute && workspaces.Settings.UnrestrictedPowerShell)
        {
            string full = Path.GetFullPath(reference);
            if (File.Exists(full)) matches.Add(full);
        }
        else
        {
            for (int i = 0; i < workspaces.Settings.Paths.Count; i++)
            {
                try
                {
                    string relative = absolute ? Path.GetRelativePath(workspaces.Settings.Paths[i], reference) : reference;
                    string full = workspaces.Resolve(i + 1, relative);
                    if (File.Exists(full)) matches.Add(full);
                }
                catch (Exception ex) when (ex is ArgumentException or UnauthorizedAccessException or IOException or NotSupportedException) { }
            }
        }
        if (!absolute && workspaces.Settings.UnrestrictedPowerShell && !string.IsNullOrWhiteSpace(desktop))
        {
            string full = Path.GetFullPath(Path.Combine(desktop, reference));
            string prefix = Path.TrimEndingDirectorySeparator(Path.GetFullPath(desktop)) + Path.DirectorySeparatorChar;
            if (full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && File.Exists(full)) matches.Add(full);
        }
        if (matches.Count == 0) throw new FileNotFoundException("Файл не найден или находится вне выбранных рабочих областей. Укажите полный путь.");
        if (matches.Count > 1) throw new ArgumentException("Найдено несколько файлов с таким именем. Укажите полный путь.");
        return matches.Single();
    }
}
