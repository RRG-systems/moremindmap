import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APA_DELTA_REQUEST_SCHEMA_LIMITS,
  apaDeltaSchemaMetrics,
  assertApaDeltaSchemaBudget,
  matchesApaSchema,
} from '../server/athleteApa/apaDeltaCore.js';

const strictObject = properties => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const expectOverBudget = schema => assert.throws(() => assertApaDeltaSchemaBudget(schema));

test('array enums require the exact ordered array rather than matching element types', () => {
  const schema = { type: 'array', items: { type: 'string' }, enum: [['A', 'B'], ['A', 'B', 'C']] };
  assert.equal(matchesApaSchema(['A', 'B'], schema), true);
  assert.equal(matchesApaSchema(['A', 'B', 'C'], schema), true);
  for (const rejected of [[], ['A'], ['B', 'A'], ['A', 'B', 'B'], ['A', 'B', 'C', 'D']]) {
    assert.equal(matchesApaSchema(rejected, schema), false, JSON.stringify(rejected));
  }
});

test('deep structural object enums ignore object key order but retain exact nested content', () => {
  const schema = { type: 'object', enum: [{
    id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: true }, count: 2,
  }] };
  assert.equal(matchesApaSchema({
    count: 2, nested: { enabled: true, refs: ['A', 'B'] }, id: 'DOMAIN:1',
  }, schema), true);
  const rejected = [
    { id: 'DOMAIN:1', nested: { refs: ['B', 'A'], enabled: true }, count: 2 },
    { id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: false }, count: 2 },
    { id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: true }, count: 3 },
    { id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: true } },
    { id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: true }, count: 2, extra: null },
    { id: 'DOMAIN:1', nested: { refs: ['A', 'B'], enabled: true, extra: null }, count: 2 },
  ];
  for (const value of rejected) assert.equal(matchesApaSchema(value, schema), false);
});

test('an enum is enforced before anyOf and type branches can accept a broader shape', () => {
  const objectSchema = {
    enum: [{ id: 'GATE:1', cite_confirmed_update: true }],
    anyOf: [strictObject({ id: { type: 'string' }, cite_confirmed_update: { type: 'boolean' } })],
  };
  assert.equal(matchesApaSchema({ cite_confirmed_update: true, id: 'GATE:1' }, objectSchema), true);
  assert.equal(matchesApaSchema({ id: 'GATE:2', cite_confirmed_update: true }, objectSchema), false);
  assert.equal(matchesApaSchema({ id: 'GATE:1', cite_confirmed_update: false }, objectSchema), false);
  const arraySchema = { enum: [['A', 'B']], anyOf: [{ type: 'array', items: { type: 'string' } }] };
  assert.equal(matchesApaSchema(['A', 'B'], arraySchema), true);
  assert.equal(matchesApaSchema(['B', 'A'], arraySchema), false);
  assert.equal(matchesApaSchema(['A', 'B', 'C'], arraySchema), false);
});

test('primitive enums and strict nested object properties reject missing and extra fields', () => {
  const schema = strictObject({
    contract: { type: 'string', enum: ['codec_v1'] },
    gate: strictObject({ id: { type: 'string', enum: ['GATE:1'] }, cite_confirmed_update: { type: 'boolean' } }),
  });
  const valid = { contract: 'codec_v1', gate: { id: 'GATE:1', cite_confirmed_update: false } };
  assert.equal(matchesApaSchema(valid, schema), true);
  for (const value of [
    { ...valid, contract: 'legacy_v1' },
    { ...valid, gate: { id: 'GATE:2', cite_confirmed_update: false } },
    { ...valid, gate: { id: 'GATE:1' } },
    { ...valid, gate: { ...valid.gate, refs: ['A'] } },
    { ...valid, refs: ['A'] },
    { gate: valid.gate },
  ]) assert.equal(matchesApaSchema(value, schema), false);
});

