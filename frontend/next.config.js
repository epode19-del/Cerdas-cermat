/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kompresi gzip buat semua respons (halaman, JSON, dsb) dari server Next.js sendiri —
  // sudah default true, ditulis eksplisit di sini biar jelas maksudnya.
  compress: true,
};

module.exports = nextConfig;
