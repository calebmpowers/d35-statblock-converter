[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$script:Root = Split-Path -Path $PSCommandPath -Parent
$script:InputDir = Join-Path $script:Root 'Stat Blocks'
$script:OutputDir = Join-Path $script:Root 'Converted JSON'
$script:ReportDir = Join-Path $script:Root 'reports'
$script:SpellDir = Join-Path $script:Root 'Spell Macros'
$script:ModulePath = Join-Path $script:Root 'Dnd35JsonTools.psm1'
$script:LegacyModulePath = Join-Path $script:Root 'DungeonStatBlockParser.psm1'
$script:LastOutputPath = $null
$script:LastOutputText = ''
$script:LastReportPath = $null

foreach ($directory in @($script:InputDir, $script:OutputDir, $script:ReportDir, $script:SpellDir)) {
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }
}

Import-Module $script:LegacyModulePath -Force
Import-Module $script:ModulePath -Force

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function New-SafeFileName {
    param([Parameter(Mandatory)][string]$Name)

    $safe = $Name
    foreach ($character in [System.IO.Path]::GetInvalidFileNameChars()) {
        $safe = $safe.Replace($character, '_')
    }
    $safe = $safe.Trim()
    if ([string]::IsNullOrWhiteSpace($safe)) {
        return 'Converted Stat Block'
    }
    return $safe
}

function Get-UniqueFilePath {
    param(
        [Parameter(Mandatory)][string]$Directory,
        [Parameter(Mandatory)][string]$BaseName,
        [Parameter(Mandatory)][string]$Extension
    )

    $candidate = Join-Path $Directory ($BaseName + $Extension)
    $counter = 2
    while (Test-Path -LiteralPath $candidate) {
        $candidate = Join-Path $Directory ("$BaseName ($counter)$Extension")
        $counter += 1
    }
    return $candidate
}

function Write-TextFileAtomically {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Text
    )

    $Path = [System.IO.Path]::GetFullPath($Path)
    $directory = [System.IO.Path]::GetDirectoryName($Path)
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $temporaryPath = Join-Path $directory ('.' + [System.IO.Path]::GetFileName($Path) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Text, [System.Text.Encoding]::UTF8)
        Move-AppFileIntoPlace -SourcePath $temporaryPath -DestinationPath $Path
    }
    catch {
        throw "Unable to safely write '$Path': $($_.Exception.Message)"
    }
}

function Move-AppFileIntoPlace {
    param(
        [Parameter(Mandatory)][string]$SourcePath,
        [Parameter(Mandatory)][string]$DestinationPath
    )

    if (-not ('Dnd35AppNativeFileOperations' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Dnd35AppNativeFileOperations {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool MoveFileEx(string existingFileName, string newFileName, int flags);
}
'@
    }

    if (-not [Dnd35AppNativeFileOperations]::MoveFileEx($SourcePath, $DestinationPath, 0x1 -bor 0x8)) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw [System.ComponentModel.Win32Exception]::new($errorCode)
    }
}

function Get-OutputPath {
    param(
        [Parameter(Mandatory)][string]$InputPath,
        [Parameter(Mandatory)][string]$Mode
    )

    $baseName = New-SafeFileName -Name ([System.IO.Path]::GetFileNameWithoutExtension($InputPath))
    switch ($Mode) {
        'Inline command' { $extension = '.roll20-command.txt' }
        'Diagnostic model' { $extension = '.diagnostic.json' }
        default { $extension = '.dnd35.json' }
    }

    return Get-UniqueFilePath -Directory $script:OutputDir -BaseName $baseName -Extension $extension
}

