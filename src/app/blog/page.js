"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import styles from "./blog.module.css";
import BlogTile from "@/components/BlogTile";
import blogs from "@/data/blogData";

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const router = useRouter();

  const categories = useMemo(
    () => [
      "Technology / Software",
      "Game Development",
      "Reviews",
      "Personal",
    ],
    []
  );

  const filteredBlogs = useMemo(() => {
    if (!selectedCategory) return blogs;
    return blogs.filter(
      (b) => Array.isArray(b.tags) && b.tags.includes(selectedCategory)
    );
  }, [selectedCategory]);

  return (
    <div className={styles.page}>
      <Navbar />
      <Background />
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h1 className={styles.title}>BLOG</h1>
        <div className={styles.ctas}>
          {categories.map((c) => (
            <div
              key={c}
              role="button"
              tabIndex={0}
              className={`${styles.navLink} ${
                selectedCategory === c ? styles.navActive : ""
              }`}
              onClick={() =>
                setSelectedCategory((s) => (s === c ? null : c))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  setSelectedCategory((s) => (s === c ? null : c));
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </motion.div>

      <section className={styles.list}>
        <div className={styles.grid}>
          {[...filteredBlogs]
            .sort((a, b) => new Date(b.date ?? b.id) - new Date(a.date ?? a.id))
            .map((b, i) => (
              <BlogTile
                key={b.id ?? b.title}
                blog={b}
                index={i}
                onClick={() => router.push(`/blog/${b.id}`)}
              />
            ))}
        </div>
      </section>
    </div>
  );
}
