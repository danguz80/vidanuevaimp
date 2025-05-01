import React from "react";

export default function Footer() {
  return (
    <footer className="bg-gray-100 py-6 text-center text-gray-600">
      <p>
        &copy; {new Date().getFullYear()} Iglesia Misión Pentecostés - Templo Vida Nueva
      </p>
    </footer>
  );
}
