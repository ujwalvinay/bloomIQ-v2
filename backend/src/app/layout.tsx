import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BloomIQ API",
  description: "Plant care backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
