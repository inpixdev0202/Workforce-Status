export default function handler(request, response) {
  response.status(200).json({
    status: "ok",
    message: "Vercel Serverless Function (Integrated) is working correctly!",
    history: "Moved to client/api/ for better Vercel detection",
    timestamp: new Date().toISOString()
  });
}
