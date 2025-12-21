export function getBlurredCloudinaryUrl(originalUrl: string): string {
  // Insert transformation after /upload/
  return originalUrl.replace(
    "/upload/",
    "/upload/e_blur:800/"
  );
}
