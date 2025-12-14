"use client";

import React from "react";
import { Animator } from "@arwes/react-animator";
import { Puffs } from "@arwes/react-bgs";

const Background = () => {
  return (
    <Animator active={true} duration={{ interval: 2 }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
          overflow: "hidden",
          background:
            "radial-gradient(circle, rgba(10,10,30,1) 20%, rgba(0,0,0,1) 80%)",
        }}
      >
        {/* Puffs Animation */}
        <Puffs color="hsla(180, 100%, 50%, 0.2)" quantity={30} />

        {/* Glowing Grid */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage:
              "linear-gradient(to top, rgba(255, 0, 255, 0.1), transparent), repeating-linear-gradient(0deg, rgba(0, 255, 255, 0.5) 0px, rgba(0, 255, 255, 0.5) 2px, transparent 2px, transparent 50px), repeating-linear-gradient(90deg, rgba(0, 255, 255, 0.5) 0px, rgba(0, 255, 255, 0.5) 2px, transparent 2px, transparent 50px)",
            backgroundSize: "100% 100%, 100% 100%, 100% 100%",
            opacity: 0.2,
          }}
        />
        {/* Keyframes for Animations */}
        <style>
          {`
            @keyframes moveLights {
              from { transform: translateX(0); }
              to { transform: translateX(-100vw); }
            }
          `}
        </style>
      </div>
    </Animator>
  );
};

export default Background;
