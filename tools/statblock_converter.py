from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable


DEFAULT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT_DIR = DEFAULT_ROOT / "Stat Blocks"
DEFAULT_OUTPUT_DIR = DEFAULT_ROOT / "Converted JSON"
DEFAULT_REPORT_DIR = DEFAULT_ROOT / "reports"
DEFAULT_SPELL_DIR = DEFAULT_ROOT / "Spell Macros"

MAIN_SECTION_PREFIXES = (
    "Init ",
    "Aura ",
    "Languages ",
    "AC ",
    "hp ",
    "Hp ",
    "Immune ",
    "Resist ",
    "Fort ",
    "Weaknesses ",
    "Spd ",
    "Melee ",
    "Ranged ",
    "Space ",
    "Base Atk ",
    "Atk Options ",
    "Special Actions ",
    "Combat Gear ",
    "Abilities ",
    "SQ ",
    "Feats ",
    "Skills ",
    "Possessions ",
    "Spellbook ",
)

DEFENSE_PREFIXES = (
    "AC ",
    "hp ",
    "Hp ",
    "Immune ",
    "Resist ",
    "Fort ",
    "Weaknesses ",
)

OFFENSE_PREFIXES = (
    "Spd ",
    "Speed ",
    "Melee ",
    "Ranged ",
    "Space ",
    "Base Atk ",
    "Atk Options ",
    "Special Actions ",
    "Combat Gear ",
)

STAT_PREFIXES = (
    "Abilities ",
    "SQ ",
    "Feats ",
    "Skills ",
    "Possessions ",
    "Spellbook ",
)

SPELL_HEADER_RE = re.compile(
    r"^(?P<label>.+?)\s*\(CL\s+(?P<caster_level>[^,)]+)(?:,\s*(?P<extras>[^)]+))?\):?$"
)
NAME_CR_RE = re.compile(r"^(?P<name>.+?)\s+CR\s+(?P<cr>.+)$")
SPECIAL_ABILITY_RE = re.compile(
    r"^(?P<name>[A-Z][^:]*?\((?:Ex|Sp|Su)\))\s*:?\s+(?P<body>.+)$"
)
SEPARATOR_LINE_RE = re.compile(r"^\s*[_=\-]{3,}\s*$")
ATTACK_BONUS_RE = re.compile(r"\s+[+-]\d")
TRAILING_PARENS_RE = re.compile(r"^(?P<base>.+?)\s*\((?P<paren>[^()]*)\)\s*$")
METAMAGIC_PREFIXES = (
    "quickened ",
    "empowered ",
    "maximized ",
    "heightened ",
    "extended ",
    "silent ",
    "still ",
    "widened ",
)


@dataclass
class ParseResult:
    source_path: Path
    data: dict
    warnings: list[str] = field(default_factory=list)


class ReportBuilder:
    def __init__(self) -> None:
        self.entries: list[tuple[str, str, list[str]]] = []

    def add(self, filename: str, status: str, warnings: list[str]) -> None:
        self.entries.append((filename, status, warnings))

    def render(self) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        success_count = sum(1 for _, status, _ in self.entries if status == "OK")
        failed_count = sum(1 for _, status, _ in self.entries if status == "FAILED")
        lines = [
            f"Stat Block Conversion Report",
            f"Generated: {timestamp}",
            f"Successful: {success_count}",
            f"Failed: {failed_count}",
            "",
        ]
        for filename, status, warnings in self.entries:
            lines.append(f"[{status}] {filename}")
            if warnings:
                for warning in warnings:
                    lines.append(f"  - {warning}")
            lines.append("")
        return "\n".join(lines).rstrip() + "\n"


