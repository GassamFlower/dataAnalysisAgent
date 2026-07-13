/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 部署需要 standalone 输出
  output: 'standalone',
  // 后端 Python 服务地址，用于 API 代理（可选）
  // async rewrites() {
  //   return [
  //     { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
  //   ];
  // },
};

module.exports = nextConfig;
