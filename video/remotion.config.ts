/**
 * Render configuration — 1920x1080 @ 30fps, high-quality H.264 MP4.
 */
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);            // visually lossless for flat UI/vector content
Config.setPixelFormat("yuv420p"); // maximum player compatibility
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
