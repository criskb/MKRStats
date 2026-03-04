import './globals.css';

export const metadata = {
  title: 'MKRStats',
  description: 'Brand analytics dashboard for 3D model marketplaces'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
