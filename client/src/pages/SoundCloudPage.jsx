import React from "react";
import SoundCloudPlayer from "../components/SoundCloudPlayer";

const SoundCloudPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Audios de Meditación</h1>
      <SoundCloudPlayer />
    </div>
  );
};

export default SoundCloudPage;
