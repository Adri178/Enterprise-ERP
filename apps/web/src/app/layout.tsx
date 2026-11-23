import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import "./workspace.css";
export const metadata: Metadata = {
  title: {
    default: "Enterprise ERP — Dashboard",
    template: "%s | Enterprise ERP",
  },
  description:
    "Workspace ERP multi-company untuk mengelola operasional bisnis.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <a href="#main-content" className="skip-link">
          Lewati ke konten utama
        </a>
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </body>
    </html>
  );
}
