"""Blender --background --python-exit-code 1 --python blender/build.py -- [--only NAME]."""

import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description="Build museum scenes to blender/out")
    parser.add_argument("--only", help="Scene filename without .py")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    scenes = sorted((ROOT / "scenes").glob("*.py"))
    scenes = [path for path in scenes if path.stem != "__init__"]
    if args.only:
        scenes = [path for path in scenes if path.stem == args.only]
    if not scenes:
        parser.error(f"No scene scripts found for {args.only or 'all scenes'}")
    built = []
    for path in scenes:
        spec = importlib.util.spec_from_file_location(f"scene_{path.stem}", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not hasattr(module, "build"):
            if args.only:
                parser.error(f"{path.stem} is render-only; run that Python script directly")
            print(f"Skipping render-only scene: {path.stem}")
            continue
        output = ROOT / "out" / f"{path.stem}.glb"
        module.build(output)
        built.append(path.stem)
    if not built:
        parser.error("No asset scenes selected")
    (ROOT / "out/manifest.json").write_text(json.dumps({"scenes": built}) + "\n")


if __name__ == "__main__":
    main()
