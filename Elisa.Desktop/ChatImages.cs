namespace Elisa.Desktop;

internal sealed class ChatImage
{
    public string Name { get; set; } = "";
    public string DataUrl { get; set; } = "";
}

internal static class ChatImages
{
    public static ChatImage? FromBytes(string name, byte[] bytes)
    {
        if (bytes.Length == 0 || bytes.Length > Attachments.MaxFileBytes) return null;
        string? mime = bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}) ? "image/png"
            : bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff ? "image/jpeg"
            : bytes.Length >= 6 && (System.Text.Encoding.ASCII.GetString(bytes, 0, 6) is "GIF87a" or "GIF89a") ? "image/gif"
            : bytes.Length >= 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" ? "image/webp" : null;
        return mime is null ? null : new ChatImage { Name = Path.GetFileName(name), DataUrl = $"data:{mime};base64,{Convert.ToBase64String(bytes)}" };
    }
    public static ChatImage FromFile(string reference, Workspaces spaces)
    {
        string path = ChatFileAccess.Resolve(reference, spaces, Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
        var info = new FileInfo(path);
        if (info.Length > Attachments.MaxFileBytes) throw new ArgumentException("Изображение больше 8 МБ.");
        return FromBytes(info.Name, File.ReadAllBytes(path)) ?? throw new ArgumentException("Поддерживаются изображения PNG, JPEG, GIF и WebP до 8 МБ.");
    }
}
