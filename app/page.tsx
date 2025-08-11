'use client';

import Image from "next/image";
import Carousel from "./components/Carousel";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <Image src="/logo.png" alt="logo" className="logo" width={150} height={60} />
        <a href="#" target="_blank" className="cart-link">
          <p>CART(0)</p>
        </a>
      </nav>
      <Carousel />
    </>
  );
}
