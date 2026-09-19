import QRCode from "qrcode";

/** The module matrix at error correction H: HQR's centre chip covers a quarter of the width. */
export function qrMatrix(text: string): { size: number; data: ArrayLike<number | boolean> } | null {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
    return { size: qr.modules.size, data: qr.modules.data };
  } catch {
    return null;
  }
}
