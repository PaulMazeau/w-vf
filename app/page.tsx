'use client';

import { useState } from "react";
import Image from "next/image";
import Carousel from "./components/Carousel";
import IntroAnimation from "./components/IntroAnimation";

export default function Home() {
  const [showCarousel, setShowCarousel] = useState(false);

  const handleAnimationComplete = () => {
    setShowCarousel(true);
  };

  return (
    <>      
      {!showCarousel ? (
        <IntroAnimation 
          onAnimationComplete={handleAnimationComplete}
          transitionColor="bg-red-500"
          images={5}
          imageSpeed={200}
          transitionDelay={1500}
        />
      ) : (
        <Carousel />
      )}
    </>
  );
}