class SpellMacroIndex:
    def __init__(self, spell_dir: Path) -> None:
        self.spell_dir = spell_dir
        self.files: dict[str, Path] = {}
        self.contents: dict[Path, str] = {}
        if spell_dir.exists():
            for path in spell_dir.glob("*.txt"):
                self.files[path.stem.lower()] = path

    def find(self, spell_name: str) -> Path | None:
        for candidate in self._candidates(spell_name):
            match = self.files.get(candidate)
            if match:
                return match
        return None

    def read(self, path: Path | None) -> str | None:
        if path is None:
            return None
        if path not in self.contents:
            self.contents[path] = path.read_text(encoding="utf-8-sig").rstrip() + "\n"
        return self.contents[path]

    def _candidates(self, spell_name: str) -> Iterable[str]:
        cleaned = spell_name.strip().lower()
        cleaned = cleaned.replace("’", "'").replace("‘", "'").replace("‐", "-")
        cleaned = cleaned.replace("*", "")
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        cleaned = cleaned.replace("’", "'").replace("‘", "'").replace("‐", "-")

        variants = set()
        variants.add(self._normalize(cleaned))

        for prefix in METAMAGIC_PREFIXES:
            if cleaned.startswith(prefix):
                variants.add(self._normalize(cleaned[len(prefix) :]))

        for prefix in ("mass ", "greater ", "lesser "):
            if cleaned.startswith(prefix):
                remainder = cleaned[len(prefix) :]
                variants.add(self._normalize(cleaned))
                variants.add(self._normalize(remainder))
                variants.add(f"{self._normalize(remainder)},_{prefix.strip()}")

        if "/" in cleaned:
            variants.add(self._normalize(cleaned.replace("/", "-")))
            variants.add(self._normalize(cleaned.replace("/", "_")))
            parts = [part.strip() for part in cleaned.split("/", maxsplit=1)]
            if len(parts) == 2 and all(parts):
                reversed_cleaned = f"{parts[1]}/{parts[0]}"
                variants.add(self._normalize(reversed_cleaned))
                variants.add(self._normalize(reversed_cleaned.replace("/", "-")))
                variants.add(self._normalize(reversed_cleaned.replace("/", "_")))

        return sorted(variants)

    @staticmethod
    def _normalize(value: str) -> str:
        value = value.replace("/", "-")
        value = value.replace("'", "_")
        value = value.replace(",", ",")
        value = value.replace("(", "")
        value = value.replace(")", "")
        value = value.replace(".", "")
        value = value.replace(":", "")
        value = value.replace(";", "")
        value = value.replace("!", "")
        value = re.sub(r"\s+", "_", value)
        value = re.sub(r"[^a-z0-9,_\-+]+", "_", value)
        value = re.sub(r"_+", "_", value)
        return value.strip("_")


def split_paragraphs(text: str) -> list[list[str]]:
    paragraphs: list[list[str]] = []
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if line.strip():
            current.append(line)
        elif current:
            paragraphs.append(current)
            current = []
    if current:
        paragraphs.append(current)
    return paragraphs


def split_nonblank_lines(text: str) -> list[str]:
    return [
        line.rstrip()
        for line in text.splitlines()
        if line.strip() and not SEPARATOR_LINE_RE.match(line)
    ]


def _legacy_normalize_text(text: str) -> str:
    return (
        text.replace("â€”", "-")
        .replace("â€“", "-")
        .replace("â€™", "'")
        .replace("â€˜", "'")
        .replace("â€œ", '"')
        .replace("â€\x9d", '"')
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("—", "-")
        .replace("–", "-")
        .replace("\u00a0", " ")
    )


def normalize_text(text: str) -> str:
    replacements = (
        ("Ã¢â‚¬â€", "-"),
        ("Ã¢â‚¬â€œ", "-"),
        ("Ã¢â‚¬â„¢", "'"),
        ("Ã¢â‚¬Ëœ", "'"),
        ("Ã¢â‚¬Å“", '"'),
        ("Ã¢â‚¬\x9d", '"'),
        ("â€™", "'"),
        ("â€˜", "'"),
        ("â€œ", '"'),
        ("â€\x9d", '"'),
        ("â€”", "-"),
        ("â€“", "-"),
        ("Ã—", "x"),
        ("Ãƒâ€”", "x"),
        ("×", "x"),
        ("\u00a0", " "),
    )
    normalized = text
    for old, new in replacements:
        normalized = normalized.replace(old, new)
    return normalized


