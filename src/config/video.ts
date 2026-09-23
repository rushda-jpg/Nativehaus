// Single source of truth for the construction-reveal video asset. To
// swap in a higher-resolution replacement (e.g. the eventual 1920x1080
// version), replace the files at public/assets/video/ — keeping the
// same filenames — and update these two paths if the filenames change;
// nothing else in the codebase hardcodes the clip's dimensions, frame
// count or duration. VideoReveal.tsx reads `duration` from the loaded
// element itself at runtime, and no longer scroll-scrubs currentTime,
// so a different-length clip needs no other changes.
export const CONSTRUCTION_VIDEO_SRC = "/assets/video/native-haus-build-reveal.mp4";

// The video's own first frame, extracted once (ffmpeg) and shown via
// the <video>'s `poster` attribute — avoids any black flash while the
// video itself is still loading/buffering.
export const CONSTRUCTION_VIDEO_POSTER = "/assets/video/native-haus-build-reveal-poster.jpg";
