import React from "react";

const SoundCloudPlayer = () => {
  return (
    <div className="aspect-video mb-6">
      <iframe
        title="Playlist Meditación"
        width="100%"
        height="450"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/imp-templo-vida-nueva/sets/meditacion&color=%23ff5500&auto_play=false&show_artwork=true&show_comments=true&show_user=true&show_reposts=false"
      ></iframe>
    </div>
  );
};

export default SoundCloudPlayer;
