// Client-only OpenFDA API client with small in-memory cache and graceful error handling

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();
const CACHE_STORAGE_KEY = 'medifind_api_cache_v1';

function _loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY) || sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      for (const k in obj) {
        cache.set(k, obj[k]);
      }
    }
  } catch (e) { console.warn('cache load error', e); }
}
function _persistCache() {
  try {
    const obj = {};
    for (const [k,v] of cache.entries()) obj[k]=v;
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) { console.warn('cache persist error', e); }
}
_loadCache();

function _cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.v;
}
function _cacheSet(key, value) {
  cache.set(key, { t: Date.now(), v: value });
  _persistCache();
}

function _handleResponseError(res) {
  if (res.status === 429) throw new Error('Rate limit exceeded (OpenFDA). Please try again later.');
  if (res.status === 404) throw new Error('No results found.');
  throw new Error(`OpenFDA request failed (${res.status})`);
}

window.searchDrugs = async function(q) {
  if (!q || !q.trim()) throw new Error('Please enter a medication name.');
  const key = q.trim().toLowerCase();
  const cached = _cacheGet(key);
  if (cached) return cached;

  // Try label endpoint first (contains human-readable sections)
  const encoded = encodeURIComponent(`openfda.brand_name:"${q}" OR openfda.generic_name:"${q}"`);
  const labelUrl = `https://api.fda.gov/drug/label.json?search=${encoded}&limit=10`;
  let labelData = null, drugsfdaData = null, enforcementData = null;

  try {
    const r = await fetch(labelUrl);
    if (!r.ok) _handleResponseError(r);
    labelData = await r.json();
  } catch (err) {
    console.warn('label fetch error', err.message);
  }

  try {
    const dfUrl = `https://api.fda.gov/drug/drugsfda.json?search=${encoded}&limit=5`;
    const r2 = await fetch(dfUrl);
    if (r2.ok) drugsfdaData = await r2.json();
    else console.warn('drugsfda status', r2.status);
  } catch (err) {
    console.warn('drugsfda fetch error', err.message);
  }

  try {
    const encEnf = encodeURIComponent(`product_description:"${q}"`);
    const enfUrl = `https://api.fda.gov/drug/enforcement.json?search=${encEnf}&limit=10`;
    const r3 = await fetch(enfUrl);
    if (r3.ok) enforcementData = await r3.json();
  } catch (err) {
    console.warn('enforcement fetch error', err.message);
  }

  const results = [];

  if (labelData && Array.isArray(labelData.results) && labelData.results.length) {
    for (const doc of labelData.results) {
      const openfda = doc.openfda || {};
      const id = doc.id || (openfda.application_number ? openfda.application_number : (openfda.product_ndc || JSON.stringify(openfda)));
      const brand = (openfda.brand_name && openfda.brand_name[0]) || (doc.brand_name && doc.brand_name[0]) || openfda.manufacturer_name || 'Unknown';
      const generic = (openfda.generic_name && openfda.generic_name[0]) || 'N/A';

      results.push({
        id,
        brand_name: brand,
        generic_name: generic,
        indications: doc.indications_and_usage ? doc.indications_and_usage.join('\n') : (doc.purpose ? doc.purpose.join('\n') : 'N/A'),
        warnings: doc.warnings ? doc.warnings.join('\n') : (doc.boxed_warning ? doc.boxed_warning.join('\n') : 'N/A'),
        side_effects: doc.adverse_reactions ? doc.adverse_reactions.join('\n') : 'N/A',
        dosage: doc.dosage_and_administration ? doc.dosage_and_administration.join('\n') : 'N/A',
        approvals: [],
        recalls: [],
        raw: doc
      });
    }
  } else if (drugsfdaData && Array.isArray(drugsfdaData.results) && drugsfdaData.results.length) {
    for (const doc of drugsfdaData.results) {
      const id = doc.application_number || doc.sponsor_name || JSON.stringify(doc);
      const prod = (doc.products && doc.products[0]) || {};
      const brand = prod.brand_name || prod.product_number || 'Unknown';
      results.push({
        id,
        brand_name: brand,
        generic_name: prod.generic_name || 'N/A',
        indications: prod.indication || 'N/A',
        warnings: 'N/A',
        side_effects: 'N/A',
        dosage: prod.dosage_form || 'N/A',
        approvals: doc.approval_history || [],
        recalls: [],
        raw: doc
      });
    }
  }

  if (drugsfdaData && Array.isArray(drugsfdaData.results)) {
    for (const d of drugsfdaData.results) {
      const prod = (d.products && d.products[0]) || {};
      const brand = prod.brand_name || prod.product_number || '';
      const match = results.find(r => (r.brand_name && r.brand_name.toLowerCase() === brand.toLowerCase()) || (r.generic_name && r.generic_name.toLowerCase() === (prod.generic_name || '').toLowerCase()));
      const approvalSummary = {
        application_number: d.application_number,
        sponsor_name: d.sponsor_name,
        products: d.products || []
      };
      if (match) match.approvals.push(approvalSummary);
      else {
        results.push({
          id: d.application_number,
          brand_name: brand || 'Unknown',
          generic_name: prod.generic_name || 'N/A',
          indications: 'N/A',
          warnings: 'N/A',
          side_effects: 'N/A',
          dosage: prod.dosage_form || 'N/A',
          approvals: [approvalSummary],
          recalls: [],
          raw: d
        });
      }
    }
  }

  if (enforcementData && Array.isArray(enforcementData.results)) {
    for (const rec of enforcementData.results) {
      const desc = (rec.product_description || rec.product_type || '').toLowerCase();
      for (const r of results) {
        if (desc.includes(q.toLowerCase()) || (r.brand_name && desc.includes(r.brand_name.toLowerCase())) ) {
          r.recalls.push({
            recall_number: rec.recall_number,
            reason_for_recall: rec.reason_for_recall,
            status: rec.status,
            recall_initiation_date: rec.recall_initiation_date
          });
        }
      }
    }
  }

  if (!results.length) {
    const msg = 'No medication results found for that name. Try different spelling or a brand/generic name.';
    throw new Error(msg);
  }

  _cacheSet(key, results);
  return results;
};

// Extract unique manufacturers from results
window.extractManufacturers = function(results) {
  const set = new Set();
  for (const d of results) {
    if (d.raw && d.raw.openfda && Array.isArray(d.raw.openfda.manufacturer_name)) {
      d.raw.openfda.manufacturer_name.forEach(m => set.add(m));
    } else if (d.raw && d.raw.openfda && typeof d.raw.openfda.manufacturer_name === 'string') {
      set.add(d.raw.openfda.manufacturer_name);
    }
  }
  return Array.from(set).sort();
};

// Determine if drug is prescription or OTC
window.getDrugTypeTag = function(drug) {
  if (drug.raw && drug.raw.openfda) {
    const rx = drug.raw.openfda.is_original_packager ? 'Prescription' : null;
    const otc = drug.raw.openfda.product_type && drug.raw.openfda.product_type.includes('OTC') ? 'OTC' : null;
    if (rx) return 'Prescription';
    if (otc) return 'OTC';
  }
  return null;
};