def repair_text(text: str) -> str:
    normalized = normalize_text(text)
    replacements = (
        ("\ufeff", ""),
        ("â€™", "'"),
        ("â€˜", "'"),
        ("â€œ", '"'),
        ("â€\x9d", '"'),
        ("â€", '"'),
        ("â€”", "-"),
        ("â€“", "-"),
        ("’", "'"),
        ("‘", "'"),
        ("“", '"'),
        ("”", '"'),
        ("—", "-"),
        ("–", "-"),
    )
    for old, new in replacements:
        normalized = normalized.replace(old, new)
    return normalized


def is_defense_line(line: str) -> bool:
    return bool(re.match(r"^AC\*+\s", line)) or line.startswith(DEFENSE_PREFIXES)


def is_offense_line(line: str) -> bool:
    return line.startswith(OFFENSE_PREFIXES)


def is_stats_line(line: str) -> bool:
    return line.startswith(STAT_PREFIXES)


def split_top_level_csv(value: str) -> list[str]:
    items: list[str] = []
    current: list[str] = []
    depth = 0
    for char in value:
        if char == "(":
            depth += 1
        elif char == ")" and depth > 0:
            depth -= 1
        if char == "," and depth == 0:
            item = "".join(current).strip()
            if item:
                items.append(item)
            current = []
            continue
        current.append(char)
    tail = "".join(current).strip()
    if tail:
        items.append(tail)
    return items


def split_attack_fragments(value: str) -> list[str]:
    parts: list[str] = []
    for segment in re.split(r"\s+or\s+", value):
        parts.extend(re.split(r"\s+and\s+", segment))
    return [part.strip() for part in parts if part.strip()]


def token_action_name(fragment: str) -> str:
    match = ATTACK_BONUS_RE.search(fragment)
    base = fragment[: match.start()].strip() if match else fragment.strip()
    base = re.sub(r"^[+-]\d+\s+", "", base)
    base = re.sub(r"^\d+\s+", "", base)
    if base.endswith("claws"):
        return "claw"
    if base.endswith("bites"):
        return "bite"
    if base.endswith("slams"):
        return "slam"
    return base


def parse_spell_token(token: str, spell_index: SpellMacroIndex) -> dict:
    token = token.strip()
    note_flags: list[str] = []
    while token.endswith("*"):
        token = token[:-1].rstrip()
        note_flags.append("*")

    details: dict[str, str] = {}
    base = token
    trailing = TRAILING_PARENS_RE.match(token)
    if trailing:
        candidate = trailing.group("paren").strip()
        base = trailing.group("base").strip()
        if candidate.upper().startswith("DC "):
            details["dc"] = candidate[3:].strip()
        else:
            details["detail"] = candidate

    macro_path = spell_index.find(base)
    macro_text = spell_index.read(macro_path)
    return {
        "name": base,
        "raw": token,
        "notes": note_flags,
        "details": details,
        "macro_file": str(macro_path) if macro_path else None,
        "macro_text": macro_text,
        "has_macro": macro_path is not None,
    }


def _legacy_parse_spell_section(header_line: str, lines: list[str], spell_index: SpellMacroIndex) -> dict:
    header_match = SPELL_HEADER_RE.match(header_line)
    result = {
        "header": header_line,
        "type": header_line.split("(")[0].strip(),
        "caster_level": None,
        "extras": None,
        "groups": [],
        "notes": [],
    }
    if header_match:
        result["type"] = header_match.group("label").strip()
        result["caster_level"] = header_match.group("caster_level").strip()
        extras = header_match.group("extras")
        result["extras"] = extras.strip() if extras else None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("*"):
            result["notes"].append(line)
            continue
        line = line.replace("—", "-").replace("–", "-")
        dash_split = re.split(r"\s*[—–-]\s*", line, maxsplit=1)
        if len(dash_split) != 2:
            result["notes"].append(line)
            continue
        label, body = dash_split
        spells = [parse_spell_token(token, spell_index) for token in split_top_level_csv(body)]
        result["groups"].append(
            {
                "label": label.strip(),
                "raw": line,
                "spells": spells,
            }
        )
    return result


