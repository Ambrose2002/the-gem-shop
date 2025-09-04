import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CartUIProvider } from "@/contexts/cart-ui";
import { CartDataProvider } from "@/contexts/cart-data";

export const metadata: Metadata = {
  title: "The Gem Shop",
  description: "Beautiful, timeless pieces for everyday elegance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-gray-50">
      <body className="min-h-screen bg-gray-50 flex flex-col">
        <CartDataProvider>
          <CartUIProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartUIProvider>
        </CartDataProvider>
      </body>
    </html>
  );
}