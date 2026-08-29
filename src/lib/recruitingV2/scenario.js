export function scenarioValuesFor(object, values = {}) {
  return Object.freeze(Object.fromEntries((object?.assumptions || []).map((item) => [
    item.id,
    Number(values[item.id] ?? item.value),
  ])));
}
export function calculateFirstLeverageScenario(values) {
  return Math.round(
    (Number(values?.releasedHours) || 0) * 4.33 * (Number(values?.valuePerReleasedHour) || 0)
      - (Number(values?.assistantMonthlyCost) || 0),
  );
}

export function scenarioChangeSet(object, values = {}) {
  const merged = scenarioValuesFor(object, values);
  const assumptions = object?.assumptions || [];
  const baselineValues = Object.fromEntries(assumptions.map((item) => [item.id, Number(item.value)]));
  const changed = assumptions.filter((item) => merged[item.id] !== baselineValues[item.id]).map((item) => Object.freeze({
    id: item.id,
    label: item.label,
    from: baselineValues[item.id],
    to: merged[item.id],
    unit: item.unit,
  }));
  const baselineNet = calculateFirstLeverageScenario(baselineValues);
  const currentNet = calculateFirstLeverageScenario(merged);
  return Object.freeze({
    values: merged,
    changed: Object.freeze(changed),
    baselineNet,
    currentNet,
    consequenceDelta: currentNet - baselineNet,
  });
}
