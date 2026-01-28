import './globals.css'

export const metadata = {
  title: 'Ooragai Originals Dashboard',
  description: 'Inventory and Order Management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
