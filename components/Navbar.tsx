"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBars, FaTimes } from "react-icons/fa";
import { SiImmich } from "react-icons/si";
import { SiPlex } from "react-icons/si";
import { SiHomeassistant } from "react-icons/si";
import { SiLetsencrypt } from "react-icons/si";
import { FaExclamation } from "react-icons/fa";
import VersionModal from "@/components/VersionModal";
import versionData from "@/data/versionData";
import styles from "./Navbar.module.css";

export interface NavbarHandle {
  openMenu: () => void;
}

const Navbar = forwardRef<NavbarHandle>(function Navbar(_props, ref) {
  const pathname = usePathname();

  const pages = [
    { name: "Task Management", href: "/tasks/" },
    { name: "Notification Manager", href: "/comingsoon/" },
    { name: "Pratt Drive", href: "/drive/" },
    { name: "Documentation", href: "/home/" },
    { name: "Print Center", href: "/comingsoon/" },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  useImperativeHandle(ref, () => ({
    openMenu: () => setMenuOpen(true),
  }));

  useEffect(() => {}, []);

  return (
    <>
      <nav className={styles.navbar}>
        {/* Left side - Retro Home Icon */}
        <Link href="/" className={styles.retroIcon}>
          <span className={styles.innerText}>PARADISE</span>
        </Link>

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
            className={styles.icon}
            onClick={() => setShowVersionModal(true)}
            style={{ cursor: "pointer" }}
          >
            <FaExclamation />
          </span>
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
});

export default Navbar;
