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

// Drag & Drop
var dropArea = document.getElementById('drop-area');
var fileInput = document.getElementById('fileInput');
var fileName = document.getElementById('fileName');
if (dropArea && fileInput) {
    dropArea.addEventListener('click', function() { fileInput.click(); });
    dropArea.addEventListener('dragover', function(e) { e.preventDefault(); });
    dropArea.addEventListener('drop', function(e) {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            if (fileName) fileName.textContent = e.dataTransfer.files[0].name;
        }
    });
}
