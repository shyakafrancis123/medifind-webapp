/**
 * ReadingListManager - Manages persistent storage of reading lists using LocalStorage
 * Handles three reading lists: Want to Read, Currently Reading, and Finished
 */
class ReadingListManager {
  constructor() {
    // Initialize three empty arrays for reading lists
    this.wantToRead = [];
    this.currentlyReading = [];
    this.finished = [];
    
    // Load existing data from LocalStorage
    this.loadFromStorage();
  }

  /**
   * Load reading lists from LocalStorage
   * Retrieves 'bookscout_reading_lists' and parses JSON
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('bookscout_reading_lists');
      if (stored) {
        const data = JSON.parse(stored);
        this.wantToRead = data.wantToRead || [];
        this.currentlyReading = data.currentlyReading || [];
        this.finished = data.finished || [];
      }
    } catch (error) {
        if (window && window.logger && window.logger.error) window.logger.error('Error loading from LocalStorage:', error);
      // Initialize with empty arrays if parsing fails
      this.wantToRead = [];
      this.currentlyReading = [];
      this.finished = [];
    }
  }

  /**
   * Save reading lists to LocalStorage
   * Stringifies lists object and saves with key 'bookscout_reading_lists'
   */
  saveToStorage() {
    try {
      const data = {
        wantToRead: this.wantToRead,
        currentlyReading: this.currentlyReading,
        finished: this.finished
      };
      localStorage.setItem('bookscout_reading_lists', JSON.stringify(data));
    } catch (error) {
      if (window && window.logger && window.logger.error) window.logger.error('Error saving to LocalStorage:', error);
      // Handle QuotaExceededError
      if (error && error.name === 'QuotaExceededError') {
        if (window && window.reportUserError) window.reportUserError('Unable to save data — your browser storage may be full. Please export or clear some items and try again.', error);
        throw new Error('Storage limit reached. Please export and clear some lists.');
      }
    }
  }

  /**
   * Add a book to a reading list
   * Removes book from other lists first (one list per book rule)
    if (window && window.logger && window.logger.error) window.logger.error('storage read error', e);
   * @param {object} book - Book object with key, title, author_name, etc.
   * @returns {boolean} Success status
   */
  addToList(listName, book) {
    try {
      // Validate list name
      if (!['wantToRead', 'currentlyReading', 'finished'].includes(listName)) {
    if (window && window.logger && window.logger.error) window.logger.error('storage write error', e);
    if (e && e.name === 'QuotaExceededError' && window && window.reportUserError) {
      window.reportUserError('Unable to save favorites — storage may be full. Please export and clear some items.');
    }
        return false;
      }

      // Remove from all lists first
      this.removeFromAllLists(book.key);

      // Add book with timestamp
      const bookWithTimestamp = {
        ...book,
        addedDate: new Date().toISOString()
      };

      // Add to specified list
      this[listName].push(bookWithTimestamp);

      // Save to LocalStorage
      this.saveToStorage();

      return true;
    } catch (error) {
      console.error('Error adding book to list:', error);
      return false;
    }
  }

