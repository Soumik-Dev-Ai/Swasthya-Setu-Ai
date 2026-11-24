"""V1 triage service — now reduced to the facility-tier mapping.

The deprecated `analyze_triage` function and its stale RED_FLAG_KEYWORDS
copy (a 29-entry duplicate of the canonical 41-keyword list that lives in
`app/services/safety_layer.py`) were removed in phase-5 item 5C: the
function had no callers since the V1 router was retired, and a second
keyword list is exactly the drift-risk the audit flagged (docs/01 #4).
Only `TIER_FACILITY_MAP` survives — the routing engine imports it.
"""

# Map urgency tier -> required facility tier (used by routing engine downstream).
TIER_FACILITY_MAP = {
    "EMERGENCY": ("CHC", "PM-JAY_Hospital"),
    "URGENT": ("PHC", "CHC", "PM-JAY_Hospital"),
    "ROUTINE": ("SC", "PHC", "CHC"),
    "SELF_CARE": ("PMBJP_Pharmacy", "SC", "PHC"),
}

__all__ = ["TIER_FACILITY_MAP"]