/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // keep native / ML packages out of the webpack bundle
    serverComponentsExternalPackages: ['chromadb', '@chroma-core/default-embed', 'onnxruntime-node', 'mysql2', 'ioredis'],
  },
};
export default nextConfig;