test('schema metrics count repeated properties, definitions, enums, constants and references conservatively', () => {
  const definitionName = 'saved_entity';
  const reference = `#/$defs/${definitionName}`;
  const schema = {
    ...strictObject({
      repeated_name: { type: 'string', enum: ['A', 'BC'] },
      selected: { $ref: reference },
    }),
    $defs: {
      [definitionName]: strictObject({
        repeated_name: { type: 'string', enum: ['A', 'BC'] },
        id: { type: 'string', const: 'ENTITY:1' },
      }),
    },
  };
  const before = structuredClone(schema);
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.deepEqual(Object.keys(metrics).sort(), [
    'enum_string_chars', 'enum_values', 'max_depth', 'properties', 'total_schema_string_chars',
  ]);
  assert.equal(metrics.properties, 4);
  assert.equal(metrics.enum_values, 4);
  assert.equal(metrics.enum_string_chars, 6);
  const minimumStrings = 'repeated_name'.length * 2 + 'selected'.length + 'id'.length
    + definitionName.length + reference.length + 'ENTITY:1'.length + 6;
  assert.ok(metrics.total_schema_string_chars >= minimumStrings);
  assert.ok(metrics.max_depth >= 2);
  assert.equal(Object.isFrozen(metrics), true);
  assert.deepEqual(schema, before);
  assert.doesNotThrow(() => assertApaDeltaSchemaBudget(schema));
});

test('strings nested in array and object enum alternatives are included in the full string budget', () => {
  const key = 'nested_enum_key';
  const schema = { enum: [
    ['ABC', { [key]: ['DE', 'F'] }],
    ['ABC', { [key]: ['DE', 'F'] }],
  ] };
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.equal(metrics.enum_values, 2);
  assert.ok(metrics.enum_string_chars >= 12);
  assert.ok(metrics.total_schema_string_chars >= 12 + key.length * 2);
});

test('the published limits include the complete 120000-character schema string budget', () => {
  assert.deepEqual(APA_DELTA_REQUEST_SCHEMA_LIMITS, {
    properties: 5000, max_depth: 10, enum_values: 1000, total_schema_string_chars: 120000,
  });
  assert.equal(Object.isFrozen(APA_DELTA_REQUEST_SCHEMA_LIMITS), true);
});

test('property count is rejected independently of the string and enum budgets', () => {
  const properties = Object.fromEntries(Array.from({ length: 5001 }, (_, index) => [`p${index}`, { type: 'boolean' }]));
  const schema = strictObject(properties);
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.equal(metrics.properties, 5001);
  assert.equal(metrics.enum_values, 0);
  assert.ok(metrics.total_schema_string_chars < 120000);
  expectOverBudget(schema);
  const allowed = strictObject(Object.fromEntries(Object.entries(properties).slice(0, 5000)));
  assert.doesNotThrow(() => assertApaDeltaSchemaBudget(allowed));
});

test('nesting beyond ten levels is rejected even with very few properties', () => {
  let schema = { type: 'boolean' };
  for (let index = 0; index < 12; index += 1) schema = strictObject({ nested: schema });
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.ok(metrics.max_depth > 10);
  assert.ok(metrics.properties <= 12);
  assert.equal(metrics.enum_values, 0);
  expectOverBudget(schema);
});

test('repeated enum alternatives still count toward the 1000-value cap', () => {
  const schema = { type: 'string', enum: Array(1001).fill('x') };
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.equal(metrics.enum_values, 1001);
  assert.ok(metrics.total_schema_string_chars < 120000);
  expectOverBudget(schema);
  assert.doesNotThrow(() => assertApaDeltaSchemaBudget({ type: 'string', enum: Array(1000).fill('x') }));
});

test('a property-name-heavy schema cannot bypass the full string limit with small enums', () => {
  const schema = strictObject({ ['p'.repeat(120001)]: { type: 'boolean' } });
  const metrics = apaDeltaSchemaMetrics(schema);
  assert.equal(metrics.properties, 1);
  assert.equal(metrics.enum_values, 0);
  assert.equal(metrics.enum_string_chars, 0);
  assert.ok(metrics.total_schema_string_chars > 120000);
  expectOverBudget(schema);
});

test('oversized definition names, enum strings, constants and references each independently fail', () => {
  const oversized = 's'.repeat(120001);
  const schemas = [
    { $defs: { [oversized]: { type: 'boolean' } }, type: 'boolean' },
    { type: 'string', enum: [oversized] },
    { type: 'string', const: oversized },
    { $ref: oversized },
    { type: 'string', enum: ['s'.repeat(60001), 's'.repeat(60001)] },
  ];
  for (const schema of schemas) {
    const metrics = apaDeltaSchemaMetrics(schema);
    assert.ok(metrics.total_schema_string_chars > 120000);
    assert.ok(metrics.properties <= 1);
    assert.ok(metrics.enum_values <= 2);
    expectOverBudget(schema);
  }
});
