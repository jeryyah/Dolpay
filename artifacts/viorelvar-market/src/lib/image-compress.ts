// Compress a user-uploaded image to a sane size before persisting it to
// localStorage. Default budget keeps the encoded blob well under ~120KB so we
// never trip the browser's localStorage quota when combined with the rest of
// the app state. PNG is preserved for transparent images (e.g. QR codes).
export async function compressImageFile(
  file: File,
  maxSize = 720,
  quality = 0.82,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
  if (dataUrl.length < 80_000) return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const isPng = file.type === "image/png" || dataUrl.startsWith("data:image/png");
      const out = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
      resolve(out.length < dataUrl.length ? out : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
