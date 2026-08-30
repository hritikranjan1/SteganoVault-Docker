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

// File Preview
if (fileInput) {
    fileInput.addEventListener('change', function() {
        if (fileInput.files[0]) {
            var file = fileInput.files[0];
            if (fileName) fileName.textContent = file.name;
            if (file.type.startsWith('image/')) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var preview = document.querySelector('#previewBefore img');
                    if (preview) {
                        preview.src = e.target.result;
                        document.getElementById('previewBefore').classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    });
}

// Encode Function
var encodeBtn = document.getElementById('encodeBtnReady');
if (encodeBtn) {
    encodeBtn.addEventListener('click', function() {
        var file = fileInput.files[0];
        var message = document.getElementById('messageInput').value;
        if (!file || !message) {
            alert('Select file and enter message');
            return;
        }
        var formData = new FormData();
        formData.append('file', file);
        formData.append('message', message);
        formData.append('password', document.getElementById('passwordInput').value);
        fetch('/encode', { method: 'POST', body: formData })
            .then(function(r) { return r.blob(); })
            .then(function(blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'encoded_file';
                a.click();
                document.getElementById('output').innerHTML = '<p class="text-green-500">✅ Encoded!</p>';
            })
            .catch(function(e) { console.error(e); });
    });
}

// Decode Function
var decodeBtn = document.getElementById('decodeBtnReady');
if (decodeBtn) {
    decodeBtn.addEventListener('click', function() {
        var file = fileInput.files[0];
        if (!file) {
            alert('Select a file');
            return;
        }
        var formData = new FormData();
        formData.append('file', file);
        formData.append('password', document.getElementById('passwordInput').value);
        fetch('/decode', { method: 'POST', body: formData })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                document.getElementById('decodedOutput').textContent = data.message;
                document.getElementById('decodedOutputContainer').classList.remove('hidden');
            })
            .catch(function(e) { console.error(e); });
    });
}

// Stealth Score
var stealthScore = 0;
function updateStealthScore(points) {
    stealthScore += points;
    var el = document.getElementById('stealth-score');
    if (el) el.textContent = stealthScore;
    var badges = document.getElementById('badges');
    if (badges && stealthScore >= 10 && badges.innerHTML.indexOf('Rookie') === -1) {
        badges.innerHTML += '<span class="badge">Rookie Spy</span>';
    }
    if (badges && stealthScore >= 50 && badges.innerHTML.indexOf('Codebreaker') === -1) {
        badges.innerHTML += '<span class="badge">Codebreaker</span>';
    }
}

// Game
var gameActive = false;
var gameScore = 0;
var startBtn = document.getElementById('start-game');
var gameTarget = document.getElementById('game-target');
if (startBtn) {
    startBtn.addEventListener('click', function() {
        if (gameActive) return;
        gameActive = true;
        gameScore = 0;
        startBtn.disabled = true;
        setTimeout(function() {
            gameActive = false;
            startBtn.disabled = false;
            alert('Game over! Score: ' + gameScore);
        }, 10000);
    });
}

// Modals
var modals = document.querySelectorAll('.modal');
document.querySelectorAll('.close').forEach(function(btn) {
    btn.addEventListener('click', function() {
        modals.forEach(function(m) { m.style.display = 'none'; });
    });
});
window.addEventListener('click', function(e) {
    modals.forEach(function(m) {
        if (e.target === m) m.style.display = 'none';
    });
});

// Auth
var authBtn = document.getElementById('authBtn');
var authStatus = document.getElementById('authStatus');
if (authBtn) {
    authBtn.addEventListener('click', function() {
        if (authStatus && authStatus.textContent === 'Logout') {
            fetch('/auth/logout', { method: 'POST' }).then(function() {
                authStatus.textContent = 'Login';
            });
        } else {
            var modal = document.getElementById('authModal');
            if (modal) modal.style.display = 'block';
        }
    });
}
