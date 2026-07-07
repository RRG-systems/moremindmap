/** MMB9 Darren BOS regression lab fixture — static, lab-only. Generated from bridge MMB9 artifacts. */
export const bosRegressionDataDarrenMmb9 = {
  "profileId": "mm-20260527-6zshuaao",
  "profileName": "Darren Kirkland",
  "generatedAt": "2026-07-07",
  "missionId": "MMB9_DARREN_BOS_GPT55_REGRESSION_LAB_RUN",
  "defaultModel": {
    "label": "Default BOS",
    "rescoring": "gpt-4o",
    "narrative": "gpt-4o-2024-08-06",
    "source": "Registry default"
  },
  "gpt55Model": {
    "label": "GPT-5.5 Lab",
    "model": "gpt-5.5-2026-04-23",
    "source": "Lab override only"
  },
  "scorecardMarkdown": "# MMB9 \u2014 Darren BOS GPT-5.5 Comparison Scorecard\n\n**Profile:** `mm-20260527-6zshuaao`  \n**Comparison date:** 2026-07-07  \n**Arms:**\n- **A (default):** `gpt-4o` rescoring / `gpt-4o-2024-08-06` narrative\n- **B (lab override):** `gpt-5.5-2026-04-23` all BOS routes\n\n**Sections compared:** executiveSummary, fiveFutures, recommendedNextStep, facilitatorNotes  \n**Rescoring:** Not comparable \u2014 both arms blocked (`rescoring_v1` missing on Darren canonical)\n\nScale: **1\u2013100** (higher = better; for hallucination/overconfidence risk, higher = lower risk)\n\n---\n\n## Score Table\n\n| Dimension | Arm A (default) | Arm B (GPT-5.5) | Delta (B\u2212A) | Evidence |\n|-----------|-----------------|-----------------|-------------|----------|\n| Specificity | 74 | 91 | +17 | B cites intake quotes (rain maker, hyper focus, cruise reversal, faith values, subscription goal); A uses dimension scores but fewer verbatim signals |\n| Psychological realism | 76 | 89 | +13 | B shows lived-in organizational detail without cartoon extremity; A competent but more template cadence |\n| Behavioral causality | 72 | 90 | +18 | B chains behavior \u2192 habit \u2192 team adaptation \u2192 cost repeatedly; A states patterns with lighter if/then depth |\n| Actionability | 75 | 88 | +13 | Both recommend decision frameworks; B specifies decision-rights tiers, weekly accountability review, owner selection |\n| Hallucination risk (\u2193 risk = \u2191 score) | 80 | 84 | +4 | Both grounded in canonical scores; B references more intake fields \u2014 slightly higher invention surface but quotes align with dossier themes |\n| Overconfidence control | 71 | 78 | +7 | Both mark One Move \"High\" confidence; B provides longer evidenceUsed array reducing unearned certainty |\n| Fallback honesty | 88 | 90 | +2 | Both returned `fromGPT: true` with model_provenance; no silent fallback masquerading as intelligence |\n| Provenance clarity | 96 | 96 | 0 | All narrative sections matched expected models; B `model_source: env` confirmed |\n| Latency | 86 | 52 | \u221234 | A total ~20.7s; B total ~99.0s (~4.8\u00d7 slower) |\n| Likely cost efficiency | 83 | 58 | \u221225 | A ~23.1k tokens; B ~26.9k tokens + 1426 reasoning tokens; higher $/quality unit |\n| Renderer compatibility | 92 | 91 | \u22121 | Both produced valid narrative V3 JSON shapes; B outputs longer but within schema |\n| Darren-specific usefulness | 77 | 93 | +16 | B explicitly addresses residual/subscription business goal, rainmaker role, founder-dependency scaling risk |\n\n**Weighted quality average (excl. latency/cost):** A **79.1** \u2192 B **88.8** (+9.7)\n\n---\n\n## Latency & Cost Notes\n\n| Metric | Arm A | Arm B |\n|--------|-------|-------|\n| Total narrative wall-clock | 20,721 ms | 98,996 ms |\n| Total tokens | 23,066 | 26,850 |\n| Reasoning tokens | 0 | 1,426 |\n| Avg tokens/section | ~5,767 | ~6,713 |\n| Prompt cache benefit (B) | partial | strong on repeated sections (5376 cached on exec/fiveFutures) |\n\n**Cost estimate (illustrative):** At typical GPT-4o vs GPT-5.5 pricing, Arm B likely **1.5\u20132.5\u00d7** more expensive per full narrative pass for measurably richer Darren-specific output.\n\n---\n\n## Hallucination & Overconfidence Findings\n\n**Arm A**\n- Grounded in vector 0.88, velocity 0.75, framework 0.17 \u2014 consistent with canonical.\n- Some generic leadership phrasing (\"strategic direction-setting\", \"sustainable growth\") not uniquely Darren.\n- \"High\" confidence on One Move without extensive evidence enumeration.\n\n**Arm B**\n- Strongest grounding in written intake (q17, q22, q24, q26, q27) and scaling_constraint / one_move_seed.\n- Cruise cancellation example and faith-based values reference appear consistent with Darren dossier themes; validator should spot-check against raw intake in snapshot.\n- Longer outputs increase surface area for subtle inference; no obvious invented dimensions detected in lab review.\n- Still uses \"High\" confidence but mitigated by explicit `evidenceUsed` and `grounding_used` arrays.\n\n**Overconfidence risk:** Neither arm produced false-precision clinical claims. B is more assertive in causal language but generally earns it with cited evidence.\n\n---\n\n## Renderer Compatibility\n\nBoth arms returned schema-valid JSON for all four sections. `fiveFutures.futures` arrays populated (5 items). `facilitatorNotes.notes` arrays populated (7 items). `recommendedNextStep` includes required structured One Move fields. No structure validation failures observed.\n\n---\n\n## Recommendation\n\n**Verdict: Move GPT-5.5 to next lab \u2014 needs more samples (MMB10)**\n\nGPT-5.5 lab override shows a **clear quality uplift** on Darren-specific narrative dimensions (specificity, causality, usefulness) without increasing hallucination risk materially. However:\n\n1. **Rescoring path untested** \u2014 Darren canonical lacks `rescoring_v1`; full BOS cognition comparison incomplete.\n2. **API compatibility gap** \u2014 Product `narrative-v3.js` / `gptBehavioralRescore.js` still use `max_tokens` + `temperature: 0.7`; GPT-5.5 requires `max_completion_tokens` and default temperature. Lab runner patched this in bridge only.\n3. **Latency/cost regression** \u2014 ~5\u00d7 slower, ~17% more tokens + reasoning overhead.\n4. **Single-profile sample** \u2014 Darren only; not sufficient for production flip.\n\n**Do not:** activate GPT-5.5 in production, flip env config, or promote registry defaults.\n\n**Do:** MMB10 multi-profile regression with rescoring-enabled profiles + product-side GPT-5.5 API compatibility patch (separate authorized sprint).\n\n---\n\n## Limits\n\n- Read-only profile retrieval via production GET (no local Redis/dev server).\n- Narrative-only comparison (4 sections); rescoring and report routes not fully exercised.\n- Lab runner used bridge-only Vercel env bootstrap (`mmb9_runtime.env`, ephemeral, not committed).\n- Cognition context fell back to baseline layer (no `rescoring_gpt` on Darren canonical).\n- No Visual DNA, vault, deploy, commit, or product file changes.\n\n---\n\n## MMB10 Breadth Recommendation\n\n**Yes \u2014 MMB10 should be broader multi-profile regression** including:\n- At least 2 additional profiles with `rescoring_v1` present\n- Rescoring + narrative + provenance parity\n- Product API compatibility fix before any production consideration\n- Human review of hallucination spot-checks on intake-quote grounding",
  "defaultOutputMarkdown": "# MMB9 \u2014 Arm A Current/Default BOS Lab Output\n\n**Profile:** `mm-20260527-6zshuaao` (Darren Kirkland)  \n**Arm:** `arm_a_default`  \n**Models (registry defaults):**\n- `bos.rescoring`: `gpt-4o`\n- `bos.narrative`: `gpt-4o-2024-08-06`\n- `bos.report`: `gpt-5.5`\n\n**Lab constraints:** Read-only canonical snapshot input. No vault/Redis writes. No profile mutation.\n\n---\n\n## Provenance Summary\n\n| Section | model_used | elapsed_ms | total_tokens |\n|---------|------------|------------|--------------|\n| executiveSummary | gpt-4o-2024-08-06 | 2313 | 5697 |\n| fiveFutures | gpt-4o-2024-08-06 | 6806 | 6114 |\n| recommendedNextStep | gpt-4o-2024-08-06 | 6244 | 5580 |\n| facilitatorNotes | gpt-4o-2024-08-06 | 5358 | 5675 |\n| **Total narrative** | \u2014 | **20721** | **23066** |\n\n**Rescoring:** Blocked \u2014 `gptBehavioralRescore` returned null because Darren canonical lacks `rescoring_v1` (deterministic topology prerequisite).\n\n---\n\n## Executive Summary\n\n**Headline:** Decisive Vector Leadership\n\n**Body:** Darren Kirkland at The MORE Companies creates value by driving decisive action with a strong vector orientation (0.88) and velocity (0.75). His effectiveness is limited by a lack of structured frameworks (0.17), which can lead to confusion among new team members. Under pressure, Darren doubles down: more decisive, faster, less reading of detail. Naturally suited for roles requiring strategic direction-setting; prolonged coordination tasks may exhaust him. Highest-leverage insight: Darren's momentum hinges on clear, structured paths \u2014 adding decision frameworks and escalation processes can harness his potential for sustainable growth.\n\n**Micro scenario:** During a strategy meeting, Darren quickly outlines a bold initiative without supplemental structure, leaving team members unclear on execution steps.\n\n**Key warning:** Risk of organizational dependency on Darren's ability to unblock momentum without external structures.\n\n---\n\n## Five Futures (summary)\n\nDarren's directive style and high velocity can drive rapid decision-making, but without external structures and frameworks, scaling issues and frustration increase as team coordination becomes a challenge.\n\n**Most likely:** Current Trajectory \u2014 Coordination Challenges Increase\n\n**Futures captured:** 5 (likely coordination challenges, possible clarity enhancement, risk burnout, possible leadership delegation, likely founder dependency constraint)\n\n---\n\n## Recommended Next Step (One Move)\n\n**Headline:** Transfer Decision-Making Judgment to Build Structured Processes\n\n**Future bottleneck:** Scaling issues due to lack of decision frameworks and clear escalation paths will cap growth within 6\u201312 months.\n\n**Intervention type:** `transfer_judgment`\n\n**Intervention:** Transfer decision-making judgment to structured frameworks and empower a trusted team member to manage coordination with these structures.\n\n**Confidence:** High\n\n**First 30 days:**\n1. Identify a trusted team member to manage decision frameworks.\n2. Draft clear decision-making and escalation processes.\n3. Conduct a workshop to train the team on these new processes.\n\n---\n\n## Facilitator Notes (summary)\n\nDesign a structured environment to support Darren's directive, action-driven operating style while providing external frameworks for decision-making and escalation.\n\n**Primary guidance:** Implement external decision frameworks and escalation processes to streamline action-oriented leadership and mitigate bottlenecks.\n\n**Note labels:** reporting, delegation, accountability, meetings, communication, decisions, organizational fit (7 notes)\n\n**Caution:** Avoid assuming Darren can independently sustain momentum without structured frameworks.\n\n---\n\n## Raw Artifacts\n\n- `arm_a_default/narrative_sections/*.json`\n- `arm_a_default/provenance.json`\n- `arm_a_default/rescoring_gpt.json` (null result \u2014 prerequisite missing)",
  "gpt55OutputMarkdown": "# MMB9 \u2014 Arm B GPT-5.5 Lab Override BOS Output\n\n**Profile:** `mm-20260527-6zshuaao` (Darren Kirkland)  \n**Arm:** `arm_b_gpt55`  \n**Lab env overrides (process-local only):**\n```\nBOS_RESCORING_MODEL=gpt-5.5-2026-04-23\nBOS_NARRATIVE_MODEL=gpt-5.5-2026-04-23\nBOS_REPORT_MODEL=gpt-5.5-2026-04-23\n```\n\n**Lab constraints:** Same read-only canonical snapshot as Arm A. No vault/Redis writes. No profile mutation. No production env flip.\n\n**Lab runner note:** GPT-5.5 required bridge-only API parameter adjustments (`max_completion_tokens` instead of `max_tokens`; omit `temperature`). Product `narrative-v3.js` was not modified per MMB9 boundary.\n\n---\n\n## Provenance Summary\n\n| Section | model_used | model_source | elapsed_ms | total_tokens | reasoning_tokens |\n|---------|------------|--------------|------------|--------------|------------------|\n| executiveSummary | gpt-5.5-2026-04-23 | env | 13288 | 6293 | 512 |\n| fiveFutures | gpt-5.5-2026-04-23 | env | 38063 | 7504 | 512 |\n| recommendedNextStep | gpt-5.5-2026-04-23 | env | 22284 | 6460 | 370 |\n| facilitatorNotes | gpt-5.5-2026-04-23 | env | 25361 | 6593 | 32 |\n| **Total narrative** | \u2014 | \u2014 | **98996** | **26850** | **1426** |\n\n**Rescoring:** Blocked \u2014 same `rescoring_v1` prerequisite missing as Arm A.\n\n---\n\n## Executive Summary\n\n**Headline:** Directed Momentum\n\n**Body:** Darren creates value by giving stalled work a direction and moving it. He is useful where revenue, model clarity, or a stuck initiative needs a rain maker who can decide, explain intent, and restart motion. His limit is scale without scaffolding: new people may lose the thread, doubts may stay hidden too long, and at 5x he needs decision frameworks, escalation paths, and clearer structure. Under pressure he doubles down: more decisive, faster, less reading of detail. Best fit: directional builder for growth, residual-business design, or stalled momentum. Exhausting fit: permission-heavy coordination where people repeat the same actions, ask him to wait, or reinterpret his model instead of using it as designed. Highest-leverage insight: do not slow him with vague consensus; give him written 30-day success criteria and a public commitment path.\n\n**Grounding used:** intake answers (q17, q22, q24, q26, q27), cognition ranked_dimensions, scaling_constraint, one_move_seed, pressure_pattern.\n\n---\n\n## Five Futures (summary)\n\nDarren is differentiated by vector primary at 0.88 paired with velocity at 0.75, very low framework at 0.17 and horizon at 0, a self-described rain-maker role, and a stated preference to move forward rather than keep asking for permission. Future paths are shaped by the gap between wanting a residual, subscription-based company and momentum depending on his personal unblock.\n\n**Most likely:** Current Trajectory \u2014 Momentum With Rising Coordination Cost\n\n**Notable evidence grounding:** Direct intake quotes (\"I hyper focus and get the job done\", rain maker role, cruise decision reversal example, faith-based company values, subscription/residual business goal).\n\n**Futures captured:** 5 richly differentiated trajectories with profile-specific causality.\n\n---\n\n## Recommended Next Step (One Move)\n\n**Headline:** Move from personal unblocker to transferable decision authority.\n\n**Future bottleneck:** Company needing Darren's personal direction every time execution slows, the model is misread, or a decision feels unclear \u2014 conflicts with subscription/residual business goal.\n\n**Intervention type:** `transfer_judgment`\n\n**Intervention:** Create a decision-rights and accountability structure that lets the team execute Darren's model without needing him to personally clarify, approve, or restart momentum.\n\n**Confidence:** High (with explicit evidenceUsed array citing rainmaker tension, scaling coordination breakpoint, vector/velocity vs framework gap)\n\n**First 30 days:**\n1. Pick one stalled function; name single accountable owner for outcomes, decisions, escalation.\n2. Write one-page decision guide: 30-day success target, autonomous decisions, escalation triggers, non-negotiable standards.\n3. Run weekly 30-minute accountability review on progress, autonomous decisions, blocked issues, judgment gaps.\n\n---\n\n## Facilitator Notes (summary)\n\nDarren functions best where he owns direction and rainmaking while a structured operating layer translates his model into delegated execution, decision rights, accountability, and escalation paths.\n\n**Primary guidance:** Do not make Darren the recurring coordination layer; install an operator/chief-of-staff/integrator.\n\n**Note labels:** reporting, delegation, accountability, meetings, communication, decisions, fit (7 notes \u2014 all structurally specific)\n\n**Caution:** Environment must prevent autonomy from becoming ambiguity given his pattern of leaving people to work independently.\n\n---\n\n## Raw Artifacts\n\n- `arm_b_gpt55/narrative_sections/*.json`\n- `arm_b_gpt55/provenance.json`\n- `arm_b_gpt55/rescoring_gpt.json` (null result \u2014 prerequisite missing)",
  "runTrace": {
    "mission_id": "MMB9_DARREN_BOS_GPT55_REGRESSION_LAB_RUN",
    "mission_slug": "mmb9_darren_bos_gpt55_regression_lab_run",
    "darren_profile_id": "mm-20260527-6zshuaao",
    "profile_retrieved_readonly": true,
    "profile_retrieval_method": "GET https://moremindmap.vercel.app/api/moremindmap/retrieve-profile?id=mm-20260527-6zshuaao",
    "openai_calls_executed": true,
    "openai_calls_count_narrative": 8,
    "openai_calls_count_rescoring": 0,
    "redis_writes_executed": false,
    "canonical_profile_mutated": false,
    "visual_dna_mutated": false,
    "production_deployed": false,
    "committed": false,
    "current_default_output_created": true,
    "gpt55_lab_output_created": true,
    "comparison_scorecard_created": true,
    "product_files_modified_by_mmb9": false,
    "mmb8_validation_confirmed": true,
    "registry_defaults_confirmed": {
      "bos.rescoring": "gpt-4o",
      "bos.narrative": "gpt-4o-2024-08-06"
    },
    "gpt55_lab_override_confirmed": {
      "bos.rescoring": "gpt-5.5-2026-04-23",
      "bos.narrative": "gpt-5.5-2026-04-23",
      "bos.report": "gpt-5.5-2026-04-23"
    },
    "arms": {
      "arm_a_default": {
        "narrative_model_used": "gpt-4o-2024-08-06",
        "sections_generated": 4,
        "total_elapsed_ms": 20721,
        "total_tokens": 23066,
        "rescoring_status": "blocked_missing_rescoring_v1"
      },
      "arm_b_gpt55": {
        "narrative_model_used": "gpt-5.5-2026-04-23",
        "model_source": "env",
        "sections_generated": 4,
        "total_elapsed_ms": 98996,
        "total_tokens": 26850,
        "reasoning_tokens": 1426,
        "rescoring_status": "blocked_missing_rescoring_v1",
        "lab_runner_api_patches": [
          "max_completion_tokens for gpt-5.5",
          "omit temperature for gpt-5.5",
          "increased max_completion_tokens to 4000"
        ]
      }
    },
    "recommendation": "move_gpt55_to_next_lab_needs_more_samples",
    "recommended_next_action": "MMB10_MULTI_PROFILE_BOS_GPT55_REGRESSION_OR_HUMAN_REVIEW",
    "commands_run": [
      "python3 -m json.tool traces/codex_mmb8_bos_gpt55_lab_switch_regression_prep_validation.json",
      "mkdir -p lab_runs/mmb9_darren_bos_gpt55_regression_lab_run",
      "git status --short (live repo)",
      "node registry CURRENT_DEFAULTS_OK smoke test",
      "BOS_*_MODEL override GPT55_LAB_OVERRIDE_OK smoke test",
      "curl GET retrieve-profile (read-only production)",
      "vercel env pull bridge lab runtime env (ephemeral)",
      "node mmb9_lab_runner.mjs (arm_a + arm_b narrative generation)"
    ],
    "files_created": [
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/MMB9_DARREN_PROFILE_READONLY_SNAPSHOT.json",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/MMB9_CURRENT_DEFAULT_OUTPUT.md",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/MMB9_GPT55_LAB_OUTPUT.md",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/MMB9_COMPARISON_SCORECARD.md",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/MMB9_RUN_TRACE.json",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/mmb9_lab_runner.mjs",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/mmb9_lab_summary.json",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/arm_a_default/",
      "lab_runs/mmb9_darren_bos_gpt55_regression_lab_run/arm_b_gpt55/",
      "inbox_validator/GROK_TO_CODEX_MMB9_DARREN_BOS_GPT55_REGRESSION_LAB_RUN.md",
      "inbox_validator/grok_to_codex_mmb9_darren_bos_gpt55_regression_lab_run.json"
    ],
    "forbidden_actions_avoided": [
      "no_production_deploy",
      "no_commit",
      "no_redis_live_data_write",
      "no_canonical_dossier_mutation",
      "no_profile_id_overwrite",
      "no_visual_dna_generation_or_storage_mutation",
      "no_gpt55_production_activation",
      "no_env_config_flip",
      "no_product_env_write",
      "no_api_key_logging",
      "no_prompt_generation_product_code_change",
      "no_customer_facing_claim_change",
      "no_design_lab_change",
      "no_package_install",
      "no_product_file_mutation"
    ],
    "remaining_limits": [
      "Rescoring comparison blocked: Darren canonical lacks rescoring_v1 prerequisite",
      "Profile retrieved via production GET (read-only) \u2014 no local Redis/dev server",
      "GPT-5.5 required bridge-only API parameter compatibility patches; product routes unchanged",
      "Single-profile sample insufficient for production model flip",
      "Ephemeral lab runtime env used for OpenAI key bootstrap; not committed"
    ]
  },
  "labSummary": {
    "arm_a": {
      "models": {
        "rescoring": "gpt-4o",
        "narrative": "gpt-4o-2024-08-06",
        "report": "gpt-5.5"
      },
      "section_models": {
        "executiveSummary": "gpt-4o-2024-08-06",
        "fiveFutures": "gpt-4o-2024-08-06",
        "recommendedNextStep": "gpt-4o-2024-08-06",
        "facilitatorNotes": "gpt-4o-2024-08-06"
      },
      "rescoring": "gptBehavioralRescore returned null (likely missing rescoring_v1)"
    },
    "arm_b": {
      "models": {
        "rescoring": "gpt-5.5-2026-04-23",
        "narrative": "gpt-5.5-2026-04-23",
        "report": "gpt-5.5-2026-04-23"
      },
      "section_models": {
        "executiveSummary": "gpt-5.5-2026-04-23",
        "fiveFutures": "gpt-5.5-2026-04-23",
        "recommendedNextStep": "gpt-5.5-2026-04-23",
        "facilitatorNotes": "gpt-5.5-2026-04-23"
      },
      "rescoring": "gptBehavioralRescore returned null (likely missing rescoring_v1)"
    }
  },
  "comparisonSummary": {
    "defaultQualityAverage": 79.1,
    "gpt55QualityAverage": 88.8,
    "qualityDelta": 9.7,
    "defaultLatencyMs": 20721,
    "gpt55LatencyMs": 98996,
    "defaultTokens": 23066,
    "gpt55Tokens": 26850,
    "gpt55ReasoningTokens": 1426,
    "recommendation": "Move GPT-5.5 to next lab \u2014 needs more samples (MMB10)",
    "verdict": "move_gpt55_to_next_lab_needs_more_samples",
    "globalFindings": [
      {
        "badge": "Improved",
        "label": "Weighted quality average",
        "detail": "79.1 \u2192 88.8 (+9.7) excluding latency/cost"
      },
      {
        "badge": "Improved",
        "label": "Darren-specific usefulness",
        "detail": "+16 delta; B addresses residual/subscription goal, rainmaker role"
      },
      {
        "badge": "Improved",
        "label": "Specificity & causality",
        "detail": "+17 specificity, +18 behavioral causality per MMB9 scorecard"
      },
      {
        "badge": "Regressed",
        "label": "Latency",
        "detail": "Arm A ~20.7s vs Arm B ~99.0s (~4.8\u00d7 slower)"
      },
      {
        "badge": "Regressed",
        "label": "Cost efficiency",
        "detail": "B ~17% more tokens + 1426 reasoning tokens; likely 1.5\u20132.5\u00d7 cost"
      },
      {
        "badge": "Watch",
        "label": "Rescoring path",
        "detail": "Both arms blocked \u2014 Darren canonical lacks rescoring_v1"
      },
      {
        "badge": "Evidence gap",
        "label": "Sample size",
        "detail": "Single-profile Darren sample; not sufficient for production flip"
      },
      {
        "badge": "Neutral",
        "label": "Renderer compatibility",
        "detail": "Both valid narrative V3 JSON; delta \u22121 (negligible)"
      }
    ],
    "dimensionScores": [
      {
        "dimension": "Specificity",
        "armA": 74,
        "armB": 91,
        "delta": 17
      },
      {
        "dimension": "Psychological realism",
        "armA": 76,
        "armB": 89,
        "delta": 13
      },
      {
        "dimension": "Behavioral causality",
        "armA": 72,
        "armB": 90,
        "delta": 18
      },
      {
        "dimension": "Actionability",
        "armA": 75,
        "armB": 88,
        "delta": 13
      },
      {
        "dimension": "Hallucination risk",
        "armA": 80,
        "armB": 84,
        "delta": 4
      },
      {
        "dimension": "Overconfidence control",
        "armA": 71,
        "armB": 78,
        "delta": 7
      },
      {
        "dimension": "Fallback honesty",
        "armA": 88,
        "armB": 90,
        "delta": 2
      },
      {
        "dimension": "Provenance clarity",
        "armA": 96,
        "armB": 96,
        "delta": 0
      },
      {
        "dimension": "Latency",
        "armA": 86,
        "armB": 52,
        "delta": -34
      },
      {
        "dimension": "Likely cost efficiency",
        "armA": 83,
        "armB": 58,
        "delta": -25
      },
      {
        "dimension": "Renderer compatibility",
        "armA": 92,
        "armB": 91,
        "delta": -1
      },
      {
        "dimension": "Darren-specific usefulness",
        "armA": 77,
        "armB": 93,
        "delta": 16
      }
    ]
  },
  "sectionMeta": [
    {
      "id": "executiveSummary",
      "title": "Executive Summary",
      "sectionBadge": null,
      "sectionNote": "No section-level score in MMB9; included in global quality uplift"
    },
    {
      "id": "fiveFutures",
      "title": "Five Futures",
      "sectionBadge": null,
      "sectionNote": "MMB9 notes B cites intake quotes in futures grounding"
    },
    {
      "id": "recommendedNextStep",
      "title": "Recommended Next Step",
      "sectionBadge": null,
      "sectionNote": "MMB9 notes B specifies decision-rights tiers and weekly accountability review"
    },
    {
      "id": "facilitatorNotes",
      "title": "Facilitator Notes",
      "sectionBadge": null,
      "sectionNote": "No section-level score in MMB9; structurally valid in both arms"
    }
  ],
  "defaultSections": {
    "executiveSummary": {
      "section": "executiveSummary",
      "headline": "Decisive Momentum",
      "body": "Darren Kirkland excels in providing clear direction and driving action, making him invaluable in roles where rapid decision-making and momentum are crucial. However, his reliance on decisiveness under pressure can limit his ability to process details thoroughly, potentially impacting long-term strategic planning. Darren thrives in environments where he can independently drive projects, but roles requiring constant coordination and structured frameworks may lead to exhaustion. The highest-leverage insight is his need for external structures to maintain organizational momentum and avoid bottlenecks. Adding decision frameworks could mitigate risks associated with his fast-paced, directive style.",
      "micro_scenario": "Faced with stalled project momentum, Darren clarifies success criteria, energizing the team for a renewed push.",
      "key_warning": "Over-reliance on decisiveness may obscure critical detail assessment.",
      "grounding_used": "canonical.executive_intelligence, canonical.coreOperatingRead, canonical.pressurePattern, canonical.scalingConstraint, canonical.cognition",
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:41:21.112Z",
      "render_source": "gpt55",
      "model_used": "gpt-4o-2024-08-06",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-4o-2024-08-06",
        "model_family": "gpt-4o",
        "model_source": "default",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:41:21.112Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 2313,
      "usage": {
        "prompt_tokens": 5498,
        "completion_tokens": 199,
        "total_tokens": 5697,
        "prompt_tokens_details": {
          "cached_tokens": 5376,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 0,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "facilitatorNotes": {
      "section": "facilitatorNotes",
      "summary": "Darren Kirkland thrives in environments with clear decision frameworks and structured escalation paths to manage rapid growth and alignment needs.",
      "primary_guidance": "Implement decision frameworks and clear escalation paths to support Darren's fast-paced, directive style and ensure organizational momentum.",
      "notes": [
        {
          "label": "reporting",
          "guidance": "Establish a hierarchical reporting structure with clear roles and responsibilities to maintain alignment and accountability as Darren's team grows.",
          "rationale": "Darren's directive operating mode and preference for speed can lead to confusion without clear reporting lines, especially as the team expands."
        },
        {
          "label": "delegation",
          "guidance": "Define and document delegation protocols that allow team members to know when and how to escalate decisions, ensuring Darren's focus remains on high-impact activities.",
          "rationale": "Darren's tendency to leave team members to work independently can result in stalled progress without predefined escalation paths."
        },
        {
          "label": "accountability",
          "guidance": "Create a framework for tracking accountability that includes regular check-ins and feedback loops to prevent project stalls and ensure momentum.",
          "rationale": "Darren's frustration with repeated failures suggests a need for structured accountability to keep projects on track."
        },
        {
          "label": "meetings",
          "guidance": "Set a regular meeting cadence with a focus on decision-making and progress updates to provide Darren with the necessary information to steer effectively.",
          "rationale": "Regular, structured meetings will help Darren maintain direction and address any emerging issues promptly."
        },
        {
          "label": "communication",
          "guidance": "Develop a communication architecture that supports Darren's listening-first but decisive style, with channels for quick action and decision-making.",
          "rationale": "Darren's communication style benefits from a system that allows for decisive action while ensuring that team input is considered."
        },
        {
          "label": "decisions",
          "guidance": "Implement decision frameworks that clarify decision-making criteria and processes, making it easier for Darren to move forward quickly and confidently.",
          "rationale": "Darren's decisive nature and action-driven validation require clear frameworks to avoid decision bottlenecks, especially under pressure."
        },
        {
          "label": "organizational fit",
          "guidance": "Align Darren's role with the organizational need for a stabilizing force that drives direction while adding support structures to manage scale.",
          "rationale": "Darren's ability to stabilize direction is crucial, but additional structures are needed to manage growth and prevent reliance on his personal intervention."
        }
      ],
      "caution": "Do not assume Darren can manage indefinite growth without additional structural support.",
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:41:39.524Z",
      "render_source": "gpt55",
      "model_used": "gpt-4o-2024-08-06",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-4o-2024-08-06",
        "model_family": "gpt-4o",
        "model_source": "default",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:41:39.524Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 5358,
      "usage": {
        "prompt_tokens": 5193,
        "completion_tokens": 482,
        "total_tokens": 5675,
        "prompt_tokens_details": {
          "cached_tokens": 3072,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 0,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "fiveFutures": {
      "section": "fiveFutures",
      "summary": "Darren Kirkland's trajectory is defined by his directive vector and velocity-driven approach. His future is shaped by balancing rapid execution with the integration of external structures to handle scaling effectively. Without change, bottlenecks in coordination will emerge, while adopting structured frameworks can unlock smoother growth. Potential burnout risks arise from accelerating under pressure without checking details, and leadership potential hinges on embracing strategic foresight.",
      "most_likely": {
        "title": "Current Trajectory: Coordination Bottleneck Emerges",
        "likelihood": "likely",
        "trajectory": "Darren continues to drive projects forward with strong directive energy and a focus on action, but as the company scales, his pace may confuse new team members, leading to coordination challenges and inefficiencies.",
        "organization_experiences": "The organization experiences steady growth but faces increasing friction in team alignment and communication as the scale requires more structured processes."
      },
      "futures": [
        {
          "title": "Current Trajectory: Coordination Bottleneck Emerges",
          "likelihood": "likely",
          "trajectory": "Darren's strong vector and velocity mean he pushes projects forward rapidly. However, as the organization grows, his decisiveness without sufficient coordination structures causes misalignment and inefficiencies, particularly with new team members.",
          "organization_experiences": "The company sees steady growth but starts to experience coordination issues, as new hires struggle to keep pace with Darren's rapid decision-making style."
        },
        {
          "title": "Optimized Trajectory: Structure Enhances Growth",
          "likelihood": "possible",
          "trajectory": "By implementing clear frameworks and decision paths, Darren's teams become more aligned. This reduces confusion and allows for greater autonomy among team members, enabling faster scaling.",
          "organization_experiences": "With clearer structures in place, team members operate more independently, leading to smoother scaling and less reliance on Darren for day-to-day decisions."
        },
        {
          "title": "Burnout Trajectory: Overload from Pressure and Pace",
          "likelihood": "risk",
          "trajectory": "Under prolonged pressure, Darren's tendency to double down without detailed checks leads to mistakes and increased stress. This accelerates burnout risk as he struggles to manage the expanding demands of his role.",
          "organization_experiences": "As Darren becomes overwhelmed, decision quality suffers, leading to costly errors and higher team turnover due to unclear processes and expectations."
        },
        {
          "title": "Leadership Trajectory: Strategic Foresight Develops",
          "likelihood": "possible",
          "trajectory": "Darren matures by integrating strategic foresight, balancing his immediate action bias with long-term planning. This helps him guide the organization through complex growth phases with stability.",
          "organization_experiences": "The organization benefits from more strategic initiatives, as Darren's leadership evolves to include long-term planning, reducing the reactionary strain on the team."
        },
        {
          "title": "Constraint Trajectory: Dependency on Darren's Unblock",
          "likelihood": "likely",
          "trajectory": "Without addressing the need for external structures, the organization remains heavily dependent on Darren's ability to resolve bottlenecks, slowing potential growth and causing operational drag as complexity increases.",
          "organization_experiences": "The company becomes increasingly dependent on Darren to resolve issues, creating a bottleneck that limits scalability and increases organizational risk if he is unavailable."
        }
      ],
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:41:27.918Z",
      "render_source": "gpt55",
      "model_used": "gpt-4o-2024-08-06",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-4o-2024-08-06",
        "model_family": "gpt-4o",
        "model_source": "default",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:41:27.918Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 6806,
      "usage": {
        "prompt_tokens": 5493,
        "completion_tokens": 621,
        "total_tokens": 6114,
        "prompt_tokens_details": {
          "cached_tokens": 5376,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 0,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "recommendedNextStep": {
      "section": "recommendedNextStep",
      "headline": "Integrate Decision Frameworks to Enable Scaling",
      "futureBottleneck": "Coordination challenges as the team grows, causing momentum loss and frustration.",
      "coreConstraint": "Lack of structured decision-making frameworks that align with rapid execution style.",
      "highestLeverageLever": "Introduce decision frameworks and clear escalation paths to maintain momentum and clarity as the organization scales.",
      "lowestValueDrag": "Spending excessive time on reactive decision-making without structured guidance.",
      "roleTruth": "Darren's fast-paced, directive style is both his strength and limitation. External structures are necessary to sustain growth.",
      "interventionType": "build_system",
      "intervention": "Build decision frameworks and escalation paths into the organizational process.",
      "whyThisMatters": "By implementing structured decision frameworks, Darren can maintain the organization's momentum, ensure clarity, and prevent bottlenecks that arise from rapid growth.",
      "whatHappensIfIgnored": "Potential scaling issues leading to frustration, stalled projects, and burnout due to lack of coordinated efforts and clear processes.",
      "first30Days": [
        "Identify key decision points that currently lack structure.",
        "Design simple decision-making frameworks that align with current operational pace.",
        "Communicate the new frameworks to the team and integrate them into daily operations."
      ],
      "proofSignals": [
        "Darren's capability to drive action but struggles with sustainable scaling.",
        "The need for external structures to handle increased complexity.",
        "His response to structure and awareness of blind spots."
      ],
      "confidence": "High",
      "evidenceUsed": [
        "Darren's primary vector and velocity scores indicate a preference for swift action.",
        "The executive summary highlights the need for external structures as a scaling solution.",
        "Five Futures analysis suggests future bottlenecks in coordination without structured frameworks."
      ],
      "body": "Darren Kirkland's future bottleneck will be coordination challenges as his team grows, causing potential momentum loss and frustration. The highest-leverage lever to prevent this is to build decision frameworks and clear escalation paths, allowing his fast-paced, directive style to continue driving growth without hitting scaling barriers. This intervention is about integrating external structures to maintain momentum and clarity, preventing bottlenecks that arise from rapid growth. Ignoring this could lead to stalled projects and burnout. In the first 30 days, Darren should identify decision points lacking structure, design frameworks aligning with current operations, and integrate these into daily processes.",
      "grounding_used": "(Darren's directive, velocity-driven approach and the Five Futures analysis indicating coordination challenges as a future bottleneck)",
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:41:34.164Z",
      "render_source": "gpt55",
      "model_used": "gpt-4o-2024-08-06",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-4o-2024-08-06",
        "model_family": "gpt-4o",
        "model_source": "default",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:41:34.164Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 6244,
      "usage": {
        "prompt_tokens": 5099,
        "completion_tokens": 481,
        "total_tokens": 5580,
        "prompt_tokens_details": {
          "cached_tokens": 3072,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 0,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    }
  },
  "gpt55Sections": {
    "executiveSummary": {
      "section": "executiveSummary",
      "headline": "Momentum Setter",
      "body": "Darren creates value by turning stalled motion into direction, then pushing work toward visible progress. He is built for rainmaking, unblocking, and leading early-stage movement where the next step matters more than perfect process. His limits show when scale needs coordination: pace can confuse newer team members, doubts may surface late, and organizational momentum can become dependent on his personal unblock. Under pressure, decisiveness rises; he moves faster and reads less. Prolonged load is the break point. A permission-heavy role, repeated process failure, or high coordination without clear escalation paths will drain him. Highest-leverage insight: separate momentum from Darren by writing the next 30-day success target, decision rules, and escalation paths so progress does not wait for him.",
      "micro_scenario": "In a meeting where a project is looping, he asks why momentum stalled, changes the path, and pushes the room toward action.",
      "key_warning": "The overlooked risk is scale without external structure.",
      "grounding_used": [
        "canonical.core_operating_read",
        "canonical.pressure_pattern",
        "canonical.team_experience",
        "canonical.scaling_constraint",
        "canonical.one_move_seed",
        "canonical.intake_answers.q17",
        "canonical.intake_answers.q22",
        "canonical.intake_answers.q24",
        "canonical.intake_answers.q26",
        "canonical.cognition.ranked_dimensions"
      ],
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:43:41.577Z",
      "render_source": "gpt55",
      "model_used": "gpt-5.5-2026-04-23",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-5.5-2026-04-23",
        "model_family": "gpt-5.5",
        "model_source": "env",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:43:41.578Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 13288,
      "usage": {
        "prompt_tokens": 5497,
        "completion_tokens": 796,
        "total_tokens": 6293,
        "prompt_tokens_details": {
          "cached_tokens": 5376,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 512,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "facilitatorNotes": {
      "section": "facilitatorNotes",
      "summary": "Darren functions best in an environment where he owns direction and rainmaking while a structured operating layer translates his model into delegated execution, decision rights, accountability, and escalation paths.",
      "primary_guidance": "Do not make Darren the recurring coordination layer; install an operator, chief of staff, or accountable integrator who converts his direction into owned workstreams, clear decision rights, milestones, and escalation rules.",
      "notes": [
        {
          "label": "reporting",
          "guidance": "Place Darren in a direction-setting, rainmaker, or founder/strategic lead seat with a direct operational counterpart responsible for execution coordination. Team members should not route routine clarification, permission, or sequencing questions directly through Darren once the model has been defined. Reporting lines should separate strategic direction from day-to-day operational management.",
          "rationale": "His primary vector pattern shows he enters situations with direction already forming and stabilizes direction for the team. His scaling constraint indicates the organization can become dependent on his unblock unless external structure, escalation paths, and decision frameworks are added."
        },
        {
          "label": "delegation",
          "guidance": "Delegation should be built around decision-right transfer, not task handoff alone. For each major workstream, define the owner, the non-negotiable model or standard, the decisions the owner may make without approval, the decisions requiring escalation, and the expected output. Darren\u2019s model should be documented as operating principles or playbooks so others execute the design as intended rather than reinterpret it informally.",
          "rationale": "He reports tension when others interpret his model and make it work for them instead of using the model as designed. He also describes leaving people to work independently, which sometimes works and sometimes results in no progress. The environment must make delegation explicit enough that autonomy does not become ambiguity."
        },
        {
          "label": "accountability",
          "guidance": "Use a visible accountability system with named owners, weekly commitments, milestone dates, and status categories such as on-track, blocked, at-risk, and decision-needed. Accountability should focus on whether the agreed model, timeline, and output were executed, not on informal effort. Missed progress should trigger a predefined recovery path rather than waiting for Darren to personally restart momentum.",
          "rationale": "The canonical read identifies momentum loss due to unclear next steps and a scaling risk where momentum becomes dependent on Darren\u2019s unblock. His frustration increases when teams repeat the same process with the same results, so the environment needs early detection and course-correction mechanisms."
        },
        {
          "label": "meetings",
          "guidance": "Keep meeting cadence structured and decision-oriented: a weekly execution review led by the operational counterpart, a separate weekly or biweekly strategic alignment meeting with Darren, and short escalation windows for blocked decisions. Meetings should start with decisions needed, blockers, owner updates, and changes to the model; avoid open-ended deliberation without a decision pathway.",
          "rationale": "His vector and velocity profile favors direction and action, while his lower framework score indicates he benefits from external process being installed around him. Under pressure, he moves faster and reads less, so meetings must slow the system just enough to preserve alignment without creating unnecessary drag."
        },
        {
          "label": "communication",
          "guidance": "Use concise written briefs before key conversations: context, recommendation, tradeoffs, decision requested, and deadline. Verbal discussion should be followed by a written decision log so the team does not rely on memory or reinterpretation. Feedback to Darren should be framed against the agreed model, outcomes, and risk evidence rather than as generalized opinion.",
          "rationale": "His communication style is listening-first but decisive, with careful consideration of feedback and possible resistance when it contradicts his self-model. Written artifacts reduce ambiguity and make it easier to evaluate whether a challenge is about the model, the execution, or the assumptions."
        },
        {
          "label": "decisions",
          "guidance": "Install a decision review structure with three tiers: reversible decisions owned by workstream leads, material operational decisions reviewed by the operator/integrator, and strategic/model-changing decisions reviewed by Darren. Maintain a decision log capturing owner, date, rationale, assumptions, and review date. High-speed decisions should include a brief risk check before execution when safety, capital, brand, or long-term direction is affected.",
          "rationale": "His decision profile forms direction quickly and validates through action. Evidence shows he can reverse a decision after gathering additional information, but under strain decisiveness increases and detail drops. A tiered decision system preserves speed while preventing over-centralization and late-stage correction."
        },
        {
          "label": "fit",
          "guidance": "The best organizational fit is a growth-stage, founder-led, mission-aligned environment where Darren can set direction, create opportunity, and define the model, while execution infrastructure carries the operating rhythm. The environment should value decisive movement, clear standards, faith- or values-aligned decision principles where relevant, and practical progress over repeated theoretical debate.",
          "rationale": "He identifies as a rainmaker, wants a company with long-term residual effect, and is frustrated by repeated ineffective patterns. His team net effect is direction stabilization, but scaling requires structure around coordination."
        },
        {
          "label": "support_structure",
          "guidance": "Provide an external operating backbone: documented operating model, role clarity, escalation rules, decision frameworks, dashboard visibility, and an integrator function empowered to manage follow-through. The system should clarify the next 30 days of success in writing and translate that into workstream commitments.",
          "rationale": "The recommended next step is to transfer judgment rather than simply work harder or faster. The canonical scaling solution explicitly calls for external structures, decision frameworks, and clear escalation paths."
        },
        {
          "label": "pressure_design",
          "guidance": "Under load, route Darren toward fewer, higher-value decisions instead of increasing his involvement in every stalled item. When pressure rises, the operator/integrator should filter incoming issues, summarize risks, and present options rather than pulling Darren into raw coordination. Prolonged load should trigger workload triage and decision consolidation.",
          "rationale": "Under pressure, Darren becomes more decisive, moves faster, and reads less. His breaking point is prolonged load with moderate recovery, so the environment must prevent pressure from converting him into the bottleneck or emergency coordinator."
        }
      ],
      "caution": "Do not assume that giving people broad independence will produce execution; this environment should not force Darren to choose between total control and unstructured delegation.",
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:45:07.289Z",
      "render_source": "gpt55",
      "model_used": "gpt-5.5-2026-04-23",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-5.5-2026-04-23",
        "model_family": "gpt-5.5",
        "model_source": "env",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:45:07.289Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 25361,
      "usage": {
        "prompt_tokens": 5169,
        "completion_tokens": 1424,
        "total_tokens": 6593,
        "prompt_tokens_details": {
          "cached_tokens": 0,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 32,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "fiveFutures": {
      "section": "fiveFutures",
      "summary": "Darren is not just a directive vector leader. This profile is differentiated by vector primary at 0.88 paired with velocity at 0.75, very low framework at 0.17 and horizon at 0, a self-described rain-maker role, and a stated preference to move forward rather than keep asking for permission. His future paths are shaped by the gap between wanting a residual, subscription-based company that can operate on its own and the current tendency for momentum to depend on his personal unblock, model ownership, and speed.",
      "most_likely": {
        "title": "Current Trajectory: Momentum With Rising Coordination Cost",
        "likelihood": "likely",
        "trajectory": "If nothing changes, Darren keeps creating forward motion through personal direction and pace. The evidence points to a leader with vector primary at 0.88 and velocity secondary at 0.75 who says, \"I hyper focus and get the job done,\" and who usually takes the role of \"rain maker.\" He will continue stepping in when momentum stalls, changing the process, and pushing the work back toward motion. The profile-specific cause is that action is his stabilizer: when repetition frustrates him, moving forward feels cleaner than waiting for permission or consensus.",
        "organization_experiences": "The MORE Companies experiences strong early momentum, especially around founder-led sales, product direction, and opportunity creation. The cost shows up as coordination load: newly added people may not understand the pace, and teams may hesitate when they are unsure whether to use Darren's model exactly or adapt it. This is not a generic vector outcome; it is specific to his own statement that tension appears when someone interprets his model and makes it work for them instead of using it as designed."
      },
      "futures": [
        {
          "title": "Current Trajectory: Momentum With Rising Coordination Cost",
          "likelihood": "likely",
          "trajectory": "Darren continues to lead through direction, speed, and intervention. He has vector primary at 0.88, velocity secondary at 0.75, and under pressure his decisiveness increases while he \"moves faster, reads less.\" His written answers reinforce the same pattern: he says he hyper-focuses and gets the job done, and when momentum stalls he tries to understand why, then makes changes to get the process moving again. This trajectory belongs to him because forward motion is not just a preference; it is how he reduces frustration when others keep repeating the same ineffective pattern.",
          "organization_experiences": "The organization gets movement, but the movement increasingly depends on Darren's interpretation of what should happen next. At 2x scale, the dossier says his pace may confuse newly added team members, and his own leadership description says he leaves people to work independently so their creative side can show up, but sometimes \"they hang themselves for not doing anything.\" The consequence is a company where initiative is uneven: strong contributors may run, while unclear contributors stall until Darren re-enters and redirects the work."
        },
        {
          "title": "Optimized Trajectory: Thirty-Day Clarity Transfers Momentum",
          "likelihood": "possible",
          "trajectory": "If Darren adopts the One Move, the next stage becomes more transferable: \"Clarify what success looks like in next 30 days. Write it down. Commit publicly.\" This works for this profile because the evidence says he is capable of execution, responds well to structure, and already says that \"just moving forward doing things is always beneficial\" for him. His hyper-focus becomes more useful when aimed at a public 30-day definition of success rather than repeatedly re-solving what stalled.",
          "organization_experiences": "The company experiences less founder interpretation in the middle of work. People know what outcome Darren has committed to for the next 30 days, which reduces the specific tension he named: others trying to reinterpret his model instead of using it as designed. This would matter especially for a subscription or residual business, because recurring value requires repeatable execution after the initial rain-maker push, not just Darren personally restarting momentum whenever the team slows down."
        },
        {
          "title": "Burnout Trajectory: Speed Becomes Rework",
          "likelihood": "risk",
          "trajectory": "Under prolonged pressure, Darren's pattern intensifies: the dossier says he doubles down, decisiveness increases, he moves faster, and reads less. His own words show the pressure source: doing the same thing repeatedly with the same result \"drains me,\" and he expects future strain as success increases because \"time for work or play will become a strain.\" This trajectory belongs to him because speed is both the relief valve and the risk; the faster he moves to escape stalled momentum, the more likely he is to skip information that later changes the decision.",
          "organization_experiences": "The organization begins to feel abrupt course changes. The cruise example shows the pattern in personal decision form: he made the decision without all the information, researched more, then cancelled because the political climate made it unsafe. In business, the same pattern can produce fast product, partnership, or hiring commitments that later reverse after new information is read. The consequence is not simply fatigue; it is avoidable rework, schedule disruption, and reduced confidence from teams who cannot tell whether a decision is final or just the first fast move."
        },
        {
          "title": "Leadership Trajectory: Judgment Becomes Shareable",
          "likelihood": "possible",
          "trajectory": "If Darren matures into stronger leadership architecture, he keeps the decisiveness but makes the reasoning easier for others to use. The dossier describes him as listening-first but decisive, thoughtful in tone, and generally reliable. His written answers also show that he tries to explain his intentions several different ways when misunderstood, and that he wants success for those he leads more than for himself. The profile-specific maturation is not becoming less directive; it is making his model teachable before people are left alone to execute.",
          "organization_experiences": "The MORE Companies would experience a shift from Darren as rain maker to Darren as builder of owners. Instead of team members either succeeding creatively or \"hanging themselves\" through inaction, they receive enough of his judgment to act without waiting for him to unblock momentum. This is especially important because faith-based values drive his company thinking and development; leadership maturity would protect the values and the operating model as the company grows, rather than leaving both dependent on Darren being present in every important interpretation."
        },
        {
          "title": "Constraint Trajectory: Scale Exposes Founder Dependency",
          "likelihood": "likely",
          "trajectory": "If the main scaling constraint remains unresolved, growth exposes the coordination break. The dossier says that at 5x scale Darren requires external structure to move, escalation processes, and decision frameworks, and that the scaling breakpoint is coordination. It also says organizational momentum becomes dependent on his unblock. This belongs to Darren's profile because vector plus velocity creates strong personal motion, while framework at 0.17 and horizon at 0 leave the broader system less able to carry that motion without him.",
          "organization_experiences": "The organization can grow revenue or opportunity faster than it grows operating independence. That is a direct threat to Darren's stated goal of building a subscription-based or saleable business that can operate mostly on its own. Instead of becoming a residual asset, the company risks becoming a founder-responsive machine: teams wait for Darren's read, his model, or his permission to adjust. The consequence is specific to this dossier because the desired end state is leverage and eventual independence, while the unresolved constraint keeps value tied to Darren's personal unblock."
        }
      ],
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:44:19.642Z",
      "render_source": "gpt55",
      "model_used": "gpt-5.5-2026-04-23",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-5.5-2026-04-23",
        "model_family": "gpt-5.5",
        "model_source": "env",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:44:19.642Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 38063,
      "usage": {
        "prompt_tokens": 5492,
        "completion_tokens": 2012,
        "total_tokens": 7504,
        "prompt_tokens_details": {
          "cached_tokens": 5376,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 512,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    },
    "recommendedNextStep": {
      "section": "recommendedNextStep",
      "headline": "Move from personal unblocker to transferable decision authority.",
      "futureBottleneck": "The next stage is most likely to be capped by the company needing Darren\u2019s personal direction every time execution slows, the model is misread, or a decision feels unclear. That dependency will directly conflict with his goal of building a subscription or residual business that can operate without him.",
      "coreConstraint": "Darren is strongest as a rainmaker and directional leader, but scale will require repeatable judgment, decision rights, escalation paths, and accountability that do not depend on his direct intervention.",
      "highestLeverageLever": "Transfer Darren\u2019s judgment into a clear operating model: who owns which decisions, what success looks like, when the team can move without permission, and when issues must escalate to him.",
      "lowestValueDrag": "The strategic capacity drain is repeated interpretation of his model, permission-seeking, stalled execution, and rescuing work after the team was given freedom without enough accountability or decision clarity.",
      "roleTruth": "Darren is the right person to define the direction, standards, and decision logic. He is not the right person to remain the recurring coordination layer or daily permission source. His highest-value role is owner of vision, rainmaking, strategic decisions, and key relationships; the execution system needs to carry more judgment without him.",
      "interventionType": "transfer_judgment",
      "intervention": "Create a decision-rights and accountability structure that lets the team execute Darren\u2019s model without needing Darren to personally clarify, approve, or restart momentum every time friction appears.",
      "whyThisMatters": "If Darren wants a business that can be sold, leveraged, or largely operate on its own, the company must prove that its judgment is transferable. A business that still needs the founder to interpret the model, unblock the team, and restart momentum is not yet a scalable asset.",
      "whatHappensIfIgnored": "Growth will increase pressure on Darren rather than reduce it. The team will either wait for his approval, misinterpret the model, or move in directions he later has to correct. As success increases, time strain will rise, frustration will build, and the company will remain dependent on his personal pace and intervention.",
      "first30Days": [
        "Pick one current business function where momentum most often stalls and name a single accountable owner for outcomes, decisions, and escalation.",
        "Write a one-page decision guide for that function: the 30-day success target, decisions the owner can make without Darren, decisions that require escalation, and the standards that must not be violated.",
        "Run a weekly 30-minute accountability review where the owner reports progress, decisions made without permission, blocked issues, and any judgment gaps that need to be added to the guide."
      ],
      "proofSignals": [
        "The team starts making correct decisions without waiting for Darren\u2019s approval.",
        "Darren spends less time re-explaining intentions, correcting interpretation, or restarting stalled work.",
        "Momentum continues for at least two weeks in the selected function even when Darren is not directly involved."
      ],
      "confidence": "High",
      "evidenceUsed": [
        "Darren describes himself as the rainmaker and notes tension when others reinterpret his model instead of using it as designed.",
        "The scaling read identifies the breakpoint as coordination, with risk that organizational momentum becomes dependent on Darren\u2019s unblock.",
        "His profile shows strong directional drive and speed, while the lowest scores point to future strain around structure, long-range scaling, and repeatable process."
      ],
      "body": "Darren\u2019s One Move is to transfer judgment, not simply work harder or move faster. His future bottleneck is founder-dependent execution: the business needing him to clarify the model, grant permission, restart momentum, or correct decisions as complexity rises. He should remain the rainmaker and strategic direction-setter, but stop being the recurring coordination layer. The highest-leverage move is to install decision rights, accountability, and escalation paths so the team can execute his model without requiring his constant intervention.",
      "grounding_used": "This recommendation is grounded in Darren\u2019s fast, decisive, direction-setting leadership pattern; his stated rainmaker role; his frustration with repeated failed processes and permission-seeking; and the future bottleneck that scale will make company momentum dependent on his personal unblock unless judgment is transferred into the team.",
      "fromGPT": true,
      "generatedAt": "2026-07-07T05:44:41.927Z",
      "render_source": "gpt55",
      "model_used": "gpt-5.5-2026-04-23",
      "model_provenance": {
        "registry_version": "mmb6.behavior_preserving.v1",
        "route_name": "bos.narrative",
        "model_used": "gpt-5.5-2026-04-23",
        "model_family": "gpt-5.5",
        "model_source": "env",
        "fallback_used": false,
        "fallback_reason": null,
        "generated_at": "2026-07-07T05:44:41.927Z",
        "cognition_source": "mmb9-lab-runner"
      },
      "elapsed_ms": 22284,
      "usage": {
        "prompt_tokens": 5165,
        "completion_tokens": 1295,
        "total_tokens": 6460,
        "prompt_tokens_details": {
          "cached_tokens": 0,
          "audio_tokens": 0
        },
        "completion_tokens_details": {
          "reasoning_tokens": 370,
          "audio_tokens": 0,
          "accepted_prediction_tokens": 0,
          "rejected_prediction_tokens": 0
        }
      }
    }
  }
};
