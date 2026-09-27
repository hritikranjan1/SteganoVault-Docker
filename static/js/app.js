// ============================================
// SteganoVault - Complete Application JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    // EMAILJS INIT
    // ============================================
    if (typeof emailjs !== 'undefined') {
        try {
            emailjs.init("jocUFhKyehMFmQgYW");
            console.log("✅ EmailJS initialized");
        } catch (e) {
            console.warn("EmailJS init failed:", e);
        }
    }

    // ============================================
    // THEME SWITCHER
    // ============================================
    var themeToggle = document.getElementById('theme-toggle');
    var bgEls = {
        cyberpunkGrid: document.getElementById('cyberpunkGrid'),
        retroScanlines: document.getElementById('retroScanlines'),
        neonParticles: document.getElementById('neonParticles'),
        vaporwaveWaves: document.getElementById('vaporwaveWaves'),
        codeRain: document.getElementById('codeRain'),
        cosmicStars: document.getElementById('cosmicStars'),
        glitchEffect: document.getElementById('glitchEffect')
    };

    function hideAllBg() {
        Object.keys(bgEls).forEach(function (k) {
            if (bgEls[k]) bgEls[k].classList.add('hidden');
        });
    }
    hideAllBg();

    if (themeToggle) {
        themeToggle.addEventListener('change', function () {
            var theme = this.value;
            document.documentElement.setAttribute('data-theme', theme);
            hideAllBg();
            clearAllEffects();

            switch (theme) {
                case 'cyberpunk':
                    if (bgEls.cyberpunkGrid) bgEls.cyberpunkGrid.classList.remove('hidden');
                    createParticles(30, 'neon-particles', 'var(--glow-color)');
                    break;
                case 'retro-spy':
                    if (bgEls.retroScanlines) bgEls.retroScanlines.classList.remove('hidden');
                    break;
                case 'neon-noir':
                    createParticles(50, 'neon-particles', 'var(--glow-color)');
                    break;
                case 'vaporwave':
                    if (bgEls.vaporwaveWaves) bgEls.vaporwaveWaves.classList.remove('hidden');
                    break;
                case 'hacker-terminal':
                    if (bgEls.codeRain) bgEls.codeRain.classList.remove('hidden');
                    createCodeRain();
                    break;
                case 'cosmic-galaxy':
                    if (bgEls.cosmicStars) bgEls.cosmicStars.classList.remove('hidden');
                    createStars();
                    break;
                case 'glitchcore':
                    if (bgEls.glitchEffect) bgEls.glitchEffect.classList.remove('hidden');
                    break;
            }
        });
        themeToggle.dispatchEvent(new Event('change'));
    }

    function clearAllEffects() {
        document.querySelectorAll('.neon-particles, .code-rain, .cosmic-stars').forEach(function (el) {
            el.innerHTML = '';
        });
    }

    function createParticles(count, cls, color) {
        var container = document.querySelector('.' + cls);
        if (!container) return;
        for (var i = 0; i < count; i++) {
            var p = document.createElement('div');
            p.className = 'neon-particle';
            var size = Math.random() * 5 + 1;
            p.style.width = size + 'px';
            p.style.height = size + 'px';
            p.style.left = (Math.random() * window.innerWidth) + 'px';
            p.style.top = (Math.random() * window.innerHeight) + 'px';
            p.style.animationDuration = (Math.random() * 10 + 5) + 's';
            p.style.animationDelay = (Math.random() * 5) + 's';
            p.style.backgroundColor = color;
            container.appendChild(p);
        }
    }

    function createCodeRain() {
        var container = document.querySelector('.code-rain');
        if (!container) return;
        var cols = Math.floor(window.innerWidth / 20);
        for (var i = 0; i < cols; i++) {
            var col = document.createElement('div');
            col.className = 'code-column';
            col.style.left = (Math.random() * window.innerWidth) + 'px';
            col.style.animationDuration = (Math.random() * 5 + 5) + 's';
            col.style.animationDelay = (Math.random() * 5) + 's';
            var txt = '';
            var len = Math.floor(Math.random() * 20) + 10;
            for (var j = 0; j < len; j++) {
                txt += Math.random() > 0.5
                    ? Math.floor(Math.random() * 2)
                    : String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96));
            }
            col.textContent = txt;
            container.appendChild(col);
        }
    }

    function createStars() {
        var container = document.querySelector('.cosmic-stars');
        if (!container) return;
        for (var i = 0; i < 100; i++) {
            var s = document.createElement('div');
            s.className = 'cosmic-star';
            var size = Math.random() * 3;
            s.style.width = size + 'px';
            s.style.height = size + 'px';
            s.style.left = (Math.random() * window.innerWidth) + 'px';
            s.style.top = (Math.random() * window.innerHeight) + 'px';
            s.style.animationDuration = (Math.random() * 3 + 1) + 's';
            s.style.animationDelay = (Math.random() * 5) + 's';
            container.appendChild(s);
        }
    }

    // ============================================
    // DRAG & DROP
    // ============================================
    var dropArea = document.getElementById('drop-area');
    var fileInput = document.getElementById('fileInput');
    var fileNameDisplay = document.getElementById('fileName');
    var previewBefore = document.getElementById('previewBefore');
    var previewBeforeImg = previewBefore ? previewBefore.querySelector('img') : null;
    var previewAfter = document.getElementById('previewAfter');
    var previewAfterImg = previewAfter ? previewAfter.querySelector('img') : null;

    if (dropArea) {
        ['dragenter', 'dragover'].forEach(function (ev) {
            dropArea.addEventListener(ev, function (e) {
                e.preventDefault();
                dropArea.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            dropArea.addEventListener(ev, function (e) {
                e.preventDefault();
                dropArea.classList.remove('dragover');
            });
        });
        dropArea.addEventListener('drop', function (e) {
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files.length > 0) handleFile(fileInput.files[0]);
        });
    }

    function handleFile(file) {
        if (!fileInput) return;
        var dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        if (fileNameDisplay) fileNameDisplay.textContent = file.name;

        if (file.type.startsWith('image/')) {
            var reader = new FileReader();
            reader.onload = function () {
                if (previewBeforeImg) previewBeforeImg.src = reader.result;
                if (previewBefore) previewBefore.classList.remove('hidden');
                if (previewAfter) previewAfter.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            if (previewBefore) previewBefore.classList.add('hidden');
            if (previewAfter) previewAfter.classList.add('hidden');
        }
    }

    // ============================================
    // STEALTH SCORE & BADGES
    // ============================================
    var stealthScore = 0;
    var stealthScoreDisplay = document.getElementById('stealth-score');
    var badgesContainer = document.getElementById('badges');
    var badgesInfoBtn = document.getElementById('badgesInfoBtn');

    function updateStealthScore(points) {
        stealthScore += points;
        if (stealthScoreDisplay) stealthScoreDisplay.textContent = stealthScore;
        if (!badgesContainer) return;
        if (stealthScore >= 10 && badgesContainer.innerHTML.indexOf('Rookie Spy') === -1) {
            badgesContainer.innerHTML += '<span class="badge">Rookie Spy</span>';
            if (badgesInfoBtn) badgesInfoBtn.classList.remove('hidden');
        }
        if (stealthScore >= 50 && badgesContainer.innerHTML.indexOf('Codebreaker') === -1) {
            badgesContainer.innerHTML += '<span class="badge">Codebreaker</span>';
        }
        if (stealthScore >= 100 && badgesContainer.innerHTML.indexOf('Shadow Agent') === -1) {
            badgesContainer.innerHTML += '<span class="badge">Shadow Agent</span>';
        }
    }

    // ============================================
    // ENCODE
    // ============================================
    function encodeFile() {
        var file = fileInput && fileInput.files[0];
        var msgEl = document.getElementById('messageInput');
        var pwdEl = document.getElementById('passwordInput');
        var message = msgEl ? msgEl.value : '';
        var password = pwdEl ? pwdEl.value : '';
        var output = document.getElementById('output');
        var shareButton = document.getElementById('share-challenge');
        var shareInfoBtn = document.getElementById('shareChallengeInfoBtn');
        var loading = document.getElementById('loading');
        var encodeBtnReady = document.getElementById('encodeBtnReady');
        var encodeBtnProcessing = document.getElementById('encodeBtn');
        var decodedOutputContainer = document.getElementById('decodedOutputContainer');

        if (!file || !message) {
            if (output) output.innerHTML = "<p class='text-red-500'>⚠️ Missing file or message, Agent!</p>";
            return;
        }

        if (output) output.innerHTML = '';
        if (decodedOutputContainer) decodedOutputContainer.classList.add('hidden');
        if (encodeBtnReady) encodeBtnReady.classList.add('hidden');
        if (encodeBtnProcessing) encodeBtnProcessing.classList.remove('hidden');
        if (loading) loading.classList.remove('hidden');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('message', message);
        formData.append('password', password);

        fetch('/encode', { method: 'POST', body: formData })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().then(function (err) {
                        throw new Error(err.error || 'Encoding failed');
                    });
                }
                var responseData = {};
                try {
                    responseData = JSON.parse(response.headers.get('X-Response-Data') || '{}');
                } catch (e) { }
                return response.blob().then(function (blob) {
                    return { blob: blob, data: responseData };
                });
            })
            .then(function (result) {
                if (file.type.startsWith('image/') && result.data.preview_url && previewAfterImg) {
                    previewAfterImg.src = result.data.preview_url;
                    if (previewAfter) previewAfter.classList.remove('hidden');
                }

                var url = window.URL.createObjectURL(result.blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = result.data.filename || 'encoded_file';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                if (output) {
                    output.innerHTML = "<p class='text-green-500'>✅ Mission complete—secret secured!</p>" +
                        "<p class='text-sm mt-2'>Processing time: " + (result.data.processing_time || '?') + "s</p>";
                }

                updateStealthScore(10);
                if (shareButton) {
                    shareButton.classList.remove('hidden');
                    shareButton.onclick = function () { shareChallenge(result.data.share_url); };
                }
                if (shareInfoBtn) shareInfoBtn.classList.remove('hidden');
            })
            .catch(function (error) {
                console.error('Encode error:', error);
                if (output) output.innerHTML = "<p class='text-red-500'>❌ Signal lost—" + error.message + "</p>";
            })
            .finally(function () {
                if (encodeBtnReady) encodeBtnReady.classList.remove('hidden');
                if (encodeBtnProcessing) encodeBtnProcessing.classList.add('hidden');
                if (loading) loading.classList.add('hidden');
                resetForm();
            });
    }

    // ============================================
    // DECODE
    // ============================================
    function decodeFile() {
        var file = fileInput && fileInput.files[0];
        var pwdEl = document.getElementById('passwordInput');
        var password = pwdEl ? pwdEl.value : '';
        var output = document.getElementById('output');
        var decodedOutputContainer = document.getElementById('decodedOutputContainer');
        var decodedOutput = document.getElementById('decodedOutput');
        var loading = document.getElementById('loading');
        var decodeBtnReady = document.getElementById('decodeBtnReady');
        var decodeBtnProcessing = document.getElementById('decodeBtn');

        if (!file) {
            if (output) output.innerHTML = "<p class='text-red-500'>⚠️ No file detected, Agent!</p>";
            return;
        }

        if (output) output.innerHTML = '';
        if (decodedOutputContainer) decodedOutputContainer.classList.add('hidden');
        if (decodeBtnReady) decodeBtnReady.classList.add('hidden');
        if (decodeBtnProcessing) decodeBtnProcessing.classList.remove('hidden');
        if (loading) loading.classList.remove('hidden');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('password', password);

        fetch('/decode', { method: 'POST', body: formData })
            .then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok) throw new Error(data.error || 'Decoding failed');
                    return data;
                });
            })
            .then(function (data) {
                if (file.type.startsWith('image/') && data.preview_url && previewAfterImg) {
                    previewAfterImg.src = data.preview_url;
                    if (previewAfter) previewAfter.classList.remove('hidden');
                }
                if (output) {
                    output.innerHTML = "<p class='text-blue-500'>🔓 Intel retrieved successfully!</p>" +
                        "<p class='text-sm mt-2'>Processing time: " + (data.processing_time || '?') + "s</p>";
                }
                if (decodedOutput) decodedOutput.textContent = data.message || 'No message found';
                if (decodedOutputContainer) decodedOutputContainer.classList.remove('hidden');
                updateStealthScore(15);
            })
            .catch(function (error) {
                console.error('Decode error:', error);
                if (output) output.innerHTML = "<p class='text-red-500'>❌ Decryption failed—" + error.message + "</p>";
            })
            .finally(function () {
                if (decodeBtnReady) decodeBtnReady.classList.remove('hidden');
                if (decodeBtnProcessing) decodeBtnProcessing.classList.add('hidden');
                if (loading) loading.classList.add('hidden');
                resetForm();
            });
    }

    function resetForm() {
        if (fileInput) fileInput.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = '';
        if (previewBefore) previewBefore.classList.add('hidden');
        if (previewAfter) previewAfter.classList.add('hidden');
        var msgInput = document.getElementById('messageInput');
        var pwdInput = document.getElementById('passwordInput');
        if (msgInput) msgInput.value = '';
        if (pwdInput) pwdInput.value = '';
    }

    // ============================================
    // SHARE CHALLENGE
    // ============================================
    function shareChallenge(shareUrl) {
        var shareText = "I've hidden a secret with SteganoVault—can you crack it? Get the file here: " +
            (shareUrl || 'check the download') + " and decode it at: " + window.location.origin;
        if (navigator.share) {
            navigator.share({ text: shareText }).catch(function () { fallbackShare(shareText); });
        } else {
            fallbackShare(shareText);
        }
    }

    function fallbackShare(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            alert('Challenge copied to clipboard!');
        } catch (e) {
            prompt('Copy:', text);
        }
        document.body.removeChild(ta);
    }

    // ============================================
    // TESTIMONIAL CAROUSEL
    // ============================================
    var carousel = document.querySelector('.testimonial-carousel');
    var testimonials = document.querySelectorAll('.testimonial-item');
    if (carousel && testimonials.length > 0) {
        var currentT = 0;
        setInterval(function () {
            currentT = (currentT + 1) % testimonials.length;
            carousel.style.transform = 'translateX(-' + (currentT * 100) + '%)';
        }, 5000);
    }

    // ============================================
    // PRIVACY
    // ============================================
    var learnBtn = document.getElementById('learnMorePrivacy');
    if (learnBtn) {
        learnBtn.addEventListener('click', function () {
            fetch('/privacy')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var pt = document.getElementById('privacyText');
                    if (pt) pt.textContent = data.privacy_policy;
                })
                .catch(function (e) { console.error(e); });
        });
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    var encodeBtnReadyEl = document.getElementById('encodeBtnReady');
    var decodeBtnReadyEl = document.getElementById('decodeBtnReady');
    if (encodeBtnReadyEl) encodeBtnReadyEl.addEventListener('click', encodeFile);
    if (decodeBtnReadyEl) decodeBtnReadyEl.addEventListener('click', decodeFile);

    // ============================================
    // TUTORIAL
    // ============================================
    var tutSteps = document.querySelectorAll('.tutorial-step');
    var tutStep = 0;
    if (tutSteps.length > 0) {
        tutSteps[tutStep].classList.add('active');
        var nextBtn = document.getElementById('nextTutorial');
        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                tutSteps[tutStep].classList.remove('active');
                tutStep = (tutStep + 1) % tutSteps.length;
                tutSteps[tutStep].classList.add('active');
            });
        }
    }

    // ============================================
    // MODALS
    // ============================================
    var modals = {
        info: document.getElementById('infoModal'),
        stealthScore: document.getElementById('stealthScoreModal'),
        badges: document.getElementById('badgesModal'),
        shareChallenge: document.getElementById('shareChallengeModal'),
        funActivities: document.getElementById('funActivitiesModal'),
        auth: document.getElementById('authModal'),
        resetPassword: document.getElementById('resetPasswordModal')
    };
    var modalBtns = {
        info: document.getElementById('infoBtn'),
        stealthScore: document.getElementById('stealthScoreInfoBtn'),
        badges: document.getElementById('badgesInfoBtn'),
        shareChallenge: document.getElementById('shareChallengeInfoBtn'),
        funActivities: document.getElementById('funActivitiesInfoBtn'),
        auth: document.getElementById('authBtn')
    };
    Object.keys(modalBtns).forEach(function (key) {
        if (modalBtns[key] && modals[key]) {
            modalBtns[key].addEventListener('click', function () {
                modals[key].style.display = 'block';
            });
        }
    });
    document.querySelectorAll('.close').forEach(function (btn) {
        btn.addEventListener('click', function () {
            Object.keys(modals).forEach(function (k) {
                if (modals[k]) modals[k].style.display = 'none';
            });
        });
    });
    window.addEventListener('click', function (e) {
        Object.keys(modals).forEach(function (k) {
            if (modals[k] && e.target === modals[k]) modals[k].style.display = 'none';
        });
    });

    // ============================================
    // GAME - SPY TARGET PRACTICE
    // ============================================
    var startGameBtn = document.getElementById('start-game');
    var gameTarget = document.getElementById('game-target');
    var gameScoreDisplay = document.getElementById('game-score');
    var gameScore = 0;
    var gameActive = false;

    if (startGameBtn && gameTarget && gameScoreDisplay) {
        startGameBtn.addEventListener('click', function () {
            if (gameActive) return;
            gameActive = true;
            gameScore = 0;
            gameScoreDisplay.textContent = 0;
            startGameBtn.textContent = 'Game On!';
            startGameBtn.disabled = true;
            moveTarget();
            gameTarget.onclick = function () {
                if (gameActive) {
                    gameScore++;
                    gameScoreDisplay.textContent = gameScore;
                    moveTarget();
                    updateStealthScore(5);
                }
            };
            setTimeout(function () {
                gameActive = false;
                startGameBtn.textContent = 'Start Game';
                startGameBtn.disabled = false;
                alert('Game Over! Score: ' + gameScore);
            }, 10000);
        });
    }

    function moveTarget() {
        var container = document.querySelector('.game-container');
        if (!container || !gameTarget) return;
        var maxX = Math.max(container.clientWidth - gameTarget.clientWidth, 10);
        var maxY = Math.max(container.clientHeight - gameTarget.clientHeight - 60, 10);
        gameTarget.style.left = Math.floor(Math.random() * maxX) + 'px';
        gameTarget.style.top = Math.floor(Math.random() * maxY) + 'px';
    }

    // ============================================
    // CONTACT FORM (EmailJS)
    // ============================================
    var contactForm = document.getElementById('contactForm');
    var sendBtn = document.getElementById('sendMessageBtn');
    var confirmMsg = document.getElementById('confirmationMessage');

    if (contactForm && sendBtn) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            sendBtn.classList.add('sending');
            sendBtn.textContent = 'Sending...';
            sendBtn.disabled = true;

            if (typeof emailjs === 'undefined') {
                alert('Email service not available');
                sendBtn.classList.remove('sending');
                sendBtn.textContent = 'Send Message';
                sendBtn.disabled = false;
                return;
            }

            var params = {
                from_name: (document.getElementById('name') || {}).value || '',
                from_email: (document.getElementById('email') || {}).value || '',
                message: (document.getElementById('message') || {}).value || ''
            };

            emailjs.send('service_jkj2tfh', 'template_62s2pkv', params)
                .then(function () {
                    sendBtn.classList.remove('sending');
                    sendBtn.textContent = 'Send Message';
                    sendBtn.disabled = false;
                    if (confirmMsg) {
                        confirmMsg.classList.remove('hidden');
                        confirmMsg.classList.add('show');
                    }
                    contactForm.reset();
                    setTimeout(function () {
                        if (confirmMsg) {
                            confirmMsg.classList.remove('show');
                            confirmMsg.classList.add('hidden');
                        }
                    }, 5000);
                })
                .catch(function (err) {
                    console.error('Email error:', err);
                    sendBtn.classList.remove('sending');
                    sendBtn.textContent = 'Send Message';
                    sendBtn.disabled = false;
                    alert('Failed to send message');
                });
        });
    }

    // ============================================
    // LOAD USER REVIEWS
    // ============================================
    function loadUserReviews() {
        var container = document.getElementById('userReviewsContainer');
        if (!container) return;
        container.innerHTML = '<div class="text-center py-4"><div class="spinner"></div><p>Loading...</p></div>';
        fetch('/api/reviews')
            .then(function (r) { return r.json(); })
            .then(function (reviews) {
                if (!reviews || reviews.length === 0) {
                    container.innerHTML = '<p class="text-center">No reviews yet. Be the first!</p>';
                    return;
                }
                container.innerHTML = reviews.map(function (r) {
                    var stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                    var date = new Date(r.timestamp).toLocaleDateString();
                    return '<div class="testimonial bg-[var(--card-bg)] p-4 rounded-lg glow-effect">' +
                        '<div class="rating-stars mb-2">' + stars + '</div>' +
                        '<p class="italic">"' + r.text + '"</p>' +
                        '<div class="flex justify-between items-center mt-2">' +
                        '<p class="font-semibold">- ' + r.name + '</p>' +
                        '<p class="text-sm opacity-75">' + date + '</p></div></div>';
                }).join('');
            })
            .catch(function (e) {
                console.error('Reviews error:', e);
                container.innerHTML = '<p class="text-center text-red-500">Failed to load reviews.</p>';
            });
    }

    // ============================================
    // SUBMIT REVIEW
    // ============================================
    var reviewForm = document.getElementById('reviewFormElement');
    if (reviewForm) {
        reviewForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = (document.getElementById('reviewName') || {}).value || '';
            var text = (document.getElementById('reviewText') || {}).value || '';
            var rating = (document.getElementById('reviewRating') || {}).value || '';
            var confirm = document.getElementById('reviewConfirmation');

            if (!name || !text || !rating) {
                alert('Please fill all fields');
                return;
            }

            fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, text: text, rating: parseInt(rating) })
            })
                .then(function (r) {
                    return r.json().then(function (d) {
                        if (!r.ok) throw new Error(d.error || 'Failed');
                        return d;
                    });
                })
                .then(function () {
                    reviewForm.reset();
                    if (confirm) {
                        confirm.textContent = 'Thank you for your review!';
                        confirm.classList.remove('hidden');
                        setTimeout(function () { confirm.classList.add('show'); }, 10);
                        setTimeout(function () {
                            confirm.classList.remove('show');
                            setTimeout(function () { confirm.classList.add('hidden'); }, 500);
                        }, 3000);
                    }
                    loadUserReviews();
                })
                .catch(function (err) {
                    console.error('Review error:', err);
                    alert(err.message || 'Failed to submit review');
                });
        });
    }

    // ============================================
    // AUTHENTICATION
    // ============================================
    var authBtn = document.getElementById('authBtn');
    var authStatus = document.getElementById('authStatus');
    var authModal = document.getElementById('authModal');
    var authModalContent = document.getElementById('authModalContent');
    var resetModal = document.getElementById('resetPasswordModal');
    var resetContent = document.getElementById('resetPasswordContent');

    function checkAuthStatus() {
        fetch('/auth/status')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (authStatus) authStatus.textContent = data.authenticated ? 'Logout' : 'Login';
            })
            .catch(function (e) { console.error(e); });
    }

    function showAuthModal(html) {
        if (authModalContent) authModalContent.innerHTML = html;
        if (authModal) authModal.style.display = 'block';
    }

    function showResetModal(html) {
        if (resetContent) resetContent.innerHTML = html;
        if (resetModal) resetModal.style.display = 'block';
    }

    function showLoginForm() {
        showAuthModal(
            '<h3 class="text-xl font-semibold mb-4">Login</h3>' +
            '<form id="loginForm" class="space-y-4">' +
            '<input type="email" id="loginEmail" placeholder="Email" class="w-full p-2 border rounded bg-transparent" required>' +
            '<input type="password" id="loginPassword" placeholder="Password" class="w-full p-2 border rounded bg-transparent" required>' +
            '<button type="submit" class="bg-[var(--button-bg)] text-white px-4 py-2 rounded w-full">Login</button>' +
            '<p class="text-center text-sm"><a href="#" id="showRegister" class="text-blue-400">Register</a></p>' +
            '<p class="text-center text-sm"><a href="#" id="showForgot" class="text-blue-400">Forgot password?</a></p>' +
            '</form>'
        );

        var loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('loginEmail').value,
                        password: document.getElementById('loginPassword').value
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) alert(d.error);
                        else {
                            if (authModal) authModal.style.display = 'none';
                            checkAuthStatus();
                        }
                    })
                    .catch(function () { alert('Login failed'); });
            });
        }
        var regLink = document.getElementById('showRegister');
        if (regLink) regLink.addEventListener('click', function (e) {
            e.preventDefault();
            showRegisterForm();
        });
        var forgotLink = document.getElementById('showForgot');
        if (forgotLink) forgotLink.addEventListener('click', function (e) {
            e.preventDefault();
            showForgotForm();
        });
    }

    function showRegisterForm() {
        showAuthModal(
            '<h3 class="text-xl font-semibold mb-4">Register</h3>' +
            '<form id="registerForm" class="space-y-4">' +
            '<input type="text" id="regName" placeholder="Name" class="w-full p-2 border rounded bg-transparent" required>' +
            '<input type="email" id="regEmail" placeholder="Email" class="w-full p-2 border rounded bg-transparent" required>' +
            '<input type="password" id="regPassword" placeholder="Password" class="w-full p-2 border rounded bg-transparent" required>' +
            '<button type="submit" class="bg-[var(--button-bg)] text-white px-4 py-2 rounded w-full">Register</button>' +
            '<p class="text-center text-sm"><a href="#" id="showLogin" class="text-blue-400">Login</a></p>' +
            '</form>'
        );

        var regForm = document.getElementById('registerForm');
        if (regForm) {
            regForm.addEventListener('submit', function (e) {
                e.preventDefault();
                fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: document.getElementById('regName').value,
                        email: document.getElementById('regEmail').value,
                        password: document.getElementById('regPassword').value
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) alert(d.error);
                        else showVerifyForm(document.getElementById('regEmail').value);
                    })
                    .catch(function () { alert('Registration failed'); });
            });
        }
        var loginLink = document.getElementById('showLogin');
        if (loginLink) loginLink.addEventListener('click', function (e) {
            e.preventDefault();
            showLoginForm();
        });
    }

    function showVerifyForm(email) {
        showAuthModal(
            '<h3 class="text-xl font-semibold mb-4">Verify Email</h3>' +
            '<p class="text-sm mb-4">Code sent to: ' + email + '</p>' +
            '<form id="verifyForm" class="space-y-4">' +
            '<input type="text" id="verifyCode" placeholder="6-digit code" maxlength="6" class="w-full p-2 border rounded bg-transparent" required>' +
            '<button type="submit" class="bg-[var(--button-bg)] text-white px-4 py-2 rounded w-full">Verify</button>' +
            '</form>'
        );

        var vForm = document.getElementById('verifyForm');
        if (vForm) {
            vForm.addEventListener('submit', function (e) {
                e.preventDefault();
                fetch('/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        otp: document.getElementById('verifyCode').value
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) alert(d.error);
                        else {
                            alert('Verified! Please login.');
                            showLoginForm();
                        }
                    })
                    .catch(function () { alert('Verification failed'); });
            });
        }
    }

    function showForgotForm() {
        showAuthModal(
            '<h3 class="text-xl font-semibold mb-4">Forgot Password</h3>' +
            '<form id="forgotForm" class="space-y-4">' +
            '<input type="email" id="forgotEmail" placeholder="Email" class="w-full p-2 border rounded bg-transparent" required>' +
            '<button type="submit" class="bg-[var(--button-bg)] text-white px-4 py-2 rounded w-full">Send OTP</button>' +
            '<p class="text-center text-sm"><a href="#" id="backLogin" class="text-blue-400">Back to Login</a></p>' +
            '</form>'
        );

        var fForm = document.getElementById('forgotForm');
        if (fForm) {
            fForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var email = document.getElementById('forgotEmail').value;
                fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) alert(d.error);
                        else showResetForm(email);
                    })
                    .catch(function () { alert('Failed'); });
            });
        }
        var backLink = document.getElementById('backLogin');
        if (backLink) backLink.addEventListener('click', function (e) {
            e.preventDefault();
            showLoginForm();
        });
    }

    function showResetForm(email) {
        showResetModal(
            '<h3 class="text-xl font-semibold mb-4">Reset Password</h3>' +
            '<form id="resetForm" class="space-y-4">' +
            '<input type="text" id="resetOtp" placeholder="OTP code" maxlength="6" class="w-full p-2 border rounded bg-transparent" required>' +
            '<input type="password" id="newPwd" placeholder="New password" class="w-full p-2 border rounded bg-transparent" required>' +
            '<input type="password" id="confirmPwd" placeholder="Confirm password" class="w-full p-2 border rounded bg-transparent" required>' +
            '<button type="submit" class="bg-[var(--button-bg)] text-white px-4 py-2 rounded w-full">Reset</button>' +
            '</form>'
        );

        var rForm = document.getElementById('resetForm');
        if (rForm) {
            rForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var np = document.getElementById('newPwd').value;
                var cp = document.getElementById('confirmPwd').value;
                if (np !== cp) { alert('Passwords do not match'); return; }
                if (np.length < 8) { alert('Password too short (min 8)'); return; }
                fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        otp: document.getElementById('resetOtp').value,
                        new_password: np
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        if (d.error) alert(d.error);
                        else {
                            alert('Password reset!');
                            if (resetModal) resetModal.style.display = 'none';
                            showLoginForm();
                        }
                    })
                    .catch(function () { alert('Reset failed'); });
            });
        }
    }

    if (authBtn) {
        authBtn.addEventListener('click', function () {
            if (authStatus && authStatus.textContent === 'Logout') {
                fetch('/auth/logout', { method: 'POST' })
                    .then(function () { checkAuthStatus(); });
            } else {
                showLoginForm();
            }
        });
    }

    // ============================================
    // INIT
    // ============================================
    checkAuthStatus();
    loadUserReviews();
    console.log('✅ SteganoVault app.js loaded successfully');
});