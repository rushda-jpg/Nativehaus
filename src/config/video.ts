// Single source of truth for the construction-reveal video asset and its
// two bridge stills (extracted via ffmpeg, not screenshots). To swap in
// a higher-resolution replacement (e.g. the eventual 1920x1080 version),
// replace the three files at public/assets/video/ — keeping the same
// filenames — and update these paths if the filenames change; nothing
// else in the codebase hardcodes the clip's dimensions, frame count or
// duration, and VideoReveal.tsx no longer scroll-scrubs currentTime.
export const CONSTRUCTION_VIDEO_SRC = "/assets/video/native-haus-build-reveal.mp4";

// The video's own first frame — shown as a plain <img> during the
// Mapbox->video crossfade (decoupling that crossfade from video load
// time entirely) and reused as the <video>'s `poster`, so there is
// nothing pixel-different for the viewer when the video element takes
// over from the static bridge image.
export const CONSTRUCTION_VIDEO_FIRST_FRAME = "/assets/video/native-haus-build-reveal-poster.jpg";

// The video's own last frame — crossfaded in once playback ends, so the
// completed building stays visible as a static image (used as the
// persistent backdrop for the hero text and the floor explorer) instead
// of the video disappearing into an empty background.
export const CONSTRUCTION_VIDEO_FINAL_FRAME = "/assets/video/native-haus-build-reveal-final.jpg";
