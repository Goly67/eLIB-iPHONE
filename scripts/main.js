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
const btnScan = document.getElementById('btnScanQR');
const btnNotif = document.getElementById('btnEnableNotif'); // ADD THIS BUTTON TO HTML!

// Register Service Worker for PWA & Notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('scripts/sw.js')
    .then(reg => console.log('SW Registered', reg))
    .catch(err => console.error('SW Fail', err));
}

const topToast = document.getElementById('topToast');

function showTopToast(message) {
  topToast.textContent = message;
  topToast.style.display = "block";
  setTimeout(() => { topToast.style.display = "none"; }, 2400);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    showTopToast("Notifications not supported");
    return false;
  }

  // 1. Check if already denied
  if (Notification.permission === 'denied') {
    showTopToast("⚠️ Notifications blocked. Please enable in browser settings.");
    return false;
  }

  // 2. Check if already granted
  if (Notification.permission === 'granted') {
    showTopToast("Notifications already active ✅");
    return true;
  }

  try {
    // 3. Request permission
    const perm = await Notification.requestPermission();
    
    if (perm === "granted") {
      showTopToast("Notifications enabled! ✅");
      
      // Test notification
      if (navigator.serviceWorker.controller) {
         navigator.serviceWorker.controller.postMessage({ type: 'TEST_NOTIF' });
      } else {
         // Fallback if SW isn't ready yet
         new Notification("Setup Complete", { body: "You will receive library reminders." });
      }
      return true;
    } else {
      // User clicked "Block" or "X" just now
      showTopToast("Notifications blocked ❌");
      return false;
    }
  } catch (e) {
    console.warn("Notification permission error", e);
    showTopToast("Error enabling notifications");
    return false;
  }
}


async function requestCameraAccess() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showTopToast("Camera access not supported.");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (e) {
    console.warn("Camera permission error", e);
    showTopToast("Camera permission required.");
    return false;
  }
}

// ---------- iOS PWA Instructions ----------
// Only show this if on iOS AND not in standalone mode (browser tab)
function checkIOSPWA() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    // Create a simple banner dynamically
    const banner = document.createElement('div');
    banner.style.cssText = "position:fixed; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.9); color:white; padding:20px; text-align:center; z-index:9999; font-family:sans-serif;";
    banner.innerHTML = `
      <p style="margin:0 0 10px 0;">To enable notifications, install this app:</p>
      <p style="margin:0;">Tap <img src="https://img.icons8.com/ios-filled/20/ffffff/share-rounded.png" style="vertical-align:middle"> then "Add to Home Screen"</p>
      <button id="closeBanner" style="position:absolute; top:5px; right:10px; background:none; border:none; color:#aaa; font-size:20px;">&times;</button>
    `;
    document.body.appendChild(banner);
    
    document.getElementById('closeBanner').onclick = () => banner.remove();
  }
}

// ---------- Main Logic ----------

// Check active session
const studentNum = localStorage.getItem('studentNum');
const studentLogKey = localStorage.getItem('studentLogKey');
const loginTimestamp = parseInt(localStorage.getItem('loginTimestamp'), 10) || 0;
const now = Date.now();
const sessionValid = studentNum && studentLogKey && (now - loginTimestamp < 60 * 60 * 1000);

if (sessionValid) {
  window.location.href = "finishScanActivity.html";
} else {
  localStorage.removeItem('studentNum');
  localStorage.removeItem('studentLogKey');
  localStorage.removeItem('loginTimestamp');
}

// Auth & Init
signInAnonymously(auth)
  .then(async () => {
    showTopToast("Data successfully gathered.");
    checkIOSPWA(); // Check if we need to show iOS instructions
  })
  .catch(() => showTopToast("No internet connection."));


if (btnScan) {
    btnScan.addEventListener('click', async () => {
      const ok = await requestCameraAccess();
      if (ok) {
        setTimeout(() => { window.location.href = "scan.html"; }, 150);
      }
    });
}

// Hide button on load if already granted
if (btnNotif && Notification.permission === 'granted') {
    btnNotif.style.display = 'none';
}

// IMPORTANT: You need a separate button for this on iOS
// You cannot ask for notifications automatically on page load in iOS PWA
if (btnNotif) {
    btnNotif.addEventListener('click', async () => {
        console.log("Notification button clicked!"); // Debug log
        await requestNotificationPermission();
        
        // If granted, hide button immediately for better UX
        if (Notification.permission === 'granted') {
            btnNotif.style.display = 'none';
        }
    });
}