def parse_attack_line(label: str, line: str) -> dict:
    body = line[len(label) :].strip()
    fragments = split_attack_fragments(body)
    return {
        "raw": line,
        "type": label.strip(),
        "fragments": [
            {
                "raw": fragment,
                "token_action_name": token_action_name(fragment),
            }
            for fragment in fragments
        ],
    }


def parse_spell_section(header_line: str, lines: list[str], spell_index: SpellMacroIndex) -> dict:
    header_line = repair_text(header_line)
    header_match = SPELL_HEADER_RE.match(header_line)
    result = {
        "header": header_line,
        "type": header_line.split("(")[0].strip(),
        "caster_level": None,
        "extras": None,
        "groups": [],
        "notes": [],
    }
    if header_match:
        result["type"] = header_match.group("label").strip()
        result["caster_level"] = header_match.group("caster_level").strip()
        extras = header_match.group("extras")
        result["extras"] = extras.strip() if extras else None

    for raw_line in lines:
        line = repair_text(raw_line).strip()
        if not line:
            continue
        if line.startswith("*"):
            result["notes"].append(line)
            continue
        dash_split = re.split(r"\s*[â€”â€“—–-]\s*", line, maxsplit=1)
        if len(dash_split) != 2:
            result["notes"].append(line)
            continue
        label, body = dash_split
        spells = [parse_spell_token(token, spell_index) for token in split_top_level_csv(body)]
        result["groups"].append(
            {
                "label": label.strip(),
                "raw": line,
                "spells": spells,
            }
        )
    return result


def parse_name_cr(line: str, warnings: list[str]) -> tuple[str, str | None]:
    match = NAME_CR_RE.match(line)
    if match:
        return match.group("name").strip(), match.group("cr").strip()
    warnings.append(f"Could not parse CR from first line: {line}")
    return line.strip(), None


def parse_header(paragraph: list[str], warnings: list[str]) -> dict:
    name, cr = parse_name_cr(paragraph[0], warnings)
    idx = 1
    ancestry = None
    alignment_size_type = None

    def looks_like_alignment_size_type(line: str) -> bool:
        stripped = line.strip()
        size_pattern = r"\b(?:Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)\b"
        return bool(
            re.match(
                r"^(?:LG|NG|CG|LN|N|CN|LE|NE|CE)\b",
                stripped,
                re.IGNORECASE,
            )
            or re.match(
                rf"^(?:(?:Always|Usually|Often|Rarely)\s+)?(?:LG|NG|CG|LN|N|CN|LE|NE|CE)\s+{size_pattern}",
                stripped,
                re.IGNORECASE,
            )
            or re.match(
                rf"^(?:(?:Always|Usually|Often|Rarely)\s+)?(?:(?:lawful|neutral|chaotic|good|evil|unaligned)\s+)+{size_pattern}",
                stripped,
                re.IGNORECASE,
            )
        )

    if idx < len(paragraph):
        candidate = paragraph[idx].strip()
        if looks_like_alignment_size_type(candidate):
            alignment_size_type = candidate
            idx += 1
        else:
            ancestry = candidate
            idx += 1
            if idx < len(paragraph):
                alignment_size_type = paragraph[idx].strip()
                idx += 1

    source_reference = None
    if idx < len(paragraph) and not paragraph[idx].startswith(("Init ", "Aura ", "Languages ")):
        source_reference = paragraph[idx].strip()
        idx += 1

    init_line = None
    aura_lines: list[str] = []
    languages_line = None
    other_lines: list[str] = []
    while idx < len(paragraph):
        line = paragraph[idx].strip()
        idx += 1
        if line.startswith("Init "):
            init_line = line
        elif line.startswith("Aura "):
            aura_lines.append(line)
        elif line.startswith("Languages "):
            languages_line = line
        else:
            other_lines.append(line)

    return {
        "name": name,
        "cr": cr,
        "ancestry": ancestry,
        "alignment_size_type": alignment_size_type,
        "source_reference": source_reference,
        "init_line": init_line,
        "aura_lines": aura_lines,
        "languages_line": languages_line,
        "other_lines": other_lines,
        "raw_lines": paragraph,
    }


