"""Stable active-pipeline interface for the Bedrock brief engine.

The rollback stack still owns the current implementation module. Keeping that
module behind this adapter lets the unified worker depend on an explicit shared
package while legacy infrastructure remains available for rollback.
"""

from __future__ import annotations

from importlib import import_module
from types import ModuleType

_ENGINE: ModuleType | None = None


def _implementation() -> ModuleType:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = import_module("bedrock_lambda.app")
    return _ENGINE


def __getattr__(name: str):
    return getattr(_implementation(), name)
