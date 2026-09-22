"""Cell fill inspection, shared by profile.py and spans.py. A cell's fill
identity is one of three shapes depending on how the workbook author picked
the color (openpyxl's `Color.type`): a plain RGB hex, a legacy palette
index, or a theme color + tint. `fill_key` normalizes all three (plus "no
fill at all") into one hashable, JSON/YAML-friendly shape.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FillKey:
    kind: str  # "none" | "rgb" | "indexed" | "theme"
    rgb: str | None = None
    indexed: int | None = None
    theme: int | None = None
    tint: float | None = None


def fill_key(cell: Any) -> FillKey:
    fill = cell.fill
    if fill is None or fill.fill_type is None:
        return FillKey(kind="none")
    color = fill.fgColor
    if color is None:
        return FillKey(kind="none")
    if color.type == "rgb":
        return FillKey(kind="rgb", rgb=color.rgb)
    if color.type == "indexed":
        return FillKey(kind="indexed", indexed=color.indexed)
    if color.type == "theme":
        return FillKey(kind="theme", theme=color.theme, tint=color.tint)
    return FillKey(kind="none")


def fill_key_from_config(entry: dict) -> FillKey:
    kind = entry["type"]
    return FillKey(
        kind=kind,
        rgb=entry.get("rgb"),
        indexed=entry.get("indexed"),
        theme=entry.get("theme"),
        tint=entry.get("tint"),
    )


def is_background_fill(cell: Any, background_fills: frozenset[FillKey]) -> bool:
    return fill_key(cell) in background_fills
