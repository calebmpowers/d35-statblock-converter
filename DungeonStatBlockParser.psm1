$script:ParserVersion = '0.2.0'

$script:SizeMap = [ordered]@{
    Colossal   = -8
    Gargantuan = -4
    Huge       = -2
    Large      = -1
    Medium     = 0
    Small      = 1
    Tiny       = 2
    Diminutive = 4
    Fine       = 8
}

$script:AlignmentCodes = @(
    'LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE',
    'Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral',
    'True Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
    'Usually', 'Always', 'Often'
)

$script:FeatCategories = @(
    'General', 'Fighter', 'Metamagic', 'Item Creation', 'Epic', 'Psionic',
    'Racial', 'Tactical', 'Divine', 'Wild', 'Vile', 'Exalted', 'Reserve',
    'Ambush', 'Luck', 'Heritage', 'Draconic', 'Incarnum', 'Style', 'Ceremony'
)

function Test-IsFeatCategory {
    param([string]$Category)

    $clean = (ConvertTo-PlainText $Category)
    return @($script:FeatCategories | Where-Object { $_ -ieq $clean }).Count -gt 0
}

$script:ReferenceStarters = @(
    'Expanded Psionics Handbook',
    'Dungeon Master''s Guide II',
    'Dungeon Master''s Guide',
    'Player''s Handbook II',
    'Player''s Handbook',
    'Magic Item Compendium',
    'Arms and Equipment Guide',
    'Eberron Campaign Setting',
    'Monster Manual V',
    'Monster Manual IV',
    'Monster Manual III',
    'Monster Manual II',
    'Monster Manual',
    'Faiths and Pantheons',
    'Weapons of Legacy',
    'Planar Handbook',
    'Heroes of Horror',
    'Libris Mortis',
    'Fiendish Codex',
    'Fiend Folio',
    'Draconomicon',
    'Dungeonscape',
    'Stormwrack',
    'Frostburn',
    'Sandstorm',
    'Underdark',
    'Cityscape',
    'Shining South',
    'Races of',
    'Heroes of',
    'Magic of',
    'Book of',
    'Tome of',
    'Complete',
    'Dungeon',
    'Dragon'
)

$script:KnownClassNames = @(
    'psychic warrior',
    'spirit shaman',
    'dragon shaman',
    'favored soul',
    'scarlet corsair',
    'dragon disciple',
    'mystic theurge',
    'arcane archer',
    'blackguard',
    'spellthief',
    'swashbuckler',
    'warmage',
    'beguiler',
    'hexblade',
    'duskblade',
    'crusader',
    'swordsage',
    'warblade',
    'artificer',
    'archivist',
    'shadowcaster',
    'truenamer',
    'soulknife',
    'marshal',
    'paladin',
    'cleric',
    'wizard',
    'sorcerer',
    'fighter',
    'ranger',
    'rogue',
    'scout',
    'expert',
    'warrior',
    'commoner',
    'aristocrat',
    'barbarian',
    'bard',
    'druid',
    'monk',
    'adept',
    'samurai',
    'ninja',
    'knight',
    'psion',
    'wilder',
    'lurk',
    'binder',
    'healer',
    'shugenja',
    'wu jen'
)

$script:ArcaneClasses = @(
    'wizard', 'sorcerer', 'bard', 'warmage', 'beguiler', 'dread necromancer',
    'wu jen', 'hexblade', 'assassin', 'blackguard', 'trapsmith'
)

$script:DivineClasses = @(
    'cleric', 'druid', 'paladin', 'ranger', 'adept', 'favored soul',
    'spirit shaman', 'shugenja', 'healer'
)

$script:PsionicClasses = @(
    'psion', 'psychic warrior', 'wilder', 'ardent', 'divine mind',
    'lurke', 'soulknife'
)

