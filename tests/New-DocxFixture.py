"""Regenerate the DOCX parser fixture with the authoritative run structure."""

from pathlib import Path
from docx import Document


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "fixtures" / "statblocks" / "Formatted Reference Mage.docx"


def paragraph(document, text="", *, bold_prefix="", italic=False, all_bold=False):
    p = document.add_paragraph()
    if bold_prefix:
        p.add_run(bold_prefix).bold = True
        p.add_run(text[len(bold_prefix):])
    else:
        run = p.add_run(text)
        run.bold = all_bold
        run.italic = italic
    return p


doc = Document()
paragraph(doc, "Formatted Reference Mage CR 5", all_bold=True)
paragraph(doc, "human wizard 5")
paragraph(doc, "LN Medium humanoid (human)")
paragraph(doc, "Synthetic DOCX regression fixture")
paragraph(doc, "Init +2; Senses normal; Listen +1, Spot +1", bold_prefix="Init")
paragraph(doc, "AC 15, touch 12, flat-footed 13 (+2 Dex, +3 armor)", bold_prefix="AC")
paragraph(doc, "hp 24 (5d4+10)", bold_prefix="hp")
paragraph(doc, "Fort +3, Ref +3, Will +5", bold_prefix="Fort ")
paragraph(doc, "Spd 30 ft.", bold_prefix="Spd ")
paragraph(doc, "Melee quarterstaff +1 (1d6-1)", bold_prefix="Melee")
paragraph(doc, "Space 5 ft.; Reach 5 ft.", bold_prefix="Space ")
paragraph(doc, "Base Atk +2; Grp +1", bold_prefix="Base Atk")
paragraph(doc, "Wizard Spells Prepared (CL 5th):", bold_prefix="Wizard Spells Prepared")
paragraph(doc, "3rd (1/day)-fireball")
paragraph(doc, "2nd (3/day)-mirror image")
paragraph(doc, "1st (4/day)-magic missile")
paragraph(doc, "Abilities Str 8, Dex 14, Con 14, Int 18, Wis 12, Cha 10", bold_prefix="Abilities ")
paragraph(doc, "SQ familiar", bold_prefix="SQ ")
paragraph(doc, "Feats Combat Casting, Scribe Scroll", bold_prefix="Feats ")
paragraph(doc, "Skills Concentration +10, Spellcraft +14", bold_prefix="Skills ")
paragraph(doc, "Possessions quarterstaff, spell component pouch", bold_prefix="Possessions ")

paragraph(
    doc,
    "Combat Casting [General] The creature gains the feat's bonus under its stated conditions.",
    bold_prefix="Combat Casting [General]",
)
paragraph(
    doc,
    "Familiar The creature has the standard wizard familiar class feature.",
    bold_prefix="Familiar",
)
paragraph(
    doc,
    "Last Defense (Ex) This final ordinary entry cannot absorb the following section.",
    bold_prefix="Last Defense (Ex)",
)

paragraph(doc, "Spell Reference", all_bold=True)
paragraph(doc, "3rd-Level Spells", all_bold=True)
paragraph(doc, "Fireball", all_bold=True)
paragraph(
    doc,
    "Evocation [Fire]; 1 standard action; Long (600 ft.); 20-ft.-radius spread; instantaneous; Reflex half; yes",
    italic=True,
)
paragraph(doc, "The spell deals 5d6 points of fire damage.")
paragraph(doc, "(Player's Handbook, page 231.)")
paragraph(doc, "2nd-Level Spells", all_bold=True)
paragraph(doc, "Mirror Image", all_bold=True)
paragraph(
    doc,
    "Illusion (Figment); 1 standard action; Personal; caster; 5 minutes; none; no",
    italic=True,
)
paragraph(doc, "The spell creates 1d4+1 illusory duplicates.")
paragraph(doc, "(Player's Handbook, page 254.)")
paragraph(doc, "1st-Level Spells", all_bold=True)
paragraph(doc, "Magic Missile", all_bold=True)
paragraph(
    doc,
    "Evocation [Force]; 1 standard action; Medium (150 ft.); up to three creatures; instantaneous; none; yes",
    italic=True,
)
paragraph(doc, "The spell creates three missiles that each deal 1d4+1 points of force damage.")
paragraph(doc, "(Player's Handbook, page 251.)")

doc.save(OUTPUT)
print(OUTPUT)
