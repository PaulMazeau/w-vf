'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface IntroAnimationProps {
  onAnimationComplete: () => void;
  transitionColor?: string;
  images?: number;
  imageSpeed?: number;
  transitionDelay?: number;
}

export default function IntroAnimation({
  onAnimationComplete,
  images = 6,
  imageSpeed = 200,
  transitionDelay = 1500
}: IntroAnimationProps) {
  const [currentImage, setCurrentImage] = useState(1);
  const [showFinalAnimation, setShowFinalAnimation] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const totalImages = images;
  
  useEffect(() => {
    // Animation des images
    const imageInterval = setInterval(() => {
      setCurrentImage((prev) => {
        const nextImage = (prev % totalImages) + 1;
        // Si on revient à la première image, on déclenche l'animation finale
        if (prev === totalImages && nextImage === 1) {
          setShowFinalAnimation(true);
          clearInterval(imageInterval);
        }
        return nextImage;
      });
    }, imageSpeed);
    
    return () => clearInterval(imageInterval);
  }, [totalImages, imageSpeed]);

  useEffect(() => {
    if (showFinalAnimation) {
      // Délai avant que le carré commence à s'agrandir
      const transitionTimer = setTimeout(() => {
        setAnimationComplete(true);
      }, transitionDelay);

      // Délai avant de déclencher la fin de l'animation
      const completeTimer = setTimeout(() => {
        onAnimationComplete();
      }, transitionDelay + 1000);

      return () => {
        clearTimeout(transitionTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [showFinalAnimation, transitionDelay, onAnimationComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white z-50">
      <div className="relative w-[600px] h-[600px] flex items-center justify-center">
        {Array.from({ length: totalImages }).map((_, index) => {
          const imageNumber = index + 1;
          return (
            <div 
              key={imageNumber} 
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
                currentImage === imageNumber && !showFinalAnimation ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image 
                src={`/img${imageNumber}.jpg`} 
                alt={`Image ${imageNumber}`} 
                width={600}
                height={600}
                className="object-cover"
                priority={imageNumber === 1}
              />
            </div>
          );
        })}
        
        {/* Carré de transition qui s'agrandit */}
        <div 
          className={`absolute bg-black transition-all duration-1500 ease-in-out ${
            !showFinalAnimation ? "opacity-0 scale-0" : 
            animationComplete ? "opacity-100 scale-[15]" : "opacity-100 scale-100"
          }`}
          style={{ width: "500px", height: "500px" }}
        />
        
        <Image 
          src="/logo.png" 
          alt="logo" 
          width={300} 
          height={300} 
          className={`mix-blend-color-burn absolute z-10 transition-opacity duration-500 ${
            animationComplete ? "opacity-0" : "opacity-100"
          }`}
        />
      </div>
    </div>
  );
} 