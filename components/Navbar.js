"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBars, FaTimes } from "react-icons/fa";
import { SiImmich } from "react-icons/si";
import { SiPlex } from "react-icons/si";
import { SiHomeassistant } from "react-icons/si";
import { SiLetsencrypt } from "react-icons/si";
import VersionModal from "@/components/VersionModal";
import NotificationIcon from "@/components/NotificationIcon";
import { useUnreadStatus } from "@/hooks/useUnreadStatus";
import versionData from "@/data/versionData";
import styles from "./Navbar.module.css";

const Navbar = forwardRef(function Navbar(_props, ref) {
  const pathname = usePathname();
  const { hasUnread } = useUnreadStatus();

  const pages = [
    { name: "Task Management", href: "/tasks/" },
    { name: "Notification Manager", href: "/notifications/manage" },
    { name: "Pratt Drive", href: "/drive/" },
    { name: "Documentation", href: "/home/" },
    { name: "Print Center", href: "/comingsoon/" },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  useImperativeHandle(ref, () => ({
    openMenu: () => setMenuOpen(true),
  }));

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
          <NotificationIcon hasUnread={hasUnread} />
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
              <NotificationIcon hasUnread={hasUnread} onClick={() => setMenuOpen(false)} />
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
