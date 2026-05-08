"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ParticleBackground.module.css";

/**
 * No props — self-contained canvas component.
 * Renders an animated particle background behind Health Portal content.
 *
 * - Spawns particles with random positions, velocities, and sizes
 * - Draws connection lines between nearby particles
 * - Uses requestAnimationFrame loop; cancels on unmount
 * - Respects prefers-reduced-motion (static particles, no animation)
 * - Renders nothing on touch-only devices
 * - Reduces particle count on low-end devices (hardwareConcurrency <= 2)
 */
export default function ParticleBackground() {
  const canvasRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Touch-only device detection: has touch but no fine pointer
    const isTouchOnly =
      "ontouchstart" in window &&
      !window.matchMedia("(pointer: fine)").matches;

    if (isTouchOnly) {
      setShouldRender(false);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Determine particle count based on device capability
    const isLowEnd =
      typeof navigator.hardwareConcurrency === "number" &&
      navigator.hardwareConcurrency <= 2;
    const particleCount = isLowEnd ? 25 : 55;

    const CONNECTION_DISTANCE = 120;
    const PARTICLE_COLOR = "rgba(0, 229, 255,"; // cyan base, alpha appended
    const LINE_COLOR = "rgba(0, 229, 255, 0.08)";

    // Resize canvas to match window
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Create particles with random positions, velocities, and sizes
    function createParticles(count) {
      const particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
      return particles;
    }

    const particles = createParticles(particleCount);

    // Draw a single frame
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = 0.08 * (1 - dist / CONNECTION_DISTANCE);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${PARTICLE_COLOR} ${p.opacity})`;
        ctx.fill();
      }
    }

    // Update particle positions (wrap around edges)
    function update() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }
    }

    // If reduced motion is preferred, draw once (static) and stop
    if (prefersReducedMotion) {
      draw();
      return () => {
        window.removeEventListener("resize", resize);
      };
    }

    // Animation loop
    let animationId;
    function animate() {
      update();
      draw();
      animationId = requestAnimationFrame(animate);
    }
    animationId = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  );
}
