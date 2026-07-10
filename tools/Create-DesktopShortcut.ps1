[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$root = Split-Path -Path $PSScriptRoot -Parent
$launcher = Join-Path $root 'Launch D35 Converter.bat'
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Launcher was not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcutName = 'D35 Statblock Converter.lnk'
$targets = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) $shortcutName),
    (Join-Path $root $shortcutName)
)

foreach ($shortcutPath in $targets) {
    try {
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $launcher
        $shortcut.WorkingDirectory = $root
        $shortcut.Description = 'D35 Statblock Converter'
        $shortcut.Save()
        Write-Host "Created shortcut: $shortcutPath"
        return
    }
    catch {
        $lastError = $_.Exception.Message
    }
}

throw "Unable to create shortcut. Last error: $lastError"
