import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ALGERIA_ADMIN_META, WILAYA_DATA } from '../data.js';

const geo = JSON.parse(await readFile(new URL('../../public/algeria.json', import.meta.url), 'utf8'));
const names = Object.keys(WILAYA_DATA);
const mapNames = geo.features.map((feature) => feature.properties?.name).filter(Boolean);
const codes = names.map((name) => WILAYA_DATA[name].code).sort((a, b) => a - b);

test('2026 legal structure exposes 69 wilayas and 1541 communes', () => {
  assert.equal(ALGERIA_ADMIN_META.official_wilaya_count, 69);
  assert.equal(ALGERIA_ADMIN_META.official_commune_count, 1541);
  assert.equal(names.length, 69);
  assert.equal(geo.features.length, 69);
});

test('map and learning dataset contain the same 69 wilayas', () => {
  assert.deepEqual([...mapNames].sort(), [...names].sort());
  assert.deepEqual(codes, Array.from({ length: 69 }, (_, index) => index + 1));
});

test('the eleven 2026 wilayas are present with codes 59 through 69', () => {
  const expected = [
    'Aflou',
    'Barika',
    'El Kantara',
    'Bir El Ater',
    'El Aricha',
    'Ksar Chellala',
    'Aïn Ouessara',
    'Messaad',
    'Ksar El Boukhari',
    'Bou Saâda',
    'El Abiodh Sidi Cheikh',
  ];
  const actual = names
    .filter((name) => WILAYA_DATA[name].created === 2026)
    .sort((a, b) => WILAYA_DATA[a].code - WILAYA_DATA[b].code);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.map((name) => WILAYA_DATA[name].code), Array.from({ length: 11 }, (_, index) => index + 59));
});

test('every wilaya has multilingual names, capital, learning region, and source', () => {
  for (const name of names) {
    const row = WILAYA_DATA[name];
    assert.ok(row.name_ar, name + ' missing Arabic name');
    assert.ok(row.name_fr, name + ' missing French name');
    assert.ok(row.capital, name + ' missing capital');
    assert.ok(row.region, name + ' missing learning region');
    assert.ok(row.official_source, name + ' missing official source');
  }
});


function signedRingArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

test('wilaya polygon winding is compatible with D3 spherical rendering', () => {
  let outerRingCount = 0;
  for (const feature of geo.features) {
    const polygons = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    for (const polygon of polygons) {
      outerRingCount += 1;
      assert.ok(
        signedRingArea(polygon[0]) < 0,
        feature.properties.name + ' outer ring must be clockwise for D3/react-simple-maps'
      );
    }
  }
  assert.equal(outerRingCount, 70);
});