function Write-ConversionReport {
    param(
        [Parameter(Mandatory)][object[]]$Results
    )

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $path = Get-UniqueFilePath -Directory $script:ReportDir -BaseName "local_app_report_$timestamp" -Extension '.txt'
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('D35 Local Converter Report')
    $lines.Add("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $lines.Add("Converted: $($Results.Count)")
    $lines.Add('')

    foreach ($result in $Results) {
        $lines.Add("[$($result.Status)] $($result.Input)")
        if ($result.Output) {
            $lines.Add("  Output: $($result.Output)")
        }
        if ($result.Name) {
            $lines.Add("  Creature: $($result.Name)")
        }
        foreach ($warning in @($result.Warnings)) {
            $lines.Add("  Warning: $warning")
        }
        if ($result.Error) {
            $lines.Add("  Error: $($result.Error)")
        }
        $lines.Add('')
    }

    Write-TextFileAtomically -Path $path -Text ($lines -join [Environment]::NewLine)
    $script:LastReportPath = $path
    return $path
}

function Convert-StatBlockFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Mode
    )

    $outputPath = Get-OutputPath -InputPath $Path -Mode $Mode
    $warnings = @()
    $name = ''

    try {
        if ($Mode -eq 'Diagnostic model') {
            $project = ConvertTo-ProjectModel -Path $Path -SpellMacroLibraryPath $script:SpellDir
            $model = ConvertFrom-ProjectModelToDnd35Json -Project $project
            $warnings = @($model.warnings)
            $name = $model.name
            Export-Dnd35Json -Model $model -Path $outputPath
        }
        else {
            $model = ConvertTo-Dnd35JsonModel -Path $Path -SpellMacroLibraryPath $script:SpellDir
            $warnings = @($model.warnings)
            $name = $model.creature.name
            if ($Mode -eq 'Inline command') {
                $text = Get-Dnd35InlineImportCommand -Model $model
                Write-TextFileAtomically -Path $outputPath -Text $text
            }
            else {
                Export-Dnd35Json -Model $model -Path $outputPath
            }
        }

        if ($Mode -eq 'Handout JSON') {
            $validated = Import-Dnd35Json -Path $outputPath
            if ($validated.schema_version -ne 1 -or [string]::IsNullOrWhiteSpace($validated.creature.name)) {
                throw 'The saved handout JSON did not pass its post-write validation.'
            }
        }

        $script:LastOutputPath = $outputPath
        $script:LastOutputText = [System.IO.File]::ReadAllText($outputPath, [System.Text.Encoding]::UTF8)
        return [pscustomobject]@{
            Status = 'OK'
            Input = $Path
            Output = $outputPath
            Name = $name
            Warnings = $warnings
            Error = ''
        }
    }
    catch {
        return [pscustomobject]@{
            Status = 'FAILED'
            Input = $Path
            Output = ''
            Name = ''
            Warnings = @()
            Error = $_.Exception.Message
        }
    }
}

function Convert-PastedStatBlock {
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$Mode
    )

    $firstLine = @($Text -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    $baseName = if ($firstLine.Count -gt 0) { $firstLine[0] -replace '\s+CR\s+.+$', '' } else { 'Pasted Stat Block' }
    $baseName = New-SafeFileName -Name $baseName
    $inputPath = Join-Path $script:InputDir "$baseName.txt"
    $counter = 1
    while (Test-Path -LiteralPath $inputPath) {
        $inputPath = Join-Path $script:InputDir "$baseName $counter.txt"
        $counter += 1
    }

    Write-TextFileAtomically -Path $inputPath -Text $Text
    return Convert-StatBlockFile -Path $inputPath -Mode $Mode
}

function Set-AppStatus {
    param(
        [Parameter(Mandatory)][System.Windows.Forms.Label]$StatusLabel,
        [Parameter(Mandatory)][string]$Message
    )

    $StatusLabel.Text = $Message
    [System.Windows.Forms.Application]::DoEvents()
}

