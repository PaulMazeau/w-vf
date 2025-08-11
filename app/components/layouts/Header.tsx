'use client';

import Image from "next/image";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 w-full z-40">
      <nav className="nav">
        <Image src="/logo.png" alt="logo" className="logo" width={150} height={60} />
        <a href="#" target="_blank" className="cart-link">
          <p>CART(0)</p>
        </a>
      </nav>
    </header>
  );
}
