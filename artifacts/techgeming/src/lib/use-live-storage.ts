import { useEffect, useState } from "react";
import { STORAGE_EVENT } from "./storage";

/**
 * Hook real-time: setiap kali ada `localStorage` yang disimpan via fungsi
 * save di `lib/storage.ts` (dan ikut memanggil `broadcastStorageChange`),
 * counter ini akan bertambah. Komponen pemakainya tinggal pakai `ver`
 * sebagai dependency `useMemo` / `useEffect` supaya data ikut refresh
 * tanpa perlu reload halaman.
 *
 * Juga ikut mendengar event `storage` standar (perubahan di tab lain),
 * dan `pinz_new_purchase` (kompat lama).
 */
export function useStorageVersion(): number {
  const [ver, setVer] = useState(0);
  useEffect(() => {
    const bump = () => setVer((v) => v + 1);
    window.addEventListener(STORAGE_EVENT, bump);
    window.addEventListener("storage", bump);
    window.addEventListener("pinz_new_purchase", bump);
    return () => {
      window.removeEventListener(STORAGE_EVENT, bump);
      window.removeEventListener("storage", bump);
      window.removeEventListener("pinz_new_purchase", bump);
    };
  }, []);
  return ver;
}
