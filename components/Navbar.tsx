"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBars, FaTimes } from "react-icons/fa";
import { SiImmich } from "react-icons/si";
import { SiPlex } from "react-icons/si";
import { SiHomeassistant } from "react-icons/si";
import { SiLetsencrypt } from "react-icons/si";
import VersionModal from "@/components/VersionModal";
import versionData from "@/data/versionData";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const pages = [
    { name: "Projects", href: "/projects/" },
    { name: "Blog", href: "/blog/" },
    { name: "Resume", href: "/resume/" },
    { name: "About", href: "/about/" },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  useEffect(() => {}, []);

  return (
    <>
      <nav className={styles.navbar}>
        {/* Left side - Retro Home Icon */}
        <Link href="/" className={styles.retroIcon}>
          <span className={styles.innerText}>PARADISE</span>
        </Link>

        {/* Center Links for Desktop: Only show if not on the home page */}
        {pathname !== "/" && (
          <div className={styles.centerLinks}>
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={`${styles.navLink} ${pathname === page.href ? styles.activeNavLink : ""}`}
              >
                {page.name}
              </Link>
            ))}
          </div>
        )}

        {/* Right Side for Desktop: Social Icons & Version */}
        <div className={styles.socialsDesktop}>
          <a
            href={process.env.NEXT_PUBLIC_IMMICH_URL}
            target="_blank"
            className={styles.icon}
          >
            <SiImmich />
          </a>
          <a
            href={process.env.NEXT_PUBLIC_PLEX_URL}
            target="_blank"
            className={styles.icon}
          >
            <SiPlex />
          </a>
          <a
            href={process.env.NEXT_PUBLIC_HOME_ASSISTANT_URL}
            target="_blank"
            className={styles.icon}
          >
            <SiHomeassistant />
          </a>
          <a
            href={process.env.NEXT_PUBLIC_PROTECT_URL}
            target="_blank"
            className={styles.icon}
          >
            <SiLetsencrypt />
          </a>
          <span
            className={styles.version}
            onClick={() => setShowVersionModal(true)}
            style={{ cursor: "pointer" }}
          >
            {versionData[0]?.version || "v?.?.?"}
          </span>
        </div>

        {/* Mobile Controls: Version & Hamburger Icon */}
        <div className={styles.mobileControls}>
          <span
            className={styles.version}
            onClick={() => setShowVersionModal(true)}
            style={{ cursor: "pointer" }}
          >
            {versionData[0]?.version || "v?.?.?"}
          </span>
          <div
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </div>
        </div>

        {/* Mobile Pop-out Submenu */}
        {menuOpen && (
          <div className={styles.mobileMenu}>
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={`${styles.mobileNavLink} ${pathname === page.href ? styles.activeMobileNavLink : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                {page.name}
              </Link>
            ))}
            {/* Social Icons at the bottom of the mobile menu */}
            <div className={styles.mobileSocials}>
              <a
                href={process.env.NEXT_PUBLIC_IMMICH_URL}
                target="_blank"
                className={styles.icon}
              >
                <SiImmich />
              </a>
              <a
                href={process.env.NEXT_PUBLIC_PLEX_URL}
                target="_blank"
                className={styles.icon}
              >
                <SiPlex />
              </a>
              <a
                href={process.env.NEXT_PUBLIC_HOME_ASSISTANT_URL}
                target="_blank"
                className={styles.icon}
              >
                <SiHomeassistant />
              </a>
              <a
                href={process.env.NEXT_PUBLIC_PROTECT_URL}
                target="_blank"
                className={styles.icon}
              >
                <SiLetsencrypt />
              </a>
            </div>
          </div>
        )}
      </nav>
      {showVersionModal && (
        <VersionModal onClose={() => setShowVersionModal(false)} />
      )}
    </>
  );
}
