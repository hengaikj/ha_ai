#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED = {
"contracts/database/ha_mysql8_schema_candidate_v1.0.sql":"afb880e9a5d4fafd003672b7a54fb37b1fb6f4bb6cac9c6ced91b7460dbb816a",
"contracts/openapi/openai-compatible.yaml":"c682ebb991b7b9b66a1c831b96bcbbce903a661c8927da6b0c28a99640897ea5",
"contracts/openapi/enterprise-management.yaml":"01ee3aacad532bae1e4a42ac00eda20cf865ddc7c9454bb2805ebefccf7d16aa",
"contracts/openapi/platform-management.yaml":"b57dbdd844decb7f7cc6afdf1e2a0e5425db6c54edff8e4e582e60112f826604",
"contracts/redis/redis-contract.yaml":"7f61e77aa4570796d189dca8d17e17cc0e59fa31466648368a8e32679b6a3945",
"contracts/testing/test-matrix.json":"6d33b7bae21008297db9e49ce8552856226159b18a96548005ff0b464288f54f",
"contracts/testing/acceptance-mapping.json":"4f1ab1bbce1ea2c96fb98570ddb35accc196db691823e29ae1d1e4141ca0f486",
"contracts/testing/integration-test-contract.json":"d795469470067c3b2cfedef74f3bd2363d740f8689179e63fdb891be82be997d",
"docs/engineering-handoff/requirements/requirements.json":"9627bbd5e028b7e4a1353eb266b11c32ed50c443513e2d2db2f31923575a6b75",
"docs/engineering-handoff/quality/coverage-matrix.json":"a604244ce9bb81eebed8ea06db1a63e3c2ed70f44a1228e5fa96453170d47d2b",
"docs/engineering-handoff/quality/development-gate.json":"921a66b66fd4e35df8978d4d224a73b389532c669c688b187a6a3e0aae319f26",
}
bad=[]
for name, expected in EXPECTED.items():
    p=Path(name)
    if not p.exists():
        bad.append((name,"MISSING"))
        continue
    actual=hashlib.sha256(p.read_bytes()).hexdigest()
    if actual != expected:
        bad.append((name,f"HASH_MISMATCH {actual}"))
if bad:
    print("FULL_CONTRACT_MATERIALIZATION=FAIL")
    for x in bad: print(x[0], x[1])
    sys.exit(2)
print("FULL_CONTRACT_MATERIALIZATION=PASS")
print(f"FILES={len(EXPECTED)}")
