// navigation.js - Multi-section SPA navigation for MediFind
class NavigationManager {
  constructor() {
    this.sections = ['search', 'favorites', 'about', 'settings'];
    this.navLinks = Array.from(document.querySelectorAll('.nav-link'));
    this.init();
  }
  init() {
    // Handle nav link clicks
    this.navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const section = link.dataset.section;
        this.navigateToSection(section);
      });
    });
    // Handle browser navigation
    window.addEventListener('popstate', e => {
      const section = (e.state && e.state.section) || window.location.hash.replace('#', '') || 'search';
      this.showSection(section);
    });
    // Initial load
    const initialSection = window.location.hash.replace('#', '') || 'search';
    this.navigateToSection(initialSection);
  }
  navigateToSection(sectionId) {
    if (!this.sections.includes(sectionId)) sectionId = 'search';
    window.history.pushState({ section: sectionId }, '', `#${sectionId}`);
    this.showSection(sectionId);
  }
  showSection(sectionId) {
    // Hide all sections
    this.sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    // Show target section
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
    // Update nav highlighting
    this.navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
    // Section-specific actions
    this.onSectionChange(sectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  updateNavigationState(sectionId) {
    this.navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === sectionId);
    });
  }
  onSectionChange(sectionId) {
    switch (sectionId) {
      case 'search':
        const input = document.getElementById('searchInput');
        if (input) input.focus();
        break;
      case 'favorites':
        if (window.app && window.app.renderFavorites) window.app.renderFavorites();
        break;
      case 'settings':
        if (window.app && window.app.loadSettingsForm) window.app.loadSettingsForm();
        break;
      case 'about':
        // No action needed
        break;
    }
  }
}
window.NavigationManager = NavigationManager;
document.addEventListener('DOMContentLoaded', () => {
  new NavigationManager();
});
