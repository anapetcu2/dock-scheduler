"""Classifies a span's text as vessel / closure / note / event (SPEC.md
section 7.4). Keyword lists live in config.yaml, derived from profiling
every distinct text the real workbook actually contains — see
DECISIONS.md, Phase 4.
"""

from dataclasses import dataclass

from importer.normalize import VesselMention, parse_vessel_mention
from importer.ruleset import ImporterConfig

Kind = str  # "vessel" | "closure" | "note" | "event"


@dataclass(frozen=True)
class Classification:
    kind: Kind
    vessel: VesselMention | None = None


def classify(text: str, config: ImporterConfig) -> Classification:
    stripped = text.strip()

    vessel = parse_vessel_mention(stripped, config)
    if vessel is not None:
        return Classification(kind="vessel", vessel=vessel)

    lowered = stripped.lower()

    if any(keyword in lowered for keyword in config.closure_keywords):
        return Classification(kind="closure")

    if lowered in config.note_exact:
        return Classification(kind="note")
    if any(
        lowered.startswith(prefix + " ") or lowered.startswith(prefix + "@")
        for prefix in config.note_prefix
    ):
        return Classification(kind="note")

    return Classification(kind="event")
