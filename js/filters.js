/**
 * BookFilter - Client-side filtering and sorting for book results
 */

class BookFilter {
  /**
   * Initialize BookFilter with books array
   * @param {Array} books - Array of book objects to filter
   */
  constructor(books) {
    this.allBooks = books || [];
    this.filteredBooks = [...this.allBooks];
  }

  /**
   * Apply filters to the book collection
   * @param {Object} filters - Filter criteria
   * @param {number} filters.yearFrom - Minimum publication year
   * @param {number} filters.yearTo - Maximum publication year
   * @param {string} filters.pageCount - Page count range ('0-100', '100-300', '300-500', '500+')
   * @param {Array<string>} filters.subjects - Array of subjects to filter by
   * @param {string} filters.language - Language code to filter by
   * @returns {Array} Filtered books array
   */
  applyFilters(filters) {
    this.filteredBooks = this.allBooks.filter(book => {
      // Year range filter
      if (filters.yearFrom && book.first_publish_year) {
        if (book.first_publish_year < filters.yearFrom) return false;
      }
      
      if (filters.yearTo && book.first_publish_year) {
        if (book.first_publish_year > filters.yearTo) return false;
      }

      // Page count filter
      if (filters.pageCount && book.number_of_pages_median) {
        const pages = book.number_of_pages_median;
        switch (filters.pageCount) {
          case '0-100':
            if (pages > 100) return false;
            break;
          case '100-300':
            if (pages < 100 || pages > 300) return false;
            break;
          case '300-500':
            if (pages < 300 || pages > 500) return false;
            break;
          case '500+':
            if (pages < 500) return false;
            break;
        }
      }

      // Subject filter (case-insensitive, any match)
      if (filters.subjects && filters.subjects.length > 0 && book.subject) {
        const bookSubjects = book.subject.map(s => s.toLowerCase());
        const filterSubjects = filters.subjects.map(s => s.toLowerCase());
        const hasMatch = filterSubjects.some(filterSubj => 
          bookSubjects.some(bookSubj => bookSubj.includes(filterSubj))
        );
        if (!hasMatch) return false;
      }

      // Language filter
      if (filters.language && book.language) {
        const hasLanguage = book.language.includes(filters.language);
        if (!hasLanguage) return false;
      }

      return true;
    });

    return this.filteredBooks;
  }

  /**
   * Sort the filtered books
   * @param {string} sortBy - Sort criteria ('title-asc', 'title-desc', 'year-new', 'year-old', 'pages-low', 'pages-high', 'author')
   * @returns {Array} Sorted books array
   */
  sort(sortBy) {
    const sorted = [...this.filteredBooks];

    switch (sortBy) {
      case 'title-asc':
        sorted.sort((a, b) => {
          if (!a.title) return 1;
          if (!b.title) return -1;
          return a.title.localeCompare(b.title);
        });
        break;

      case 'title-desc':
        sorted.sort((a, b) => {
          if (!a.title) return 1;
          if (!b.title) return -1;
          return b.title.localeCompare(a.title);
        });
        break;

      case 'year-new':
        sorted.sort((a, b) => {
          if (!a.first_publish_year) return 1;
          if (!b.first_publish_year) return -1;
          return b.first_publish_year - a.first_publish_year;
        });
        break;

      case 'year-old':
        sorted.sort((a, b) => {
          if (!a.first_publish_year) return 1;
          if (!b.first_publish_year) return -1;
          return a.first_publish_year - b.first_publish_year;
        });
        break;

      case 'pages-low':
        sorted.sort((a, b) => {
          if (!a.number_of_pages_median) return 1;
          if (!b.number_of_pages_median) return -1;
          return a.number_of_pages_median - b.number_of_pages_median;
        });
        break;

      case 'pages-high':
        sorted.sort((a, b) => {
          if (!a.number_of_pages_median) return 1;
          if (!b.number_of_pages_median) return -1;
          return b.number_of_pages_median - a.number_of_pages_median;
        });
        break;

      case 'author':
        sorted.sort((a, b) => {
          const authorA = a.author_name && a.author_name[0] ? a.author_name[0] : '';
          const authorB = b.author_name && b.author_name[0] ? b.author_name[0] : '';
          if (!authorA) return 1;
          if (!authorB) return -1;
          return authorA.localeCompare(authorB);
        });
        break;
    }

    this.filteredBooks = sorted;
    return this.filteredBooks;
  }

  /**
   * Get unique subjects from all books
   * @returns {Array<string>} Sorted array of unique subjects
   */
  getUniqueSubjects() {
    const subjectsSet = new Set();
    
    this.allBooks.forEach(book => {
      if (book.subject && Array.isArray(book.subject)) {
        book.subject.forEach(subject => {
          if (subject) {
            subjectsSet.add(subject);
          }
        });
      }
    });

    return Array.from(subjectsSet).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Calculate statistics for filtered results
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      total: this.allBooks.length,
      filtered: this.filteredBooks.length,
      avgPages: 0,
      avgYear: 0,
      mostCommonSubject: ''
    };

    // Calculate average pages
    const booksWithPages = this.filteredBooks.filter(book => 
      book.number_of_pages_median && !isNaN(book.number_of_pages_median)
    );
    
    if (booksWithPages.length > 0) {
      const totalPages = booksWithPages.reduce((sum, book) => 
        sum + book.number_of_pages_median, 0
      );
      stats.avgPages = Math.round(totalPages / booksWithPages.length);
    }

    // Calculate average year
    const booksWithYear = this.filteredBooks.filter(book => 
      book.first_publish_year && !isNaN(book.first_publish_year)
    );
    
    if (booksWithYear.length > 0) {
      const totalYears = booksWithYear.reduce((sum, book) => 
        sum + book.first_publish_year, 0
      );
      stats.avgYear = Math.round(totalYears / booksWithYear.length);
    }

    // Find most common subject
    const subjectCounts = {};
    this.filteredBooks.forEach(book => {
      if (book.subject && Array.isArray(book.subject)) {
        book.subject.forEach(subject => {
          if (subject) {
            subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
          }
        });
      }
    });

    let maxCount = 0;
    let mostCommon = '';
    for (const [subject, count] of Object.entries(subjectCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = subject;
      }
    }
    stats.mostCommonSubject = mostCommon;

    return stats;
  }
}