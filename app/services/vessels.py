"""Vessel normalization shared by the API and the importer (see SPEC.md
section 7.4). Kept minimal here: the importer's own normalize.py additionally
groups historical name variants, which only matters when loading the
workbook.
"""

import re

_PREFIX_CANONICAL = {
    "R/V": "RV",
    "M/V": "MV",
    "F/V": "FV",
    "S/V": "SV",
    "M/Y": "MY",
    "S/Y": "SY",
    "TUG": "TUG",
    "BARGE": "BARGE",
    "OSV": "OSV",
}

_PUNCTUATION_RE = re.compile(r"[^\w\s]")
_WHITESPACE_RE = re.compile(r"\s+")


def canonical_prefix(type_prefix: str | None) -> str:
    if not type_prefix:
        return ""
    return _PREFIX_CANONICAL.get(type_prefix.strip().upper(), type_prefix.strip().upper())


def normalize_vessel_key(type_prefix: str | None, name: str) -> str:
    prefix = canonical_prefix(type_prefix)
    cleaned = _PUNCTUATION_RE.sub("", name).strip().upper()
    cleaned = _WHITESPACE_RE.sub(" ", cleaned)
    return f"{prefix}|{cleaned}" if prefix else cleaned
