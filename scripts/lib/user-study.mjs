const participantIds = ["P1", "P2", "P3", "P4", "P5"];
const familiarityValues = new Set(["low", "medium", "high"]);
const deviceValues = new Set(["mobile-touch", "desktop-pointer", "desktop-keyboard"]);
const forbiddenKeys = /^(?:name|email|phone|face|voice|address|contact)$/iu;

function count(records, predicate) {
  return records.filter(predicate).length;
}

function walkKeys(value, path = "study", errors = []) {
  if (!value || typeof value !== "object") return errors;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) errors.push(`forbidden personal-data field: ${path}.${key}`);
    walkKeys(child, `${path}.${key}`, errors);
  }
  return errors;
}

export function computePrimarySummary(participants) {
  return {
    tradeoff_pass: count(participants, (record) => record.tradeoff_pass === true),
    move_within_15s_pass: count(participants, (record) => typeof record.first_valid_move_seconds === "number" && record.first_valid_move_seconds <= 15),
    evidence_distinction_pass: count(participants, (record) => record.evidence_distinction_pass === true),
    spontaneous_loop_pass: count(participants, (record) => record.spontaneous_loop_pass === true),
    misconception_count: count(participants, (record) => record.misconception_present === true),
    guided_path_pass: count(participants, (record) => record.guided_path_pass === true),
  };
}

export function validatePrimaryStudy(study) {
  const errors = walkKeys(study);
  if (study?.schema_version !== 1 || study?.study_id !== "primary-wave-1") errors.push("invalid primary study identity");
  if (!new Set(["pending", "complete"]).has(study?.status)) errors.push("study status must be pending or complete");
  if (!Array.isArray(study?.participants) || study.participants.length !== 5 ||
      JSON.stringify(study.participants.map((record) => record.id)) !== JSON.stringify(participantIds)) {
    errors.push("primary study requires exact anonymous IDs P1-P5 in order");
    return errors;
  }
  if (study.status === "pending") {
    if (study.summary !== null) errors.push("pending study must not claim a summary");
    for (const record of study.participants) {
      for (const [key, value] of Object.entries(record)) {
        if (key !== "id" && value !== null) errors.push(`pending participant ${record.id} must not claim ${key}`);
      }
    }
    return errors;
  }

  if (!/^[a-f0-9]{40}$/u.test(study.build?.source_commit ?? "")) errors.push("complete study requires a full source_commit");
  if (study.build?.evidence_fingerprint !== "877e015b716ffdee") errors.push("study build fingerprint does not match admitted evidence");
  for (const field of ["started_at", "completed_at"]) {
    if (!Number.isFinite(Date.parse(study.build?.[field] ?? ""))) errors.push(`complete study requires ${field}`);
  }
  if (typeof study.build?.moderator !== "string" || study.build.moderator.trim().length < 2 || /codex|agent|test/iu.test(study.build.moderator)) {
    errors.push("complete study requires a real human moderator identifier");
  }
  for (const record of study.participants) {
    if (!familiarityValues.has(record.familiarity)) errors.push(`${record.id} has invalid familiarity`);
    if (!deviceValues.has(record.device_path)) errors.push(`${record.id} has invalid device_path`);
    if (typeof record.browser_viewport !== "string" || !/\d+.*\d+/u.test(record.browser_viewport)) errors.push(`${record.id} requires browser and viewport evidence`);
    if (typeof record.reduced_motion !== "boolean") errors.push(`${record.id} requires reduced_motion`);
    if (typeof record.five_second_answer !== "string" || record.five_second_answer.trim().length < 2) errors.push(`${record.id} requires a verbatim five-second answer`);
    for (const field of ["tradeoff_pass", "neutral_prompt_used", "evidence_distinction_pass", "misconception_present", "spontaneous_loop_pass", "guided_path_pass"]) {
      if (typeof record[field] !== "boolean") errors.push(`${record.id} requires boolean ${field}`);
    }
    if (typeof record.first_valid_move_seconds !== "number" || record.first_valid_move_seconds < 0) errors.push(`${record.id} requires first_valid_move_seconds`);
    if (typeof record.evidence_distinction_verbatim !== "string" || record.evidence_distinction_verbatim.trim().length < 2) errors.push(`${record.id} requires evidence_distinction_verbatim`);
    if (record.misconception_present === true && (typeof record.misconception_verbatim !== "string" || record.misconception_verbatim.trim().length < 2)) {
      errors.push(`${record.id} misconception requires verbatim evidence`);
    }
    if (record.misconception_present === false && record.misconception_verbatim !== null) errors.push(`${record.id} no-misconception record must keep misconception_verbatim null`);
  }
  if (count(study.participants, (record) => record.device_path === "mobile-touch") < 2) errors.push("primary cohort requires at least two mobile-touch sessions");
  for (const path of ["desktop-pointer", "desktop-keyboard"]) {
    if (count(study.participants, (record) => record.device_path === path) < 1) errors.push(`primary cohort requires at least one ${path} session`);
  }
  if (count(study.participants, (record) => record.familiarity === "low") < 1 ||
      count(study.participants, (record) => record.familiarity === "medium") < 2 ||
      count(study.participants, (record) => record.familiarity === "high") < 1) {
    errors.push("primary cohort familiarity mix requires low>=1 medium>=2 high>=1");
  }
  const actual = computePrimarySummary(study.participants);
  if (JSON.stringify(study.summary) !== JSON.stringify(actual)) errors.push("study summary must exactly equal computed participant counts");
  for (const [field, value] of Object.entries(actual)) {
    if (field === "misconception_count") {
      if (value > 1) errors.push("primary gate hard stop: misconception_count exceeds 1/5");
    } else if (field !== "guided_path_pass" && value < 4) {
      errors.push(`primary gate failed: ${field} is below 4/5`);
    }
  }
  return errors;
}
