function startQRScanner() {
  const html5QrCode = new Html5Qrcode("qr-reader");
  const qrConfig = { fps: 10, qrbox: 250 };

  html5QrCode.start(
    { facingMode: "environment" },
    qrConfig,
    qrCodeMessage => {
      if (qrCodeMessage.trim().toUpperCase() === "LOGIN") {
        html5QrCode.stop().then(() => {
          const sessionToken = Date.now().toString();
          sessionStorage.setItem('qrSessionToken', sessionToken);
          window.location.href = `SecondScanActivity.html?token=${sessionToken}`;
        });
      }
    },
    () => {}
  );
}

window.addEventListener('load', startQRScanner);
