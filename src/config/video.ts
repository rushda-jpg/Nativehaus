// Single source of truth for the construction-reveal video asset. To
// swap in a higher-resolution replacement (e.g. the eventual 1920x1080
// version), replace the file at public/videos/ and update only this
// path — nothing else in the codebase hardcodes the clip's dimensions,
// frame count or duration; VideoReveal.tsx reads `duration` from the
// loaded element itself at runtime, so a different-length clip needs no
// other changes.
export const CONSTRUCTION_VIDEO_SRC = "/videos/native-haus-build-reveal.mp4";
