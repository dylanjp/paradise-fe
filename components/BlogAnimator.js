"use client";

import { useEffect, useRef } from "react";
import styles from "./blogPost.module.css";

export default function BlogAnimator({
  htmlContent,
  enableAnimation = true,
  durationMultiplier = 1, // 1 = Normal time. 2 = Double the time. (SLOWER)
  flickerIntervalMs = 1000, // 50ms (fast), 200ms (slow), 500ms (very slow).
}) {
  const articleRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    if (!enableAnimation) {
      root.classList.add(styles.decoded || "decoded");
      return;
    }

    const NOISE = "!<a>-_\\/g[]{a}-=+d*^'?#xb!<>g-_\\/d[]{}ys-=+*^?#_z".repeat(
      50,
    );

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (
          node.parentNode &&
          ["IFRAME", "SCRIPT", "STYLE"].includes(node.parentNode.nodeName)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return /\S/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const nodeData = [];
    while (walker.nextNode()) {
      const originalText = walker.currentNode.nodeValue;

      // Base calculation for a reasonable duration
      const baseDuration = Math.min(2000, 500 + originalText.length * 30);

      nodeData.push({
        node: walker.currentNode,
        originalText: originalText,
        length: originalText.length,
        delay: nodeData.length * 50 * durationMultiplier,
        duration: baseDuration * durationMultiplier,

        startTime: null,
      });
    }

    // Initial State: Set everything to fully scrambled text
    nodeData.forEach((data) => {
      data.node.nodeValue = NOISE.substring(0, data.length);
    });

    root.classList.remove(styles.initiallyHidden || "initiallyHidden");
    root.classList.add(styles.deciphering || "deciphering");

    let globalStartTime = null;

    const animate = (timestamp) => {
      if (!globalStartTime) globalStartTime = timestamp;

      let allComplete = true;
      const noiseOffset = Math.floor(timestamp / flickerIntervalMs) % 50;

      nodeData.forEach((data) => {
        if (!data.startTime) {
          if (timestamp - globalStartTime >= data.delay) {
            data.startTime = timestamp;
          } else {
            allComplete = false;
            if (timestamp - globalStartTime > 0) {
              data.node.nodeValue = NOISE.substring(
                noiseOffset,
                noiseOffset + data.length,
              );
            }
            return;
          }
        }

        const elapsed = timestamp - data.startTime;
        const progress = Math.min(elapsed / data.duration, 1);

        if (progress < 1) {
          allComplete = false;

          const revealCount = Math.floor(data.length * progress);
          const revealed = data.originalText.substring(0, revealCount);

          const remainingLen = data.length - revealCount;
          const scrambled = NOISE.substring(
            noiseOffset,
            noiseOffset + remainingLen,
          );

          data.node.nodeValue = revealed + scrambled;
        } else if (!data.isDone) {
          data.node.nodeValue = data.originalText;
          data.isDone = true;
        }
      });

      if (!allComplete) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        root.classList.remove(styles.deciphering || "deciphering");
        root.classList.add(styles.decoded || "decoded");
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      nodeData.forEach((data) => (data.node.nodeValue = data.originalText));
    };
  }, [htmlContent, enableAnimation, durationMultiplier, flickerIntervalMs]);

  return (
    <article
      ref={articleRef}
      className={`${styles.blogContent} ${styles.deciphering}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
