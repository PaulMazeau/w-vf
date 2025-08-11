'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface CarouselProps {
  imageNames?: string[];
  slideCount?: number;
  imagesCount?: number;
}

// Interface pour les données utilisateur des slides
interface SlideUserData {
  originalVertices: number[];
  index: number;
  targetPos: number;
  currentPos: number;
}

// Type pour les slides avec userData typé
type SlideWithUserData = THREE.Mesh & {
  userData: SlideUserData;
}

// Extension de Window pour les propriétés personnalisées
declare global {
  interface Window {
    scrollTimeout?: NodeJS.Timeout;
  }
}

export default function Carousel({ 
  imageNames = ["TRIPACK TEES BLACK", "WALONE HOODIE", "WALONE TEE", "WALONE HOODIE", "TRIPACK TEES WHITE"],
  slideCount = 10,
  imagesCount = 5
}: CarouselProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageNameRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Détection mobile
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent;
      const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobileDevice = mobileRegex.test(userAgent) || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !imageNameRef.current) return;

    const canvas = canvasRef.current;
    const imageNameElement = imageNameRef.current;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    
    // Position de la caméra adaptée selon le device
    if (isMobile) {
      camera.position.z = 6;
      camera.position.y = 0;
    } else {
      camera.position.z = 5;
    }

    const settings = {
      wheelSensitivity: 0.01,
      touchSensitivity: isMobile ? 0.015 : 0.01,
      momentumMultiplier: 2,
      smoothing: 0.1,
      slideLerp: 0.075,
      distortionDecay: 0.95,
      maxDistortion: 2.5,
      distortionSensitivity: 0.15,
      distortionSmoothing: 0.075,
    };

    const slideWidth = isMobile ? 2.5 : 3.0;
    const slideHeight = isMobile ? 1.25 : 1.5;
    const gap = isMobile ? 0.8 : 0.1;
    const slideUnit = isMobile ? slideHeight + gap : slideWidth + gap;
    const totalSize = slideCount * slideUnit;

    const slides: SlideWithUserData[] = [];
    let currentPosition = 0;
    let targetPosition = 0;
    let isScrolling = false;
    let autoScrollSpeed = 0;
    let lastTime = 0;
    let touchStartY = 0;
    let touchStartX = 0;
    let touchLastY = 0;
    let touchLastX = 0;

    let currentDistortionFactor = 0;
    let targetDistortionFactor = 0;
    let peakVelocity = 0;
    const velocityHistory = [0, 0, 0, 0, 0];

    let currentCenterImageIndex = 0;
    const snapStrength = 0.05;

    const correctImageColor = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    const createSlide = (index: number) => {
      const geometry = new THREE.PlaneGeometry(slideWidth, slideHeight, 32, 16);

      const colors = ["#FF5733", "#33FF57", "#3357FF", "#F3FF33", "#FF33F3"];
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors[index % colors.length]),
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material) as unknown as SlideWithUserData;
      
      // Position selon le device
      if (isMobile) {
        mesh.position.y = -index * (slideHeight + gap);
        mesh.position.x = 0;
      } else {
        mesh.position.x = index * (slideWidth + gap);
        mesh.position.y = 0;
      }
      
      mesh.userData = {
        originalVertices: [...geometry.attributes.position.array],
        index,
        targetPos: isMobile ? mesh.position.y : mesh.position.x,
        currentPos: isMobile ? mesh.position.y : mesh.position.x
      };

      const imageIndex = (index % imagesCount) + 1;
      const imagePath = `/img${imageIndex}.jpg`;

      new THREE.TextureLoader().load(
        imagePath,
        (texture) => {
          correctImageColor(texture);
          material.map = texture;
          material.color.set(0xffffff);
          material.needsUpdate = true;

          const imgAspect = texture.image.width / texture.image.height;
          const slideAspect = slideWidth / slideHeight;

          if (imgAspect > slideAspect) {
            mesh.scale.y = slideAspect / imgAspect;
          } else {
            mesh.scale.x = imgAspect / slideAspect;
          }
        },
        undefined,
        (err) => console.warn(`Couldn't load image ${imagePath}`, err)
      );

      scene.add(mesh);
      slides.push(mesh);
    };

    const applyScrollSnap = () => {
      const normalizedPosition = ((currentPosition % totalSize) + totalSize) % totalSize;
      const rawIndex = normalizedPosition / slideUnit;
      const nearestIndex = Math.round(rawIndex) % slideCount;
      const snapTargetPosition = nearestIndex * slideUnit;
      
      const currentNormalized = ((currentPosition % totalSize) + totalSize) % totalSize;
      const diff1 = snapTargetPosition - currentNormalized;
      const diff2 = diff1 + totalSize;
      const diff3 = diff1 - totalSize;
      
      const smallestDiff = [diff1, diff2, diff3].reduce((prev, curr) => 
        Math.abs(curr) < Math.abs(prev) ? curr : prev
      );
      
      const idealPosition = currentPosition + smallestDiff;
      const snapForce = (idealPosition - targetPosition) * snapStrength;
      targetPosition += snapForce;
    };

    const updateCenterImageName = () => {
      let closestSlide: SlideWithUserData | null = null;
      let minDistance = Infinity;

      slides.forEach((slide) => {
        const distance = isMobile ? Math.abs(slide.position.y) : Math.abs(slide.position.x);
        if (distance < minDistance) {
          minDistance = distance;
          closestSlide = slide;
        }
      });

      if (closestSlide) {
        const imageIndex = (closestSlide as SlideWithUserData).userData.index % imagesCount;
        if (currentCenterImageIndex !== imageIndex) {
          currentCenterImageIndex = imageIndex;
          imageNameElement.textContent = imageNames[imageIndex];
          
          imageNameElement.style.transform = "translate(-50%, -50%) scale(1.1)";
          setTimeout(() => {
            imageNameElement.style.transform = "translate(-50%, -50%) scale(1)";
          }, 150);
        }
      }
    };

    for (let i = 0; i < slideCount; i++) {
      createSlide(i);
    }

    slides.forEach((slide) => {
      if (isMobile) {
        slide.position.y += totalSize / 2;
        slide.userData.targetPos = slide.position.y;
        slide.userData.currentPos = slide.position.y;
      } else {
        slide.position.x -= totalSize / 2;
        slide.userData.targetPos = slide.position.x;
        slide.userData.currentPos = slide.position.x;
      }
    });

    const updateCurve = (mesh: SlideWithUserData, worldPosition: number, distortionFactor: number) => {
      const distortionCenter = new THREE.Vector2(0, 0);
      const distortionRadius = 2.0;
      const maxCurvature = settings.maxDistortion * distortionFactor;

      const positionAttribute = mesh.geometry.attributes.position;
      const originalVertices = mesh.userData.originalVertices;

      for (let i = 0; i < positionAttribute.count; i++) {
        const x = originalVertices[i * 3];
        const y = originalVertices[i * 3 + 1];

        let distFromCenter;
        if (isMobile) {
          const vertexWorldPosY = worldPosition + y;
          distFromCenter = Math.sqrt(
            Math.pow(x - distortionCenter.x, 2) +
              Math.pow(vertexWorldPosY - distortionCenter.y, 2)
          );
        } else {
          const vertexWorldPosX = worldPosition + x;
          distFromCenter = Math.sqrt(
            Math.pow(vertexWorldPosX - distortionCenter.x, 2) +
              Math.pow(y - distortionCenter.y, 2)
          );
        }

        const distortionStrength = Math.max(
          0,
          1 - distFromCenter / distortionRadius
        );
        const curveZ =
          Math.pow(Math.sin((distortionStrength * Math.PI) / 2), 1.5) *
          maxCurvature;

        positionAttribute.setZ(i, curveZ);
      }

      positionAttribute.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMobile) return; // Désactiver les touches sur mobile
      
      if (e.key === "ArrowLeft" || (isMobile && e.key === "ArrowUp")) {
        targetPosition += slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      } else if (e.key === "ArrowRight" || (isMobile && e.key === "ArrowDown")) {
        targetPosition -= slideUnit;
        targetDistortionFactor = Math.min(1.0, targetDistortionFactor + 0.3);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (isMobile) return; // Désactiver la molette sur mobile
      
      e.preventDefault();
      const wheelStrength = Math.abs(e.deltaY) * 0.001;
      targetDistortionFactor = Math.min(
        1.0,
        targetDistortionFactor + wheelStrength
      );

      targetPosition -= e.deltaY * settings.wheelSensitivity;
      isScrolling = true;
      autoScrollSpeed =
        Math.min(Math.abs(e.deltaY) * 0.0005, 0.05) * Math.sign(e.deltaY);

      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isMobile) {
        touchStartY = e.touches[0].clientY;
        touchLastY = touchStartY;
      } else {
        touchStartX = e.touches[0].clientX;
        touchLastX = touchStartX;
      }
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      
      if (isMobile) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchY - touchLastY;
        touchLastY = touchY;

        const touchStrength = Math.abs(deltaY) * 0.02;
        targetDistortionFactor = Math.min(
          1.0,
          targetDistortionFactor + touchStrength
        );

                 // Scroll naturel vers le bas/haut
         targetPosition -= deltaY * settings.touchSensitivity;
        isScrolling = true;
      } else {
        const touchX = e.touches[0].clientX;
        const deltaX = touchX - touchLastX;
        touchLastX = touchX;

        const touchStrength = Math.abs(deltaX) * 0.02;
        targetDistortionFactor = Math.min(
          1.0,
          targetDistortionFactor + touchStrength
        );

        targetPosition -= deltaX * settings.touchSensitivity;
        isScrolling = true;
      }
    };

          const handleTouchEnd = () => {
        let velocity;
        if (isMobile) {
          velocity = -(touchLastY - touchStartY) * 0.005;
        } else {
          velocity = (touchLastX - touchStartX) * 0.005;
        }
      
      if (Math.abs(velocity) > 0.5) {
        autoScrollSpeed = velocity * settings.momentumMultiplier * 0.05;
        targetDistortionFactor = Math.min(
          1.0,
          Math.abs(velocity) * 3 * settings.distortionSensitivity
        );
        isScrolling = true;
        setTimeout(() => {
          isScrolling = false;
        }, 800);
      }
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const animate = (time: number) => {
      requestAnimationFrame(animate);

      const deltaTime = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;

      const prevPos = currentPosition;

      if (isScrolling) {
        targetPosition += autoScrollSpeed;
        const speedBasedDecay = 0.97 - Math.abs(autoScrollSpeed) * 0.5;
        autoScrollSpeed *= Math.max(0.92, speedBasedDecay);

        if (Math.abs(autoScrollSpeed) < 0.001) {
          autoScrollSpeed = 0;
          isScrolling = false;
        }
      }

      applyScrollSnap();

      currentPosition += (targetPosition - currentPosition) * settings.smoothing;

      const currentVelocity = Math.abs(currentPosition - prevPos) / deltaTime;
      velocityHistory.push(currentVelocity);
      velocityHistory.shift();

      const avgVelocity =
        velocityHistory.reduce((sum, val) => sum + val, 0) / velocityHistory.length;

      if (avgVelocity > peakVelocity) {
        peakVelocity = avgVelocity;
      }

      const velocityRatio = avgVelocity / (peakVelocity + 0.001);
      const isDecelerating = velocityRatio < 0.7 && peakVelocity > 0.5;

      peakVelocity *= 0.99;

      const movementDistortion = Math.min(1.0, currentVelocity * 0.1);
      if (currentVelocity > 0.05) {
        targetDistortionFactor = Math.max(
          targetDistortionFactor,
          movementDistortion
        );
      }

      if (isDecelerating || avgVelocity < 0.2) {
        const decayRate = isDecelerating
          ? settings.distortionDecay
          : settings.distortionDecay * 0.9;
        targetDistortionFactor *= decayRate;
      }

      currentDistortionFactor +=
        (targetDistortionFactor - currentDistortionFactor) *
        settings.distortionSmoothing;

      slides.forEach((slide, i) => {
        let basePos;
        if (isMobile) {
          basePos = -i * slideUnit + currentPosition;
          basePos = ((basePos % totalSize) + totalSize) % totalSize;

          if (basePos > totalSize / 2) {
            basePos -= totalSize;
          }
        } else {
          basePos = i * slideUnit - currentPosition;
          basePos = ((basePos % totalSize) + totalSize) % totalSize;

          if (basePos > totalSize / 2) {
            basePos -= totalSize;
          }
        }

        const isWrapping =
          Math.abs(basePos - slide.userData.targetPos) > slideUnit * 2;
        if (isWrapping) {
          slide.userData.currentPos = basePos;
        }

        slide.userData.targetPos = basePos;
        slide.userData.currentPos +=
          (slide.userData.targetPos - slide.userData.currentPos) * settings.slideLerp;

        const wrapThreshold = totalSize / 2 + slideUnit;
        if (Math.abs(slide.userData.currentPos) < wrapThreshold * 1.5) {
          if (isMobile) {
            slide.position.y = slide.userData.currentPos;
            updateCurve(slide, slide.position.y, currentDistortionFactor);
          } else {
            slide.position.x = slide.userData.currentPos;
            updateCurve(slide, slide.position.x, currentDistortionFactor);
          }
        }
      });

      updateCenterImageName();
      renderer.render(scene, camera);
    };

    // Event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("resize", handleResize);

    animate(0);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("resize", handleResize);
      
      // Dispose of Three.js objects
      slides.forEach(slide => {
        scene.remove(slide);
        slide.geometry.dispose();
        if (slide.material instanceof THREE.Material) {
          slide.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [imageNames, slideCount, imagesCount, isMobile]);

  return (
    <>
      <div ref={imageNameRef} id="imageName" className="image-name">
        {imageNames[0]}
      </div>
      <canvas ref={canvasRef} id="canvas"></canvas>
    </>
  );
} 