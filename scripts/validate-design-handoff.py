#!/usr/bin/env python3
from pathlib import Path
import json, sys
root=Path(".")
required=["contracts/design/design-handoff.schema.json","contracts/design/assets-manifest.schema.json","contracts/design/component-mapping.schema.json","docs/design/00_设计交付从这里开始.md","docs/design/Design_Handoff_Gate.md"]
missing=[x for x in required if not (root/x).exists()]
if missing:
 print("DESIGN_HANDOFF_CONTRACT=FAIL")
 for x in missing: print("MISSING",x)
 sys.exit(2)
handoff=root/"design-handoff/design-handoff.json"
if not handoff.exists():
 print("DESIGN_HANDOFF_CONTRACT=PASS")
 print("PROJECT_DESIGN_HANDOFF=NOT_RUN")
 sys.exit(0)
data=json.loads(handoff.read_text(encoding="utf-8"))
errors=[]
for p in data.get("pages",[]):
 for ref in p.get("screen_refs",[]):
  if not (root/ref).exists(): errors.append(f"ASSET_OR_SCREEN_MISSING {p.get('page_id')} {ref}")
for key in ("assets_manifest","component_mapping"):
 ref=data.get(key)
 if ref and not (root/ref).exists(): errors.append(f"REFERENCE_MISSING {key} {ref}")
if errors:
 print("PROJECT_DESIGN_HANDOFF=FAIL")
 for e in errors: print(e)
 sys.exit(2)
print("PROJECT_DESIGN_HANDOFF=BASIC_PASS")
print("BASIC_PASS不替代12项Design Gate人工/工程审查")
