# Bundled spell-macro library

This release includes all 696 original macro TXT files unchanged, with credit to Moonpile and permission to redistribute the collection. SRD-derived rules text is Open Game Content under OGL 1.0a. See [the game-content notices](../licenses/GAME-CONTENT.md) and [the complete OGL / Section 15 notices](../licenses/OGL-1.0a.txt). The original D35 software remains MIT; these files are not represented as wholly MIT-licensed.

The maintained converter loads this directory by default. A supplied Spell Reference takes precedence in the importer; otherwise a matched macro enriches the spell card, and an unmatched spell uses the existing generic fallback. An optional external library is supported without changing the bundled files:

```powershell
.\Convert-D35StatBlock.ps1 -Path 'input.docx' -OutputPath 'output.dnd35.json' -SpellMacroLibraryPath 'D:\PrivateSpellLibrary'
```

The legacy Python CLI has `--spell-dir`. The GUI reads its adjacent Spell Macros directory; it has no external-library picker. Providing a library or producing JSON does not itself grant permission to redistribute third-party content.
