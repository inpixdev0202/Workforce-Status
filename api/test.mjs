export default function handler(request, response) {
  response.status(200).json({
    status: "ok",
    message: "Vercel Serverless Function is working correctly!",
    timestamp: new Date().toISOString(),
    env_check: process.env.NODE_ENV
  });
}