$script:SkillMap = @{
    'Appraise' = @{ Prefix = 'appraise'; Ability = 'Int'; Extra = 'None' }
    'Autohypnosis' = @{ Prefix = 'autohypnosis'; Ability = 'Wis'; Extra = 'None' }
    'Balance' = @{ Prefix = 'balance'; Ability = 'Dex'; Extra = 'Armor' }
    'Bluff' = @{ Prefix = 'bluff'; Ability = 'Cha'; Extra = 'None' }
    'Climb' = @{ Prefix = 'climb'; Ability = 'Str'; Extra = 'Armor' }
    'Concentration' = @{ Prefix = 'concentration'; Ability = 'Con'; Extra = 'None' }
    'Decipher Script' = @{ Prefix = 'decipherscript'; Ability = 'Int'; Extra = 'None' }
    'Diplomacy' = @{ Prefix = 'diplomacy'; Ability = 'Cha'; Extra = 'None' }
    'Disable Device' = @{ Prefix = 'disabledevice'; Ability = 'Int'; Extra = 'None' }
    'Disguise' = @{ Prefix = 'disguise'; Ability = 'Cha'; Extra = 'None' }
    'Escape Artist' = @{ Prefix = 'escapeartist'; Ability = 'Dex'; Extra = 'Armor' }
    'Forgery' = @{ Prefix = 'forgery'; Ability = 'Int'; Extra = 'None' }
    'Gather Information' = @{ Prefix = 'gatherinformation'; Ability = 'Cha'; Extra = 'None' }
    'Handle Animal' = @{ Prefix = 'handleanimal'; Ability = 'Cha'; Extra = 'None' }
    'Heal' = @{ Prefix = 'heal'; Ability = 'Wis'; Extra = 'None' }
    'Hide' = @{ Prefix = 'hide'; Ability = 'Dex'; Extra = 'HideSize' }
    'Intimidate' = @{ Prefix = 'intimidate'; Ability = 'Cha'; Extra = 'None' }
    'Iaijutsu Focus' = @{ Prefix = 'iaijutsufocus'; Ability = 'Cha'; Extra = 'None' }
    'Jump' = @{ Prefix = 'jump'; Ability = 'Str'; Extra = 'Armor' }
    'Listen' = @{ Prefix = 'listen'; Ability = 'Wis'; Extra = 'None' }
    'Move Silently' = @{ Prefix = 'movesilently'; Ability = 'Dex'; Extra = 'Armor' }
    'Open Lock' = @{ Prefix = 'openlock'; Ability = 'Dex'; Extra = 'None' }
    'Psicraft' = @{ Prefix = 'psicraft'; Ability = 'Int'; Extra = 'None' }
    'Ride' = @{ Prefix = 'ride'; Ability = 'Dex'; Extra = 'Armor' }
    'Search' = @{ Prefix = 'search'; Ability = 'Int'; Extra = 'None' }
    'Sense Motive' = @{ Prefix = 'sensemotive'; Ability = 'Wis'; Extra = 'None' }
    'Sleight of Hand' = @{ Prefix = 'sleightofhand'; Ability = 'Dex'; Extra = 'Armor' }
    'Spellcraft' = @{ Prefix = 'spellcraft'; Ability = 'Int'; Extra = 'None' }
    'Spot' = @{ Prefix = 'spot'; Ability = 'Wis'; Extra = 'None' }
    'Survival' = @{ Prefix = 'survival'; Ability = 'Wis'; Extra = 'None' }
    'Swim' = @{ Prefix = 'swim'; Ability = 'Str'; Extra = 'Armor' }
    'Tumble' = @{ Prefix = 'tumble'; Ability = 'Dex'; Extra = 'Armor' }
    'Use Magic Device' = @{ Prefix = 'usemagicdevice'; Ability = 'Cha'; Extra = 'None' }
    'Use Psionic Device' = @{ Prefix = 'usepsionicdevice'; Ability = 'Cha'; Extra = 'None' }
    'Use Rope' = @{ Prefix = 'userope'; Ability = 'Dex'; Extra = 'None' }
    'Knowledge (arcana)' = @{ Prefix = 'knowarcana'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (architecture and engineering)' = @{ Prefix = 'knowengineer'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (dungeoneering)' = @{ Prefix = 'knowdungeon'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (geography)' = @{ Prefix = 'knowgeography'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (history)' = @{ Prefix = 'knowhistory'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (local)' = @{ Prefix = 'knowlocal'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (nature)' = @{ Prefix = 'knownature'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (nobility and royalty)' = @{ Prefix = 'knownobility'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (nobility & royalty)' = @{ Prefix = 'knownobility'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (psionics)' = @{ Prefix = 'knowpsionic'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (religion)' = @{ Prefix = 'knowreligion'; Ability = 'Int'; Extra = 'None' }
    'Knowledge (the planes)' = @{ Prefix = 'knowplanes'; Ability = 'Int'; Extra = 'None' }
}

function ConvertTo-PlainText {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return ''
    }

    $normalized = $Text `
        -replace [char]0x2013, '-' `
        -replace [char]0x2014, '-' `
        -replace [char]0x2212, '-' `
        -replace [char]0x00A0, ' ' `
        -replace '\s+', ' '

    return $normalized.Trim()
}

function Get-AbilityModifier {
    param([AllowNull()][int]$Score)

    if ($null -eq $Score) {
        return 0
    }

    return [int][Math]::Floor(($Score - 10) / 2)
}

function Get-SizeValue {
    param([string]$SizeText)

    foreach ($entry in $script:SizeMap.GetEnumerator()) {
        if ($SizeText -match "\b$([Regex]::Escape($entry.Key))\b") {
            return [int]$entry.Value
        }
    }

    return 0
}

function Add-Warning {
    param(
        [System.Collections.Generic.List[string]]$Warnings,
        [string]$Message
    )

    if ($Message -and -not $Warnings.Contains($Message)) {
        $Warnings.Add($Message)
    }
}

function Split-TopLevel {
    param(
        [Parameter(Mandatory)]
        [string]$Text,

        [string[]]$Delimiters = @(', ')
    )

    $result = New-Object System.Collections.Generic.List[string]
    $buffer = New-Object System.Text.StringBuilder
    $depth = 0
    $index = 0

    while ($index -lt $Text.Length) {
        $char = $Text[$index]
        if ($char -eq '(') {
            $depth++
            [void]$buffer.Append($char)
            $index++
            continue
        }

        if ($char -eq ')') {
            if ($depth -gt 0) {
                $depth--
            }
            [void]$buffer.Append($char)
            $index++
            continue
        }

        $matchedDelimiter = $null
        foreach ($delimiter in $Delimiters) {
            if ($depth -eq 0 -and $index + $delimiter.Length -le $Text.Length -and $Text.Substring($index, $delimiter.Length) -eq $delimiter) {
                $matchedDelimiter = $delimiter
                break
            }
        }

        if ($matchedDelimiter) {
            $part = ConvertTo-PlainText $buffer.ToString()
            if ($part) {
                $result.Add($part)
            }
            $buffer.Clear() | Out-Null
            $index += $matchedDelimiter.Length
            continue
        }

        [void]$buffer.Append($char)
        $index++
    }

    $tail = ConvertTo-PlainText $buffer.ToString()
    if ($tail) {
        $result.Add($tail)
    }

    return $result
}

function Get-DocxParagraphs {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "DOCX file not found: $Path"
    }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.GetEntry('word/document.xml')
        if ($null -eq $entry) {
            throw "word/document.xml not found inside $Path"
        }

        $reader = [System.IO.StreamReader]::new($entry.Open())
        try {
            $xmlContent = $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }

        $xml = [xml]$xmlContent
        $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

        $paragraphNodes = $xml.SelectNodes('//w:body/w:p', $ns)
        $paragraphs = New-Object System.Collections.Generic.List[string]
        foreach ($paragraph in $paragraphNodes) {
            $textParts = $paragraph.SelectNodes('.//w:t | .//w:tab | .//w:br | .//w:cr', $ns) | ForEach-Object {
                if ($_.LocalName -in @('tab', 'br', 'cr')) {
                    ' '
                }
                else {
                    $_.InnerText
                }
            }
            $text = ConvertTo-PlainText (($textParts -join ''))
            if (-not [string]::IsNullOrWhiteSpace($text)) {
                $paragraphs.Add($text)
            }
        }

        $expandedParagraphs = Expand-CompoundParagraphs -Paragraphs ($paragraphs | ForEach-Object { $_ })
        return @(
            $expandedParagraphs |
            Where-Object {
                $_ -and
                $_ -notmatch '^(Tab|Page)\s+\d+$'
            } |
            ForEach-Object { $_ }
        )
    }
    finally {
        $zip.Dispose()
    }
}

function Get-DocxParagraphRecords {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "DOCX file not found: $Path"
    }

    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $entry = $zip.GetEntry('word/document.xml')
        if ($null -eq $entry) {
            throw "word/document.xml not found inside $Path"
        }

        $reader = [System.IO.StreamReader]::new($entry.Open())
        try {
            $xml = [xml]$reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }

        $ns = [System.Xml.XmlNamespaceManager]::new($xml.NameTable)
        $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        $records = New-Object System.Collections.Generic.List[object]
        $paragraphNumber = 0

        foreach ($paragraph in $xml.SelectNodes('//w:body/w:p', $ns)) {
            $paragraphNumber++
            $runs = New-Object System.Collections.Generic.List[object]
            foreach ($run in $paragraph.SelectNodes('.//w:r', $ns)) {
                $textParts = $run.SelectNodes('.//w:t | .//w:tab | .//w:br | .//w:cr', $ns) | ForEach-Object {
                    if ($_.LocalName -in @('tab', 'br', 'cr')) { ' ' } else { $_.InnerText }
                }
                $runText = ($textParts -join '')
                if (-not $runText) {
                    continue
                }

                $boldNode = $run.SelectSingleNode('./w:rPr/w:b', $ns)
                $italicNode = $run.SelectSingleNode('./w:rPr/w:i', $ns)
                $isBold = $null -ne $boldNode -and $boldNode.GetAttribute('val', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main') -notin @('0', 'false', 'off')
                $isItalic = $null -ne $italicNode -and $italicNode.GetAttribute('val', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main') -notin @('0', 'false', 'off')
                $runs.Add([pscustomobject][ordered]@{
                    Text = $runText
                    Bold = $isBold
                    Italic = $isItalic
                })
            }

            $text = ConvertTo-PlainText (($runs | ForEach-Object { $_.Text }) -join '')
            if (-not $text -or $text -match '^(Tab|Page)\s+\d+$') {
                continue
            }

            $textRuns = @($runs | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Text) })
            $leadingBold = New-Object System.Text.StringBuilder
            foreach ($run in $textRuns) {
                if (-not $run.Bold) {
                    break
                }
                [void]$leadingBold.Append($run.Text)
            }

            $expanded = @(Expand-CompoundParagraphs -Paragraphs @($text))
            foreach ($part in $expanded) {
                $preserveFormatting = $expanded.Count -eq 1
                $records.Add([pscustomobject][ordered]@{
                    Text = $part
                    SourceKind = 'docx'
                    ParagraphNumber = $paragraphNumber
                    Runs = $(if ($preserveFormatting) { @($runs | ForEach-Object { $_ }) } else { @() })
                    LeadingBoldText = $(if ($preserveFormatting) { ConvertTo-PlainText $leadingBold.ToString() } else { '' })
                    IsBold = $preserveFormatting -and $textRuns.Count -gt 0 -and @($textRuns | Where-Object { -not $_.Bold }).Count -eq 0
                    IsItalic = $preserveFormatting -and $textRuns.Count -gt 0 -and @($textRuns | Where-Object { -not $_.Italic }).Count -eq 0
                })
            }
        }

        return @($records | ForEach-Object { $_ })
    }
    finally {
        $zip.Dispose()
    }
}

function Get-TextParagraphRecords {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $paragraphs = Get-TextParagraphs -Path $Path
    $records = New-Object System.Collections.Generic.List[object]
    $number = 0
    foreach ($paragraph in $paragraphs) {
        $number++
        $records.Add([pscustomobject][ordered]@{
            Text = $paragraph
            SourceKind = 'text'
            ParagraphNumber = $number
            Runs = @()
            LeadingBoldText = ''
            IsBold = $false
            IsItalic = $false
        })
    }
    return @($records | ForEach-Object { $_ })
}

function Get-StatBlockParagraphRecords {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        '.docx' { return Get-DocxParagraphRecords -Path $Path }
        '.txt' { return Get-TextParagraphRecords -Path $Path }
        default { throw "Unsupported stat block file type. Supported types: .docx, .txt" }
    }
}

function Get-TextParagraphs {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Text file not found: $Path"
    }

    $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    $text = $text -replace [char]0xFEFF, ''
    $lines = $text -split "`r?`n"
    $paragraphs = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        $clean = ConvertTo-PlainText $line
        if (-not [string]::IsNullOrWhiteSpace($clean)) {
            $paragraphs.Add($clean)
        }
    }

    $expandedParagraphs = Expand-CompoundParagraphs -Paragraphs ($paragraphs | ForEach-Object { $_ })
    return @(
        $expandedParagraphs |
        Where-Object {
            $_ -and
            $_ -notmatch '^(Tab|Page)\s+\d+$'
        } |
        ForEach-Object { $_ }
    )
}

function Normalize-FeatListText {
    param([string]$Text)

    $clean = ConvertTo-PlainText $Text
    if (-not $clean) {
        return ''
    }

    # Dungeon-style stat blocks use a superscript B to mark bonus feats.
    # DOCX extraction flattens that superscript into the feat name, so remove
    # only a trailing B immediately before a top-level list separator.
    return ($clean -replace '(?<=[A-Za-z0-9\)])B(?=\s*(?:,|$))', '')
}

function Get-StatBlockParagraphs {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($extension) {
        '.docx' { return Get-DocxParagraphs -Path $Path }
        '.txt' { return Get-TextParagraphs -Path $Path }
        default {
            throw "Unsupported stat block file type '$extension'. Supported types: .docx, .txt"
        }
    }
}

function Expand-CompoundParagraphs {
    param([string[]]$Paragraphs)

    $expanded = New-Object System.Collections.Generic.List[string]
    $alignmentPattern = '(?:LG|NG|CG|LN|N|CN|LE|NE|CE|Lawful Good|Neutral Good|Chaotic Good|Lawful Neutral|True Neutral|Neutral|Chaotic Neutral|Lawful Evil|Neutral Evil|Chaotic Evil|Usually|Always|Often)'
    $sizePattern = '(?:Colossal|Gargantuan|Huge|Large|Medium|Small|Tiny|Diminutive|Fine)'
    $patterns = @(
        'Init ',
        'Aura ',
        'Languages ',
        'AC\*? ',
        '(?i)hp ',
        'Immune ',
        'Resist ',
        'Fort ',
        'Weakness(?:es)? ',
        'Sp(?:d|eed) ',
        'Melee\*? ',
        'Ranged ',
        'Space ',
        'Base Atk ',
        'Atk Options ',
        'Special Actions ',
        'Combat Gear ',
        'Spell-Like Abilities ',
        'Psi-Like Abilities ',
        'Powers Known ',
        'Imbued Spells ',
        'Spells Prepared/Known ',
        'Spells Prepared ',
        'Spells Known ',
        'Domains/Prohibited schools',
        '(?<!Spell-Like )(?<!Psi-Like )Abilities ',
        'SQ ',
        'Feats ',
        'Skills ',
        'Possessions ',
        'Spellbook '
    )

    foreach ($paragraph in $Paragraphs) {
        $text = ConvertTo-PlainText $paragraph
        if (-not $text) {
            continue
        }

        $text = [regex]::Replace(
            $text,
            '(\bCR\s+\d+(?:/\d+)?)(?=[A-Z])',
            ('$1' + [Environment]::NewLine)
        )

        $text = [regex]::Replace(
            $text,
            "([0-9a-z\)])((?:$alignmentPattern)\s+(?:$sizePattern)\b)",
            ('$1' + [Environment]::NewLine + '$2')
        )

        if ($text -notmatch '\bCR\s+\d+(?:/\d+)?\b') {
            foreach ($starter in ($script:ReferenceStarters | Sort-Object Length -Descending)) {
                $referencePattern = "$([regex]::Escape($starter))(?:\s+[A-Za-z0-9#&''/\-]+)*\s+\d+$"
                $text = [regex]::Replace(
                    $text,
                    "\s+(?=$referencePattern)",
                    [Environment]::NewLine
                )
                $text = [regex]::Replace(
                    $text,
                    "([a-z\)])(?=$referencePattern)",
                    ('$1' + [Environment]::NewLine)
                )
            }
        }

        $text = [regex]::Replace(
            $text,
            "(?<=[0-9A-Za-z\.\)])(?=(?:[A-Z][A-Za-z''/-]+(?:\s+[A-Z][A-Za-z''/-]+){0,4})\s+\((?:Ex|Su|Sp|Ps)\))",
            [Environment]::NewLine
        )

        foreach ($pattern in $patterns) {
            $text = [regex]::Replace(
                $text,
                "(?<=[0-9A-Za-z\.\)])(?=$pattern)",
                [Environment]::NewLine
            )
        }

        foreach ($part in ($text -split '\r?\n')) {
            foreach ($refinedPart in (Split-EmbeddedHeadingLine -Line $part)) {
                $clean = ConvertTo-PlainText $refinedPart
                if ($clean) {
                    $expanded.Add($clean)
                }
            }
        }
    }

    return @($expanded | ForEach-Object { $_ })
}

function Split-EmbeddedHeadingLine {
    param([string]$Line)

    $clean = ConvertTo-PlainText $Line
    if (-not $clean) {
        return @()
    }

    $headingPatterns = @(
        '^Init ',
        '^Aura ',
        '^Languages ',
        '^AC\*? ',
        '^(?i)hp ',
        '^Immune ',
        '^Resist ',
        '^Fort ',
        '^Weakness(?:es)? ',
        '^Sp(?:d|eed) ',
        '^Melee\*? ',
        '^Ranged ',
        '^Space ',
        '^Base Atk ',
        '^Atk Options ',
        '^Special Actions ',
        '^Combat Gear ',
        '^Spell-Like Abilities ',
        '^Psi-Like Abilities ',
        '^Powers Known ',
        '^Imbued Spells ',
        '^Spells Prepared/Known ',
        '^Spells Prepared ',
        '^Spells Known ',
        '^Abilities ',
        '^SQ ',
        '^Feats ',
        '^Skills ',
        '^Possessions ',
        '^Spellbook '
    )

    $secondaryPatterns = @(
        'AC\*? ',
        '(?i)hp ',
        'Immune ',
        'Resist ',
        'Fort ',
        'Weakness(?:es)? ',
        'Sp(?:d|eed) ',
        'Melee\*? ',
        'Ranged ',
        'Space ',
        'Base Atk ',
        'Atk Options ',
        'Special Actions ',
        'Combat Gear ',
        'Abilities ',
        'SQ ',
        'Feats ',
        'Skills ',
        'Possessions ',
        'Spellbook '
    )

    if (-not ($headingPatterns | Where-Object { $clean -match $_ } | Select-Object -First 1)) {
        return @($clean)
    }

    $bestIndex = $null
    foreach ($pattern in $secondaryPatterns) {
        foreach ($match in [regex]::Matches($clean, $pattern)) {
            if ($match.Index -le 0) {
                continue
            }

            if ($null -eq $bestIndex -or $match.Index -lt $bestIndex) {
                $bestIndex = $match.Index
            }
        }
    }

    if ($null -eq $bestIndex) {
        return @($clean)
    }

    $first = ConvertTo-PlainText $clean.Substring(0, $bestIndex)
    $second = ConvertTo-PlainText $clean.Substring($bestIndex)
    $result = New-Object System.Collections.Generic.List[string]
    if ($first) {
        $result.Add($first)
    }
    if ($second) {
        foreach ($child in (Split-EmbeddedHeadingLine -Line $second)) {
            $result.Add($child)
        }
    }

    return @($result | ForEach-Object { $_ })
}

function Split-ReferenceText {
    param([string]$Text)

    $result = [ordered]@{
        Main = (ConvertTo-PlainText $Text)
        Reference = ''
    }

    if (-not $result.Main) {
        return [pscustomobject]$result
    }

    foreach ($starter in ($script:ReferenceStarters | Sort-Object Length -Descending)) {
        $pattern = "(?<reference>$([regex]::Escape($starter))(?:\s+[A-Za-z0-9#&''/\-]+)*\s+\d+)$"
        $match = [regex]::Match($result.Main, $pattern)
        if (-not $match.Success -or $match.Index -le 0) {
            continue
        }

        $previous = $result.Main[$match.Index - 1]
        if (-not [char]::IsWhiteSpace($previous) -and $previous -notmatch '[a-z\)]') {
            continue
        }

        $result.Main = (ConvertTo-PlainText $result.Main.Substring(0, $match.Index))
        $result.Reference = (ConvertTo-PlainText $match.Groups['reference'].Value)
        break
    }

    return [pscustomobject]$result
}

function Parse-IdentityClasses {
    param([string]$IdentityLine)

    $result = [ordered]@{
        RaceText = ''
        Classes = @()
    }

    $clean = ConvertTo-PlainText $IdentityLine
    if (-not $clean) {
        return [pscustomobject]$result
    }

    $clean = $clean -replace '^(Male (?:and|or) female|Female (?:and|or) male|Male|Female)\s+', ''
    $segments = @($clean -split '/')
    $classes = New-Object System.Collections.Generic.List[object]
    $raceText = ''

    for ($index = 0; $index -lt $segments.Count; $index++) {
        $segment = ConvertTo-PlainText $segments[$index]
        if ($segment -notmatch '^(?<label>.+?)\s+(?<level>\d+)$') {
            continue
        }

        $label = (ConvertTo-PlainText $Matches.label)
        $level = [int]$Matches.level

        if ($index -eq 0) {
            $className = ''
            foreach ($knownName in ($script:KnownClassNames | Sort-Object Length -Descending)) {
                if ($label -match "(?i)^(?<race>.*?)(?<class>\b$([regex]::Escape($knownName))\b)$") {
                    $raceText = (ConvertTo-PlainText $Matches.race)
                    $className = (ConvertTo-PlainText $Matches.class)
                    break
                }
            }

            if (-not $className) {
                if ($label -match '^(?<race>.*\s)(?<class>[A-Za-z][A-Za-z''-]*)$') {
                    $raceText = (ConvertTo-PlainText $Matches.race)
                    $className = (ConvertTo-PlainText $Matches.class)
                }
                else {
                    $className = $label
                }
            }

            $classes.Add([pscustomobject]@{
                Name = $className
                Level = $level
            })

            continue
        }

        $classes.Add([pscustomobject]@{
            Name = $label
            Level = $level
        })
    }

    if ($classes.Count -gt 0) {
        $result.Classes = @($classes | ForEach-Object { $_ })
        $result.RaceText = $raceText
    }
    else {
        $result.RaceText = $clean
    }

    return [pscustomobject]$result
}

function Test-IsHeadingLine {
    param([string]$Line)

    $patterns = @(
        '^Init\b',
        '^Aura\b',
        '^Languages\b',
        '^AC\b',
        '^hp\b',
        '^Immune\b',
        '^Resist\b',
        '^Fort\b',
        '^Weakness',
        '^Sp(?:d|eed)\b',
        '^Melee\b',
        '^Ranged\b',
        '^Space\b',
        '^Base Atk\b',
        '^Atk Options\b',
        '^Special Actions\b',
        '^Combat Gear\b',
        '^Spells?\b',
        '^Domains\b',
        '^Prohibited Schools\b',
        '^Spell-Like Abilities\b',
        '^Psi-Like Abilities\b',
        '^Psionics\s*\(CL\b',
        '^Imbued Spells\b',
        '^Powers Known\b',
        '^Power Points\b',
        '^Abilities\b',
        '^SQ\b',
        '^Feats\b',
        '^Skills\b',
        '^Possessions\b',
        '^Spellbook\b'
    )

    return $patterns | Where-Object { $Line -match $_ } | Select-Object -First 1
}

function Parse-Header {
    param(
        [string]$Line,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $Line = ConvertTo-PlainText $Line

    $result = [ordered]@{
        Name = $Line
        CR   = ''
        Remainder = ''
    }

    if ($Line -match '^(?<name>.+?)\s+CR\s+(?<cr>\d+(?:/\d+)?|[-—])(?<rest>.*)$') {
        $result.Name = (ConvertTo-PlainText $Matches.name)
        $result.CR = (ConvertTo-PlainText $Matches.cr)
        $result.Remainder = (ConvertTo-PlainText $Matches.rest)
    }
    else {
        Add-Warning -Warnings $Warnings -Message 'Could not parse CR from the title line.'
    }

    return [pscustomobject]$result
}

function Parse-IdentityBlock {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $info = [ordered]@{
        IdentityLine  = ''
        AlignmentLine = ''
        ReferenceLine = ''
        RaceText      = ''
        TypeText      = ''
        Alignment     = ''
        SizeText      = 'Medium'
        SizeValue     = 0
        Classes       = @()
    }

    if ($Lines.Count -eq 0) {
        return [pscustomobject]$info
    }

    $alignmentLeadPattern = '^(?:LG|NG|CG|LN|N|CN|LE|NE|CE|Lawful Good|Neutral Good|Chaotic Good|Lawful Neutral|True Neutral|Neutral|Chaotic Neutral|Lawful Evil|Neutral Evil|Chaotic Evil|Usually|Always|Often)\b'
    $alignmentSearchPattern = '(?:LG|NG|CG|LN|N|CN|LE|NE|CE|Lawful Good|Neutral Good|Chaotic Good|Lawful Neutral|True Neutral|Neutral|Chaotic Neutral|Lawful Evil|Neutral Evil|Chaotic Evil|Usually|Always|Often)\s+(?:Colossal|Gargantuan|Huge|Large|Medium|Small|Tiny|Diminutive|Fine)\b'
    $combined = (ConvertTo-PlainText (($Lines | Where-Object { $_ }) -join ' '))
    $alignmentLineIndex = -1
    for ($index = 0; $index -lt $Lines.Count; $index++) {
        if ($Lines[$index] -match $alignmentLeadPattern) {
            $alignmentLineIndex = $index
            break
        }
    }

    if ($alignmentLineIndex -ge 0) {
        if ($alignmentLineIndex -gt 0) {
            $info.IdentityLine = (ConvertTo-PlainText (($Lines | Select-Object -First $alignmentLineIndex) -join ' '))
        }

        $referenceSplit = Split-ReferenceText -Text $Lines[$alignmentLineIndex]
        $info.AlignmentLine = $referenceSplit.Main
        $info.ReferenceLine = $referenceSplit.Reference

        if (-not $info.ReferenceLine -and ($alignmentLineIndex + 1) -lt $Lines.Count) {
            $trailingLines = @($Lines | Select-Object -Skip ($alignmentLineIndex + 1))
            if ($trailingLines) {
                $info.ReferenceLine = (ConvertTo-PlainText ($trailingLines -join ' '))
            }
        }
    }
    elseif ($combined -match $alignmentSearchPattern) {
        $alignmentMatch = [regex]::Match($combined, $alignmentSearchPattern)
        if ($alignmentMatch.Index -gt 0) {
            $info.IdentityLine = (ConvertTo-PlainText $combined.Substring(0, $alignmentMatch.Index))
        }

        $alignmentChunk = (ConvertTo-PlainText $combined.Substring($alignmentMatch.Index))
        $referenceSplit = Split-ReferenceText -Text $alignmentChunk
        $info.AlignmentLine = $referenceSplit.Main
        $info.ReferenceLine = $referenceSplit.Reference
    }
    else {
        $candidate = $Lines[0]
        $lineIndex = 0
        if ($candidate -notmatch $alignmentLeadPattern -and -not (Test-IsHeadingLine $candidate)) {
            $info.IdentityLine = $candidate
            $lineIndex = 1
        }

        if ($lineIndex -lt $Lines.Count -and $Lines[$lineIndex] -match $alignmentLeadPattern) {
            $referenceSplit = Split-ReferenceText -Text $Lines[$lineIndex]
            $info.AlignmentLine = $referenceSplit.Main
            $info.ReferenceLine = $referenceSplit.Reference
            $lineIndex++
        }

        if (-not $info.ReferenceLine -and $lineIndex -lt $Lines.Count -and -not (Test-IsHeadingLine $Lines[$lineIndex])) {
            $info.ReferenceLine = (ConvertTo-PlainText (($Lines | Select-Object -Skip $lineIndex) -join ' '))
        }
    }

    if ($info.AlignmentLine) {
        foreach ($alignmentCode in $script:AlignmentCodes) {
            if ($info.AlignmentLine -match ('^{0}\b' -f [regex]::Escape($alignmentCode))) {
                $info.Alignment = $alignmentCode
                break
            }
        }

        foreach ($sizeName in $script:SizeMap.Keys) {
            if ($info.AlignmentLine -match "\b$sizeName\b") {
                $info.SizeText = $sizeName
                $info.SizeValue = [int]$script:SizeMap[$sizeName]
                break
            }
        }

        $typeText = $info.AlignmentLine
        if ($info.Alignment) {
            $typeText = [regex]::Replace($typeText, ('^{0}\s*' -f [regex]::Escape($info.Alignment)), '')
        }
        if ($info.SizeText) {
            $typeText = [regex]::Replace($typeText, ('^{0}\s*' -f [regex]::Escape($info.SizeText)), '')
        }
        $info.TypeText = (ConvertTo-PlainText $typeText)
    }

    if ($info.IdentityLine) {
        $classData = Parse-IdentityClasses -IdentityLine $info.IdentityLine
        $info.Classes = @($classData.Classes | ForEach-Object { $_ })

        if ($classData.RaceText) {
            $info.RaceText = $classData.RaceText
        }
        else {
            $info.RaceText = (ConvertTo-PlainText ($info.IdentityLine -replace '^(Male (?:and|or) female|Female (?:and|or) male|Male|Female)\s+', ''))
        }
    }

    return [pscustomobject]$info
}

function Parse-InitiativeLine {
    param([string]$Line)

    $result = [ordered]@{
        Initiative = $null
        Senses     = ''
        Listen     = $null
        Spot       = $null
        Raw        = $Line
    }

    if ($Line -match '^Init\s+(?<init>[+\-]?\d+);?\s*(?<rest>.*)$') {
        $result.Initiative = [int]$Matches.init
        $rest = $Matches.rest
        if ($rest -match 'Senses\s+(?<senses>.*?)(?:;\s*Listen\s+(?<listen>[+\-]?\d+),\s*Spot\s+(?<spot>[+\-]?\d+))?$') {
            $result.Senses = (ConvertTo-PlainText $Matches.senses)
            if ($Matches['listen']) { $result.Listen = [int]$Matches['listen'] }
            if ($Matches['spot']) { $result.Spot = [int]$Matches['spot'] }
        }
        elseif ($rest) {
            $result.Senses = (ConvertTo-PlainText $rest)
        }
    }

    return [pscustomobject]$result
}

function Parse-AbilityScores {
    param([string]$Line)

    $scores = [ordered]@{
        Str = $null
        Dex = $null
        Con = $null
        Int = $null
        Wis = $null
        Cha = $null
    }

    if ($Line -match '^Abilities\s+(?<body>.+)$') {
        $body = $Matches.body
        foreach ($ability in @($scores.Keys)) {
            if ($body -match "$ability\s+(?<value>\d+)") {
                $scores[$ability] = [int]$Matches.value
            }
        }
    }

    return [pscustomobject]$scores
}

function Parse-Saves {
    param([string]$Line)

    $result = [ordered]@{
        Fort = $null
        Ref  = $null
        Will = $null
        Notes = ''
    }

    if ($Line -match '^Fort\s+(?<fort>[+\-]?\d+)(?:\s*\((?<fortNote>[^)]+)\))?\s*,?\s*Ref\s+(?<ref>[+\-]?\d+)(?:\s*\((?<refNote>[^)]+)\))?\s*,?\s*Will\s+(?<will>[+\-]?\d+)(?:\s*\((?<willNote>[^)]+)\))?(?<notes>.*)$') {
        $result.Fort = [int]$Matches.fort
        $result.Ref = [int]$Matches.ref
        $result.Will = [int]$Matches.will
        $noteParts = New-Object System.Collections.Generic.List[string]
        foreach ($noteKey in @('fortNote', 'refNote', 'willNote')) {
            $noteValue = (ConvertTo-PlainText $Matches[$noteKey])
            if ($noteValue) {
                $noteParts.Add($noteValue)
            }
        }
        $tailNotes = (ConvertTo-PlainText $Matches.notes.Trim(' ', ';', '(', ')'))
        if ($tailNotes) {
            $noteParts.Add($tailNotes)
        }
        $result.Notes = (($noteParts | ForEach-Object { $_ }) -join '; ')
    }

    return [pscustomobject]$result
}

function Parse-SpeedLine {
    param([string]$Line)

    $result = [ordered]@{
        Base = ''
        Fly = ''
        FlyManeuver = ''
        Swim = ''
        Climb = ''
        Burrow = ''
        Glide = ''
        Raw = $Line
    }

    if ($Line -notmatch '^Sp(?:d|eed)\s+(?<body>.+)$') {
        return [pscustomobject]$result
    }

    $body = $Matches.body
    if ($body -match '^(?<base>\d+\s*ft\.)') {
        $result.Base = $Matches.base
    }

    foreach ($label in @('fly', 'swim', 'climb', 'burrow', 'glide')) {
        if ($body -match "$label\s+(?<value>\d+\s*ft\.)(?:\s*\((?<qual>[^)]+)\))?") {
            switch ($label) {
                'fly' {
                    $result.Fly = $Matches.value
                    $result.FlyManeuver = (ConvertTo-PlainText $Matches.qual)
                }
                'swim' { $result.Swim = $Matches.value }
                'climb' { $result.Climb = $Matches.value }
                'burrow' { $result.Burrow = $Matches.value }
                'glide' { $result.Glide = $Matches.value }
            }
        }
    }

    return [pscustomobject]$result
}

function Parse-AcLine {
    param([string]$Line)

    $result = [ordered]@{
        Total = $null
        Touch = $null
        FlatFooted = $null
        Components = @()
        Notes = ''
        Raw = $Line
    }

    if ($Line -match '^AC\*?\s+(?<total>\d+)(?:\s*\((?<totalNote>[^)]+)\))?,\s*touch\s+(?<touch>\d+)(?:\s*\((?<touchNote>[^)]+)\))?,\s*flat-footed\s+(?<flat>\d+)(?:\s*\((?<flatNote>[^)]+)\))?(?<rest>.*)$') {
        $result.Total = [int]$Matches.total
        $result.Touch = [int]$Matches.touch
        $result.FlatFooted = [int]$Matches.flat
        $componentText = $Matches.rest
        $noteParts = New-Object System.Collections.Generic.List[string]
        foreach ($noteKey in @('totalNote', 'touchNote', 'flatNote')) {
            $noteValue = (ConvertTo-PlainText $Matches[$noteKey])
            if ($noteValue) {
                $noteParts.Add($noteValue)
            }
        }
        if ($componentText -match '\((?<components>[^)]+)\)') {
            $parts = Split-TopLevel -Text $Matches.components -Delimiters @(', ')
            $components = foreach ($part in $parts) {
                if ($part -match '^(?<bonus>[+\-]?\d+)\s+(?<type>.+)$') {
                    [pscustomobject]@{
                        Bonus = [int]$Matches.bonus
                        Type = (ConvertTo-PlainText $Matches.type)
                    }
                }
            }
            $result.Components = @($components)
        }

        $remainingText = [regex]::Replace($componentText, '\((?<components>[^)]+)\)', '').Trim(' ', ';', ',')
        if ($remainingText) {
            $noteParts.Add((ConvertTo-PlainText $remainingText))
        }
        $result.Notes = (($noteParts | ForEach-Object { $_ }) -join '; ')
    }

    return [pscustomobject]$result
}

function Parse-HpLine {
    param([string]$Line)

    $result = [ordered]@{
        HitPoints = $null
        HitDice = ''
        Extra = @()
        DamageReduction = ''
        Raw = $Line
    }

    if ($Line -match '^hp\s+(?<hp>\d+)\s+\((?<hd>[^)]+)\)(?<rest>.*)$') {
        $result.HitPoints = [int]$Matches.hp
        $result.HitDice = (ConvertTo-PlainText $Matches.hd)
        $rest = $Matches.rest.Trim(' ', ';')
        if ($rest) {
            $parts = Split-TopLevel -Text ($rest -replace '; ', ', ') -Delimiters @(', ')
            foreach ($part in $parts) {
                if ($part -match '^DR\s+(?<dr>.+)$') {
                    $result.DamageReduction = (ConvertTo-PlainText $Matches.dr)
                }
                else {
                    $result.Extra += (ConvertTo-PlainText $part)
                }
            }
        }
    }

    return [pscustomobject]$result
}

function Parse-ResistLine {
    param([string]$Line)

    $result = [ordered]@{
        Resist = ''
        SR = ''
    }

    if ($Line -match '^Resist\s+(?<resist>.*?)(?:\s+SR\s+(?<sr>\S+))?$') {
        $result.Resist = (ConvertTo-PlainText $Matches.resist)
        $result.SR = (ConvertTo-PlainText $Matches.sr)
    }

    return [pscustomobject]$result
}

function Parse-AttackPart {
    param(
        [string]$Text,
        [string]$Category
    )

    $clean = ConvertTo-PlainText $Text
    $entry = [ordered]@{
        Category = $Category
        Raw = $clean
        Name = $clean
        CountText = ''
        Bonuses = @()
        PrimaryBonus = $null
        Damage = ''
        DamageExpression = ''
        CritMin = 20
        CritMultiplier = 2
        Notes = ''
    }

    if ($clean -match '^(?<prefix>.+?)\s+(?<bonus>[+\-]?\d+(?:/[+\-]?\d+)*)\s*\((?<damage>[^)]+)\)(?<notes>.*)$') {
        $prefix = (ConvertTo-PlainText $Matches.prefix)
        $entry.Name = $prefix
        $entry.Damage = (ConvertTo-PlainText $Matches.damage)
        $entry.Notes = (ConvertTo-PlainText $Matches.notes.Trim(' ', ';', ','))

        $bonuses = @()
        foreach ($piece in $Matches.bonus.Split('/')) {
            if ($piece) {
                $bonuses += [int]$piece
            }
        }
        $entry.Bonuses = $bonuses
        if ($bonuses.Count -gt 0) {
            $entry.PrimaryBonus = $bonuses[0]
        }

        if ($prefix -match '^(?<count>\d+)\s+(?<name>.+)$') {
            $entry.CountText = $Matches.count
            $entry.Name = (ConvertTo-PlainText $Matches.name)
        }

        if ($entry.Damage -match '(?<expr>[^/]+)/(?:x)?(?<crit>[\d-]+)') {
            $entry.DamageExpression = (ConvertTo-PlainText $Matches.expr)
            $crit = $Matches.crit
            if ($crit -match '^(?<min>\d+)-\d+$') {
                $entry.CritMin = [int]$Matches.min
                $entry.CritMultiplier = 2
            }
            elseif ($crit -match '^(?<mult>\d+)$') {
                $entry.CritMultiplier = [int]$Matches.mult
            }
        }
        else {
            $entry.DamageExpression = $entry.Damage
        }
    }

    return [pscustomobject]$entry
}

function Parse-AttackLine {
    param(
        [string]$Line,
        [string]$Category
    )

    $prefix = if ($Category -eq 'Melee') { '^Melee\*?\s+' } else { '^Ranged\*?\s+' }
    $body = $Line -replace $prefix, ''
    $parts = Split-TopLevel -Text $body -Delimiters @(' and ', ' or ')
    $entries = foreach ($part in $parts) {
        Parse-AttackPart -Text $part -Category $Category
    }

    return @($entries | ForEach-Object { $_ })
}

function ConvertTo-NormalizedSpellName {
    param([string]$Name)

    $clean = ConvertTo-PlainText $Name
    $clean = $clean -creplace '(?<=[a-z\)])D$', ''
    $clean = $clean -replace '\([^)]*\)', ''
    $clean = $clean -replace '\bDC\s+\d+\b', ''
    $clean = $clean -replace '[!''’]', ''
    $clean = $clean -replace '\s+', ' '
    $clean = $clean.Trim(' ', ',', ';')
    return (Get-Culture).TextInfo.ToTitleCase($clean.ToLowerInvariant())
}

function Get-SpellMacroLibrary {
    param([string]$Path)

    $map = @{}
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return $map
    }

    Get-ChildItem -LiteralPath $Path -File -Filter '*.txt' | ForEach-Object {
        $displayName = $_.BaseName -replace '_', ' ' -replace ', ', ','
        $displayName = $displayName -replace '\s+', ' '
        $normalized = (ConvertTo-NormalizedSpellName $displayName).ToLowerInvariant()
        $map[$normalized] = [pscustomobject]@{
            Name = (ConvertTo-NormalizedSpellName $displayName)
            File = $_.FullName
            Macro = [System.IO.File]::ReadAllText($_.FullName)
        }
    }

    return $map
}

function Get-CastingTrack {
    param(
        [pscustomobject]$Identity,
        [string]$SpellHeading,
        [string]$HeaderRemainder
    )

    $heading = (ConvertTo-PlainText "$SpellHeading $HeaderRemainder").ToLowerInvariant()
    if ($heading -match 'psi|power') {
        return 'Psionic'
    }

    if ($heading -match 'domain') {
        return 'Divine'
    }

    if ($heading -match 'prohibited school|school') {
        return 'Arcane'
    }

    $classNames = @($Identity.Classes | ForEach-Object { $_.Name.ToLowerInvariant() })
    foreach ($name in $classNames) {
        if ($script:DivineClasses -contains $name) {
            return 'Divine'
        }
        if ($script:ArcaneClasses -contains $name) {
            return 'Arcane'
        }
        if ($script:PsionicClasses -contains $name) {
            return 'Psionic'
        }
    }

    return 'Arcane'
}

function Parse-SpellHeaderLine {
    param(
        [string]$Line,
        [pscustomobject]$Identity
    )

    $result = [ordered]@{
        Heading = ''
        Track = 'Arcane'
        CasterLevel = ''
        MeleeTouch = ''
        RangedTouch = ''
        InlineText = ''
    }

    if ($Line -match '^(?:(?<class>[A-Za-z][A-Za-z ''/-]+?)\s+)?(?<heading>Spell-Like Abilities|Psi-Like Abilities|Psionics|Powers Known|Imbued Spells|Spells Prepared/Known|Spells Prepared|Spells Known)\s*(?<paren>\([^)]*\))?:?\s*(?<tail>.*)$') {
        $classPrefix = ConvertTo-PlainText $Matches['class']
        $baseHeading = ConvertTo-PlainText $Matches.heading
        if ($baseHeading -eq 'Psionics') {
            $baseHeading = 'Psi-Like Abilities'
        }
        $inlineText = ConvertTo-PlainText $Matches['tail']
        $result.Heading = (("$classPrefix $baseHeading").Trim())
        $result.Track = Get-CastingTrack -Identity $Identity -SpellHeading $result.Heading -HeaderRemainder $Matches.paren
        $paren = ''
        if ($Matches.paren) {
            $paren = $Matches.paren.Trim('(', ')')
        }
        if ($paren -match 'CL\s+(?<cl>[^,]+)') {
            $result.CasterLevel = (ConvertTo-PlainText $Matches.cl)
        }
        if ($paren -match 'melee touch\s+(?<mt>[+\-]?\d+)') {
            $result.MeleeTouch = $Matches.mt
        }
        if ($paren -match 'ranged touch\s+(?<rt>[+\-]?\d+)') {
            $result.RangedTouch = $Matches.rt
        }
        $result.InlineText = $inlineText
    }

    return [pscustomobject]$result
}

function Parse-UsageEntries {
    param(
        [string]$Text,
        [pscustomobject]$Header
    )

    $normalized = ConvertTo-PlainText $Text
    if (-not $normalized) {
        return @()
    }

    $prepared = $normalized -replace '(?=At will-)', '||SEP||' `
                           -replace '(?=Constant-)', '||SEP||' `
                           -replace '(?=\d+/\w+-)', '||SEP||' `
                           -replace '(?=\d+/day-)', '||SEP||' `
                           -replace '(?=\d+/round-)', '||SEP||'

    $entries = New-Object System.Collections.Generic.List[object]
    foreach ($line in ($prepared -split '\|\|SEP\|\|')) {
        $piece = ConvertTo-PlainText $line
        if (-not $piece) {
            continue
        }

        if ($piece -match '^(?<usage>At will|Constant|\d+/\w+|\d+/day|\d+/round|\d+/week|\d+/month)-(?<body>.+)$') {
            $usage = ConvertTo-PlainText $Matches.usage
            $spellItems = Split-TopLevel -Text $Matches.body -Delimiters @(', ')
            foreach ($spellItem in $spellItems) {
                $dc = ''
                if ($spellItem -match '\(DC\s*(?<dc>\d+)\)') {
                    $dc = $Matches.dc
                }
                $entries.Add([pscustomobject]@{
                    Kind = 'SpellLike'
                    Usage = $usage
                    Name = ConvertTo-NormalizedSpellName $spellItem
                    Raw = (ConvertTo-PlainText $spellItem)
                    SaveDC = $dc
                    CasterLevel = $(if ($Header) { $Header.CasterLevel } else { '' })
                    Heading = $(if ($Header) { $Header.Heading } else { 'Spell-Like Abilities' })
                    MatchedMacro = ''
                    MatchedMacroPath = ''
                })
            }
        }
    }

    return @($entries | ForEach-Object { $_ })
}

function Parse-SpellLevelEntries {
    param(
        [string[]]$Lines,
        [pscustomobject]$Header,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $entries = New-Object System.Collections.Generic.List[object]
    $allLines = New-Object System.Collections.Generic.List[string]

    if ($Header.InlineText) {
        $allLines.Add($Header.InlineText)
    }
    foreach ($line in $Lines) {
        $allLines.Add((ConvertTo-PlainText $line))
    }

    $normalizedLevelLines = New-Object System.Collections.Generic.List[string]
    foreach ($sourceLine in $allLines) {
        foreach ($levelLine in [regex]::Split(
            $sourceLine,
            '\s+(?=\d+(?:st|nd|rd|th)?(?:\s*\([^)]+\))?\s*[-:])'
        )) {
            $cleanLevelLine = ConvertTo-PlainText $levelLine
            if ($cleanLevelLine) {
                $normalizedLevelLines.Add($cleanLevelLine)
            }
        }
    }

    if ($Header.Heading -match 'Spell-Like|Psi-Like') {
        return Parse-UsageEntries -Text (($allLines -join ' ')) -Header $Header
    }

    foreach ($line in $normalizedLevelLines) {
        if (-not $line) {
            continue
        }

        if ($line -match '^(?<level>\d+)(?:st|nd|rd|th)?(?:\s*\((?<slots>[^)]+)\))?\s*[-:]\s*(?<spells>.+)$') {
            $level = [int]$Matches.level
            $slots = (ConvertTo-PlainText $Matches['slots'])
            $spellItems = Split-TopLevel -Text $Matches.spells -Delimiters @(', ', '; ')
            foreach ($spellItem in $spellItems) {
                $dc = ''
                $prep = ''
                if ($spellItem -match '\(DC\s*(?<dc>\d+)\)') { $dc = $Matches.dc }
                if ($spellItem -match '\((?<count>\d+)\)$') { $prep = $Matches.count }

                $entries.Add([pscustomobject]@{
                    Kind = 'Spell'
                    Track = $Header.Track
                    Level = $level
                    Slots = $slots
                    CasterLevel = $Header.CasterLevel
                    Raw = (ConvertTo-PlainText $spellItem)
                    Name = (ConvertTo-NormalizedSpellName $spellItem)
                    SaveDC = $dc
                    PreparedCount = $prep
                    Heading = $Header.Heading
                    MatchedMacro = ''
                    MatchedMacroPath = ''
                })
            }

            continue
        }

        if ($line -match '^\*') {
            continue
        }

        Add-Warning -Warnings $Warnings -Message "Unparsed spell line: $line"
    }

    return @($entries | ForEach-Object { $_ })
}

function Parse-SkillEntries {
    param(
        [string]$Line,
        [pscustomobject]$AbilityScores,
        [int]$SizeValue,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $body = $Line -replace '^Skills\s+', ''
    $segments = Split-TopLevel -Text $body -Delimiters @(', ')
    $entries = New-Object System.Collections.Generic.List[object]

    foreach ($segment in $segments) {
        if ($segment -match '\bbonus\s+on\b') {
            continue
        }
        if ($segment -match '^(?<name>.+?)\s+(?<bonus>[+\-]?\d+)(?<notes>.*)$') {
            $name = (ConvertTo-PlainText $Matches.name)
            $bonus = [int]$Matches.bonus
            $notes = (ConvertTo-PlainText $Matches.notes.Trim(' ', ';'))
            $mapping = $null
            if ($script:SkillMap.ContainsKey($name)) {
                $mapping = $script:SkillMap[$name]
            }

            $customMapping = $null
            if (-not $mapping) {
                switch -Regex ($name) {
                    '^Craft\s+\(.+\)$' {
                        $customMapping = [pscustomobject]@{
                            DisplayName = $name
                            Ability = 'Int'
                        }
                        break
                    }
                    '^Perform\s+\(.+\)$' {
                        $customMapping = [pscustomobject]@{
                            DisplayName = $name
                            Ability = 'Cha'
                        }
                        break
                    }
                    '^Profession\s+\(.+\)$' {
                        $customMapping = [pscustomobject]@{
                            DisplayName = $name
                            Ability = 'Wis'
                        }
                        break
                    }
                    '^Knowledge\s+\(.+\)$' {
                        $customMapping = [pscustomobject]@{
                            DisplayName = $name
                            Ability = 'Int'
                        }
                        break
                    }
                }
            }

            $abilityValue = 0
            $computedMisc = $bonus
            if ($mapping) {
                $abilityProp = $mapping.Ability
                $abilityValue = Get-AbilityModifier -Score $AbilityScores.$abilityProp
                $extra = 0
                if ($mapping.Extra -eq 'HideSize') {
                    $extra = $SizeValue
                }
                $computedMisc = $bonus - $abilityValue - $extra
            }
            elseif ($customMapping) {
                $abilityValue = Get-AbilityModifier -Score $AbilityScores.$($customMapping.Ability)
                $computedMisc = $bonus - $abilityValue
            }
            else {
                Add-Warning -Warnings $Warnings -Message "Skill '$name' does not have a direct field mapping; it will be preserved in notes only."
            }

            $entries.Add([pscustomobject]@{
                Name = $name
                Bonus = $bonus
                Notes = $notes
                Mapping = $mapping
                CustomMapping = $customMapping
                AbilityModifier = $abilityValue
                MiscModifier = $computedMisc
            })
        }
    }

    return @($entries | ForEach-Object { $_ })
}

function ConvertTo-Base64Utf8 {
    param([string]$Text)
    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
}

function Get-SkillAbilityExpression {
    param([string]$Ability)

    switch ($Ability) {
        'Str' { return '@{str-mod} ' }
        'Dex' { return '@{dex-mod} ' }
        'Con' { return '@{con-mod} ' }
        'Int' { return '@{int-mod} ' }
        'Wis' { return '@{wis-mod} ' }
        'Cha' { return '@{cha-mod} ' }
        default { return '@{int-mod} ' }
    }
}

function ConvertTo-ReferenceMatchKey {
    param([string]$Name)

    $clean = ConvertTo-PlainText $Name
    $clean = $clean -replace '\(\s*DC\s+\d+\s*\)', ''
    $clean = $clean -replace '\(\s*\d+\s*\)$', ''
    $clean = $clean -replace '\s+(?:D|S|\[D\]|\[S\]|\*)$', ''
    $clean = $clean -replace "'", ''
    $clean = $clean.Replace([string][char]0x2019, '')
    $clean = $clean -replace '[^A-Za-z0-9]+', ' '
    return $clean.Trim().ToLowerInvariant()
}

function Test-IsUpperStatLine {
    param([string]$Line)

    return $Line -match '^(?:Init|Aura|Languages|AC|hp|Immune|Resist|Fort|Weakness(?:es)?|Spd|Speed|Melee|Ranged|Space|Base Atk|Atk Options|Special Actions|Combat Gear|Spell-Like Abilities|Psi-Like Abilities|Psionics|Powers Known|Imbued Spells|Spells Prepared/Known|Spells Prepared|Spells Known|Domains|Prohibited Schools|Abilities|SQ|Feats|Skills|Possessions|Spellbook)\b'
}

function Test-IsLowerEntryStart {
    param(
        [pscustomobject]$Record,
        [bool]$StatisticsSeen
    )

    if (-not $StatisticsSeen -or -not $Record -or -not $Record.Text) {
        return $false
    }
    if ($Record.Text -eq 'Spell Reference' -or (Test-IsUpperStatLine -Line $Record.Text)) {
        return $false
    }
    if ($Record.SourceKind -eq 'docx' -and $Record.LeadingBoldText) {
        return $true
    }
    return $Record.Text -match '^.+?(?:\s*\[[^\]]+\]|\s+\((?:Ex|Su|Sp|Ps)\))\s+.+$' -or
        $Record.Text -match '^Skills\s+\D' -or
        $Record.Text -match '^[A-Z][A-Za-z0-9'' -]{1,80}\s+(?:-|:|—)\s+.+$' -or
        $Record.Text -cmatch '^[A-Z][A-Za-z0-9''+() -]{1,80}?\s+(?:The|A|An|Full|When|Once|If|This)\b.+$'
}

function New-LowerEntryFromRecord {
    param(
        [pscustomobject]$Record,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $raw = ConvertTo-PlainText $Record.Text
    $name = ''
    $type = ''
    $typeStyle = 'untyped'
    $body = ''

    if ($Record.SourceKind -eq 'docx' -and $Record.LeadingBoldText) {
        $namePart = ConvertTo-PlainText $Record.LeadingBoldText
        $body = ConvertTo-PlainText $raw.Substring([Math]::Min($Record.LeadingBoldText.Length, $raw.Length))
        if ($namePart -match '^(?<name>.+?)\s*\[(?<type>[^\]]+)\]$') {
            $name = ConvertTo-PlainText $Matches.name
            $type = ConvertTo-PlainText $Matches.type
            $typeStyle = 'bracketed'
        }
        elseif ($namePart -match '^(?<name>.+?)\s+\((?<type>Ex|Su|Sp|Ps)\)$') {
            $name = ConvertTo-PlainText $Matches.name
            $type = $Matches.type
            $typeStyle = 'parenthetical'
        }
        else {
            $name = $namePart
            if ($body -match '^\s*\[(?<type>[^\]]+)\]\s*(?<body>.*)$') {
                $type = ConvertTo-PlainText $Matches.type
                $typeStyle = 'bracketed'
                $body = ConvertTo-PlainText $Matches.body
            }
        }
    }
    elseif ($raw -match '^(?<name>.+?)\s*\[(?<type>[^\]]+)\]\s+(?<body>.+)$') {
        $name = ConvertTo-PlainText $Matches.name
        $type = ConvertTo-PlainText $Matches.type
        $typeStyle = 'bracketed'
        $body = ConvertTo-PlainText $Matches.body
    }
    elseif ($raw -match '^(?<name>.+?)\s+\((?<type>Ex|Su|Sp|Ps)\)\s+(?<body>.+)$') {
        $name = ConvertTo-PlainText $Matches.name
        $type = $Matches.type
        $typeStyle = 'parenthetical'
        $body = ConvertTo-PlainText $Matches.body
    }
    elseif ($raw -match '^(?<name>Skills)\s+(?<body>.+)$') {
        $name = 'Skills'
        $body = ConvertTo-PlainText $Matches.body
    }
    elseif ($raw -match '^(?<name>.+?)\s+(?:-|:|—)\s+(?<body>.+)$') {
        $name = ConvertTo-PlainText $Matches.name
        $body = ConvertTo-PlainText $Matches.body
    }
    elseif ($raw -cmatch '^(?<name>[A-Z][A-Za-z0-9''+() -]{1,80}?)\s+(?<body>(?:The|A|An|Full|When|Once|If|This)\b.+)$') {
        $name = ConvertTo-PlainText $Matches.name
        $body = ConvertTo-PlainText $Matches.body
    }
    else {
        return $null
    }

    $normalizedRaw = $raw
    if ($typeStyle -eq 'bracketed') {
        $normalizedRaw = ("{0} [{1}] {2}" -f $name, $type, $body).Trim()
    }
    elseif ($typeStyle -eq 'parenthetical') {
        $normalizedRaw = ("{0} ({1}) {2}" -f $name, $type, $body).Trim()
    }

    return [pscustomobject][ordered]@{
        Name = $name
        Type = $type
        TypeStyle = $typeStyle
        Body = $body
        Raw = $normalizedRaw
    }
}

function Parse-LowerEntryRecords {
    param(
        [object[]]$Records,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $entries = New-Object System.Collections.Generic.List[object]
    $notes = New-Object System.Collections.Generic.List[string]
    foreach ($record in @($Records)) {
        if (-not $record -or -not $record.Text) {
            continue
        }
        $recordText = ConvertTo-PlainText $record.Text
        if ($recordText -match '^D\s*:?[ ]*Domain spell\.?$') {
            continue
        }
        if ($entries.Count -gt 0) {
            $previous = $entries[$entries.Count - 1]
            $isPotionStatContinuation = $previous.Name -match '^Potion of\b' -and
                $recordText -match '^(?:Spd|AC|Melee|Ranged|Skills)\b'
            if ($isPotionStatContinuation) {
                $previous.Body = (($previous.Body, $recordText | Where-Object { $_ }) -join "`n`n")
                $previous.Raw = (($previous.Raw, $recordText | Where-Object { $_ }) -join "`n`n")
                continue
            }
        }

        $entry = New-LowerEntryFromRecord -Record $record -Warnings $Warnings
        if ($entry) {
            $entries.Add($entry)
        }
        elseif ($entries.Count -gt 0) {
            $previous = $entries[$entries.Count - 1]
            $previous.Body = (($previous.Body, (ConvertTo-PlainText $record.Text) | Where-Object { $_ }) -join "`n`n")
            $previous.Raw = (($previous.Raw, (ConvertTo-PlainText $record.Text) | Where-Object { $_ }) -join "`n`n")
        }
        else {
            $preserved = ConvertTo-PlainText $record.Text
            $notes.Add($preserved)
            Add-Warning -Warnings $Warnings -Message "Ambiguous plain-text lower entry preserved as a note: $preserved"
        }
    }
    return [pscustomobject][ordered]@{
        Entries = @($entries | ForEach-Object { $_ })
        Notes = @($notes | ForEach-Object { $_ })
    }
}

function Parse-SpellReferenceRecords {
    param(
        [object[]]$Records,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $levels = New-Object System.Collections.Generic.List[object]
    $currentLevel = $null
    $currentSpell = $null

    $completeReferenceSpell = {
        if ($null -ne $currentSpell -and $null -ne $currentLevel) {
            $currentSpell.Body = ($currentSpell.BodyParagraphs -join "`n`n")
            $rawParts = @($currentSpell.Name)
            if ($currentSpell.CompactRules) { $rawParts += $currentSpell.CompactRules }
            $rawParts += @($currentSpell.BodyParagraphs)
            $currentSpell.Raw = ($rawParts -join "`n`n")
            $currentLevel.Spells += $currentSpell
            $currentSpell = $null
        }
    }

    for ($index = 0; $index -lt @($Records).Count; $index++) {
        $record = $Records[$index]
        $text = ConvertTo-PlainText $record.Text
        if (-not $text) { continue }

        if ($text -match '^(?<level>\d+)(?:st|nd|rd|th)?-Level Spells$') {
            . $completeReferenceSpell
            $currentLevel = [pscustomobject][ordered]@{
                Level = [int]$Matches.level
                Label = $text
                Spells = @()
            }
            $levels.Add($currentLevel)
            continue
        }

        if ($null -eq $currentLevel) {
            if ($text -match '(?i)spontaneous cure spells?.*included below') {
                continue
            }
            Add-Warning -Warnings $Warnings -Message "Spell Reference text before a level heading was preserved as a warning: $text"
            continue
        }

        $nextText = ''
        if (($index + 1) -lt @($Records).Count) {
            $nextText = ConvertTo-PlainText $Records[$index + 1].Text
        }
        $isSpellName = $record.IsBold -or
            ($record.SourceKind -eq 'text' -and $text.Length -le 100 -and $nextText -match ';')

        if ($isSpellName) {
            . $completeReferenceSpell
            $currentSpell = [pscustomobject][ordered]@{
                Name = $text
                MatchKey = ConvertTo-ReferenceMatchKey $text
                CompactRules = ''
                BodyParagraphs = @()
                Body = ''
                Raw = ''
                MatchedUpperSpell = $false
            }
            continue
        }

        if ($null -eq $currentSpell) {
            Add-Warning -Warnings $Warnings -Message "Spell Reference paragraph without a spell name was preserved as a warning: $text"
            continue
        }

        if (-not $currentSpell.CompactRules -and ($record.IsItalic -or $text -match ';')) {
            $currentSpell.CompactRules = $text
        }
        else {
            $currentSpell.BodyParagraphs += $text
        }
    }

    . $completeReferenceSpell
    return [pscustomobject][ordered]@{
        Heading = 'Spell Reference'
        Levels = @($levels | ForEach-Object { $_ })
    }
}

function Link-SpellReferenceEntries {
    param(
        [object[]]$UpperSpells,
        [pscustomobject]$SpellReference,
        [System.Collections.Generic.List[string]]$Warnings
    )

    $referenceMap = @{}
    foreach ($level in @($SpellReference.Levels)) {
        foreach ($reference in @($level.Spells)) {
            $key = ConvertTo-ReferenceMatchKey $reference.Name
            if (-not $referenceMap.ContainsKey($key)) {
                $referenceMap[$key] = New-Object System.Collections.Generic.List[object]
            }
            $referenceMap[$key].Add($reference)
        }
    }

    $seenUpper = @{}
    foreach ($spell in @($UpperSpells)) {
        $key = ConvertTo-ReferenceMatchKey $spell.Name
        if (-not $key) { continue }
        if (-not $seenUpper.ContainsKey($key)) { $seenUpper[$key] = $spell }
        if ($referenceMap.ContainsKey($key)) {
            $reference = $referenceMap[$key][0]
            $reference.MatchedUpperSpell = $true
            Add-Member -InputObject $spell -MemberType NoteProperty -Name Reference -Value $reference -Force
        }
    }

    foreach ($key in $seenUpper.Keys) {
        if (-not $referenceMap.ContainsKey($key)) {
            Add-Warning -Warnings $Warnings -Message "Upper spell '$($seenUpper[$key].Name)' has no matching Spell Reference entry."
        }
    }
    foreach ($level in @($SpellReference.Levels)) {
        foreach ($reference in @($level.Spells)) {
            if (-not $reference.MatchedUpperSpell) {
                if ($reference.Body -match '(?i)\bspontane(?:ous|ously)\b') {
                    continue
                }
                Add-Warning -Warnings $Warnings -Message "Spell Reference entry '$($reference.Name)' has no matching upper prepared/known spell."
            }
        }
    }
}

function ConvertTo-ProjectModel {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [string]$SpellMacroLibraryPath
    )

    $paragraphRecords = @(Get-StatBlockParagraphRecords -Path $Path)
    $paragraphs = @($paragraphRecords | ForEach-Object { $_.Text })
    $warnings = New-Object System.Collections.Generic.List[string]

    if ($paragraphs.Count -eq 0) {
        throw "No text paragraphs were extracted from $Path"
    }

    $header = Parse-Header -Line $paragraphs[0] -Warnings $warnings
    $identitySlice = New-Object System.Collections.Generic.List[string]
    if ($header.Remainder) {
        $identitySlice.Add($header.Remainder)
    }
    $lineIndex = 1
    while ($lineIndex -lt $paragraphs.Count -and -not (Test-IsHeadingLine $paragraphs[$lineIndex])) {
        $identitySlice.Add($paragraphs[$lineIndex])
        $lineIndex++
    }

    $identity = Parse-IdentityBlock -Lines $identitySlice -Warnings $warnings

    $model = [pscustomobject][ordered]@{
        Metadata = [pscustomobject][ordered]@{
            ParserVersion = $script:ParserVersion
            GeneratedAt = (Get-Date).ToString('s')
            SourcePath = $Path
            SpellMacroLibraryPath = $SpellMacroLibraryPath
            AvailableMacroCount = 0
        }
        Raw = [pscustomobject][ordered]@{
            Paragraphs = @($paragraphs)
            StatBlockText = ($paragraphs -join [Environment]::NewLine)
        }
        Creature = [pscustomobject][ordered]@{
            Name = $header.Name
            ChallengeRating = $header.CR
            Identity = $identity
            Initiative = $null
            Senses = ''
            Aura = ''
            Languages = ''
            AC = [pscustomobject][ordered]@{}
            HP = [pscustomobject][ordered]@{}
            Saves = [pscustomobject][ordered]@{}
            Resist = ''
            SR = ''
            Immune = ''
            Weaknesses = ''
            Speed = [pscustomobject][ordered]@{}
            Melee = ''
            Ranged = ''
            Attacks = @()
            Space = ''
            Reach = ''
            BaseAttack = ''
            Grapple = ''
            AttackOptions = ''
            SpecialActions = ''
            CombatGear = ''
            Spells = @()
            SpellLikeAbilities = @()
            Powers = @()
            Domains = ''
            Abilities = [pscustomobject][ordered]@{}
            SQ = ''
            Feats = ''
            ExpandedFeats = @()
            Skills = ''
            ExpandedSkillDetails = @()
            SkillEntries = @()
            SkillTricks = ''
            Possessions = ''
            Spellbook = ''
            Notes = @()
            SpecialAbilities = @()
            OrdinaryEntries = @()
            LowerSkillsEntry = $null
            SpellReference = [pscustomobject][ordered]@{
                Heading = ''
                Levels = @()
            }
        }
        Warnings = @()
    }

    $abilityScores = $null
    $spellHeader = $null
    $spellLines = New-Object System.Collections.Generic.List[string]
    $lowerStartIndex = -1
    $spellReferenceIndex = -1
    for ($candidateIndex = 0; $candidateIndex -lt $paragraphs.Count; $candidateIndex++) {
        if ($paragraphs[$candidateIndex] -eq 'Spell Reference') {
            $spellReferenceIndex = $candidateIndex
            break
        }
    }
    $upperLimit = $(if ($spellReferenceIndex -ge 0) { $spellReferenceIndex } else { $paragraphs.Count })

    while ($lineIndex -lt $upperLimit) {
        $line = $paragraphs[$lineIndex]

        $lowerSkillsStartsHere = $line -match '^Skills\s+\D' -and @($model.Creature.SkillEntries).Count -gt 0
        $isKnownUpperField = $line -match '^(?:Skill Tricks|Possessions|Combat Gear)\b'
        if ($lowerSkillsStartsHere -or (-not $isKnownUpperField -and (Test-IsLowerEntryStart -Record $paragraphRecords[$lineIndex] -StatisticsSeen ($null -ne $abilityScores)))) {
            $lowerStartIndex = $lineIndex
            break
        }

        if ($spellHeader -and $line -match '^D\s+domain spell;\s*Domains\s+(?<domains>.+)$') {
            $parsedSpellEntries = Parse-SpellLevelEntries -Lines $spellLines.ToArray() -Header $spellHeader -Warnings $warnings
            if ($spellHeader.Heading -match 'Spell-Like|Psi-Like') {
                $model.Creature.SpellLikeAbilities += $parsedSpellEntries
            }
            elseif ($spellHeader.Track -eq 'Psionic') {
                $model.Creature.Powers += $parsedSpellEntries
            }
            else {
                $model.Creature.Spells += $parsedSpellEntries
            }

            $model.Creature.Domains = (ConvertTo-PlainText $Matches.domains)
            $spellHeader = $null
            $spellLines.Clear()
            $lineIndex++
            continue
        }

        if ($spellHeader -and -not (Test-IsHeadingLine $line)) {
            $spellLines.Add($line)
            $lineIndex++
            continue
        }

        if ($spellHeader) {
            $parsedSpellEntries = Parse-SpellLevelEntries -Lines $spellLines.ToArray() -Header $spellHeader -Warnings $warnings
            if ($spellHeader.Heading -match 'Spell-Like|Psi-Like') {
                $model.Creature.SpellLikeAbilities += $parsedSpellEntries
            }
            elseif ($spellHeader.Track -eq 'Psionic') {
                $model.Creature.Powers += $parsedSpellEntries
            }
            else {
                $model.Creature.Spells += $parsedSpellEntries
            }
            $spellHeader = $null
            $spellLines.Clear()
        }

        switch -Regex ($line) {
            '^Init\b' {
                $init = Parse-InitiativeLine -Line $line
                $model.Creature.Initiative = $init.Initiative
                $model.Creature.Senses = $init.Senses
                if ($init.Listen -ne $null) { $model.Creature.Notes += "Listen $($init.Listen)" }
                if ($init.Spot -ne $null) { $model.Creature.Notes += "Spot $($init.Spot)" }
                break
            }
            '^Aura\b' { $model.Creature.Aura = ($line -replace '^Aura\s+', ''); break }
            '^Languages\b' { $model.Creature.Languages = ($line -replace '^Languages\s+', ''); break }
            '^AC\b' {
                $parsedAc = Parse-AcLine -Line $line
                if ($parsedAc.Total -ne $null) {
                    $model.Creature.AC = $parsedAc
                }
                else {
                    $model.Creature.Notes += $line
                }
                break
            }
            '^hp\b' {
                $parsedHp = Parse-HpLine -Line $line
                if ($parsedHp.HitPoints -ne $null) {
                    $model.Creature.HP = $parsedHp
                }
                else {
                    $model.Creature.Notes += $line
                }
                break
            }
            '^Immune\b' { $model.Creature.Immune = ($line -replace '^Immune\s+', ''); break }
            '^Resist\b' {
                $resist = Parse-ResistLine -Line $line
                $model.Creature.Resist = $resist.Resist
                $model.Creature.SR = $resist.SR
                break
            }
            '^Fort\b' {
                $parsedSaves = Parse-Saves -Line $line
                if ($parsedSaves.Fort -ne $null -and $parsedSaves.Ref -ne $null -and $parsedSaves.Will -ne $null) {
                    $model.Creature.Saves = $parsedSaves
                }
                else {
                    $model.Creature.Notes += $line
                }
                break
            }
            '^Weakness' { $model.Creature.Weaknesses = ($line -replace '^Weaknesses\s+', ''); break }
            '^Sp(?:d|eed)\b' { $model.Creature.Speed = Parse-SpeedLine -Line $line; break }
            '^Melee\b' {
                $model.Creature.Melee = $line
                $model.Creature.Attacks += Parse-AttackLine -Line $line -Category 'Melee'
                break
            }
            '^Ranged\b' {
                $model.Creature.Ranged = $line
                $model.Creature.Attacks += Parse-AttackLine -Line $line -Category 'Ranged'
                break
            }
            '^Space\b' {
                if ($line -match '^Space\s+(?<space>[^;]+);\s*Reach\s+(?<reach>.+)$') {
                    $model.Creature.Space = (ConvertTo-PlainText $Matches.space)
                    $model.Creature.Reach = (ConvertTo-PlainText $Matches.reach)
                }
                break
            }
            '^Base Atk\b' {
                if ($line -match '^Base Atk\s+(?<bab>[+\-]?\d+);\s*(?:Grp|Grapple)\s+(?<grp>[+\-]?\d+)') {
                    $model.Creature.BaseAttack = $Matches.bab
                    $model.Creature.Grapple = $Matches.grp
                }
                break
            }
            '^Atk Options\b' { $model.Creature.AttackOptions = ($line -replace '^Atk Options\s+', ''); break }
            '^Special Actions\b' { $model.Creature.SpecialActions = ($line -replace '^Special Actions\s+', ''); break }
            '^Combat Gear\b' { $model.Creature.CombatGear = ($line -replace '^Combat Gear\s*', ''); break }
            '^Spells\s+(?!Prepared\b|Known\b)' {
                $model.Creature.Notes += $line
                break
            }
            '^(?:[A-Za-z][A-Za-z ''/-]+?\s+)?(Spell-Like Abilities|Psi-Like Abilities|Psionics|Powers Known|Imbued Spells|Spells Prepared/Known|Spells Prepared|Spells Known)\b' {
                $spellHeader = Parse-SpellHeaderLine -Line $line -Identity $identity
                if ($spellHeader.Heading -match 'Spell-Like|Psi-Like' -and $spellHeader.InlineText) {
                    $model.Creature.SpellLikeAbilities += Parse-UsageEntries -Text $spellHeader.InlineText -Header $spellHeader
                    $spellHeader = $null
                }
                break
            }
            '^(Domains|Prohibited Schools)\b' { $model.Creature.Domains = ($line -replace '^(Domains/Prohibited schools|Domains|Prohibited Schools)\s*', ''); break }
            '^Abilities\b' {
                $abilityScores = Parse-AbilityScores -Line $line
                $model.Creature.Abilities = $abilityScores
                break
            }
            '^SQ\b' { $model.Creature.SQ = ($line -replace '^SQ\s+', ''); break }
            '^Feats\b' {
                $model.Creature.Feats = Normalize-FeatListText ($line -replace '^Feats\s+', '')
                break
            }
            '^Skills\b' {
                if ($model.Creature.SkillEntries -and $model.Creature.SkillEntries.Count -gt 0) {
                    $model.Creature.ExpandedSkillDetails += $line
                    $model.Creature.Notes += $line
                }
                elseif ($line -match '^Skills\s+(?!An?\b|The\b).*[+\-]\d') {
                    $model.Creature.Skills = ($line -replace '^Skills\s+', '')
                    if ($abilityScores) {
                        $model.Creature.SkillEntries = Parse-SkillEntries -Line $line -AbilityScores $abilityScores -SizeValue $identity.SizeValue -Warnings $warnings
                    }
                }
                else {
                    $model.Creature.Notes += $line
                }
                break
            }
            '^Skill Tricks\b' { $model.Creature.SkillTricks = ($line -replace '^Skill Tricks\s+', ''); break }
            '^Possessions\b' { $model.Creature.Possessions = ($line -replace '^Possessions\s+', ''); break }
            '^Spellbook\b' { $model.Creature.Spellbook = ($line -replace '^Spellbook\s+', ''); break }
            default {
                if ($line -match '^(?<name>.+?)\s+\[(?<category>[^\]]+)\]\s+(?<body>.+)$') {
                    if (Test-IsFeatCategory -Category $Matches.category) {
                        $model.Creature.ExpandedFeats += [pscustomobject]@{
                            Name = (ConvertTo-PlainText $Matches.name)
                            Category = (ConvertTo-PlainText $Matches.category)
                            Body = (ConvertTo-PlainText $Matches.body)
                            Raw = (ConvertTo-PlainText $line)
                        }
                    }
                    else {
                        $model.Creature.Notes += $line
                    }
                }
                elseif ($line -match '^(?<name>[^()]+?)\s+\((?<type>Ex|Su|Sp|Ps)\)\s*(?<body>.*)$') {
                    $model.Creature.SpecialAbilities += [pscustomobject]@{
                        Name = (ConvertTo-PlainText $Matches.name)
                        Type = $Matches.type
                        Body = (ConvertTo-PlainText $Matches.body)
                    }
                }
                else {
                    $model.Creature.Notes += $line
                }
            }
        }

        $lineIndex++
    }

    if ($spellHeader) {
        $parsedSpellEntries = Parse-SpellLevelEntries -Lines $spellLines.ToArray() -Header $spellHeader -Warnings $warnings
        if ($spellHeader.Heading -match 'Spell-Like|Psi-Like') {
            $model.Creature.SpellLikeAbilities += $parsedSpellEntries
        }
        elseif ($spellHeader.Track -eq 'Psionic') {
            $model.Creature.Powers += $parsedSpellEntries
        }
        else {
            $model.Creature.Spells += $parsedSpellEntries
        }
    }

    if ($lowerStartIndex -ge 0) {
        $lowerEndIndex = $(if ($spellReferenceIndex -ge 0) { $spellReferenceIndex } else { $paragraphRecords.Count })
        $lowerCount = $lowerEndIndex - $lowerStartIndex
        if ($lowerCount -gt 0) {
            $lowerRecords = @($paragraphRecords | Select-Object -Skip $lowerStartIndex -First $lowerCount)
            $lowerResult = Parse-LowerEntryRecords -Records $lowerRecords -Warnings $warnings
            $allLowerEntries = @($lowerResult.Entries)
            $model.Creature.OrdinaryEntries = @($allLowerEntries | Where-Object { $_.Name -ne 'Skills' })
            $model.Creature.Notes += @($lowerResult.Notes)
            foreach ($entry in $allLowerEntries) {
                $entryKey = ConvertTo-ReferenceMatchKey -Name $entry.Name
                $isListedFeat = @($model.Creature.Feats -split '\s*,\s*' | Where-Object {
                    (ConvertTo-ReferenceMatchKey -Name $_) -eq $entryKey
                }).Count -gt 0
                if ($entry.Name -eq 'Skills') {
                    $model.Creature.LowerSkillsEntry = $entry
                    $model.Creature.ExpandedSkillDetails += $entry.Raw
                }
                elseif (($entry.TypeStyle -eq 'bracketed' -and (Test-IsFeatCategory -Category $entry.Type)) -or $isListedFeat) {
                    $model.Creature.ExpandedFeats += [pscustomobject][ordered]@{
                        Name = $entry.Name
                        Category = $entry.Type
                        Body = $entry.Body
                        Raw = $entry.Raw
                    }
                }
                elseif ($entry.TypeStyle -ne 'bracketed') {
                    $model.Creature.SpecialAbilities += [pscustomobject][ordered]@{
                        Name = $entry.Name
                        Type = $entry.Type
                        Body = $entry.Body
                        Raw = $entry.Raw
                    }
                }
            }
        }
    }

    if ($spellReferenceIndex -ge 0) {
        $referenceRecords = @($paragraphRecords | Select-Object -Skip ($spellReferenceIndex + 1))
        $model.Creature.SpellReference = Parse-SpellReferenceRecords -Records $referenceRecords -Warnings $warnings
        Link-SpellReferenceEntries -UpperSpells @($model.Creature.Spells) -SpellReference $model.Creature.SpellReference -Warnings $warnings
    }
    elseif (@($model.Creature.Spells).Count -gt 0 -and [System.IO.Path]::GetExtension($Path).ToLowerInvariant() -eq '.docx') {
        Add-Warning -Warnings $warnings -Message 'Prepared or known spells were found, but the required Spell Reference section is missing.'
    }

    $macroLibrary = Get-SpellMacroLibrary -Path $SpellMacroLibraryPath

    if ($model.Creature.SpellLikeAbilities.Count -eq 0) {
        foreach ($paragraph in $paragraphs) {
            if ($paragraph -match '^(Spell-Like Abilities|Psi-Like Abilities|Psionics)\b.*?:\s*(?<body>.+)$') {
                $fallbackHeader = Parse-SpellHeaderLine -Line $paragraph -Identity $identity
                $model.Creature.SpellLikeAbilities += Parse-UsageEntries -Text $Matches['body'] -Header $fallbackHeader
            }
        }
    }

    foreach ($spell in @($model.Creature.Spells) + @($model.Creature.Powers) + @($model.Creature.SpellLikeAbilities)) {
        $normalizedName = $spell.Name.ToLowerInvariant()
        if ($macroLibrary.ContainsKey($normalizedName)) {
            Add-Member -InputObject $spell -MemberType NoteProperty -Name MatchedMacroPath -Value $macroLibrary[$normalizedName].File -Force
            Add-Member -InputObject $spell -MemberType NoteProperty -Name MatchedMacro -Value $macroLibrary[$normalizedName].Macro -Force
        }
        else {
            Add-Member -InputObject $spell -MemberType NoteProperty -Name MatchedMacroPath -Value '' -Force
            Add-Member -InputObject $spell -MemberType NoteProperty -Name MatchedMacro -Value '' -Force
        }
    }

    $model.Warnings = @($warnings)
    $model.Metadata.AvailableMacroCount = $macroLibrary.Count

    return [pscustomobject]$model
}

function New-AttributeTable {
    $table = [ordered]@{}
    return @{
        Set = ({
            param($Name, $Current, $Max = $null)
            $table[$Name] = [ordered]@{
                name = $Name
                current = if ($null -eq $Current) { '' } else { [string]$Current }
                max = if ($null -eq $Max) { '' } else { [string]$Max }
            }
        }.GetNewClosure())
        Get = ({
            return @($table.Values)
        }.GetNewClosure())
    }
}

function Get-TrackSuffix {
    param(
        [ValidateSet('Divine', 'Arcane', 'Psionic')]
        [string]$Track,
        [int]$Level
    )

    switch ($Track) {
        'Divine' { return '{0}1' -f $Level }
        'Arcane' { return '{0}2' -f $Level }
        'Psionic' { return '{0}3' -f $Level }
    }
}

function Get-CasterAttributeForTrack {
    param(
        [ValidateSet('Divine', 'Arcane', 'Psionic')]
        [string]$Track
    )

    switch ($Track) {
        'Divine' { return 'casterlevel' }
        'Arcane' { return 'casterlevel2' }
        'Psionic' { return 'manifesterlevel' }
    }
}

function Convert-MacroForTrack {
    param(
        [string]$Macro,
        [ValidateSet('Divine', 'Arcane', 'Psionic')]
        [string]$Track,
        [int]$Level
    )

    if (-not $Macro) {
        return ''
    }

    $adapted = $Macro -replace '@\{spellPen\}', '@{spellpen}'
    switch ($Track) {
        'Divine' {
            $adapted = $adapted -replace '@\{casterlevel2\}', '@{casterlevel}'
            $adapted = $adapted -replace '@\{arcanecasterlevel\}', '@{casterlevel}'
            $adapted = $adapted -replace '@\{divinecasterlevel\}', '@{casterlevel}'
        }
        'Arcane' {
            $adapted = $adapted -replace '@\{casterlevel\}', '@{casterlevel2}'
            $adapted = $adapted -replace '@\{divinecasterlevel\}', '@{casterlevel2}'
            $adapted = $adapted -replace '@\{arcanecasterlevel\}', '@{casterlevel2}'
        }
        'Psionic' {
            $adapted = $adapted -replace '@\{casterlevel2\}', '@{manifesterlevel}'
            $adapted = $adapted -replace '@\{casterlevel\}', '@{manifesterlevel}'
            $adapted = $adapted -replace '@\{arcanecasterlevel\}', '@{manifesterlevel}'
            $adapted = $adapted -replace '@\{divinecasterlevel\}', '@{manifesterlevel}'
        }
    }

    if ($adapted -match '@\{spellcastingstatmod\}') {
        if ($Track -eq 'Psionic') {
            $adapted = $adapted -replace '@\{spellcastingstatmod\}', '0'
        }
        else {
            $adapted = $adapted -replace '@\{spellcastingstatmod\}', "([[ @{spelldc$Level} - 10 - $Level ]])"
        }
    }

    return $adapted
}

function New-GenericSpellMacro {
    param(
        [string]$SpellName,
        [ValidateSet('Divine', 'Arcane', 'Psionic')]
        [string]$Track,
        [int]$Level,
        [string]$SaveDC,
        [string]$Usage,
        [string]$RawNotes
    )

    $casterAttribute = Get-CasterAttributeForTrack -Track $Track
    $notes = if ($RawNotes) { $RawNotes } else { 'Imported from Dungeon-style stat block.' }
    $macro = "&{template:DnD35StdRoll} {{spellflag=true}} {{name=@{character_name}}} {{subtags=Imported: $SpellName}}"
    if ($Usage) { $macro += " {{check=Usage}} {{checkroll=$Usage}}" }
    if ($SaveDC) { $macro += " {{Saving Throw:= DC $SaveDC}}" }
    $macro += " {{Caster level check:= [[ 1d20+@{$casterAttribute}+@{spellpen} ]] vs spell resistance}}"
    $macro += " {{notes=$notes}}"
    return $macro
}

function New-SpecialAbilityMacro {
    param(
        [string]$Name,
        [string]$Body
    )

    $safeBody = ($Body -replace '\{', '\(' -replace '\}', '\)')
    return "&{template:DnD35StdRoll} {{abilityflag=true}} {{name=@{character_name}}} {{check=$Name}} {{notes=$safeBody}}"
}

function ConvertTo-FullAttackMacro {
    param(
        [string]$WeaponName,
        [int[]]$Bonuses,
        [string]$Damage,
        [int]$CritMin,
        [string]$Notes,
        [int]$RepeatCount = 1
    )

    $attackBonuses = New-Object System.Collections.Generic.List[int]
    if ($Bonuses.Count -gt 0) {
        foreach ($bonus in $Bonuses) { $attackBonuses.Add($bonus) }
    }
    elseif ($RepeatCount -gt 0) {
        $attackBonuses.Add(0)
    }

    if ($RepeatCount -gt $attackBonuses.Count -and $attackBonuses.Count -eq 1) {
        for ($i = 1; $i -lt $RepeatCount; $i++) { $attackBonuses.Add($attackBonuses[0]) }
    }

    $template = "&{template:DnD35Attack} {{pcflag=true}} {{name=@{character_name}}} {{subtags=attacks with $WeaponName}}"
    for ($i = 0; $i -lt $attackBonuses.Count; $i++) {
        $slot = $i + 1
        $bonus = $attackBonuses[$i]
        $template += " {{attack${slot}=A${slot}: [[ 1d20cs>$CritMin + $bonus ]] }}"
        $template += " {{critconfirm${slot}=Crit?: [[ 1d20cs>$CritMin + $bonus ]] }}"
        if ($Damage) {
            $template += " {{damage${slot}=D${slot}: [[ $Damage ]] }}"
            $template += " {{critdmg${slot}=+ [[ $Damage ]] }}"
        }
    }
    $template += " {{fullattackflag=[[d1]]}}"
    if ($Notes) { $template += " {{notes=$Notes}}" }

    return $template
}

function ConvertTo-Roll20Payload {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Project
    )

    $attributeTable = [ordered]@{}
    $setAttribute = {
        param($Name, $Current, $Max = $null)
        $attributeTable[$Name] = [ordered]@{
            name = $Name
            current = if ($null -eq $Current) { '' } else { [string]$Current }
            max = if ($null -eq $Max) { '' } else { [string]$Max }
        }
    }.GetNewClosure()
    $rows = New-Object System.Collections.Generic.List[object]
    $abilities = New-Object System.Collections.Generic.List[object]

    & $setAttribute 'character_name' $Project.Creature.Name
    & $setAttribute 'character-name2' $Project.Creature.Name
    & $setAttribute 'race' $Project.Creature.Identity.RaceText
    & $setAttribute 'racetype' $Project.Creature.Identity.TypeText
    & $setAttribute 'alignment' $Project.Creature.Identity.Alignment
    & $setAttribute 'size' $Project.Creature.Identity.SizeValue
    $levelTotal = ($Project.Creature.Identity.Classes | Measure-Object -Property Level -Sum).Sum
    if (-not $levelTotal) {
        $levelTotal = ($Project.Creature.HP.HitDice -replace '\D', '')
    }
    & $setAttribute 'level' $levelTotal
    & $setAttribute 'hitdie' ($Project.Creature.HP.HitDice -replace '\D', '')
    & $setAttribute 'hitpoint' $Project.Creature.HP.HitPoints
    & $setAttribute 'hitpoints' $Project.Creature.HP.HitPoints $Project.Creature.HP.HitPoints
    & $setAttribute 'init' $Project.Creature.Initiative
    & $setAttribute 'languages' $Project.Creature.Languages
    & $setAttribute 'feats' $Project.Creature.Feats
    & $setAttribute 'bab' $Project.Creature.BaseAttack
    & $setAttribute 'spellresistance' $Project.Creature.SR
    & $setAttribute 'damagereduction' $Project.Creature.HP.DamageReduction
    & $setAttribute 'speed' ($Project.Creature.Speed.Base -replace '\s*ft\.', '')
    & $setAttribute 'fly-speed' ($Project.Creature.Speed.Fly -replace '\s*ft\.', '')
    & $setAttribute 'fly-maneuver' $Project.Creature.Speed.FlyManeuver
    & $setAttribute 'swim-speed' ($Project.Creature.Speed.Swim -replace '\s*ft\.', '')
    & $setAttribute 'climb-speed' ($Project.Creature.Speed.Climb -replace '\s*ft\.', '')
    & $setAttribute 'burrow-speed' ($Project.Creature.Speed.Burrow -replace '\s*ft\.', '')
    & $setAttribute 'attackmode' 2
    & $setAttribute 'criticmode' 4
    & $setAttribute 'damagemode' 1
    & $setAttribute 'spellmode' 2
    & $setAttribute 'npc-show' 0

    if ($Project.Creature.Abilities) {
        foreach ($abilityName in @('Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha')) {
            $score = $Project.Creature.Abilities.$abilityName
            $lower = $abilityName.ToLowerInvariant()
            if ($null -ne $score) {
                & $setAttribute "$lower-base" $score
                & $setAttribute "$lower-misc" 0
                & $setAttribute "$lower-equi" 0
                & $setAttribute "$lower-temp" 0
            }
        }
    }

    if ($Project.Creature.Saves) {
        $dexMod = Get-AbilityModifier -Score $Project.Creature.Abilities.Dex
        $conMod = Get-AbilityModifier -Score $Project.Creature.Abilities.Con
        $wisMod = Get-AbilityModifier -Score $Project.Creature.Abilities.Wis

        & $setAttribute 'fortitudebase' 0
        & $setAttribute 'fortitudeability' $conMod
        & $setAttribute 'fortitudemiscmod' ($Project.Creature.Saves.Fort - $conMod)
        & $setAttribute 'fortitudenote' $Project.Creature.Saves.Notes

        & $setAttribute 'reflexbase' 0
        & $setAttribute 'reflexability' $dexMod
        & $setAttribute 'reflexmiscmod' ($Project.Creature.Saves.Ref - $dexMod)
        & $setAttribute 'reflexnote' $Project.Creature.Saves.Notes

        & $setAttribute 'willbase' 0
        & $setAttribute 'willability' $wisMod
        & $setAttribute 'willmiscmod' ($Project.Creature.Saves.Will - $wisMod)
        & $setAttribute 'willnote' $Project.Creature.Saves.Notes
    }

    if ($Project.Creature.AC.Total) {
        $sizeValue = [int]$Project.Creature.Identity.SizeValue
        $dexMod = Get-AbilityModifier -Score $Project.Creature.Abilities.Dex
        $naturalArmor = 0
        foreach ($component in $Project.Creature.AC.Components) {
            if ($component.Type -match 'natural') {
                $naturalArmor += [int]$component.Bonus
            }
        }

        $touchResidual = [int]$Project.Creature.AC.Touch - (10 + $dexMod + $sizeValue)
        $flatResidual = [int]$Project.Creature.AC.FlatFooted - (10 + $sizeValue + $naturalArmor)

        & $setAttribute 'naturalarmor1inuse' 1
        & $setAttribute 'naturalarmor1bonus' $naturalArmor
        if ($touchResidual -ne 0) {
            & $setAttribute 'miscac1inuse' 1
            & $setAttribute 'miscac1bonus' $touchResidual
            & $setAttribute 'miscac1stdac' 1
            & $setAttribute 'miscac1touchac' 1
            & $setAttribute 'miscac1ffac' 1
            & $setAttribute 'miscac1immoblac' 1
        }
        if ($flatResidual -ne $touchResidual) {
            & $setAttribute 'miscac2inuse' 1
            & $setAttribute 'miscac2bonus' ($flatResidual - $touchResidual)
            & $setAttribute 'miscac2stdac' 1
            & $setAttribute 'miscac2touchac' 0
            & $setAttribute 'miscac2ffac' 1
            & $setAttribute 'miscac2immoblac' 1
        }
    }

    if ($Project.Creature.SkillEntries) {
        foreach ($skill in $Project.Creature.SkillEntries) {
            if ($skill.Mapping) {
                & $setAttribute ("{0}ranks" -f $skill.Mapping.Prefix) 0
                & $setAttribute ("{0}miscmod" -f $skill.Mapping.Prefix) $skill.MiscModifier
                & $setAttribute ("{0}tempmod" -f $skill.Mapping.Prefix) 0
            }
            elseif ($skill.CustomMapping) {
                $rows.Add([pscustomobject]@{
                    section = 'skills'
                    fields = [ordered]@{
                        otherskillname = $skill.CustomMapping.DisplayName
                        otherskillstat = (Get-SkillAbilityExpression -Ability $skill.CustomMapping.Ability)
                        otherskillranks = '0'
                        otherskillarmorcheckpen = '0'
                        otherskillmiscmod = [string]$skill.MiscModifier
                        otherskilltempmod = '0'
                        otherskillactionmod = '0'
                        otherskillnote = $skill.Notes
                        otherskillwgm = ' '
                    }
                })
            }
        }
    }

    $weaponSlot = 1
    foreach ($attack in $Project.Creature.Attacks | Select-Object -First 10) {
        $repeatCount = if ($attack.CountText) { [int]$attack.CountText } elseif ($attack.Bonuses.Count -gt 1) { $attack.Bonuses.Count } else { 1 }
        $slotPrefix = "weapon$weaponSlot"
        $notesText = @("Imported: $($attack.Raw)") -join ' | '
        $primaryBonus = if ($attack.PrimaryBonus -ne $null) { $attack.PrimaryBonus } else { 0 }
        $damageExpression = if ($attack.DamageExpression) { $attack.DamageExpression } else { '0' }

        & $setAttribute ("{0}name" -f $slotPrefix) $attack.Name
        & $setAttribute ("{0}specialproperties" -f $slotPrefix) $notesText
        & $setAttribute ("{0}critmin" -f $slotPrefix) $attack.CritMin
        & $setAttribute ("{0}critmult" -f $slotPrefix) $attack.CritMultiplier
        & $setAttribute ("{0}attackcalc" -f $slotPrefix) ("1d20cs>{0} + {1}" -f $attack.CritMin, $primaryBonus)
        & $setAttribute ("{0}damage" -f $slotPrefix) $damageExpression
        & $setAttribute ("{0}critcustomunited" -f $slotPrefix) $damageExpression
        & $setAttribute ("{0}attackmacrosinglecustomunited" -f $slotPrefix) (ConvertTo-FullAttackMacro -WeaponName $attack.Name -Bonuses @($primaryBonus) -Damage $damageExpression -CritMin $attack.CritMin -Notes $notesText)
        & $setAttribute ("{0}fullattackmacrosinglecustomunited" -f $slotPrefix) (ConvertTo-FullAttackMacro -WeaponName $attack.Name -Bonuses $attack.Bonuses -Damage $damageExpression -CritMin $attack.CritMin -Notes $notesText -RepeatCount $repeatCount)
        $weaponSlot++
    }

    & $setAttribute 'notes1groupname' 'Imported Stat Block'
    & $setAttribute 'notes2groupname' 'Import Notes & Warnings'
    $rows.Add([pscustomobject]@{
        section = 'notes1'
        fields = [ordered]@{
            note1date = (Get-Date).ToString('yyyy-MM-dd')
            note1body = $Project.Raw.StatBlockText
        }
    })
    foreach ($warning in $Project.Warnings) {
        $rows.Add([pscustomobject]@{
            section = 'notes2'
            fields = [ordered]@{
                note2date = (Get-Date).ToString('yyyy-MM-dd')
                note2body = $warning
            }
        })
    }
    foreach ($note in $Project.Creature.Notes) {
        $rows.Add([pscustomobject]@{
            section = 'notes2'
            fields = [ordered]@{
                note2date = ''
                note2body = $note
            }
        })
    }

    foreach ($spell in $Project.Creature.Spells) {
        $suffix = Get-TrackSuffix -Track $spell.Track -Level $spell.Level
        $macro = if ($spell.MatchedMacro) { Convert-MacroForTrack -Macro $spell.MatchedMacro -Track $spell.Track -Level $spell.Level } else { New-GenericSpellMacro -SpellName $spell.Name -Track $spell.Track -Level $spell.Level -SaveDC $spell.SaveDC -Usage $spell.Slots -RawNotes $spell.Raw }
        $rows.Add([pscustomobject]@{
            section = "spells$($suffix)"
            fields = [ordered]@{
                ("spellused$($suffix)") = '0'
                ("spellprep$($suffix)") = if ($spell.PreparedCount) { [string]$spell.PreparedCount } else { '' }
                ("spellname$($suffix)") = $spell.Name
                ("spelllevel$($suffix)") = [string]$spell.Level
                ("spellmacro$($suffix)") = $macro
            }
        })
        if ($spell.MatchedMacro) {
            $abilities.Add([pscustomobject]@{
                name = "Spell: $($spell.Name)"
                action = $macro
                istokenaction = $false
            })
        }
    }

    foreach ($ability in $Project.Creature.SpecialAbilities) {
        $abilities.Add([pscustomobject]@{
            name = "$($ability.Name) ($($ability.Type))"
            action = New-SpecialAbilityMacro -Name $ability.Name -Body $ability.Body
            istokenaction = $false
        })
    }

    foreach ($spellLike in $Project.Creature.SpellLikeAbilities) {
        $action = if ($spellLike.MatchedMacro) {
            Convert-MacroForTrack -Macro $spellLike.MatchedMacro -Track 'Arcane' -Level 0
        }
        else {
            New-GenericSpellMacro -SpellName $spellLike.Name -Track 'Arcane' -Level 0 -SaveDC $spellLike.SaveDC -Usage $spellLike.Usage -RawNotes $spellLike.Raw
        }
        $abilities.Add([pscustomobject]@{
            name = "SLA: $($spellLike.Name)"
            action = $action
            istokenaction = $false
        })
    }

    $payload = [pscustomobject][ordered]@{
        version = 1
        source = [pscustomobject][ordered]@{
            parserVersion = $Project.Metadata.ParserVersion
            sourcePath = $Project.Metadata.SourcePath
        }
        character = [pscustomobject][ordered]@{
            name = $Project.Creature.Name
            bio = $Project.Raw.StatBlockText
            gmnotes = $Project.Raw.StatBlockText
        }
        attributes = @($attributeTable.Values | ForEach-Object { $_ })
        rows = @($rows | ForEach-Object { $_ })
        abilities = @($abilities | ForEach-Object { $_ })
        warnings = @($Project.Warnings)
    }

    return $payload
}

function Export-ProjectJson {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Project,
        [Parameter(Mandatory)]
        [string]$Path
    )

    $json = $Project | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($Path, $json, [System.Text.Encoding]::UTF8)
}

function Import-ProjectJson {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $json = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    return $json | ConvertFrom-Json
}

function Get-Roll20ChatCommand {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Payload
    )

    $json = $Payload | ConvertTo-Json -Depth 12 -Compress
    $encoded = ConvertTo-Base64Utf8 -Text $json
    return "!dsb-import $encoded"
}

function Get-Roll20HandoutPayload {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Payload
    )

    $json = $Payload | ConvertTo-Json -Depth 12 -Compress
    $encoded = ConvertTo-Base64Utf8 -Text $json
    return "BEGIN_DSB_PAYLOAD`n$encoded`nEND_DSB_PAYLOAD"
}

Export-ModuleMember -Function @(
    'ConvertTo-ProjectModel',
    'ConvertTo-Roll20Payload',
    'Export-ProjectJson',
    'Import-ProjectJson',
    'Get-StatBlockParagraphs',
    'Get-DocxParagraphs',
    'Get-Roll20ChatCommand',
    'Get-Roll20HandoutPayload'
)