function Get-ConversionStatusMessage {
    param(
        [Parameter(Mandatory)][object[]]$Results,
        [Parameter(Mandatory)][string]$ReportPath
    )

    $succeeded = @($Results | Where-Object { $_.Status -eq 'OK' }).Count
    $failed = @($Results | Where-Object { $_.Status -ne 'OK' }).Count
    $warnings = @($Results | ForEach-Object { @($_.Warnings).Count } | Measure-Object -Sum).Sum
    $reportName = [System.IO.Path]::GetFileName($ReportPath)
    $message = "Converted $succeeded file(s)"
    if ($failed -gt 0) {
        $message += "; $failed failed"
    }
    if ($warnings -gt 0) {
        $message += "; $warnings warning(s) need review"
    }
    return "$message. Report: $reportName"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'D35 Statblock Converter'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(1100, 760)
$form.MinimumSize = New-Object System.Drawing.Size(900, 620)

$font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.Font = $font

$tabs = New-Object System.Windows.Forms.TabControl
$tabs.Dock = 'Fill'
$form.Controls.Add($tabs)

$pasteTab = New-Object System.Windows.Forms.TabPage
$pasteTab.Text = 'Paste'
$tabs.TabPages.Add($pasteTab)

$fileTab = New-Object System.Windows.Forms.TabPage
$fileTab.Text = 'File'
$tabs.TabPages.Add($fileTab)

$folderTab = New-Object System.Windows.Forms.TabPage
$folderTab.Text = 'Folder'
$tabs.TabPages.Add($folderTab)

$bottomPanel = New-Object System.Windows.Forms.Panel
$bottomPanel.Dock = 'Bottom'
$bottomPanel.Height = 265
$form.Controls.Add($bottomPanel)
$bottomPanel.BringToFront()

$outputBox = New-Object System.Windows.Forms.TextBox
$outputBox.Multiline = $true
$outputBox.ScrollBars = 'Both'
$outputBox.WordWrap = $false
$outputBox.ReadOnly = $true
$outputBox.Dock = 'Fill'
$bottomPanel.Controls.Add($outputBox)

$buttonPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$buttonPanel.Dock = 'Bottom'
$buttonPanel.Height = 42
$buttonPanel.FlowDirection = 'LeftToRight'
$bottomPanel.Controls.Add($buttonPanel)

$modeLabel = New-Object System.Windows.Forms.Label
$modeLabel.Text = 'Output'
$modeLabel.AutoSize = $true
$modeLabel.Margin = New-Object System.Windows.Forms.Padding(8, 12, 4, 4)
$buttonPanel.Controls.Add($modeLabel)

$modeBox = New-Object System.Windows.Forms.ComboBox
$modeBox.DropDownStyle = 'DropDownList'
$modeBox.Width = 160
[void]$modeBox.Items.Add('Handout JSON')
[void]$modeBox.Items.Add('Inline command')
[void]$modeBox.Items.Add('Diagnostic model')
$modeBox.SelectedIndex = 0
$buttonPanel.Controls.Add($modeBox)

$copyButton = New-Object System.Windows.Forms.Button
$copyButton.Text = 'Copy Output'
$copyButton.Width = 100
$copyButton.Add_Click({
    if (-not [string]::IsNullOrWhiteSpace($script:LastOutputText)) {
        [System.Windows.Forms.Clipboard]::SetText($script:LastOutputText)
        $statusLabel.Text = 'Copied latest output.'
    }
})
$buttonPanel.Controls.Add($copyButton)

$openOutputButton = New-Object System.Windows.Forms.Button
$openOutputButton.Text = 'Open Output Folder'
$openOutputButton.Width = 135
$openOutputButton.Add_Click({
    Start-Process explorer.exe -ArgumentList "`"$script:OutputDir`""
})
$buttonPanel.Controls.Add($openOutputButton)

$openReportButton = New-Object System.Windows.Forms.Button
$openReportButton.Text = 'Open Report'
$openReportButton.Width = 100
$openReportButton.Add_Click({
    if ($script:LastReportPath -and (Test-Path -LiteralPath $script:LastReportPath)) {
        Start-Process notepad.exe -ArgumentList "`"$script:LastReportPath`""
    }
})
$buttonPanel.Controls.Add($openReportButton)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Ready.'
$statusLabel.AutoSize = $true
$statusLabel.Margin = New-Object System.Windows.Forms.Padding(12, 12, 4, 4)
$buttonPanel.Controls.Add($statusLabel)