def parse_defense(paragraph: list[str], warnings: list[str]) -> dict:
    defense = {
        "ac_line": None,
        "hp_line": None,
        "immune_line": None,
        "resist_line": None,
        "fort_ref_will_line": None,
        "weaknesses_line": None,
        "other_lines": [],
        "raw_lines": paragraph,
    }
    for line in paragraph:
        stripped = line.strip()
        if stripped.startswith("AC ") or re.match(r"^AC\*+\s", stripped):
            defense["ac_line"] = stripped
        elif stripped.startswith(("hp ", "Hp ")) or (defense["hp_line"] is None and re.search(r"\bhp\s+\d", stripped, re.IGNORECASE)):
            defense["hp_line"] = stripped
        elif stripped.startswith("Immune "):
            defense["immune_line"] = stripped
        elif stripped.startswith(("Resist ", "Resists ")):
            defense["resist_line"] = stripped
        elif stripped.startswith("Fort "):
            defense["fort_ref_will_line"] = stripped
        elif stripped.startswith(("Weaknesses ", "Weakness ")):
            defense["weaknesses_line"] = stripped
        else:
            defense["other_lines"].append(stripped)
    if not defense["ac_line"]:
        warnings.append("Defense block missing AC line")
    if not defense["hp_line"]:
        warnings.append("Defense block missing HP line")
    return defense


def parse_offense(paragraph: list[str], spell_index: SpellMacroIndex) -> dict:
    offense = {
        "speed_line": None,
        "melee_lines": [],
        "ranged_lines": [],
        "space_reach_line": None,
        "base_attack_line": None,
        "attack_options_line": None,
        "special_actions_line": None,
        "combat_gear_line": None,
        "spell_sections": [],
        "other_lines": [],
        "weapon_token_actions": [],
        "raw_lines": paragraph,
    }
    idx = 0
    while idx < len(paragraph):
        stripped = paragraph[idx].rstrip()
        if stripped.startswith(("Spd ", "Speed ")):
            offense["speed_line"] = stripped
        elif stripped.startswith("Melee "):
            parsed = parse_attack_line("Melee ", stripped)
            offense["melee_lines"].append(parsed)
            offense["weapon_token_actions"].extend(parsed["fragments"])
        elif stripped.startswith("Ranged "):
            parsed = parse_attack_line("Ranged ", stripped)
            offense["ranged_lines"].append(parsed)
            offense["weapon_token_actions"].extend(parsed["fragments"])
        elif stripped.startswith("Space "):
            offense["space_reach_line"] = stripped
        elif stripped.startswith("Base Atk "):
            offense["base_attack_line"] = stripped
        elif stripped.startswith("Atk Options "):
            offense["attack_options_line"] = stripped
        elif re.match(r"^Special\s+Actions?\s+", stripped, re.IGNORECASE):
            offense["special_actions_line"] = stripped
        elif stripped.startswith("Combat Gear "):
            offense["combat_gear_line"] = stripped
        elif SPELL_HEADER_RE.match(stripped):
            spell_lines: list[str] = []
            idx += 1
            while idx < len(paragraph):
                candidate = paragraph[idx].rstrip()
                if SPELL_HEADER_RE.match(candidate.strip()):
                    idx -= 1
                    break
                if candidate.startswith(MAIN_SECTION_PREFIXES):
                    idx -= 1
                    break
                spell_lines.append(candidate)
                idx += 1
            offense["spell_sections"].append(parse_spell_section(stripped, spell_lines, spell_index))
        else:
            offense["other_lines"].append(stripped)
        idx += 1
    return offense


