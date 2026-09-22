"""Vessel name normalization and variant merging (SPEC.md section 7.4).

The normalized-key formula itself (`prefix normalized + "|" + name
uppercased, punctuation stripped`) lives in app/services/vessels.py so the
API (creating a vessel by hand) and the importer (creating one from parsed
workbook text) can never disagree about what counts as a duplicate. This
module is the importer-specific half: pulling a prefix+name out of raw
cell text, and picking a single display name/prefix out of a group of
variants that all normalize to the same key.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass

from app.services.vessels import normalize_vessel_key
from importer.ruleset import ImporterConfig


@dataclass(frozen=True)
class VesselMention:
    raw_text: str
    prefix: str  # canonical, e.g. "OSV" even if the cell said "OS/V"
    name: str


@dataclass(frozen=True)
class VesselGroup:
    normalized_key: str
    prefix: str
    display_name: str
    variants: tuple[str, ...]  # distinct raw cell texts that map to this group


def parse_vessel_mention(text: str, config: ImporterConfig) -> VesselMention | None:
    """Returns a VesselMention if `text` starts with a known vessel prefix
    (config-driven, including aliases like "OS/V" for "OSV") followed by a
    space and a name; otherwise None. Longest aliases are checked first so
    a 4+ char alias isn't shadowed by a 3-char one that happens to be its
    prefix (none currently overlap, but this stays correct if one is added).
    """
    stripped = text.strip()
    upper = stripped.upper()
    for alias in sorted(config.vessel_prefix_aliases, key=len, reverse=True):
        if not upper.startswith(alias):
            continue
        rest = stripped[len(alias) :]
        if rest == "" or rest[0] in " \t":
            return VesselMention(
                raw_text=stripped,
                prefix=config.vessel_prefix_aliases[alias],
                name=rest.strip(),
            )
    return None


def _display_case(name: str) -> str:
    return name.title() if name == name.upper() else name


def group_vessel_mentions(
    mentions: list[VesselMention], config: ImporterConfig
) -> dict[str, VesselGroup]:
    """Groups mentions by normalized key. Each group's display name is its
    most-frequent raw name, title-cased if that variant was all-caps
    (SPEC.md section 7.4); ties break on the first-seen variant."""
    by_key: dict[str, list[VesselMention]] = defaultdict(list)
    for mention in mentions:
        by_key[normalize_vessel_key(mention.prefix, mention.name)].append(mention)

    groups: dict[str, VesselGroup] = {}
    for key, group_mentions in by_key.items():
        name_counts = Counter(m.name for m in group_mentions)
        best_count = max(name_counts.values())
        most_common_name = next(name for name in name_counts if name_counts[name] == best_count)
        variants = tuple(dict.fromkeys(m.raw_text for m in group_mentions))  # de-dup, keep order
        groups[key] = VesselGroup(
            normalized_key=key,
            prefix=group_mentions[0].prefix,
            display_name=_display_case(most_common_name),
            variants=variants,
        )
    return groups
