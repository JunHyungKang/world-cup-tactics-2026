from __future__ import annotations

import runpy
from pathlib import Path


# Keep the historical command name as a compatibility entrypoint, but make the
# promoted Policy Lab renderer the single canonical implementation.
runpy.run_path(
    str(Path(__file__).with_name("render-policy-lab-plan.py")),
    run_name="__main__",
)