def parse_statistics(paragraph: list[str]) -> dict:
    stats = {
        "abilities_line": None,
        "sq_line": None,
        "feats_line": None,
        "skills_line": None,
        "possessions_line": None,
        "spellbook_line": None,
        "other_lines": [],
        "feats": [],
        "skills": [],
        "possessions": [],
        "raw_lines": paragraph,
    }
    for line in paragraph:
        stripped = line.strip()
        if stripped.startswith("Abilities "):
            stats["abilities_line"] = stripped
        elif stripped.startswith("SQ "):
            stats["sq_line"] = stripped
        elif stripped.startswith("Feats "):
            stats["feats_line"] = stripped
            stats["feats"] = split_top_level_csv(stripped[len("Feats ") :])
        elif stripped.startswith("Skills "):
            stats["skills_line"] = stripped
            stats["skills"] = split_top_level_csv(stripped[len("Skills ") :])
        elif stripped.startswith("Possessions "):
            stats["possessions_line"] = stripped
            stats["possessions"] = split_top_level_csv(stripped[len("Possessions ") :])
        elif stripped.startswith("Spellbook "):
            stats["spellbook_line"] = stripped
        else:
            stats["other_lines"].append(stripped)
    return stats


def parse_specials_and_bio(paragraphs: list[list[str]]) -> tuple[list[dict], str | None]:
    specials: list[dict] = []
    bio_paragraphs: list[str] = []
    for paragraph in paragraphs:
        joined = " ".join(line.strip() for line in paragraph if line.strip())
        if not joined:
            continue
        if SEPARATOR_LINE_RE.match(joined):
            continue
        match = SPECIAL_ABILITY_RE.match(joined)
        if match and any(tag in match.group("name") for tag in ("(Ex)", "(Sp)", "(Su)")):
            specials.append(
                {
                    "name": match.group("name").strip(),
                    "description": match.group("body").strip(),
                    "raw": joined,
                }
            )
        else:
            bio_paragraphs.append(joined)
    bio_text = "\n\n".join(bio_paragraphs).strip() or None
    return specials, bio_text


