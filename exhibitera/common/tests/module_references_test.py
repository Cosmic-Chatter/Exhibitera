"""Verify that each function a script uses from a module imported with `import * as name` is exported by that module.

ESLint can't check these, since `name.anything` is a valid expression. Hub's definition Copy button did nothing after
the function it called moved to another file, because webpage.js still looked for it in the old one.
"""

# Standard modules
import pathlib
import re

# Third-party modules
import pytest

EXHIBITERA_DIR = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS = sorted(path for folder in ["hub/js", "apps", "common"] for path in (EXHIBITERA_DIR / folder).rglob("*.js")
                 if not any(part in {"tests", "node_modules", "bootstrap_5_3", "_static"} for part in path.parts)
                 and not path.name.endswith(".min.js"))

NAMESPACE_IMPORT = re.compile(r"""^import \* as (\w+) from ['"](\.[^'"]+)['"]""", re.MULTILINE)
EXPORT = re.compile(r"^export (?:async )?(?:function\*? ?|const |let |var |class )(\w+)", re.MULTILINE)
EXPORT_LIST = re.compile(r"^export \{([^}]*)\}", re.MULTILINE)


def exported_names(module: pathlib.Path) -> set[str]:
    source = module.read_text(encoding="utf-8")
    names = set(EXPORT.findall(source))
    for group in EXPORT_LIST.findall(source):
        for item in group.split(","):
            if item.strip():
                names.add(item.split(" as ")[-1].strip())
    if re.search(r"^export default", source, re.MULTILINE):
        names.add("default")
    return names


def missing_references(script: pathlib.Path) -> list[str]:
    source = script.read_text(encoding="utf-8")
    missing = []
    for namespace, relative in NAMESPACE_IMPORT.findall(source):
        module = (script.parent / relative).resolve()
        if not module.exists() or re.search(r"^export \* from", module.read_text(encoding="utf-8"), re.MULTILINE):
            continue  # Re-exports would need following; none of our modules use them
        exported = exported_names(module)
        for name in sorted(set(re.findall(rf"\b{namespace}\.(\w+)", source))):
            if name not in exported:
                missing.append(f"{namespace}.{name} (not exported by {module.relative_to(EXHIBITERA_DIR)})")
    return missing


@pytest.mark.parametrize("script", SCRIPTS, ids=lambda path: str(path.relative_to(EXHIBITERA_DIR)))
def test_namespace_references_are_exported(script):
    assert missing_references(script) == []
