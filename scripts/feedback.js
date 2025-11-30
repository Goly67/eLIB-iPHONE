import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
        import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
        import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDsYm9spjswfNVT_VvTprGI0Ystc3iQXQA",
            authDomain: "realtime-database-7e415.firebaseapp.com",
            databaseURL: "https://realtime-database-7e415-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "realtime-database-7e415",
            storageBucket: "realtime-database-7e415.appspot.com",
            messagingSenderId: "817516970962",
            appId: "1:817516970962:web:13b35185538cd472eebe0b"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        // UI refs
        const tvGreeting = document.getElementById('tvGreeting');
        const tvStudentName = document.getElementById('tvStudentName');
        const tvStudentID = document.getElementById('tvStudentID');
        const tvCurrentTime = document.getElementById('tvCurrentTime');
        const greetingRow = document.getElementById('greetingRow');

        const etStudentNumber = document.getElementById('etStudentNumber');
        const etSubject = document.getElementById('etSubject');
        const etDescription = document.getElementById('etDescription');
        const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');
        const topToast = document.getElementById('topToast');
        const logoutDialog = document.getElementById('logoutDialog');
        const btnLogoutYes = document.getElementById('btnLogoutYes');
        const btnLogoutNo = document.getElementById('btnLogoutNo');

        let currentStudentName = '';
        let currentStudentID = '';

        function showTopToast(msg, ms = 2200) {
            topToast.textContent = msg;
            topToast.style.display = 'block';
            clearTimeout(showTopToast._t);
            showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
        }

        function adjustStudentName() {
            const full = (currentStudentName && currentStudentName.trim()) ||
                localStorage.getItem('studentName') ||
                tvStudentName.textContent.trim() ||
                '';

            function adjustStudentName() {
                const full = (currentStudentName && currentStudentName.trim()) ||
                    localStorage.getItem('studentName') ||
                    tvStudentName.textContent.trim() ||
                    '';

                if (!full) {
                    tvStudentName.textContent = '';
                    return; // ✅ OK here because it’s inside the function
                }

                // Only use first name
                const first = full.split(/\s+/)[0];
                tvStudentName.textContent = first;
            }



            // helper to test overflow of greetingRow (we want combined greeting+name to fit)
            function fits(textForName) {
                tvStudentName.textContent = textForName;
                // allow 1px tolerance
                return greetingRow.scrollWidth <= greetingRow.clientWidth + 1;
            }

            // 1) try full name
            if (fits(full)) return;

            // 2) try first name only
            const first = full.trim().split(/\s+/)[0] || full;
            if (fits(first)) {
                tvStudentName.textContent = first;
                return;
            }

            // 3) truncate first name with ellipsis until fits
            let s = first;
            // quick guard if extremely narrow
            if (!s) { tvStudentName.textContent = ''; return; }

            // Remove chars from end until it fits
            // Start with conservative slice length to speed up
            let maxLen = s.length;
            while (maxLen > 0) {
                const candidate = s.slice(0, maxLen) + (maxLen < s.length ? '…' : '');
                if (fits(candidate)) {
                    tvStudentName.textContent = candidate;
                    return;
                }
                maxLen--;
            }

            // fallback: one char ellipsis
            tvStudentName.textContent = (s[0] || '') + '…';
        }

        // Debounce wrapper
        function debounce(fn, wait = 120) {
            let t;
            return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); };
        }
        const debouncedAdjust = debounce(adjustStudentName, 80);


        window.addEventListener('resize', debouncedAdjust);
        window.addEventListener('orientationchange', debouncedAdjust);

        // Update greeting and time (time-only)
        function updateGreetingAndTime() {
            const now = new Date();
            const hr = now.getHours();
            const greeting = hr < 12 ? 'Good Morning' : (hr < 18 ? 'Good Afternoon' : 'Good Evening');
            tvGreeting.textContent = greeting + ',';
            tvCurrentTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

            // adjust after greeting text updated
            adjustStudentName();
            debouncedAdjust();

        }
        updateGreetingAndTime();
        setInterval(updateGreetingAndTime, 1000);

        // Handle window resize / orientation changes
        window.addEventListener('resize', debounce(() => adjustStudentName(), 120));
        window.addEventListener('orientationchange', debounce(() => adjustStudentName(), 150));

        // Determine incoming params (studentId and token)
        const params = new URLSearchParams(window.location.search);
        const urlStudentId = params.get('studentId');
        const urlToken = params.get('token');
        if (urlToken) localStorage.setItem('activeToken', urlToken);

        const storedStudentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || null;
        const finalStudentId = urlStudentId || storedStudentId;

        // Sign-in and load student info
        signInAnonymously(auth).then(() => {
            if (finalStudentId) loadStudentInfo(finalStudentId);
            else {
                showTopToast('No student ID found. Please scan first.');
                setTimeout(() => window.location.href = 'secondScanActivity.html', 900);
            }
        }).catch(err => {
            console.error(err);
            showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
        });

        async function loadStudentInfo(studentId) {
            try {
                const snap = await get(ref(db, `Students/${studentId}`));
                if (snap.exists()) {
                    const d = snap.val();
                    const name = (d.name || d.fullName || localStorage.getItem('studentName') || '').trim();
                    const id = d.studentNumber || d.studentID || studentId;
                    currentStudentName = name || '';
                    currentStudentID = id || '';

                    // show
                    tvStudentName.textContent = currentStudentName || 'Unknown';
                    tvStudentID.textContent = 'ID: ' + (currentStudentID || '');
                    etStudentNumber.value = currentStudentID || '';

                    // persist
                    localStorage.setItem('studentNum', studentId);
                    localStorage.setItem('studentID', currentStudentID);
                    localStorage.setItem('studentName', currentStudentName);

                    // adjust to fit
                    adjustStudentName();
                    debouncedAdjust();

                } else {
                    tvStudentName.textContent = localStorage.getItem('studentName') || 'Unknown';
                    tvStudentID.textContent = 'ID: ' + (studentId || '');
                    etStudentNumber.value = studentId || '';
                    currentStudentName = tvStudentName.textContent;
                    currentStudentID = studentId || '';
                    showTopToast('Student record not found; using provided ID');
                    adjustStudentName();
                    debouncedAdjust();

                }
            } catch (err) {
                console.error(err);
                showTopToast('Error fetching student info');
            }
        }

        // Submit feedback
        btnSubmitFeedback.addEventListener('click', async () => {
            const subject = etSubject.value.trim();
            const description = etDescription.value.trim();
            const studentNum = currentStudentID || etStudentNumber.value.trim();

            if (!subject || !description) { showTopToast('Please fill all fields'); return; }
            if (!studentNum) { showTopToast('Student ID missing'); return; }

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const date = `${yyyy}-${mm}-${dd}`;

            const payload = {
                name: currentStudentName || localStorage.getItem('studentName') || 'Unknown',
                studentNumber: studentNum,
                subject,
                description,
                date
            };

            try {
                const newRef = push(ref(db, 'Feedbacks'));
                await set(newRef, payload);
                showTopToast('Feedback submitted');
                etSubject.value = '';
                etDescription.value = '';
            } catch (e) {
                console.error('Submit failed', e);
                showTopToast('Failed to submit feedback');
            }
        });

        // Nav helpers (drawables)
        function navHome() {
            const tok = localStorage.getItem('activeToken') || '';
            if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
            else window.location.href = 'finishScanActivity.html';
        }
        function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }
        function navFeedback() { showTopToast('You are on Feedback'); }
        // Logout flow (with Firebase session update)
        function navLogout() {
            logoutDialog.style.display = 'flex';
            requestAnimationFrame(() => logoutDialog.classList.add('show'));
            logoutDialog.setAttribute('aria-hidden', 'false');
        }

        btnLogoutYes.addEventListener('click', async () => {
            hideLogoutDialog(async () => {
                const studentNum = localStorage.getItem('studentNum');
                const name = localStorage.getItem('studentName') || currentStudentName || 'Unknown';
                const activeToken = localStorage.getItem('activeToken');
                const now = Date.now();
                const humanDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

                try {
                    if (studentNum) {
                        // Try to update the latest session in Students/{studentNum}/sessions
                        const sessionsSnap = await get(ref(db, `Students/${studentNum}/sessions`));
                        let candidateKey = null;

                        if (sessionsSnap.exists()) {
                            const sessions = sessionsSnap.val();
                            let latestLogin = -1;
                            Object.entries(sessions).forEach(([k, v]) => {
                                if (v && (!v.logoutTime || v.logoutTime === 0)) {
                                    const lt = typeof v.loginTime === 'number' ? v.loginTime : 0;
                                    if (lt >= latestLogin) { latestLogin = lt; candidateKey = k; }
                                }
                            });
                        }

                        const sessionData = { logoutTime: now, date: humanDate, name, studentNumber: studentNum };

                        if (candidateKey) {
                            await set(ref(db, `Students/${studentNum}/sessions/${candidateKey}/logoutTime`), now);
                            await set(ref(db, `StudentLogs/${studentNum}/${candidateKey}/logoutTime`), now).catch(() => { });
                            showTopToast('Logout recorded (session updated)');
                        } else {
                            const newRef = push(ref(db, `StudentLogs/${studentNum}`));
                            const key = newRef.key;
                            const payload = { date: humanDate, grade: '', loginTime: now, logoutTime: now, name, strand: '', studentNumber: studentNum };
                            await set(ref(db, `StudentLogs/${studentNum}/${key}`), payload);
                            await set(ref(db, `Students/${studentNum}/sessions/${key}`), payload);
                            showTopToast('Logout recorded (new session)');
                        }
                    }
                } catch (e) {
                    console.error('Logout write error', e);
                    showTopToast('Failed to record logout to DB');
                } finally {
                    // clear localStorage & redirect
                    localStorage.removeItem('studentNum');
                    localStorage.removeItem('studentName');
                    localStorage.removeItem('studentID');
                    localStorage.removeItem('activeToken');
                    setTimeout(() => window.location.href = 'thankyou.html', 900);
                }
            });
        });

        btnLogoutNo.addEventListener('click', () => {
            logoutDialog.classList.remove('show');
            logoutDialog.setAttribute('aria-hidden', 'true');
        });

        // helper to hide dialog
        function hideLogoutDialog(callback) {
            logoutDialog.classList.remove('show');
            logoutDialog.setAttribute('aria-hidden', 'true');
            setTimeout(() => {
                logoutDialog.style.display = 'none';
                if (callback) callback();
            }, 260);
        }

        // make nav helpers available for inline onclicks
        window.navHome = navHome;
        window.navBlogs = navBlogs;
        window.navFeedback = navFeedback;
        window.navLogout = navLogout;