def parse_stat_block(path: Path, spell_index: SpellMacroIndex) -> ParseResult:
    warnings: list[str] = []
    text = repair_text(path.read_text(encoding="utf-8-sig"))
    content_lines = split_nonblank_lines(text)
    if len(content_lines) < 3:
        raise ValueError("Expected at least header, defense, and offense content")

    defense_start = next((idx for idx, line in enumerate(content_lines) if is_defense_line(line)), None)
    offense_start = next((idx for idx, line in enumerate(content_lines) if is_offense_line(line)), None)
    if defense_start is None and offense_start is None:
        raise ValueError("Could not find start of defense or offense section")

    section_starts = [idx for idx in (defense_start, offense_start) if idx is not None]
    header_end = min(section_starts)
    stats_search_start = max(section_starts)
    stats_start = next(
        (idx for idx, line in enumerate(content_lines[stats_search_start:], start=stats_search_start) if is_stats_line(line)),
        None,
    )
    if stats_start is None:
        warnings.append("Could not find explicit statistics section")
        stats_start = len(content_lines)

    stats_end = stats_start
    while stats_end < len(content_lines) and is_stats_line(content_lines[stats_end]):
        stats_end += 1

    header_lines = content_lines[:header_end]
    if defense_start is None:
        defense_lines = []
        warnings.append("Could not find explicit defense section")
    elif offense_start is not None and defense_start < offense_start:
        defense_lines = content_lines[defense_start:offense_start]
    else:
        defense_lines = content_lines[defense_start:stats_start]

    if offense_start is None:
        offense_lines = []
        warnings.append("Could not find explicit offense section")
    elif defense_start is not None and offense_start < defense_start:
        offense_lines = content_lines[offense_start:defense_start]
    else:
        offense_lines = content_lines[offense_start:stats_start]
    stats_lines = content_lines[stats_start:stats_end]
    tail_lines = content_lines[stats_end:]

    header = parse_header(header_lines, warnings)
    defense = parse_defense(defense_lines, warnings)
    offense = parse_offense(offense_lines, spell_index)
    stats = parse_statistics(stats_lines) if stats_lines else {}
    specials, bio_notes = parse_specials_and_bio([[line] for line in tail_lines]) if tail_lines else ([], None)

    unmatched_spells = []
    matched_spells = []
    for section in offense["spell_sections"]:
        for group in section["groups"]:
            for spell in group["spells"]:
                if spell["has_macro"]:
                    matched_spells.append(spell["name"])
                else:
                    unmatched_spells.append(spell["name"])
    if unmatched_spells:
        unique_unmatched = sorted(set(unmatched_spells))
        warnings.append(f"Missing spell macros for: {', '.join(unique_unmatched)}")

    data = {
        "schema_version": 1,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": {
            "file_name": path.name,
            "file_path": str(path),
            "text_format": "txt",
        },
        "creature": {
            "name": header["name"],
            "cr": header["cr"],
            "header": header,
            "defense": defense,
            "offense": offense,
            "statistics": stats,
            "special_abilities": specials,
            "bio_notes": bio_notes,
        },
        "roll20_hints": {
            "character_name": header["name"],
            "weapon_token_actions": offense["weapon_token_actions"],
            "matched_spell_macros": sorted(set(matched_spells)),
            "unmatched_spell_macros": sorted(set(unmatched_spells)),
        },
        "warnings": warnings,
        "raw_text": text,
    }
    return ParseResult(source_path=path, data=data, warnings=warnings)


def determine_files(input_dir: Path, file_arg: str | None) -> list[Path]:
    if file_arg:
        candidate = Path(file_arg)
        if not candidate.is_absolute():
            candidate = input_dir / file_arg
        if not candidate.exists():
            raise FileNotFoundError(f"Input file not found: {candidate}")
        return [candidate]
    return sorted(path for path in input_dir.glob("*.txt") if path.is_file())


def write_json(output_dir: Path, result: ParseResult) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{result.source_path.stem}.json"
    output_path.write_text(json.dumps(result.data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return output_path


def write_report(report_dir: Path, report_builder: ReportBuilder) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"conversion_report_{timestamp}.txt"
    report_path.write_text(report_builder.render(), encoding="utf-8")
    return report_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Convert Dungeon-style 3.5e stat blocks to internal JSON.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--report-dir", type=Path, default=DEFAULT_REPORT_DIR)
    parser.add_argument("--spell-dir", type=Path, default=DEFAULT_SPELL_DIR)
    parser.add_argument("--file", help="Convert a single .txt file by name or absolute path.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    spell_index = SpellMacroIndex(args.spell_dir)
    report = ReportBuilder()
    failures = 0

    try:
        files = determine_files(args.input_dir, args.file)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not files:
        print("No input files found.", file=sys.stderr)
        return 1

    for path in files:
        try:
            result = parse_stat_block(path, spell_index)
            output_path = write_json(args.output_dir, result)
            report.add(path.name, "OK", result.warnings)
            print(f"OK: {path.name} -> {output_path.name}")
        except Exception as exc:
            failures += 1
            report.add(path.name, "FAILED", [str(exc)])
            print(f"FAILED: {path.name} -> {exc}", file=sys.stderr)

    report_path = write_report(args.report_dir, report)
    print(f"Report: {report_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