  /**
   * Remove a book from a specific reading list
   * @param {string} listName - 'wantToRead', 'currentlyReading', or 'finished'
   * @param {string} bookKey - Unique book key (e.g., '/works/OL27448W')
   * @returns {boolean} Success status
   */
  removeFromList(listName, bookKey) {
    try {
      // Validate list name
      if (!['wantToRead', 'currentlyReading', 'finished'].includes(listName)) {
        console.error('Invalid list name:', listName);
        return false;
      }

      // Find and remove book by key
      const list = this[listName];
      const index = list.findIndex(book => book.key === bookKey);

      if (index !== -1) {
        list.splice(index, 1);
        this.saveToStorage();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error removing book from list:', error);
      return false;
    }
  }

  /**
   * Remove a book from all reading lists
   * @param {string} bookKey - Unique book key
   */
  removeFromAllLists(bookKey) {
    this.removeFromList('wantToRead', bookKey);
    this.removeFromList('currentlyReading', bookKey);
    this.removeFromList('finished', bookKey);
  }

  /**
   * Get a specific reading list
   * @param {string} listName - 'wantToRead', 'currentlyReading', or 'finished'
   * @returns {Array} Array of books in the list
   */
  getList(listName) {
    if (!['wantToRead', 'currentlyReading', 'finished'].includes(listName)) {
      console.error('Invalid list name:', listName);
      return [];
    }
    return this[listName];
  }

  /**
   * Check if a book is in any reading list
   * @param {string} bookKey - Unique book key
   * @returns {string|null} List name if found, null otherwise
   */
  isInList(bookKey) {
    if (this.wantToRead.some(book => book.key === bookKey)) {
      return 'wantToRead';
    }
    if (this.currentlyReading.some(book => book.key === bookKey)) {
      return 'currentlyReading';
    }
    if (this.finished.some(book => book.key === bookKey)) {
      return 'finished';
    }
    return null;
  }

  /**
   * Get statistics for all reading lists
   * @returns {object} Object with counts for each list and total
   */
  getStatistics() {
    return {
      wantToRead: this.wantToRead.length,
      currentlyReading: this.currentlyReading.length,
      finished: this.finished.length,
      total: this.wantToRead.length + this.currentlyReading.length + this.finished.length
    };
  }

  /**
   * Export reading lists as JSON file
   * Creates downloadable JSON file with filename bookscout_reading_lists_YYYY-MM-DD.json
   */
  exportAsJSON() {
    try {
      const data = {
        wantToRead: this.wantToRead,
        currentlyReading: this.currentlyReading,
        finished: this.finished,
        exportDate: new Date().toISOString()
      };

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookscout_reading_lists_${this.getDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting as JSON:', error);
    }
  }

  /**
   * Export reading lists as CSV file
   * Creates downloadable CSV file with filename bookscout_reading_lists_YYYY-MM-DD.csv
   */
  exportAsCSV() {
    try {
      // CSV headers
      let csv = 'List,Title,Author,Year,Added Date\n';

      // Helper function to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Helper function to add books from a list
      const addBooksToCSV = (listName, books) => {
        books.forEach(book => {
          const author = Array.isArray(book.author_name) 
            ? book.author_name.join('; ') 
            : (book.author_name || '');
          const year = book.first_publish_year || '';
          const addedDate = book.addedDate || '';

          csv += `${escapeCSV(listName)},${escapeCSV(book.title)},${escapeCSV(author)},${escapeCSV(year)},${escapeCSV(addedDate)}\n`;
        });
      };

      // Add books from all lists
      addBooksToCSV('Want to Read', this.wantToRead);
      addBooksToCSV('Currently Reading', this.currentlyReading);
      addBooksToCSV('Finished', this.finished);

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `bookscout_reading_lists_${this.getDateString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting as CSV:', error);
    }
  }

  /**
   * Get current date string in YYYY-MM-DD format
   * @returns {string} Date string
   */
  getDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Simple localStorage favorites manager for client-only app

const STORAGE_KEY = 'medifind_favorites_v1';

function _read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('storage read error', e);
    return [];
  }
}

function _write(arr) {
  let quotaError = false;
  let errorDetails = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    quotaError = quotaError || (e && e.name === 'QuotaExceededError');
    errorDetails = errorDetails || e;
    console.error('localStorage write error', e);
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    quotaError = quotaError || (e && e.name === 'QuotaExceededError');
    errorDetails = errorDetails || e;
    console.error('sessionStorage write error', e);
  }
  if (quotaError && window && window.reportUserError) {
    window.reportUserError('Unable to save favorites — storage may be full. Please export and clear some items.', errorDetails);
  }
}

window.getFavorites = function() {
  return _read();
};
window.addFavorite = function(item) {
  const list = _read();
  const exists = list.find(x => x.id === item.id);
  if (!exists) {
    list.unshift(item);
    _write(list);
  }
};
window.removeFavorite = function(id) {
  const list = _read().filter(x => x.id !== id);
  _write(list);
};
window.isFavorite = function(id) {
  return _read().some(x => x.id === id);
};

// Settings persistence for MediFind
const SETTINGS_KEY = 'medifind_settings_v2';
const DEFAULTS = {
  darkMode: false,
  sortOrder: 'brand_asc',
  autoSearch: true,
  showRecalls: true,
  fontSize: 'normal'
};
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch (e) { return { ...DEFAULTS }; }
}
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
window.getAppSettings = loadSettings;
window.saveAppSettings = saveSettings;