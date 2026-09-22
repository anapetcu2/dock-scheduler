"""Loads and type-checks importer/config.yaml — see SPEC.md section 7.1:
config values (fill meanings, keyword lists, berth aliases) come from
profiling the real workbook, not hard-coded guesses, so they live in data,
not in importer code.
"""

from dataclasses import dataclass
from pathlib import Path

import yaml

from importer.fills import FillKey, fill_key_from_config

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


@dataclass(frozen=True)
class ImporterConfig:
    background_fills: frozenset[FillKey]
    vessel_prefix_aliases: dict[str, str]  # alias (as found in text) -> canonical prefix
    closure_keywords: tuple[str, ...]
    note_exact: frozenset[str]
    note_prefix: tuple[str, ...]
    unlengthed_berths: frozenset[str]
    berth_aliases: dict[str, str]
    summary_only_berths: frozenset[str]


def load_config(path: Path | None = None) -> ImporterConfig:
    raw = yaml.safe_load((path or DEFAULT_CONFIG_PATH).read_text())

    background_fills = frozenset(fill_key_from_config(e) for e in raw["background_fills"])

    vessel_prefix_aliases: dict[str, str] = {}
    for canonical, aliases in raw["vessel_prefixes"].items():
        for alias in aliases:
            vessel_prefix_aliases[alias.upper()] = canonical

    return ImporterConfig(
        background_fills=background_fills,
        vessel_prefix_aliases=vessel_prefix_aliases,
        closure_keywords=tuple(k.lower() for k in raw["closure_keywords"]),
        note_exact=frozenset(k.lower() for k in raw["note_exact"]),
        note_prefix=tuple(k.lower() for k in raw["note_prefix"]),
        unlengthed_berths=frozenset(raw["unlengthed_berths"]),
        berth_aliases=dict(raw["berth_aliases"]),
        summary_only_berths=frozenset(raw["summary_only_berths"]),
    )
