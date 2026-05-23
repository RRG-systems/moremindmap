# V2 Benchmark Schema

**Version:** v2
**Snapshot:** 2026-05-23T01:09:33.393Z

## Vault Record Structure

```json
{
  "version": "v2",
  "timestamp": "2026-05-23T01:09:33.393Z",
  "vault_record_schema": {
    "core_fields": [
      "profile_id",
      "job_id",
      "person_name",
      "email",
      "company_name",
      "created_at"
    ],
    "metadata_schema": {
      "organization": {
        "company": "string",
        "department": "string",
        "role_title": "string",
        "reports_to": "string",
        "direct_reports_count": "string",
        "years_in_current_role": "string",
        "years_in_industry": "string",
        "industry": "string",
        "org_context": [
          "string"
        ]
      },
      "identity": {
        "full_name": "string",
        "email": "string",
        "phone": "string?"
      },
      "contextual_signals": {
        "best_role_ever": "string",
        "best_role_why": "string",
        "worst_role_ever": "string",
        "worst_role_why": "string",
        "current_energy_drain": "string (REQUIRED)",
        "current_role_misalignment": "string",
        "avoided_work": "string",
        "recurring_org_frustration": "string",
        "relied_on_for": "string (REQUIRED)",
        "misunderstood_for": "string",
        "unrealized_capacity": "string"
      }
    },
    "canonical_profile_json": {
      "vector_scores": "object",
      "narratives": "object",
      "evidence_map": "object"
    },
    "quality_index_fields": [
      "quality_score",
      "profile_signature",
      "assessment_version"
    ]
  },
  "vault_indexes": [
    "vault:index:date:{YYYY-MM-DD}",
    "vault:index:email:{email}",
    "vault:index:company:{company_slug}",
    "vault:index:department:{dept_slug}",
    "vault:index:role:{role_slug}",
    "vault:index:manager:{manager_slug}",
    "vault:index:industry:{industry_slug}",
    "vault:index:org_context:{context_slug}"
  ]
}
```
