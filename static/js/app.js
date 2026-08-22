console.log('SteganoVault app loading...');
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM Ready');
});

// Theme Switcher
var themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('change', function() {
        document.documentElement.setAttribute('data-theme', this.value);
    });
}
