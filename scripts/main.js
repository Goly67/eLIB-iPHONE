import { initializeApp } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

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
const auth = getAuth(app);

(function () {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  if (!isIOS) {
 
    document.body.innerHTML = `
    <div class="overlay"></div>  
<div class="content">
<div class="center-wrapper">
<div class="access-denied-card">
<img src="drawables/ios-logo.png" alt="iOS Logo" class="ios-logo">
<h1>Access Denied</h1>
<p>This website is only available on iOS devices, if you are using an android please download the app.</p>
<button onclick="window.location.href='https://www.apple.com/ios/'" class="learn-more-btn">
  Learn More About iOS
</button>
</div>
</div>
</div>
    `;
    throw new Error('Non-iOS device detected. Access denied.');
  }
})();

// ---------- Permissions helpers ----------
async function requestNotificationPermission() {
  // Some browsers (esp. older Safari/iOS) don't support Notifications API — fallback to toast
  if (!("Notification" in window)) {
    console.log("Notifications API not supported");
    showTopToast("Notifications not supported in this browser");
    return false;
  }

  try {
    // If already granted, show one
    if (Notification.permission === "granted") {
      showNotification("App ready", { body: "Ready to scan QR code." });
      return true;
    }

    // Ask user
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      showNotification("App ready", { body: "Ready to scan QR code." });
      return true;
    } else {
      showTopToast("Notifications blocked (will use in-app alerts)");
      return false;
    }
  } catch (e) {
    console.warn("Notification permission error", e);
    showTopToast("Notification permission failed");
    return false;
  }
}

function showNotification(title, opts = {}) {
  showTopToast((opts && opts.body) || title);
}

async function requestCameraAccess() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showTopToast("Camera access not supported in this browser.");
    return false;
  }

  try {
    // prefer back camera on phones
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    // immediately stop tracks so we don't hold camera before scan page
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (e) {
    console.warn("Camera permission error", e);
    // show a user-friendly message
    showTopToast("Camera permission required to scan QR (please allow access).");
    return false;
  }
}
// ---------- end helpers ----------



const topToast = document.getElementById('topToast');

function showTopToast(message) {
  topToast.textContent = message;
  topToast.style.display = "block";
  setTimeout(() => { topToast.style.display = "none"; }, 2400);
}

// ✅ Check if there is an active session
const studentNum = localStorage.getItem('studentNum');
const studentLogKey = localStorage.getItem('studentLogKey');
const loginTimestamp = parseInt(localStorage.getItem('loginTimestamp'), 10) || 0;
const now = Date.now();
const sessionValid = studentNum && studentLogKey && (now - loginTimestamp < 60 * 60 * 1000); // 1 hour

if (sessionValid) {
  // If valid session exists, redirect to finish page
  window.location.href = "finishScanActivity.html";
} else {
  // Clear any stale data
  localStorage.removeItem('studentNum');
  localStorage.removeItem('studentLogKey');
  localStorage.removeItem('loginTimestamp');
}

// Anonymous Firebase auth
signInAnonymously(auth)
  .then(async () => {
    showTopToast("Ready to scan QR code.");
    // ask notification permission in the background (non-blocking)
    requestNotificationPermission().catch(() => { });
  })
  .catch(() => showTopToast("No internet connection."));

document.getElementById('btnScanQR').addEventListener('click', async () => {
  // Request camera permission first. If granted, proceed to scan page.
  const ok = await requestCameraAccess();
  if (ok) {
    // small delay so UI can update and the camera prompt can settle
    setTimeout(() => { window.location.href = "scan.html"; }, 150);
  } else {
  }
});