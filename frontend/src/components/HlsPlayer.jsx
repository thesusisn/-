import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function HlsPlayer({ src, poster }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls;
    if (Hls.isSupported()) {
      hls = new Hls({ liveSyncDurationCount: 3 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("hls.js error", data.type, data.details, data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
          }
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      controls
      autoPlay
      muted
      playsInline
      className="player"
    />
  );
}
