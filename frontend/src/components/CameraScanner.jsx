import React, { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function CameraScanner({ title = "Scan Barcode/QR Code", onScanSuccess, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize the scanner
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        qrbox: { width: 300, height: 150 },
        fps: 10,
        rememberLastUsedCamera: true
      },
      /* verbose= */ false
    );
    
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        // Pause scanning to avoid multiple scans
        if (scannerRef.current && scannerRef.current.getState() !== 3) {
          try {
            scannerRef.current.pause(true);
          } catch(e) {}
        }
        
        onScanSuccess(decodedText);
        
        // Clean up immediately after successful scan
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      },
      (errorMessage) => {
        // Continuous scanning errors (not finding a code) are expected.
        // We just ignore them.
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScanSuccess]);

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      zIndex: 99999,
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{
        background: "white",
        padding: "1.5rem",
        borderRadius: "12px",
        width: "100%",
        maxWidth: "500px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, color: "#1e293b", fontSize: "1.2rem" }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{
              background: "#ef4444", color: "white", border: "none", 
              borderRadius: "6px", padding: "0.4rem 0.8rem", cursor: "pointer", fontWeight: "bold"
            }}
          >
            Close
          </button>
        </div>
        
        <div id="reader" style={{ width: "100%", border: "none" }}></div>
        
        <div style={{ marginTop: "1.5rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
          <p>Please point your camera at the barcode/QR code on the tablet box. The scanner will automatically detect and capture the IMEI.</p>
        </div>
      </div>
    </div>
  );
}
