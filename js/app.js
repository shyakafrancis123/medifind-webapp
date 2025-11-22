// Main UI wiring for client-only MediFind
// No imports; use global functions

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const searchInput = $('#searchInput');
const searchBtn = $('#searchBtn');
// page-level loading spinner removed; we use the button spinner instead
const errorContainer = $('#errorContainer');
const resultsContainer = $('#resultsContainer');
const sortSelect = $('#sortSelect');
const filterRecalls = $('#filterRecalls');
const filterWarnings = $('#filterWarnings');
const filterInput = $('#filterInput');
const favoritesList = $('#favoritesList');
const feedback = $('#feedback');

let currentResults = [];
let displayedResults = [];

// Remove legacy modal logic for About/Settings
// Modal elements for drug details only
let modal = null;
function ensureModal() {
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.innerHTML = `<div class="modal-content"><button class="modal-close" aria-label="Close details">&times;</button><div class="modal-body"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
  }
}
function showModal(html) {
  ensureModal();
  modal.querySelector('.modal-body').innerHTML = html;
  modal.classList.remove('hidden');
}
function hideModal() {
  if (modal) modal.classList.add('hidden');
}

function showLoading(on = true) {
  // disable the search button while loading and show inline spinner (keep button text stable)
  if (searchBtn) {
    const spinner = searchBtn.querySelector('.btn-spinner');
    if (on) {
      searchBtn.disabled = true;
      if (spinner) spinner.classList.remove('hidden');
    } else {
      searchBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  }
}
function showError(msg) {
  errorContainer.textContent = msg;
  errorContainer.classList.remove('hidden');
}
function clearError() {
  errorContainer.textContent = '';
  errorContainer.classList.add('hidden');
  hideModal();
}
function setFeedback(msg) {
  feedback.textContent = msg;
  // No auto-hide; message stays until next update
}

// Settings and state
const appSettings = window.getAppSettings();
let debounceTimer = null;
let manufacturerSelect = $('#manufacturerSelect');
let filterSideEffects = $('#filterSideEffects');
let filterPrescription = $('#filterPrescription');
let darkModeToggle = $('#darkModeToggle');
let helpBtn = $('#helpBtn');
let settingsBtn = $('#settingsBtn');

function applyDarkMode() {
  if (appSettings.darkMode) {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    darkModeToggle.checked = false;
  }
}
applyDarkMode();
darkModeToggle.addEventListener('change', () => {
  appSettings.darkMode = darkModeToggle.checked;
  window.saveAppSettings(appSettings);
  applyDarkMode();
});

// Help/About modal
document.addEventListener('DOMContentLoaded', function() {
  let helpBtn = document.getElementById('helpBtn');
  let settingsBtn = document.getElementById('settingsBtn');
  if (helpBtn) {
    helpBtn.removeEventListener('click', function() {
      window.showAppModal('helpModal', `
        <h2>About MediFind</h2>
        <p>This app helps you find medication and drug information using OpenFDA data.</p>
        <ul>
          <li>Search by brand or generic name</li>
          <li>View indications, warnings, side effects, dosage, recalls, and approvals</li>
          <li>Filter and sort results, highlight keywords</li>
          <li>Dark mode, settings, and favorites</li>
          <li>Data source: <a href='https://open.fda.gov/' target='_blank'>OpenFDA</a></li>
          <li>Limitations: Data may be incomplete or outdated</li>
          <li>Developer: shyakafrancis123</li>
        </ul>
      `);
    });
  }
  if (settingsBtn) {
    settingsBtn.removeEventListener('click', function() {
      window.showAppModal('settingsModal', `
        <h2>Settings</h2>
        <form id='settingsForm'>
          <label><input type='checkbox' name='darkMode' ${appSettings.darkMode ? 'checked' : ''}> Dark Mode</label><br>
          <label>Default Sort Order:
            <select name='sortOrder'>
              <option value='brand_asc' ${appSettings.sortOrder==='brand_asc'?'selected':''}>Brand Name (A-Z)</option>
              <option value='brand_desc' ${appSettings.sortOrder==='brand_desc'?'selected':''}>Brand Name (Z-A)</option>
              <option value='approval_desc' ${appSettings.sortOrder==='approval_desc'?'selected':''}>Latest Approval</option>
              <option value='approval_asc' ${appSettings.sortOrder==='approval_asc'?'selected':''}>Earliest Approval</option>
            </select>
          </label><br>
          <label><input type='checkbox' name='autoSearch' ${appSettings.autoSearch ? 'checked' : ''}> Auto-search on Enter</label><br>
          <label><input type='checkbox' name='showRecalls' ${appSettings.showRecalls ? 'checked' : ''}> Show Recall Info</label><br>
          <label>Font Size:
            <select name='fontSize'>
              <option value='normal' ${appSettings.fontSize==='normal'?'selected':''}>Normal</option>
              <option value='large' ${appSettings.fontSize==='large'?'selected':''}>Large</option>
            </select>
          </label>
          <br><button type='submit' class='btn btn-primary'>Save</button>
        </form>
      `);
      document.getElementById('settingsForm').onsubmit = function(e) {
        e.preventDefault();
        const f = e.target;
        appSettings.darkMode = f.darkMode.checked;
        appSettings.sortOrder = f.sortOrder.value;
        appSettings.autoSearch = f.autoSearch.checked;
        appSettings.showRecalls = f.showRecalls.checked;
        appSettings.fontSize = f.fontSize.value;
        window.saveAppSettings(appSettings);
        applyDarkMode();
        setFontSize();
        document.getElementById('settingsModal').classList.add('hidden');
        applyFiltersAndSort();
      };
    });
  }
});

function setFontSize() {
  document.body.style.fontSize = appSettings.fontSize === 'large' ? '1.18em' : '';
}
setFontSize();

function highlight(term, text) {
  if (!term || !text) return escapeHtml(text);
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapeHtml(text).replace(re, '<span class="highlight">$1</span>');
}

function renderTags(drug) {
  const tags = [];
  if (drug.warnings && drug.warnings !== 'N/A') tags.push('<span class="tag">Has Warnings</span>');
  if (drug.recalls && drug.recalls.length) tags.push('<span class="tag">Has Recalls</span>');
  if (drug.side_effects && drug.side_effects !== 'N/A') tags.push('<span class="tag">Has Side Effects</span>');
  const typeTag = window.getDrugTypeTag(drug);
  if (typeTag) tags.push(`<span class="tag">${typeTag}</span>`);
  return tags.length ? `<div class="card-tags">${tags.join('')}</div>` : '';
}

function renderCard(drug, searchTerm) {
  const div = document.createElement('div');
  div.className = 'card pretty';
  const title = highlight(searchTerm, `${drug.brand_name}${drug.generic_name && drug.generic_name !== 'N/A' ? ' — ' + drug.generic_name : ''}`);
  const manufacturer = (drug.raw && drug.raw.openfda && drug.raw.openfda.manufacturer_name) ? drug.raw.openfda.manufacturer_name.join(', ') : 'Information not available';
  const approvalDate = (drug.approvals && drug.approvals.length && drug.approvals[0].products && drug.approvals[0].products[0] && drug.approvals[0].products[0].submission && drug.approvals[0].products[0].submission.date) ? drug.approvals[0].products[0].submission.date : 'Information not available';
  div.innerHTML = `
    <h3>${title}</h3>
    <div class="meta small">Manufacturer: ${escapeHtml(manufacturer)}</div>
    <div class="meta small">Approval Date: ${escapeHtml(approvalDate)}</div>
    ${renderTags(drug)}
    <details>
      <summary>Indications</summary>
      <div>${highlight(searchTerm, drug.indications || 'Information not available')}</div>
    </details>
    <details>
      <summary>Dosage</summary>
      <div>${highlight(searchTerm, drug.dosage || 'Information not available')}</div>
    </details>
    <details>
      <summary>Side Effects</summary>
      <div>${highlight(searchTerm, drug.side_effects || 'Information not available')}</div>
    </details>
    <details>
      <summary>Warnings</summary>
      <div>${highlight(searchTerm, drug.warnings || 'Information not available')}</div>
    </details>
    <details>
      <summary>Recalls</summary>
      <div>${drug.recalls && drug.recalls.length ? drug.recalls.map(r => `<div><strong>${escapeHtml(r.recall_number)}</strong>: ${escapeHtml(r.reason_for_recall)} (${escapeHtml(r.status)})</div>`).join('') : 'None'}</div>
      <div class="chart-container" id="recallChart-${drug.id}"></div>
    </details>
    <div class="actions">
      <button class="btn primary btn-fav">${window.isFavorite(drug.id) ? 'Saved' : 'Save'}</button>
      <button class="btn btn-view">View</button>
    </div>
  `;
  // Chart.js lazy load for recalls
  const recallDetails = div.querySelector('details:last-of-type');
  recallDetails.addEventListener('toggle', function() {
    if (recallDetails.open && drug.recalls && drug.recalls.length) {
      renderRecallChart(drug);
    }
  });
  // button handlers
  const favBtn = div.querySelector('.btn-fav');
  favBtn.addEventListener('click', () => {
    if (window.isFavorite(drug.id)) {
      window.removeFavorite(drug.id);
      favBtn.textContent = 'Save';
      setFeedback('Removed from favorites');
    } else {
      window.addFavorite({ id: drug.id, brand_name: drug.brand_name, generic_name: drug.generic_name });
      favBtn.textContent = 'Saved';
      setFeedback('Saved to favorites');
    }
    renderFavorites();
  });
  const viewBtn = div.querySelector('.btn-view');
  viewBtn.addEventListener('click', () => {
    showModal(`
      <div class="modal-section">
        <h2 style="color:#b91c1c; margin-bottom:8px;">${escapeHtml(drug.brand_name)}${drug.generic_name && drug.generic_name !== 'N/A' ? ' — ' + escapeHtml(drug.generic_name) : ''}</h2>
        <div class="meta small">Manufacturer: ${escapeHtml(manufacturer)}</div>
        <div class="meta small">Approval Date: ${escapeHtml(approvalDate)}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Indications</div>
        ${highlight(searchTerm, drug.indications || 'Information not available')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Warnings</div>
        ${highlight(searchTerm, drug.warnings || 'Information not available')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Side Effects</div>
        ${highlight(searchTerm, drug.side_effects || 'Information not available')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Dosage</div>
        ${highlight(searchTerm, drug.dosage || 'Information not available')}
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Approvals</div>
        <div>${drug.approvals && drug.approvals.length ? drug.approvals.map(a => escapeHtml(String(a.application_number || a.sponsor_name))).join(', ') : 'Information not available'}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Recalls</div>
        <div>${drug.recalls && drug.recalls.length ? drug.recalls.map(r => `<div><strong>${escapeHtml(r.recall_number)}</strong>: ${escapeHtml(r.reason_for_recall)} (${escapeHtml(r.status)})</div>`).join('') : 'None'}</div>
        <div class="chart-container" id="recallChartModal-${drug.id}"></div>
      </div>
    `);
    if (drug.recalls && drug.recalls.length) {
      renderRecallChart(drug, true);
    }
  });
  return div;
}

function renderRecallChart(drug, inModal = false) {
  const recalls = drug.recalls || [];
  const years = recalls.map(r => r.recall_initiation_date ? r.recall_initiation_date.slice(0,4) : 'Unknown');
  const freq = {};
  years.forEach(y => { freq[y] = (freq[y]||0)+1; });
  const labels = Object.keys(freq);
  const data = Object.values(freq);
  const chartId = inModal ? `recallChartModal-${drug.id}` : `recallChart-${drug.id}`;
  const ctx = document.getElementById(chartId);
  if (!ctx) return;
  ctx.innerHTML = '<canvas></canvas>';
  const canvas = ctx.querySelector('canvas');
  if (window.Chart) {
    new window.Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Recalls per Year', data, backgroundColor: '#2563eb' }] },
      options: { plugins: { legend: { display: false } } }
    });
  }
}

function renderResults(list, searchTerm) {
  resultsContainer.innerHTML = '';
  if (!list.length) {
    resultsContainer.innerHTML = `<div class="small">No medication matched your search. Try another name.</div>`;
    setFeedback('Found 0 results');
    return;
  }
  for (const d of list) {
    resultsContainer.appendChild(renderCard(d, searchTerm));
  }
  setFeedback(`Found ${list.length} result${list.length === 1 ? '' : 's'}`);
}

function renderFavorites() {
  const favs = window.getFavorites();
  favoritesList.innerHTML = '';
  if (!favs.length) {
    favoritesList.innerHTML = '<li class="small">No favorites yet</li>';
    return;
  }
  for (const f of favs) {
  const li = document.createElement('li');
  // Render favorites as compact list rows (not card tiles)
  li.className = 'fav-item';
    li.innerHTML = `
      <div class="fav-info">
        <h3>${escapeHtml(f.brand_name)}${f.generic_name ? ' — ' + escapeHtml(f.generic_name) : ''}</h3>
        <div class="meta small">Saved favorite</div>
      </div>
      <div class="fav-actions">
        <button class="btn btn-view">View</button>
        <button class="btn btn-remove">Remove</button>
      </div>
    `;

    // Remove handler
    li.querySelector('.btn-remove').addEventListener('click', () => {
      window.removeFavorite(f.id);
      renderFavorites();
      setFeedback('Removed from favorites');
    });

    // View handler: show a simple details modal for the saved favorite
    li.querySelector('.btn-view').addEventListener('click', () => {
      // Try to find the full drug record in the current search results
      const drug = currentResults.find(d => d.id == f.id);
      if (drug) {
        const manufacturer = (drug.raw && drug.raw.openfda && drug.raw.openfda.manufacturer_name) ? drug.raw.openfda.manufacturer_name.join(', ') : 'Information not available';
        const approvalDate = (drug.approvals && drug.approvals.length && drug.approvals[0].products && drug.approvals[0].products[0] && drug.approvals[0].products[0].submission && drug.approvals[0].products[0].submission.date) ? drug.approvals[0].products[0].submission.date : 'Information not available';
        showModal(`
          <div class="modal-section">
            <h2 style="color:#b91c1c; margin-bottom:8px;">${escapeHtml(drug.brand_name)}${drug.generic_name && drug.generic_name !== 'N/A' ? ' — ' + escapeHtml(drug.generic_name) : ''}</h2>
            <div class="meta small">Manufacturer: ${escapeHtml(manufacturer)}</div>
            <div class="meta small">Approval Date: ${escapeHtml(approvalDate)}</div>
          </div>
          <div class="modal-section">
            <div class="modal-section-title">Indications</div>
            ${highlight('', drug.indications || 'Information not available')}
          </div>
          <div class="modal-section">
            <div class="modal-section-title">Warnings</div>
            ${highlight('', drug.warnings || 'Information not available')}
          </div>
          <div class="modal-section">
            <div class="modal-section-title">Side Effects</div>
            ${highlight('', drug.side_effects || 'Information not available')}
          </div>
          <div class="modal-section">
            <div class="modal-section-title">Dosage</div>
            ${highlight('', drug.dosage || 'Information not available')}
          </div>
          <div class="modal-section">
            <div class="modal-section-title">Recalls</div>
            <div>${drug.recalls && drug.recalls.length ? drug.recalls.map(r => `<div><strong>${escapeHtml(r.recall_number)}</strong>: ${escapeHtml(r.reason_for_recall)} (${escapeHtml(r.status)})</div>`).join('') : 'None'}</div>
            <div class="chart-container" id="recallChartModal-${drug.id}"></div>
          </div>
        `);
        if (drug.recalls && drug.recalls.length) {
          renderRecallChart(drug, true);
        }
      } else {
        // Full details not in memory. Show helpful fallback and suggest searching.
        showModal(`
          <div class="modal-section">
            <h2 style="margin-bottom:6px;">${escapeHtml(f.brand_name)}${f.generic_name ? ' — ' + escapeHtml(f.generic_name) : ''}</h2>
            <div class="modal-section-title">Details unavailable</div>
            <div>No full details for this favorite are available in the current session. Try searching for the medication to view full information.</div>
          </div>
        `);
      }
    });

    favoritesList.appendChild(li);
  }
}

function updateManufacturerDropdown(results) {
  const manufacturers = window.extractManufacturers(results);
  manufacturerSelect.innerHTML = '<option value="">All</option>' + manufacturers.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
}

function applyFiltersAndSort() {
  let list = currentResults.slice();
  const s = filterInput.value.trim().toLowerCase();
  if (s) {
    list = list.filter(d => (
      (d.brand_name && d.brand_name.toLowerCase().includes(s)) ||
      (d.generic_name && d.generic_name.toLowerCase().includes(s)) ||
      (d.indications && d.indications.toLowerCase().includes(s))
    ));
  }
  if (filterRecalls.checked) {
    list = list.filter(d => d.recalls && d.recalls.length > 0);
  }
  if (filterWarnings.checked) {
    list = list.filter(d => d.warnings && d.warnings !== 'N/A');
  }
  if (filterSideEffects && filterSideEffects.checked) {
    list = list.filter(d => d.side_effects && d.side_effects !== 'N/A');
  }
  if (manufacturerSelect && manufacturerSelect.value) {
    list = list.filter(d => d.raw && d.raw.openfda && Array.isArray(d.raw.openfda.manufacturer_name) && d.raw.openfda.manufacturer_name.includes(manufacturerSelect.value));
  }
  if (filterPrescription && filterPrescription.checked) {
    list = list.filter(d => window.getDrugTypeTag(d) === 'Prescription');
  }
  // sort
  const sort = appSettings.sortOrder || sortSelect.value;
  if (sort === 'approval_desc' || sort === 'approval_asc') {
    list.sort((a,b) => {
      const getLatestApprovalDate = r => {
        if (!r.approvals || !r.approvals.length) return 0;
        const dates = [];
        for (const ap of r.approvals) {
          if (ap.products && ap.products.length) {
            for (const p of ap.products) {
              if (p.submission && p.submission.date) dates.push(Number(p.submission.date) || 0);
              if (p.submission && p.submission.submission_date) dates.push(Number(p.submission.submission_date) || 0);
            }
          }
        }
        return Math.max(...dates, 0);
      };
      const da = getLatestApprovalDate(a);
      const db = getLatestApprovalDate(b);
      return sort === 'approval_desc' ? (db - da) : (da - db);
    });
  } else if (sort === 'brand_asc' || sort === 'brand_desc') {
    list.sort((a,b) => {
      const A = (a.brand_name || '').toLowerCase();
      const B = (b.brand_name || '').toLowerCase();
      if (A < B) return sort === 'brand_asc' ? -1 : 1;
      if (A > B) return sort === 'brand_asc' ? 1 : -1;
      return 0;
    });
  }
  displayedResults = list;
  renderResults(displayedResults, filterInput.value.trim());
}

// Debounce for live search
function debounceSearch() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (appSettings.autoSearch) doSearch();
  }, 300);
}

// Add overlay spinner element to the DOM
const searchOverlay = document.createElement('div');
searchOverlay.className = 'search-overlay';
searchOverlay.innerHTML = '<div class="spinner"></div>';
document.body.appendChild(searchOverlay);
function toggleSearchOverlay(show) {
  if (show) {
    searchOverlay.classList.add('active');
  } else {
    searchOverlay.classList.remove('active');
  }
}

async function doSearch() {
  clearError();
  const term = searchInput.value.trim();
  if (!term) {
    showError('Please enter a medication name to search.');
    setFeedback(currentResults.length ? `Found ${currentResults.length} result${currentResults.length === 1 ? '' : 's'}` : 'Found 0 results');
    return;
  }
  showLoading(true);
  toggleSearchOverlay(true);
  try {
    const results = await window.searchDrugs(term);
    currentResults = results;
    updateManufacturerDropdown(results);
    applyFiltersAndSort();
    setFeedback(`Found ${results.length} result${results.length === 1 ? '' : 's'}`);
  } catch (err) {
    console.error('search error', err);
    showError(err.message || 'Search failed. Try again.');
    setFeedback('Found 0 results');
  } finally {
    showLoading(false);
    toggleSearchOverlay(false);
  }
}

// small helpers
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// wire events
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });
searchInput.addEventListener('input', debounceSearch);
sortSelect.addEventListener('change', e => {
  appSettings.sortOrder = sortSelect.value;
  window.saveAppSettings(appSettings);
  applyFiltersAndSort();
});
filterRecalls.addEventListener('change', applyFiltersAndSort);
filterWarnings.addEventListener('change', applyFiltersAndSort);
filterInput.addEventListener('input', applyFiltersAndSort);
if (filterSideEffects) filterSideEffects.addEventListener('change', applyFiltersAndSort);
if (manufacturerSelect) manufacturerSelect.addEventListener('change', applyFiltersAndSort);
if (filterPrescription) filterPrescription.addEventListener('change', applyFiltersAndSort);

// initial render
renderFavorites();
clearError();
setFontSize();

// ----- Settings, import/export, and utility functions for navigation -----
function loadSettingsForm() {
  const s = window.getAppSettings ? window.getAppSettings() : { sortOrder: 'brand_asc', autoSearch: true, fontSize: 'normal', showRecalls: true, darkMode: false };
  const fontSizeEl = document.getElementById('fontSizeSelect');
  const sortEl = document.getElementById('defaultSortSelect');
  const autoEl = document.getElementById('autoSearchToggle');
  const showRecallsEl = document.getElementById('showRecallsToggle');
  const darkToggle = document.getElementById('darkModeToggle');
  if (fontSizeEl) fontSizeEl.value = s.fontSize || 'normal';
  if (sortEl) sortEl.value = s.sortOrder || 'brand_asc';
  if (autoEl) autoEl.checked = !!s.autoSearch;
  if (showRecallsEl) showRecallsEl.checked = !!s.showRecalls;
  if (darkToggle) darkToggle.checked = !!s.darkMode;
}

function saveSettingsFromForm() {
  const fontSizeEl = document.getElementById('fontSizeSelect');
  const sortEl = document.getElementById('defaultSortSelect');
  const autoEl = document.getElementById('autoSearchToggle');
  const showRecallsEl = document.getElementById('showRecallsToggle');
  const darkToggle = document.getElementById('darkModeToggle');
  const settings = window.getAppSettings ? window.getAppSettings() : {};
  settings.fontSize = fontSizeEl ? fontSizeEl.value : (settings.fontSize || 'normal');
  settings.sortOrder = sortEl ? sortEl.value : (settings.sortOrder || 'brand_asc');
  settings.autoSearch = autoEl ? !!autoEl.checked : !!settings.autoSearch;
  settings.showRecalls = showRecallsEl ? !!showRecallsEl.checked : !!settings.showRecalls;
  settings.darkMode = darkToggle ? !!darkToggle.checked : !!settings.darkMode;
  if (window.saveAppSettings) window.saveAppSettings(settings);
  // Apply immediately
  if (settings.darkMode) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
  document.body.style.fontSize = settings.fontSize === 'large' ? '1.18em' : '';
  // update appSettings object in memory
  Object.assign(appSettings, settings);
  setFeedback('Settings saved.');
}

function exportFavorites() {
  try {
    const favs = window.getFavorites ? window.getFavorites() : [];
    const json = JSON.stringify({ favorites: favs, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medifind_favorites_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback('Favorites exported');
  } catch (e) {
    console.error('export error', e);
    setFeedback('Export failed');
  }
}

function importFavoritesFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      const arr = Array.isArray(data) ? data : (Array.isArray(data.favorites) ? data.favorites : null);
      if (!arr) throw new Error('Invalid favorites format');
      // validate items have id
      const valid = arr.every(i => i && (i.id || i.brand_name));
      if (!valid) throw new Error('Favorites file missing required fields');
      // Write to localStorage using same key as storage.js
      localStorage.setItem('medifind_favorites_v1', JSON.stringify(arr));
      renderFavorites();
      setFeedback('Favorites imported');
    } catch (err) {
      console.error('import error', err);
      setFeedback('Import failed: invalid file');
    }
  };
  reader.readAsText(file);
}

function clearCache() {
  // remove favorites cache only
  localStorage.removeItem('medifind_favorites_v1');
  renderFavorites();
  setFeedback('Local favorites cleared');
}

function clearAllData() {
  localStorage.removeItem('medifind_favorites_v1');
  localStorage.removeItem('medifind_settings_v2');
  setFeedback('All app data cleared');
  // reload to apply defaults
  setTimeout(() => location.reload(), 600);
}

// Wire settings UI buttons (if present)
document.addEventListener('DOMContentLoaded', function() {
  // expose API for navigation
  window.app = window.app || {};
  window.app.renderFavorites = renderFavorites;
  window.app.loadSettingsForm = loadSettingsForm;

  const saveBtn = document.getElementById('saveSettingsBtn');
  if (saveBtn) saveBtn.addEventListener('click', function(e){ e.preventDefault(); saveSettingsFromForm(); });

  const exportBtn = document.getElementById('exportFavoritesBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportFavorites);

  const importBtn = document.getElementById('importFavoritesBtn');
  const importInput = document.getElementById('importFileInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importFavoritesFromFile(f); });
  }

  const clearCacheBtn = document.getElementById('clearCacheBtn');
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearCache);

  const clearAllBtn = document.getElementById('clearAllDataBtn');
  if (clearAllBtn) clearAllBtn.addEventListener('click', function(){ if (confirm('Clear all local app data? This cannot be undone.')) clearAllData(); });

  // ensure settings form reflects current settings
  loadSettingsForm();
});