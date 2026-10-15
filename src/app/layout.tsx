import type { Metadata } from "next";
import "./globals.css";
import "summernote/dist/summernote-lite.min.css";

export const metadata: Metadata = {
  title: "Ujian Online",
  description: "Ujian online Majelis Dikdasmen dan PNF PP Muhammadiyah",
  icons: {
    icon: [{ url: "/brand/logo-dikdas-outline.png", type: "image/png" }],
    apple: [{ url: "/brand/logo-dikdas-outline.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-page font-ui text-base text-ink antialiased">{children}</body>
    </html>
  );
}
