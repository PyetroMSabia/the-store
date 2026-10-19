"use client";

import { useState } from "react";
import SafeImage from "./SafeImage";

export default function ProductGallery({ images = [], title = "", badges = null }) {
  const photoList = Array.isArray(images) && images.length > 0
    ? images.filter(Boolean)
    : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const currentImage = photoList[activeIndex] || photoList[0] || "";

  return (
    <div className="pd-gallery-container reveal">
      <div className="pd-media-wrapper">
        <SafeImage
          src={currentImage}
          alt={title}
          className="pd-main-img"
          style={{ width: "100%", height: "auto", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
        />
        {badges}
      </div>

      {photoList.length > 1 && (
        <div className="pd-thumbnails-row" role="tablist" aria-label="Fotos do produto">
          {photoList.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`pd-thumb-btn ${isActive ? "active" : ""}`}
                aria-selected={isActive}
                aria-label={`Ver foto ${idx + 1}`}
              >
                <SafeImage
                  src={img}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