$pasteLayout = New-Object System.Windows.Forms.TableLayoutPanel
$pasteLayout.Dock = 'Fill'
$pasteLayout.RowCount = 2
$pasteLayout.ColumnCount = 1
$pasteLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
$pasteLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 45)))
$pasteTab.Controls.Add($pasteLayout)

$pasteBox = New-Object System.Windows.Forms.TextBox
$pasteBox.Multiline = $true
$pasteBox.ScrollBars = 'Both'
$pasteBox.WordWrap = $false
$pasteBox.Dock = 'Fill'
$pasteLayout.Controls.Add($pasteBox, 0, 0)

$pasteButtons = New-Object System.Windows.Forms.FlowLayoutPanel
$pasteButtons.Dock = 'Fill'
$pasteLayout.Controls.Add($pasteButtons, 0, 1)

$convertPasteButton = New-Object System.Windows.Forms.Button
$convertPasteButton.Text = 'Convert Pasted Text'
$convertPasteButton.Width = 145
$convertPasteButton.Add_Click({
    if ([string]::IsNullOrWhiteSpace($pasteBox.Text)) {
        $statusLabel.Text = 'Paste a stat block first.'
        return
    }
    Set-AppStatus -StatusLabel $statusLabel -Message 'Converting pasted stat block...'
    $result = Convert-PastedStatBlock -Text $pasteBox.Text -Mode $modeBox.SelectedItem
    $reportPath = Write-ConversionReport -Results @($result)
    $outputBox.Text = if ($result.Status -eq 'OK') { $script:LastOutputText } else { $result.Error }
    $statusLabel.Text = Get-ConversionStatusMessage -Results @($result) -ReportPath $reportPath
})
$pasteButtons.Controls.Add($convertPasteButton)

$fileLayout = New-Object System.Windows.Forms.TableLayoutPanel
$fileLayout.Dock = 'Fill'
$fileLayout.RowCount = 3
$fileLayout.ColumnCount = 1
$fileLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 45)))
$fileLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
$fileLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 45)))
$fileTab.Controls.Add($fileLayout)

$fileTop = New-Object System.Windows.Forms.FlowLayoutPanel
$fileTop.Dock = 'Fill'
$fileLayout.Controls.Add($fileTop, 0, 0)

$filePathBox = New-Object System.Windows.Forms.TextBox
$filePathBox.Width = 560
$fileTop.Controls.Add($filePathBox)

$browseFileButton = New-Object System.Windows.Forms.Button
$browseFileButton.Text = 'Choose File'
$browseFileButton.Width = 95
$browseFileButton.Add_Click({
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.InitialDirectory = $script:InputDir
    $dialog.Filter = 'Stat block files (*.txt;*.docx)|*.txt;*.docx|All files (*.*)|*.*'
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $filePathBox.Text = $dialog.FileName
        try {
            if ([System.IO.Path]::GetExtension($dialog.FileName).ToLowerInvariant() -eq '.txt') {
                $filePreviewBox.Text = [System.IO.File]::ReadAllText($dialog.FileName, [System.Text.Encoding]::UTF8)
            }
            else {
                $filePreviewBox.Text = 'DOCX selected. Preview is not shown here, but conversion can read it.'
            }
        }
        catch {
            $filePreviewBox.Text = $_.Exception.Message
        }
    }
})
$fileTop.Controls.Add($browseFileButton)

$filePreviewBox = New-Object System.Windows.Forms.TextBox
$filePreviewBox.Multiline = $true
$filePreviewBox.ScrollBars = 'Both'
$filePreviewBox.WordWrap = $false
$filePreviewBox.ReadOnly = $true
$filePreviewBox.Dock = 'Fill'
$fileLayout.Controls.Add($filePreviewBox, 0, 1)

$fileBottom = New-Object System.Windows.Forms.FlowLayoutPanel
$fileBottom.Dock = 'Fill'
$fileLayout.Controls.Add($fileBottom, 0, 2)

