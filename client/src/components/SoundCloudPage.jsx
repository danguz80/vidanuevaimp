import React from "react";

const SoundCloudPage = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Lista de reproducción: Meditación</h1>

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
    </div>
  );
};

export default SoundCloudPage;
