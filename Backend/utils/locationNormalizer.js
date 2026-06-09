'use strict';
// Backend/utils/locationNormalizer.js
// ── Single source of truth for city name normalization ────────────────────────
// All variants map to one canonical spelling.
// Used in protect.js (read) and userController.js (write).

const LOCATION_MAP = {
  // ── India ──────────────────────────────────────────────────────────────────
  'bangalore':           'Bengaluru',
  'bangaluru':           'Bengaluru',
  'bengalore':           'Bengaluru',
  'bengaluru':           'Bengaluru',
  'blr':                 'Bengaluru',

  'kolkata':             'Kolkata',
  'calcutta':            'Kolkata',
  'culkata':             'Kolkata',
  'culcutta':            'Kolkata',
  'kolkatta':            'Kolkata',
  'calcuta':             'Kolkata',

  'mumbai':              'Mumbai',
  'bombay':              'Mumbai',
  'mum':                 'Mumbai',

  'delhi':               'Delhi',
  'new delhi':           'Delhi',
  'nd':                  'Delhi',

  'hyderabad':           'Hyderabad',
  'hyd':                 'Hyderabad',
  'hydrabad':            'Hyderabad',

  'chennai':             'Chennai',
  'madras':              'Chennai',

  'pune':                'Pune',
  'poona':               'Pune',

  'ahmedabad':           'Ahmedabad',
  'ahemdabad':           'Ahmedabad',
  'ahmadabad':           'Ahmedabad',

  'noida':               'Noida',

  // ── USA ────────────────────────────────────────────────────────────────────
  'new york':            'New York',
  'newyork':             'New York',
  'ny':                  'New York',
  'nyc':                 'New York',

  'san jose':            'San Jose',
  'sanjose':             'San Jose',

  'san francisco':       'San Francisco',
  'sf':                  'San Francisco',

  'los angeles':         'Los Angeles',
  'la':                  'Los Angeles',

  'chicago':             'Chicago',
  'houston':             'Houston',
  'dallas':              'Dallas',
  'austin':              'Austin',
  'seattle':             'Seattle',
  'boston':              'Boston',
  'atlanta':             'Atlanta',
  'denver':              'Denver',
  'phoenix':             'Phoenix',
  'miami':               'Miami',

  // ── Canada ─────────────────────────────────────────────────────────────────
  'toronto':             'Toronto',
  'vancouver':           'Vancouver',
  'montreal':            'Montreal',
  'calgary':             'Calgary',

  // ── UK ─────────────────────────────────────────────────────────────────────
  'london':              'London',
  'manchester':          'Manchester',
  'birmingham':          'Birmingham',
  'edinburgh':           'Edinburgh',

  // ── Germany ────────────────────────────────────────────────────────────────
  'berlin':              'Berlin',
  'munich':              'Munich',
  'munchen':             'Munich',
  'münchen':             'Munich',
  'frankfurt':           'Frankfurt',
  'hamburg':             'Hamburg',

  // ── Singapore ──────────────────────────────────────────────────────────────
  'singapore':           'Singapore',
  'sg':                  'Singapore',

  // ── Malaysia ───────────────────────────────────────────────────────────────
  'kuala lumpur':        'Kuala Lumpur',
  'kl':                  'Kuala Lumpur',
  'kualalumpur':         'Kuala Lumpur',
  'penang':              'Penang',

  // ── Bahrain ────────────────────────────────────────────────────────────────
  'bahrain':             'Bahrain',
  'manama':              'Bahrain',
};

/**
 * Normalize a single location string to its canonical form.
 * e.g. 'bangalore' → 'Bengaluru', 'culkata' → 'Kolkata'
 * Unknown cities are returned with first-letter capitalization.
 */
const normalizeLocation = (loc) => {
  if (!loc || typeof loc !== 'string') return loc;
  const trimmed = loc.trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase();
  return LOCATION_MAP[key] || toTitleCase(trimmed);
};

/**
 * Normalize an array of locations.
 */
const normalizeLocations = (locs) => {
  if (!Array.isArray(locs)) return locs;
  return locs.map(normalizeLocation);
};

/**
 * Title-case fallback for unknown city names.
 * e.g. 'new taipei city' → 'New Taipei City'
 */
const toTitleCase = (str) =>
  str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

module.exports = { normalizeLocation, normalizeLocations, LOCATION_MAP };