let appInstance = null;
let loadError = null;

export default async function handler(req, res) {
  if (loadError) {
    return res.status(500).json({
      error: 'Module Load Failed',
      message: loadError.message,
      stack: loadError.stack
    });
  }

  try {
    if (!appInstance) {
      const appModule = await import('../server/app.js');
      appInstance = appModule.default;
    }
    return appInstance(req, res);
  } catch (err) {
    loadError = err;
    console.error('Serverless Execution Error:', err);
    return res.status(500).json({
      error: 'Serverless Execution Error',
      message: err.message,
      stack: err.stack
    });
  }
}
