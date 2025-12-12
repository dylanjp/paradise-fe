"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaLinkedin, FaGithub, FaItchIo, FaBars, FaTimes } from "react-icons/fa";
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
        <span className={styles.innerText}>DJP</span>
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
        <a href="https://www.linkedin.com/in/dylanjohnpratt/" target="_blank" className={styles.icon}>
          <FaLinkedin />
        </a>
        <a href="https://github.com/dylanjp" target="_blank" className={styles.icon}>
          <FaGithub />
        </a>
        <a href="https://legendaryepics.itch.io/" target="_blank" className={styles.icon}>
          <FaItchIo />
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
        <div className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
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
            <a href="https://www.linkedin.com/in/dylanjohnpratt/" target="_blank" className={styles.icon}>
              <FaLinkedin />
            </a>
            <a href="https://github.com/dylanjp" target="_blank" className={styles.icon}>
              <FaGithub />
            </a>
            <a href="https://legendaryepics.itch.io/" target="_blank" className={styles.icon}>
              <FaItchIo />
            </a>
          </div>
        </div>
      )}
    </nav>
    {showVersionModal && <VersionModal onClose={() => setShowVersionModal(false)} />}
    </>
  );
}
