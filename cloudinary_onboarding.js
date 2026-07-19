#!/usr/bin/env node

const cloudinary = require("cloudinary").v2;

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: "hupinbau",
  api_key: "826682796636475",
  api_secret: "eYKhOrJUdnJqGcXSMaG-n4NinXk",
  secure: true
});

async function main() {
  try {
    const sampleImageUrl = "https://res.cloudinary.com/demo/image/upload/dog.jpg";
    console.log("Starting Cloudinary Onboarding flow...");
    console.log(`Uploading sample image: ${sampleImageUrl}`);

    // 2. Upload an image
    const uploadResult = await cloudinary.uploader.upload(sampleImageUrl, {
      folder: "onboarding_demo"
    });

    console.log("\n[Upload Success]");
    console.log("Secure URL: " + uploadResult.secure_url);
    console.log("Public ID: " + uploadResult.public_id);

    // 3. Get image details
    console.log("\n[Image Metadata]");
    console.log("- Width: " + uploadResult.width + "px");
    console.log("- Height: " + uploadResult.height + "px");
    console.log("- Format: " + uploadResult.format);
    console.log("- File Size: " + uploadResult.bytes + " bytes");

    // 4. Transform the image
    // fetch_format: 'auto' (f_auto) selects the best image format (e.g. AVIF/WebP) based on browser support.
    // quality: 'auto' (q_auto) optimizes visual compression balance to reduce byte size.
    const transformedUrl = cloudinary.url(uploadResult.public_id, {
      fetch_format: "auto",
      quality: "auto",
      secure: true
    });

    console.log("\nDone! Click link below to see optimized version of the image. Check the size and the format.");
    console.log(transformedUrl);

  } catch (err) {
    console.error("Onboarding script failed:", err);
  }
}

main();
