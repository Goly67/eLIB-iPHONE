import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
        import { getDatabase, ref, get, child, set, update, push } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-database.js";
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
        const tvCurrentTime = document.getElementById('tvCurrentTime');
        const tvName = document.getElementById('tvStudentName');
        const tvId = document.getElementById('tvStudentID');
        const tvGreeting = document.getElementById('tvGreeting');
        const topToast = document.getElementById('topToast');
        const logoutDialog = document.getElementById('logoutDialog');
        const btnLogoutYes = document.getElementById('btnLogoutYes');
        const btnLogoutNo = document.getElementById('btnLogoutNo');
        const askModal = document.getElementById('askStudentModal');
        const askInput = document.getElementById('askStudentInput');
        const askSave = document.getElementById('askStudentSave');
        const askCancel = document.getElementById('askStudentCancel');

        let currentStudentName = '';
        let currentStudentID = '';
        let activeToken = null;

        // helper: toast
        function showTopToast(msg, ms = 2500) {
            topToast.textContent = msg;
            topToast.style.display = 'block';
            clearTimeout(showTopToast._t);
            showTopToast._t = setTimeout(() => topToast.style.display = 'none', ms);
        }

        // time + greeting
        function updateTimeAndGreeting() {
            const now = new Date();
            tvCurrentTime.textContent = now.toLocaleTimeString();
            const hr = now.getHours();
            tvGreeting.textContent = hr < 12 ? 'Good Morning,' : (hr < 18 ? 'Good Afternoon,' : 'Good Evening,');
        }
        updateTimeAndGreeting();
        setInterval(updateTimeAndGreeting, 1000);

        // read token from URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token') || null;
        if (token) {
            localStorage.setItem('activeToken', token);
            activeToken = token;
        } else {
            activeToken = localStorage.getItem('activeToken') || null;
        }

        // ask modal controls
        function openAskModal() {
            askModal.style.display = 'flex';
            askInput.value = '';
            askInput.focus();
        }
        function closeAskModal() { askModal.style.display = 'none'; }

        askSave.addEventListener('click', () => {
            const v = askInput.value.trim();
            if (!v) { showTopToast('Enter ID'); return; }
            localStorage.setItem('studentNum', v);
            fetchStudentByNumber(v);
            closeAskModal();
        });
        askCancel.addEventListener('click', () => { closeAskModal(); showTopToast('Student ID required'); });

        // Firebase: sign in
        signInAnonymously(auth).then(() => {
            showTopToast('Data gathered successfully', 1200);
            // If token present, load session; else try loadStudentData (localStorage)
            if (activeToken) {
                loadStudentFromToken(activeToken);
            } else {
                const stored = localStorage.getItem('studentNum');
                if (stored) fetchStudentByNumber(stored);
                else openAskModal();
            }
        }).catch(err => {
            console.error('Auth failed', err);
            showTopToast('Auth failed: ' + (err && err.message ? err.message : ''));
        });

        // load student from SessionsByToken/{token}
        async function loadStudentFromToken(tok) {
            if (!tok) return;
            try {
                const snap = await get(child(ref(db), `SessionsByToken/${tok}`));
                if (!snap.exists()) {
                    showTopToast('Invalid or expired token');
                    // fallback: prompt
                    openAskModal();
                    return;
                }
                const data = snap.val();
                const name = data.name || data.studentName || data.fullName || 'Unknown';
                const studentNumber = data.studentNumber || data.id || data.studentNum || data.studentID || '';
                // save to localStorage
                localStorage.setItem('studentNum', studentNumber);
                localStorage.setItem('studentName', name);
                localStorage.setItem('studentID', studentNumber);
                localStorage.setItem('activeToken', tok);
                currentStudentName = name; currentStudentID = studentNumber; activeToken = tok;
                tvName.textContent = name;
                tvId.textContent = 'ID: ' + studentNumber;
                showTopToast('Welcome ' + name + '!');
            } catch (e) {
                console.error(e);
                showTopToast('Error fetching session data');
                openAskModal();
            }
        }

        // fetch Students/{studentNum}
        async function fetchStudentByNumber(studentNum) {
            if (!studentNum) return;
            try {
                const snap = await get(child(ref(db), `Students/${studentNum}`));
                if (!snap.exists()) {
                    tvName.textContent = 'Not Found';
                    tvId.textContent = 'ID: ' + studentNum;
                    localStorage.setItem('studentNum', studentNum);
                    localStorage.setItem('studentID', studentNum);
                    showTopToast('Student not found in DB, but stored locally');
                    return;
                }
                const d = snap.val();
                const name = d.name || d.fullName || d.displayName || 'Unknown';
                const id = d.studentNumber || d.studentID || studentNum;
                currentStudentName = name;
                currentStudentID = id;
                localStorage.setItem('studentNum', studentNum);
                localStorage.setItem('studentName', name);
                localStorage.setItem('studentID', id);
                tvName.textContent = name;
                tvId.textContent = 'ID: ' + id;
                showTopToast('Data loaded successfully');
            } catch (err) {
                console.error(err);
                showTopToast('Error loading student data');
            }
        }

        /* NAV helpers requested */
        // return to home and keep token in URL
        function navHome() {
            const tok = localStorage.getItem('activeToken') || '';
            if (tok) window.location.href = `finishScanActivity.html?token=${tok}`;
            else window.location.href = 'finishScanActivity.html';
        }
        window.navHome = navHome;

        // open blogs
        function navBlogs() { window.open('https://www.sti.edu/blog1.asp', '_blank'); }
        window.navBlogs = navBlogs;

        // feedback: auto-redirect to feedback.html with studentId & token
        function navFeedback() {
            const studentId = localStorage.getItem('studentID') || localStorage.getItem('studentNum') || '';
            const tok = localStorage.getItem('activeToken') || '';
            if (!studentId) { showTopToast('Student session missing. Please scan again.'); return; }
            const url = `feedback.html?studentId=${encodeURIComponent(studentId)}${tok ? '&token=' + encodeURIComponent(tok) : ''}`;
            window.location.href = url;
        }
        window.navFeedback = navFeedback;

        // logout flow (dialog)
        function navLogout() {
            logoutDialog.style.display = 'flex';
            requestAnimationFrame(() => logoutDialog.classList.add('show'));
            logoutDialog.setAttribute('aria-hidden', 'false');
        }
        window.navLogout = navLogout;

        function hideLogoutDialog(callback) {
            logoutDialog.classList.remove('show');
            logoutDialog.setAttribute('aria-hidden', 'true');
            setTimeout(() => {
                logoutDialog.style.display = 'none';
                if (callback) callback();
            }, 260);
        }
        btnLogoutYes.addEventListener('click', () => {
            hideLogoutDialog(() => performManualLogout());
        });
        btnLogoutNo.addEventListener('click', () => {
            hideLogoutDialog(() => { });
        });

        // adapted performManualLogout (updates Students/{studentNum}/sessions and StudentLogs)
        async function performManualLogout() {
            const studentNum = localStorage.getItem('studentNum');
            const name = localStorage.getItem('studentName') || tvName.textContent || '';
            if (!studentNum) {
                // final fallback: clear local and redirect
                localStorage.removeItem('studentNum'); localStorage.removeItem('studentName'); localStorage.removeItem('studentID');
                showTopToast('Logged out');
                setTimeout(() => window.location.href = 'thankyou.html', 700);
                return;
            }
            const now = Date.now();
            const humanDate = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            try {
                // try update open session under Students/{studentNum}/sessions
                const sessionsSnap = await get(child(ref(db), `Students/${studentNum}/sessions`));
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
                if (candidateKey) {
                    const sessionUpdates = { logoutTime: now, date: humanDate, name, studentNumber: studentNum };
                    await update(ref(db, `Students/${studentNum}/sessions/${candidateKey}`), sessionUpdates);
                    await update(ref(db, `StudentLogs/${studentNum}/${candidateKey}`), sessionUpdates).catch(() => { }); // ignore if missing
                    showTopToast('Logout recorded (session updated)');
                } else {
                    // create new log in StudentLogs and Students/sessions
                    const newRef = push(ref(db, `StudentLogs/${studentNum}`));
                    const key = newRef.key;
                    const payload = { date: humanDate, grade: '', loginTime: now, logoutTime: now, name, strand: '', studentNumber: studentNum };
                    await set(ref(db, `StudentLogs/${studentNum}/${key}`), payload);
                    await set(ref(db, `Students/${studentNum}/sessions/${key}`), payload);
                    showTopToast('Logout recorded (new session)');
                }
            } catch (e) {
                console.error('Logout write error', e);
                showTopToast('Failed to record logout to DB');
            } finally {
                // clear local session
                localStorage.removeItem('studentNum'); localStorage.removeItem('studentName'); localStorage.removeItem('studentID'); localStorage.removeItem('activeToken');
                setTimeout(() => window.location.href = 'thankyou.html', 900);
            }
        }

        /* small utility actions */
        window.openHelp = () => window.open('https://library.sticollegesurigao.com/contact-us/', '_blank');
        window.openLibrary = () => window.open('https://login.ebsco.com/', '_blank');
        window.openELMS = () => window.open('https://elms.sti.edu/', '_blank');
        window.openSite = () => window.open('https://library.sticollegesurigao.com/', '_blank');
        window.openFeedback = () => navFeedback();
        window.onBlogInfo = (i) => { if (i === 1) window.open('https://www.sti.edu/blog1.asp', '_blank'); else showTopToast('Opening blog ' + i); };