$convertFileButton = New-Object System.Windows.Forms.Button
$convertFileButton.Text = 'Convert Selected File'
$convertFileButton.Width = 145
$convertFileButton.Add_Click({
    if (-not (Test-Path -LiteralPath $filePathBox.Text)) {
        $statusLabel.Text = 'Choose a valid file first.'
        return
    }
    Set-AppStatus -StatusLabel $statusLabel -Message 'Converting selected file...'
    $result = Convert-StatBlockFile -Path $filePathBox.Text -Mode $modeBox.SelectedItem
    $reportPath = Write-ConversionReport -Results @($result)
    $outputBox.Text = if ($result.Status -eq 'OK') { $script:LastOutputText } else { $result.Error }
    $statusLabel.Text = Get-ConversionStatusMessage -Results @($result) -ReportPath $reportPath
})
$fileTop.Controls.Add($convertFileButton)

$fileHint = New-Object System.Windows.Forms.Label
$fileHint.Text = 'Choose a file, then use Convert Selected File above.'
$fileHint.AutoSize = $true
$fileHint.Margin = New-Object System.Windows.Forms.Padding(8, 12, 4, 4)
$fileBottom.Controls.Add($fileHint)

$folderLayout = New-Object System.Windows.Forms.TableLayoutPanel
$folderLayout.Dock = 'Fill'
$folderLayout.RowCount = 2
$folderLayout.ColumnCount = 1
$folderLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 45)))
$folderLayout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
$folderTab.Controls.Add($folderLayout)

$folderTop = New-Object System.Windows.Forms.FlowLayoutPanel
$folderTop.Dock = 'Fill'
$folderLayout.Controls.Add($folderTop, 0, 0)

$folderPathBox = New-Object System.Windows.Forms.TextBox
$folderPathBox.Width = 700
$folderPathBox.Text = $script:InputDir
$folderTop.Controls.Add($folderPathBox)

$browseFolderButton = New-Object System.Windows.Forms.Button
$browseFolderButton.Text = 'Choose Folder'
$browseFolderButton.Width = 105
$browseFolderButton.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.SelectedPath = $folderPathBox.Text
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $folderPathBox.Text = $dialog.SelectedPath
    }
})
$folderTop.Controls.Add($browseFolderButton)

$convertFolderButton = New-Object System.Windows.Forms.Button
$convertFolderButton.Text = 'Convert Folder'
$convertFolderButton.Width = 110
$convertFolderButton.Add_Click({
    if (-not (Test-Path -LiteralPath $folderPathBox.Text)) {
        $statusLabel.Text = 'Choose a valid folder first.'
        return
    }
    Set-AppStatus -StatusLabel $statusLabel -Message 'Converting folder...'
    $files = @(Get-ChildItem -LiteralPath $folderPathBox.Text -File | Where-Object { $_.Extension -in @('.txt', '.docx') })
    if ($files.Count -eq 0) {
        $statusLabel.Text = 'No txt or docx files found.'
        return
    }
    $results = foreach ($file in $files) {
        Convert-StatBlockFile -Path $file.FullName -Mode $modeBox.SelectedItem
    }
    $reportPath = Write-ConversionReport -Results @($results)
    $summary = $results | ForEach-Object {
        if ($_.Status -eq 'OK') {
            $warningText = if (@($_.Warnings).Count -gt 0) { " [$(@($_.Warnings).Count) warning(s)]" } else { '' }
            "OK: $($_.Name) -> $($_.Output)$warningText"
        }
        else {
            "FAILED: $($_.Input) - $($_.Error)"
        }
    }
    $outputBox.Text = $summary -join [Environment]::NewLine
    $statusLabel.Text = Get-ConversionStatusMessage -Results @($results) -ReportPath $reportPath
})
$folderTop.Controls.Add($convertFolderButton)

$folderHint = New-Object System.Windows.Forms.TextBox
$folderHint.Multiline = $true
$folderHint.ReadOnly = $true
$folderHint.Dock = 'Fill'
$folderHint.Text = "Choose a folder containing .txt or .docx stat blocks. Converted files are written to:`r`n$script:OutputDir"
$folderLayout.Controls.Add($folderHint, 0, 1)

[void]$form.ShowDialog()
